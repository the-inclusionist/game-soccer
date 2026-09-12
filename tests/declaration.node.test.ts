// SPDX-License-Identifier: AGPL-3.0-or-later
// THE EIGHT FIELDS - and this file is the most valuable one in the repository.
//
// ========================= WHAT THE DECLARATION BUYS =========================
// Answering eight questions gets this game a screen reader, spatial sonar, high contrast by semantic
// role, switch scanning and Libras without writing a line of any of them. That is ADR-0030's claim, and
// football is where it is hardest to believe: a quiz is a list, a 2048 board is a grid, and this is
// twenty-two bodies moving continuously.
//
// ========================= WHAT IT PAYS BACK =========================
// `continuous` is the engine's THIRD topology preset ever - `hotspots` came from the quiz, `grid` from
// the 2048. A preset only stops being a hypothesis when a consumer exercises it, so the value of this
// file is as much to the engine as to the game.
//
// WARNING: THE DECLARATION OBSERVES AND OWNS NOTHING. Every field is a function because the answer
// changes each tick, and holding a copy of the world here would create the second version of the truth
// that diverges on the first restart.
import { describe, expect, it } from 'vitest';
import { conformanceProblems, distance } from '@the-inclusionist/engine/core/contract.js';
import { createDeclaration, type Observed } from '../app/js/declaration.ts';
import { createMatchState } from '../app/js/sim/state.ts';
import { MATCH_PROFILE, PRACTICE_PROFILE } from '../app/js/rules/profile.ts';
import { HOME, SQUAD_SIZE } from '../app/js/sim/ids.ts';
import { PACE_M, PITCH } from '../app/js/sim/units.ts';
import { NOBODY } from '../app/js/sim/possession.ts';
import type { MatchPhase } from '../app/js/rules/phase.ts';
import { CHARGE_MODES } from '../app/js/input/charge.ts';
import { playTick } from '../app/js/play.ts';
import { emptyFrame } from '../app/js/sim/command.ts';
import { DT } from '../app/js/sim/ball.ts';
import { withPeriod } from '../app/js/rules/profile.ts';
import { CLUBS } from '../app/js/teams/roster.ts';
import { onPitch } from '../app/js/sim/squads.ts';
import { firstOf } from '../app/js/sim/ids.ts';

/** The five-minute school match, which is the game the Dev settled on. */
const SWEEP_PROFILE = withPeriod(MATCH_PROFILE, 5);

/** A `t` that RETURNS ITS KEY, so a test can measure which key was asked for and catch a raw literal. */
const keyEcho = (key: string) => 't:' + key;

function observing(overrides: Partial<Observed> = {}) {
  const state = createMatchState();
  state.phase = 'live';
  const o: Observed = {
    state: () => state,
    profile: () => MATCH_PROFILE,
    ourTeam: () => HOME,
    controlledBy: (seat: number) => (seat === 0 ? 9 : 10),
    t: keyEcho,
    charge: () => 'hold',
    ...overrides,
  };
  return { o, state, d: createDeclaration(o) };
}

describe('conformance', () => {
  it('[Interface] the declaration is well formed in EVERY phase of a match', () => {
    const phases: MatchPhase[] = [
      'preMatch',
      'kickoff',
      'live',
      'throwIn',
      'corner',
      'goalKick',
      'freeKick',
      'goal',
      'halfTime',
      'fullTime',
    ];

    for (const phase of phases) {
      const { state, d } = observing();
      state.phase = phase;
      expect(conformanceProblems(d), phase).toEqual([]);
    }
  });
});

