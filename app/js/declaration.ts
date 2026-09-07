// SPDX-License-Identifier: AGPL-3.0-or-later
// THE EIGHT FIELDS - the only thing the engine's accessibility stack knows about this game.
//
// ========================= WHAT THIS FILE BUYS =========================
// By answering eight questions the game gets a screen reader, spatial sonar, high contrast by semantic
// role, switch scanning and Libras without writing a line of any of them. It is the product of ADR-0027
// and ADR-0030, and it is the reason for an engine to exist rather than "another 2D renderer".
//
// ========================= AND WHAT IT PAYS BACK =========================
// `continuous` is the engine's THIRD topology preset. `hotspots` came from the quiz - a list with no
// space in it at all - and `grid` came from the 2048, where distance and neighbourhood exist but are
// counted in cells. A pitch has neither cells nor a list: it has metres, twenty-two moving bodies, and a
// ball. If eight fields can describe that, ADR-0030's claim survives its hardest case.
//
// ========================= NO STATE OF ITS OWN, DELIBERATELY =========================
// This module OBSERVES. Every field is a function because the answer changes every tick, and whoever owns
// the state is whoever plays. Keeping a copy here would create the second version of the truth that
// diverges on the first restart.

import type {
  Focus,
  GameDeclaration,
  Objective,
  Role,
  Speakable,
  Spot,
  Topology,
  WorldScope,
} from '@the-inclusionist/engine/core/contract.js';
import { offsideMask } from './rules/offside.ts';
import type { RulesProfile } from './rules/profile.ts';
import { firstOf, shirtOf, teamOf, type PlayerId, type TeamId } from './sim/ids.ts';
import { onPitch, squadIds } from './sim/squads.ts';
import { headingOf } from './sim/heading.ts';
import { NOBODY } from './sim/possession.ts';
import type { MatchState } from './sim/state.ts';
import { BALL, GOAL, PACE_M, PITCH } from './sim/units.ts';
import { dist2, len2 } from './sim/vec.ts';

/** What the declaration needs to ASK the game. Nothing beyond this, and nothing that writes. */
export interface Observed {
  state(): MatchState;
  profile(): RulesProfile;
  /** The side the human seats play for. Both seats share it: the default two-seat mode is co-operative. */
  ourTeam(): TeamId;
  /** Which body a seat is driving. */
  controlledBy(seat: number): PlayerId;
  /** The engine's `t()`, INJECTED - a test passes a `t` that returns its key and measures which was asked. */
  t(key: string): string;
}

/** Metres. Within this of a spot, the spot IS that thing - the ball, a body, the goal mouth. */
const NAMED_RADIUS = 1.0;

/** Metres. A pass is only offered if no opponent stands this close to the line it would travel. */
const LANE_CLEARANCE = 1.2;

/** Metres. Beyond this a shot is not on, so the goal is not offered as a target. */
const SHOOTING_RANGE = 25;

/** The sonar answers what is actionable NOW, and that is never more than a handful of places. */
const MAX_TARGETS = 4;

const spotOf = (p: { x: number; y: number }): Spot => ({ x: p.x, y: p.y });