describe('field 1 - topology', () => {
  it('[Right] the pitch is declared in METRES, and one unit is one PACE', () => {
    const { d } = observing();

    expect(d.topology()).toEqual({
      kind: 'continuous',
      size: [PITCH.length, PITCH.width],
      unit: PACE_M,
      move: 'free',
      frame: 'compass',
    });
  });

  it('[Right] so the engine distance comes back in PACES, which is what a blind child counts', () => {
    const { d } = observing();
    const t = d.topology();

    // Twelve metres apart is eight paces, and the screen reader adds no arithmetic of its own.
    expect(distance(t, { x: 10, y: 20 }, { x: 22, y: 20 })).toBeCloseTo(8, 10);
  });

  // WARNING: THE ADR-0084 GATE. `topology` became a function because a cached one goes stale in silence;
  // the practice pitch is half a pitch, chosen at runtime, so this game is a consumer that would break.
  it('[Right] the practice pitch is a DIFFERENT topology from the same declaration', () => {
    let profile = MATCH_PROFILE;
    const { d } = observing({ profile: () => profile });

    const match = d.topology();
    profile = PRACTICE_PROFILE;
    const practice = d.topology();

    // Narrowed by `kind` rather than cast: a cast would compile against a `hotspots` topology too, and
    // the day this game declared one by mistake the test would still be green.
    expect(practice).not.toEqual(match);
    if (match.kind !== 'continuous' || practice.kind !== 'continuous') {
      throw new Error('a pitch is a continuous space');
    }
    expect(practice.size[0]).toBeLessThan(match.size[0]);
  });
});

describe('field 2 - world', () => {
  it('[Interface] names the element that IS the pitch, and declares it rather than defaulting', () => {
    const { d } = observing();

    expect(d.world()).toEqual({ kind: 'element', selector: '#pitch' });
  });
});

describe('field 3 - tick', () => {
  it('[Right] a clock-run match belongs to the clock; a pitch with no clock belongs to the player', () => {
    expect(createDeclaration(observing().o).tick).toBe('clock');
    expect(createDeclaration(observing({ profile: () => PRACTICE_PROFILE }).o).tick).toBe('player');
  });
});

describe('field 4 - roleAt', () => {
  it('[Right] when we do NOT have the ball, the BALL is what the round asks for', () => {
    const { state, d } = observing();
    state.possession.holder = NOBODY;

    expect(d.roleAt({ x: state.ball.p.x, y: state.ball.p.y })).toBe('goal');
  });

  it('[Right] when we DO have it, the opponents goal mouth is what the round asks for', () => {
    const { state, d } = observing();
    state.possession.holder = 9;

    expect(d.roleAt({ x: PITCH.length, y: PITCH.width / 2 })).toBe('goal');
    expect(d.roleAt({ x: state.ball.p.x, y: state.ball.p.y })).not.toBe('goal');
  });

  // WARNING: THE ROW WORTH THE WHOLE FILE. High contrast paints by ROLE, so declaring the offside band as
  // a `gate` gives a low-vision child a visibly tinted offside zone - out of the contract, with no code in
  // this game and no code in the engine.
  it('[Right] the ground beyond the offside line is a GATE - barred until a condition holds', () => {
    const { state, d } = observing();
    state.possession.holder = 9;
    for (let i = SQUAD_SIZE; i < SQUAD_SIZE * 2; i++) state.players[i].p = { x: 60, y: 28 };

    expect(d.roleAt({ x: 75, y: 28 })).toBe('gate');
    expect(d.roleAt({ x: 50, y: 28 })).not.toBe('gate');
  });

  it('[Zero] open grass is free, and the ground off the pitch is structure', () => {
    const { state, d } = observing();
    state.possession.holder = 9;
    state.ball.p = { x: 20, y: 10, z: 0 };

    expect(d.roleAt({ x: 30, y: 40 })).toBe('free');
    expect(d.roleAt({ x: -5, y: 40 })).toBe('structure');
  });

  it('[Interface] it never claims a role this game has no such thing as', () => {
    const { d } = observing();
    const forbidden = ['water', 'climb', 'key'];
    const seen = new Set<string>();

    for (let x = 0; x <= PITCH.length; x += 3) {
      for (let y = 0; y <= PITCH.width; y += 3) seen.add(d.roleAt({ x, y }));
    }

    expect([...seen].filter((r) => forbidden.includes(r))).toEqual([]);
  });
});

describe('field 5 - nameAt', () => {
  it('[Right] the ball is feminine and the goal is masculine, so agreement is right in pt-BR', () => {
    const { state, d } = observing();
    const ball = d.nameAt({ x: state.ball.p.x, y: state.ball.p.y });
    const goal = d.nameAt({ x: PITCH.length, y: PITCH.width / 2 });

    expect(ball).toMatchObject({ gender: 'f' });
    expect(goal).toMatchObject({ gender: 'm' });
  });

  it('[Interface] every name goes through the dictionary - no raw literal reaches a child', () => {
    const { state, d } = observing();
    const spots = [
      { x: state.ball.p.x, y: state.ball.p.y },
      { x: PITCH.length, y: PITCH.width / 2 },
      { x: state.players[3].p.x, y: state.players[3].p.y },
    ];

    for (const at of spots) {
      const name = d.nameAt(at);
      expect(name).not.toBeNull();
      expect(name?.text.startsWith('t:')).toBe(true);
    }
  });

  it('[Zero] open grass has no name, and null is the honest answer', () => {
    const { state, d } = observing();
    state.ball.p = { x: 5, y: 5, z: 0 };

    expect(d.nameAt({ x: 45, y: 40 })).toBeNull();
  });
});

describe('field 6 - focusOf', () => {
  it('[Right] the focus is the body this seat drives, where it is, facing where it faces', () => {
    const { state, d } = observing();
    state.players[9].p = { x: 33, y: 21 };
    state.players[9].facing = { x: 1, y: 0 };

    expect(d.focusOf(0)).toEqual({ id: 'p9', at: { x: 33, y: 21 }, heading: 'e' });
  });

  it('[Zero] before the match starts nobody has the focus', () => {
    const { state, d } = observing();
    state.phase = 'preMatch';

    expect(d.focusOf(0)).toBeNull();
  });
});

describe('field 7 - objectiveOf', () => {
  it('[Right] the round asks for one more goal than the opponent has', () => {
    const { state, d } = observing();
    state.goals = [1, 2];

    expect(d.objectiveOf(0)).toMatchObject({ have: 1, need: 3 });
  });

  it('[Boundary] while ahead, the objective is already met rather than a moving target', () => {
    const { state, d } = observing();
    state.goals = [3, 1];

    expect(d.objectiveOf(0)).toMatchObject({ have: 3, need: 3 });
  });
});