export function createDeclaration(o: Observed): GameDeclaration {
  /** +1 if our side attacks increasing `x`. Ends swap at half time, so it is derived and never stored. */
  const ourDir = (): 1 | -1 => {
    const home = o.ourTeam() === 0;
    const firstPeriod = o.state().period === 1;
    return home === firstPeriod ? 1 : -1;
  };

  const goalMouth = (dir: 1 | -1): Spot => ({
    x: dir === 1 ? PITCH.length : 0,
    y: PITCH.width / 2,
  });

  const ourIds = (): PlayerId[] => squadIds(o.state(), o.ourTeam());
  const theirIds = (): PlayerId[] => squadIds(o.state(), (1 - o.ourTeam()) as TeamId);

  const weHaveIt = (): boolean => {
    const holder = o.state().possession.holder;
    return holder !== NOBODY && teamOf(holder) === o.ourTeam();
  };

  /**
   * The line beyond which a team-mate would be offside: the deeper of the ball and the second-last
   * opponent. It is computed here rather than reused from `offsideMask` because that function answers
   * about PLAYERS and this answers about GROUND - the high-contrast layer paints ground.
   */
  const offsideLine = (): number => {
    const dir = ourDir();
    const state = o.state();

    let last = -Infinity;
    let second = -Infinity;
    for (const id of theirIds()) {
      const along = state.players[id].p.x * dir;
      if (along > last) {
        second = last;
        last = along;
      } else if (along > second) {
        second = along;
      }
    }

    const ballAlong = state.ball.p.x * dir;
    return (second > ballAlong ? second : ballAlong) * dir;
  };

  const nearestBody = (at: Spot): PlayerId => {
    const state = o.state();
    let best = NOBODY;
    let bestD2 = NAMED_RADIUS * NAMED_RADIUS;
    for (let i = 0; i < state.players.length; i++) {
      if (!onPitch(state, i)) continue;
      const d2 = dist2(state.players[i].p, at);
      if (d2 < bestD2) {
        bestD2 = d2;
        best = i;
      }
    }
    return best;
  };

  const isBall = (at: Spot): boolean =>
    dist2(o.state().ball.p, at) < NAMED_RADIUS * NAMED_RADIUS;

  const isGoalMouth = (at: Spot): boolean => {
    const halfMouth = GOAL.width / 2;
    const onALine = at.x <= BALL.radius || at.x >= PITCH.length - BALL.radius;
    return onALine && Math.abs(at.y - PITCH.width / 2) <= halfMouth;
  };

  const offPitch = (at: Spot): boolean =>
    at.x < 0 || at.x > PITCH.length || at.y < 0 || at.y > PITCH.width;

  /** Distance from `p` to the segment `a`-`b`, squared. No trigonometry, no `hypot`. */
  const segmentD2 = (p: Spot, a: Spot, b: Spot): number => {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const ab2 = abx * abx + aby * aby;
    if (ab2 === 0) return dist2(p, a);
    let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / ab2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return dist2(p, { x: a.x + abx * t, y: a.y + aby * t });
  };

  const laneIsClear = (from: Spot, to: Spot): boolean => {
    const state = o.state();
    const limit = LANE_CLEARANCE * LANE_CLEARANCE;
    for (const id of theirIds()) {
      if (segmentD2(state.players[id].p, from, to) < limit) return false;
    }
    return true;
  };

  /** Is the ball dead in a phase that will restart with the OTHER side putting it back in play? */
  const deadAgainstUs = (): boolean => {
    const state = o.state();
    const restarting =
      state.phase === 'throwIn' ||
      state.phase === 'corner' ||
      state.phase === 'goalKick' ||
      state.phase === 'freeKick';
    if (!restarting) return false;
    const toucher = state.possession.lastTouch;
    return toucher !== NOBODY && teamOf(toucher) === o.ourTeam();
  };

  return {
    // 1 - TOPOLOGY, IN METRES, WITH A PACE AS THE UNIT.
    //
    //     `unit` is not a scale factor. The engine's `distance()` divides by it and its own comment says
    //     the result is "how many steps, not how many pixels" - so `unit` is literally the thing the
    //     narration counts in. A blind child needs "the ball is eight paces to your right"; she does not
    //     need 6.4 metres and she certainly does not need 51 pixels.
    //
    //     A FUNCTION, and it earns it: the practice pitch is half a pitch, chosen at runtime (ADR-0084).
    topology(): Topology {
      // The area IN PLAY, which the profile owns. A practice session uses half a pitch, so the space the
      // sonar measures and the paces the screen reader counts shrink with it - and a cached topology
      // would go on describing the match after the mode changed, in silence. ADR-0084.
      const playable = o.profile().playable;
      return {
        kind: 'continuous',
        size: [playable.length, playable.width],
        unit: PACE_M,
        // ⚠️ `free` IS THE METRIC AND NOT A PREFERENCE. A pitch has no cells and no lanes: the distance
        //    between two points is the straight line between them (L2), which is what the sonar must
        //    count in. Declaring `orthogonal` would have it announce a diagonal run as the sum of two
        //    sides of a triangle, which is a number no child could act on.
        move: 'free',
        // ⚠️ `compass` BECAUSE THE CAMERA LOOKS DOWN. The projection is an affine squash of the ground
        //    plane - a high tele, not a side view - so up the screen is up the PITCH and not up into the
        //    air. A `clock` frame would make the screen reader describe a lofted ball as "to the north".
        frame: 'compass',
      };
    },

    // 2 - WHICH ELEMENT IS THE WORLD. Declared, never defaulted: blindfold chess is the proof that a game
    //     without a visible space is not a game where empathy makes no sense.
    world(): WorldScope {
      return { kind: 'element', selector: '#pitch' };
    },

    // 3 - WHOSE TICK. A running clock owns a match; a practice pitch has no clock, so the child does, and
    //     WCAG 2.2.1 is satisfied there by construction rather than by an option in a menu.
    tick: o.profile().clock === 'count' ? 'clock' : 'player',

    // 4 - SEMANTIC ROLE, and this is where high contrast gets its colours.
    //
    //     Read from OUR side's point of view, because `roleAt` takes no player and both seats are on the
    //     same side. What the round asks for changes with possession: without the ball, the ball IS the
    //     objective; with it, the goal is.
    //
    //     ⚠️ THE `gate` ROW IS THE ONE TO BE PROUD OF. High contrast paints by role, so declaring the
    //     offside band as a gate - "barred until a condition holds", which is exactly what offside is -
    //     hands a low-vision child a visibly tinted offside zone for free, with no code in this game and
    //     no code in the engine. No commercial football game ships that.
    roleAt(at: Spot): Role {
      if (offPitch(at)) return 'structure';

      const dir = ourDir();
      if (weHaveIt()) {
        if (isGoalMouth(at) && at.x * dir > 0) return 'goal';
      } else if (isBall(at)) {
        return 'goal';
      }

      if (isGoalMouth(at)) return 'structure';

      const line = offsideLine();
      const beyond = at.x * dir > line * dir;
      const inTheirHalf = at.x * dir > (PITCH.length / 2) * dir;
      if (beyond && inTheirHalf) return 'gate';

      return 'free';
    },

    // 5 - A SPEAKABLE NAME. The same datum the screen reader says and Libras translates.
    //
    //     ⚠️ THE SHIRT NUMBER TRAVELS AS A PARAMETER, NOT AS A KEY. A number is a number in every
    //     language; sending it through the dictionary would create eleven keys to translate a digit. The
    //     frame lives in the key and the content passes through - the same rule the 2048 applied to a tile.
    nameAt(at: Spot): Speakable | null {
      if (isBall(at)) return { text: o.t('name.ball'), gender: 'f', plural: false };
      if (isGoalMouth(at)) return { text: o.t('name.goal'), gender: 'm', plural: false };

      const who = nearestBody(at);
      if (who === NOBODY) return null;

      const mine = teamOf(who) === o.ourTeam();
      const key = mine ? 'name.teammate' : 'name.opponent';
      return { text: o.t(key) + ' ' + shirtOf(who), gender: 'm', plural: false };
    },

    // 6 - WHO HAS THE FOCUS. The body this seat drives, and where it points - what the cane and the
    //     scanning need to know. `null` before the whistle, which is the truth rather than a filler value.
    focusOf(seat: number): Focus | null {
      const state = o.state();
      if (state.phase === 'preMatch' || state.phase === 'fullTime') return null;

      const who = o.controlledBy(seat);
      const body = state.players[who];
      if (body === undefined) return null;

      return { id: 'p' + who, at: spotOf(body.p), heading: headingOf(body.facing) };
    },

    // 7 - WHAT THE ROUND ASKS FOR, and the HUD frame is `{have} de {need} {nome}`.
    //
    //     `need` is one more than the opponent has, so it reads "1 de 2 gols" while losing and "3 de 3"
    //     while ahead. Both are true statements about what the round asks RIGHT NOW, and the second is
    //     honest rather than a treadmill: a `need` of `have + 1` forever would be the compulsion loop
    //     ADR-0006 forbids, and a fixed target would be a lie, because football has none.
    objectiveOf(seat: number): Objective {
      void seat;
      const state = o.state();
      const us = o.ourTeam();
      const ours = state.goals[us];
      const theirs = state.goals[1 - us];
      return {
        name: { text: o.t('objective.goals'), gender: 'm', plural: true },
        have: ours,
        need: theirs + 1 > ours ? theirs + 1 : ours,
      };
    },

    // 8 - WHERE THE TARGETS ARE. The half the sonar uses, and the highest-leverage decision in the game.
    //
    //     The 2048's lesson was that `targetsOf` must answer the MECHANIC, not decorate. For a child
    //     holding the ball the mechanic is one question - where do I put it next - so the answer is the
    //     open receivers and, if it is on, the goal.
    //
    //     ⚠️ NEVER ALL TEN TEAM-MATES. That is the quiz's "correct and useless" failure wearing another
    //     shape: a sonar that beeps ten times says nothing. At most four spots, and each one actionable
    //     this instant.
    targetsOf(seat: number): readonly Spot[] {
      const state = o.state();
      if (deadAgainstUs()) return [];

      if (!weHaveIt()) return [spotOf(state.ball.p)];

      const dir = ourDir();
      const me = o.controlledBy(seat);
      const carrier = state.possession.holder;

      if (carrier !== me) {
        // Off the ball, the target is the space to run into: ahead of me, toward their goal, and only
        // while that space is legal. Invisible even to sighted players, and it is the whole of movement
        // without the ball.
        const ahead: Spot = {
          x: state.players[me].p.x + dir * 8,
          y: state.players[me].p.y,
        };
        if (offPitch(ahead)) return [];
        return ahead.x * dir > offsideLine() * dir ? [] : [ahead];
      }

      const from = spotOf(state.players[carrier].p);
      const mask = offsideMask({
        attackers: ourIds().map((id) => state.players[id].p.x),
        defenders: theirIds().map((id) => state.players[id].p.x),
        ball: state.ball.p.x,
        passer: carrier - firstOf(o.ourTeam()),
        dir,
        halfwayX: PITCH.length / 2,
      });

      const options: { at: Spot; d2: number }[] = [];
      for (const id of ourIds()) {
        if (id === carrier) continue;
        if ((mask & (1 << (id - firstOf(o.ourTeam())))) !== 0) continue;
        const at = spotOf(state.players[id].p);
        if (!laneIsClear(from, at)) continue;
        options.push({ at, d2: dist2(from, at) });
      }

      // Nearest first, ties by the order the squad is walked, which is index order - deterministic by
      // construction rather than by a comparator somebody has to remember to make stable.
      options.sort((a, b) => a.d2 - b.d2);
      const targets = options.slice(0, MAX_TARGETS - 1).map((c) => c.at);

      const mouth = goalMouth(dir);
      const shotOn =
        len2({ x: mouth.x - from.x, y: mouth.y - from.y }) < SHOOTING_RANGE * SHOOTING_RANGE &&
        laneIsClear(from, mouth);
      if (shotOn) targets.push(mouth);

      return targets;
    },
  };
}