describe('field 8 - targetsOf', () => {
  it('[Right] without the ball, the one target is the ball', () => {
    const { state, d } = observing();
    state.possession.holder = NOBODY;

    expect(d.targetsOf(0)).toEqual([{ x: state.ball.p.x, y: state.ball.p.y }]);
  });

  // WARNING: A SONAR THAT BEEPS TEN TIMES SAYS NOTHING. The quiz recorded a sonar that was "correct and
  // useless"; ten team-mates would be the same failure wearing a different shape.
  it('[Boundary] carrying the ball, never more than four targets', () => {
    const { state, d } = observing();
    state.possession.holder = 9;

    expect(d.targetsOf(0).length).toBeLessThanOrEqual(4);
  });

  // ⚠️ AND "NEVER" WAS GATED ON ONE HAND-PLACED STATE. The gate above sets a carrier, asks once, and is
  // named `never more than four` - which is a claim about every state a match can reach, answered by the
  // single state the test happened to build. The bound is the highest-leverage decision in this design
  // (a sonar that beeps ten times says nothing), and it is the sonar of a child who cannot see the pitch,
  // so it is worth asking of football rather than of a fixture.
  //
  // So this one plays a real five-minute match with nobody driving and asks the declaration on EVERY tick,
  // through every phase, restart, booking and change of ends. Deterministic - no clock and no `random`
  // under `sim/`, `rules/` or `ai/` - so it is a repeatable measurement, not a soak.
  //
  // ⚠️ THE SEAT FOLLOWS AN ON-PITCH MAN, because that is what a seat is. A sent-off player is switched
  // away from by the boot, so pinning the seat to a fixed id would sweep a state the game prevents and
  // report a defect that is not one.
  it('[Many] and "never" means every tick of a whole match, not one arranged state', () => {
    const state = createMatchState(SWEEP_PROFILE);
    state.phase = 'live';
    const sides = { 0: CLUBS[0].ratings, 1: CLUBS[1].ratings };
    // ⚠️ THE SEAT FOLLOWS THE BALL WHEN WE HAVE IT, and the first version of this sweep did not - it took
    // the first on-pitch home player, which in a 4-4-2 is the GOALKEEPER. He is never the carrier, so
    // every one of twelve thousand ticks took the off-the-ball branch and the sweep reported a worst case
    // of ONE. A maximum of one is impossible if the branch being measured had ever run; the ceiling was
    // green because nothing came near it, and the sweep would have certified a bound it never tested.
    const ours = () => {
      const holder = state.possession.holder;
      if (holder !== NOBODY && holder >= firstOf(HOME) && holder < firstOf(HOME) + SQUAD_SIZE) {
        if (onPitch(state, holder)) return holder;
      }
      for (let i = 1; i < SQUAD_SIZE; i++) {
        const id = firstOf(HOME) + i;
        if (onPitch(state, id)) return id;
      }
      return firstOf(HOME);
    };
    const d = createDeclaration({
      state: () => state,
      profile: () => SWEEP_PROFILE,
      ourTeam: () => HOME,
      controlledBy: () => ours(),
      t: keyEcho,
      charge: () => 'hold',
    });

    let worst = 0;
    let asked = 0;
    // ⚠️ THE LOOP RECORDS AND THE ASSERTIONS COME AFTER, and the first version of this gate did the
    // opposite - twelve thousand `expect` calls inside the loop. Alone it ran in 1.4 s; under the full
    // `validate`, with the browser project transforming beside it, it passed the node project's five-second
    // ceiling and was KILLED while healthy. That is the third arithmetic impossibility this repository has
    // built into a wait and the first one in a testTimeout: a deadline a correct test cannot meet under
    // load is not a deadline, it is a flake with a stack trace. Recording the first offender keeps the
    // tick and the phase in the failure message, which is the only thing the per-tick `expect` bought.
    let tooMany: string | null = null;
    let offTheNumberLine: string | null = null;
    const phaseNow = (): string => state.phase;

    for (let tick = 0; tick < 40_000 && phaseNow() !== 'fullTime'; tick++) {
      playTick(state, emptyFrame(tick), DT, SWEEP_PROFILE, sides);
      const spots = d.targetsOf(0);
      asked += 1;
      if (spots.length > worst) worst = spots.length;
      if (spots.length > 4 && tooMany === null) {
        tooMany = `${String(spots.length)} targets on tick ${String(tick)} in ${phaseNow()}`;
      }
      // A NaN coordinate is the silent version of the same failure: the sonar pans to nowhere and says
      // nothing, with no gate anywhere reporting a wrong number.
      for (const s of spots) {
        if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) {
          offTheNumberLine ??= `spot (${String(s.x)}, ${String(s.y)}) on tick ${String(tick)}`;
        }
      }
    }

    expect(tooMany, 'the sonar offered more than a child can hold').toBe(null);
    expect(offTheNumberLine, 'a target that is not a place').toBe(null);

    // The match has to have actually been played, or the sweep measured an empty loop.
    expect(phaseNow()).toBe('fullTime');
    expect(asked).toBeGreaterThan(10_000);
    // ⚠️ MEASURED 2026-09-11: THE CEILING OF FOUR IS NEVER REACHED - the most football ever offers is
    // THREE. That is not a slack bound, it is the attack diagnosis arriving from the accessibility side:
    // `receiverFor` refuses all but a fraction of its candidates, so a carrier rarely has three legal open
    // team-mates AND the goal at once. The ceiling gate was green because nothing came near it.
    expect(worst).toBeLessThanOrEqual(4);

    // ⚠️ AND THIS IS THE ASSERTION WITH TEETH, because it is the one a child feels. A sonar that offers
    // exactly one thing is not a choice - it is an instruction, and the whole claim of `targetsOf` is that
    // a child who cannot see the pitch sweeps it, hears two or three distinct directions, picks one and
    // passes. If the passing game degrades to a single option this goes red and says so HERE, in the
    // accessibility register, rather than as a moved average in a band table.
    //
    // ⚠️ AND IT IS DELIBERATELY NOT `toBe(3)`. An exact measurement of a played match is a golden trail
    // wearing a gate's clothes: it goes red whenever the AI is legitimately retuned, gets re-blessed, and
    // carries a real regression through in the re-blessing. The floor is the requirement; three is the
    // observation, and it belongs in this comment.
    expect(worst, 'the sonar never offered a choice - only one option, all match').toBeGreaterThanOrEqual(2);
    // ⚠️ AND THE CEILING IS DECLARED, GENEROUSLY, for the one thing a deadline is good for: a match that
    // never reaches full time would otherwise hang the suite. `tests/helpers/ticks` argues this at length
    // for the browser - a backstop against a stopped loop, far too long to be the thing that fires first.
  }, 120_000);

  // WARNING: THE DEFENDERS ARE PARKED OFF THE PASSING LINE ON PURPOSE, and it took a surviving mutation
  // to find out why it matters. With them standing between carrier and receiver, the pass was already
  // being rejected for a blocked lane - so deleting the offside filter changed nothing and the test still
  // passed. A test that is green for the wrong reason is worse than a missing one: it reports coverage it
  // does not have. Moved wide, the lane is clear and the ONLY thing that can exclude him is offside.
  it('[Right] an OFFSIDE team-mate is never offered as a pass, even down a clear lane', () => {
    const { state, d } = observing();
    state.possession.holder = 9;
    state.ball.p = { x: 50, y: 28, z: 0 };
    // Scatter FIRST, then place the two bodies that matter: the loop would otherwise walk over the
    // carrier it was set before, and the test would be measuring a pass from the wrong place.
    for (let i = 0; i < SQUAD_SIZE; i++) state.players[i].p = { x: 5, y: 5 };
    for (let i = SQUAD_SIZE; i < SQUAD_SIZE * 2; i++) state.players[i].p = { x: 55, y: 52 };
    state.players[9].p = { x: 50, y: 28 };
    state.players[5].p = { x: 80, y: 30 };

    const targets = d.targetsOf(0);

    expect(targets).not.toContainEqual({ x: 80, y: 30 });
  });

  it('[Right] and an ONSIDE team-mate down that same clear lane IS offered', () => {
    const { state, d } = observing();
    state.possession.holder = 9;
    state.ball.p = { x: 50, y: 28, z: 0 };
    for (let i = 0; i < SQUAD_SIZE; i++) state.players[i].p = { x: 5, y: 5 };
    for (let i = SQUAD_SIZE; i < SQUAD_SIZE * 2; i++) state.players[i].p = { x: 85, y: 52 };
    state.players[9].p = { x: 50, y: 28 };
    state.players[5].p = { x: 80, y: 30 };

    expect(d.targetsOf(0)).toContainEqual({ x: 80, y: 30 });
  });

  it('[Zero] with the ball dead against us, the honest answer is nothing at all', () => {
    const { state, d } = observing();
    state.phase = 'throwIn';
    state.possession.lastTouch = 4; // one of ours put it out, so it is their throw

    expect(d.targetsOf(0)).toEqual([]);
  });
});

// ========================= HOW MANY FINGERS THIS GAME ASKS FOR =========================
// `holdsAtOnce` arrived MANDATORY in engine 8.0 (ADR-0104), and the mandatoriness is the decision: an
// optional field is answered by silence, and here silence decides for the child - decided by whoever did
// not think about it. It is a different axis from "how many actions", which is why the engine had a blind
// spot where the warning never fired: a game can declare nine reachable actions and still need three
// fingers at once, and on a two-finger phone a child simply cannot, with nothing anywhere saying why.
describe('how many positions this game holds at once', () => {
  it('[Right] four with the holding charge: a diagonal run, sprint, and a kick being charged', () => {
    expect(observing({ charge: () => 'hold' }).d.holdsAtOnce()).toBe(4);
  });

  // ⚠️ AND THIS IS THE ASSERTION THAT MAKES OUR ACCESSIBILITY WORK LEGIBLE TO THE ENGINE. The stepped
  //    route was built so a child who cannot hold a key can still pick the power of a pass: each press
  //    adds a step and a pause fires it. That removes a HELD position, so it removes a finger - and the
  //    engine's device-reach check is the thing that reads this number. Until now the accommodation was
  //    real and invisible to every consumer of the declaration.
  it('[Right] three with either latched route, because the kick stops being a hold', () => {
    expect(observing({ charge: () => 'latch-stepped' }).d.holdsAtOnce()).toBe(3);
    expect(observing({ charge: () => 'latch-timed' }).d.holdsAtOnce()).toBe(3);
  });

  // ⚠️ THE CHORD DOES NOT RAISE IT, and the reason is a rule this repository already wrote down: an
  //    acorde with no latched equivalent is a conformance failure, so the lofted through ball is reachable
  //    by single presses. A verb that has a one-switch route cannot be what sets the finger count.
  it('[Boundary] the R1+R2 chord does not raise the count, because it has a latched equivalent', () => {
    expect(observing({ charge: () => 'latch-stepped' }).d.holdsAtOnce()).toBeLessThan(
      observing({ charge: () => 'hold' }).d.holdsAtOnce(),
    );
  });

  // ⚠️ AND WHETHER ANYTHING IS HELD AT ALL IS A SEPARATE QUESTION, which is the finding that produced
  //    the field (their ADR-0115). `holdsAtOnce` counts SIMULTANEOUS positions and refuses zero, so a quiz
  //    answers 1 while holding nothing whatsoever - "one at a time" and "one HELD" are the same number, and
  //    every decision downstream was reading a number that answers the other question. The cost lands on a
  //    child who cannot keep a key pressed: she turns on the toggle her play depends on, and in a game that
  //    holds nothing it does nothing. She learns the adjustment is broken. That is the dead button.
  it('[Right] this game does hold keys, and the answer does not move with the charge route', () => {
    // ⚠️ TRUE IN ALL THREE, AND THAT IS THE POINT OF ASSERTING IT ROUTE BY ROUTE. The stepped route
    //    takes the hold out of the KICK, which is why `holdsAtOnce` drops by one - but running is a held
    //    direction in every route this game has, and sprint is a hold by definition. A version of this
    //    that tracked `holdsAtOnce` down to "false" would hand a child the toggle and no reason for it.
    for (const mode of CHARGE_MODES) {
      expect(observing({ charge: () => mode }).d.seguraTeclas(), `${mode} says nothing is held`).toBe(true);
    }
  });

  it('[Interface] it is a positive whole number in every charge route', () => {
    for (const mode of CHARGE_MODES) {
      const n = observing({ charge: () => mode }).d.holdsAtOnce();
      expect(Number.isInteger(n), `${mode} is not a whole number of fingers`).toBe(true);
      expect(n, `${mode} asks for no fingers at all`).toBeGreaterThan(0);
    }
  });
});
