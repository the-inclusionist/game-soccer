// SPDX-License-Identifier: AGPL-3.0-or-later
// ONE TICK OF A MATCH. The seam between a simulation that knows no rules and a referee that moves nothing.
//
// ========================= WHY THE SEAM IS HERE AND NOT INSIDE `step` =========================
// `sim/step` integrates bodies and a ball and has no opinion about football. `rules/referee` reads a world
// and returns verdicts, and moves nothing. Neither knows about the other, which is what lets the referee
// be tested on hand-placed positions and the simulation be tested with no laws at all. This file is the
// only place that knows both, and it is twenty lines because that is all the seam is.
//
// ========================= THE ORDER, AND IT IS THE CONTRACT =========================
// move -> judge -> apply -> place. The restart is placed on the SAME tick the rule fires: otherwise there
// is one tick in which the phase says `throwIn` while the ball is still lying outside the pitch, and
// every consumer reading both would describe a world that is internally inconsistent.

import { evaluate, applyEvents, defenderOf } from './rules/referee.ts';
import { applyRestart } from './rules/restart.ts';
import { judgeTackle, type Foul } from './rules/foul.ts';
import { book, cardFor, RED } from './rules/cards.ts';
import type { RuleEvent } from './rules/events.ts';
import type { RulesProfile } from './rules/profile.ts';
import type { TickFrame } from './sim/command.ts';
import { teamOf, type TeamId } from './sim/ids.ts';
import { NOBODY } from './sim/possession.ts';
import { onPitch } from './sim/squads.ts';
import type { MatchState } from './sim/state.ts';
import { step } from './sim/step.ts';
import { applyStrike, strikeFor } from './sim/strike.ts';
import { nextControlled } from './sim/switching.ts';
import { challenger, decideKick, steerAll, think, type Skills } from './ai/brain.ts';
import { PITCH } from './sim/units.ts';

/**
 * A judged foul, as the event the rest of the game already knows how to read.
 *
 * ⚠️ `team` IS THE SIDE THAT WAS FOULED, not the offender. `rules/events` says the field is the side an
 * event is ABOUT, and it is what decides who takes the restart - about the offender, the kick would go to
 * the side that committed it.
 *
 * ⚠️ AND THE CARD IS APPLIED HERE rather than in `applyEvents`, because it is a fact about a PLAYER and
 * the event carries a team. Putting a player id on the event only for this would widen the type every
 * other consumer reads for the one that needs it.
 */
function foulEvents(state: MatchState, foul: Foul): RuleEvent[] {
  const offender = teamOf(foul.by);
  const fouled = (offender === 0 ? 1 : 0) as TeamId;

  const out: RuleEvent[] = [
    { kind: foul.inBox ? 'penaltyGiven' : 'foulGiven', team: fouled, at: foul.at },
  ];

  // ⚠️ THE WHISTLE FIRST AND THE CARD SECOND, because that is the order it happens in and therefore the
  //    order a child hears it. Reversed, she is told somebody was sent off before she is told there was a
  //    foul at all.
  const before = state.cards[foul.by] ?? 0;
  book(state, foul.by, cardFor(foul.severity));
  const after = state.cards[foul.by] ?? 0;

  // ⚠️ AND THE CARD NAMES THE OFFENDER'S SIDE - the OPPOSITE of the event above it. A kick is FOR
  //    somebody; a card is AGAINST somebody. Each event carries the side its own sentence needs, so
  //    neither reader has to remember which way round it goes.
  //
  // ⚠️ COMPARED BEFORE AND AFTER rather than derived from the severity, because a second booking is a
  //    RED: severity says 'reckless' and what actually happened was a sending-off. Asking the state what
  //    changed is the only version that gets that case right.
  if (after > before) {
    out.push({ kind: after >= RED ? 'sendingOff' : 'bookingGiven', team: offender, at: foul.at });
  }
  return out;
}

const STOPPED = new Set(['throwIn', 'corner', 'goalKick', 'freeKick', 'goal', 'halfTime', 'kickoff']);

/**
 * Phases in which the match is not being played at all.
 *
 * ⚠️ `fullTime` WAS MISSING AND THE WORLD KEPT RUNNING. The referee stops speaking once the phase leaves
 * `live`, so after the final whistle twenty-two bodies went on chasing a ball under no laws at all - the
 * clock counting, the AI deciding, nothing able to happen. A match that does not stop is not a match with
 * a quiet ending; it is a match with no ending.
 */
const OVER = new Set(['preMatch', 'fullTime']);

/** Who takes the restart this event awards. `-1` when the event awards none. */
function takerFor(event: RuleEvent, state: MatchState): TeamId | -1 {
  const end = (event.at?.x ?? 0) > PITCH.length / 2 ? 1 : 0;

  switch (event.kind) {
    case 'crossedTouchline': {
      // ⚠️ THE SIDE THAT DID NOT PUT IT OUT, and `lastTouch` is the only thing that knows. With nobody
      //    having touched it - the very first ball of a match - the throw goes home, which is arbitrary
      //    and written down rather than left to whatever `teamOf(-1)` happens to return.
      const toucher = state.possession.lastTouch;
      if (toucher === NOBODY) return 0;
      return (1 - teamOf(toucher)) as TeamId;
    }
    case 'crossedGoalLineByDefender':
      return (1 - defenderOf(end, state.period)) as TeamId;
    case 'crossedGoalLineByAttacker':
      return defenderOf(end, state.period);
    case 'offsideGiven':
      return (1 - (event.team ?? 0)) as TeamId;

    // ⚠️ READ STRAIGHT OFF THE EVENT, and NOT flipped like offside. An offside is given AGAINST the
    //    side named on it; a foul is given TO the side named on it, because `foulEvent` puts the fouled
    //    side there. Two events, two readings, and the difference is on the event rather than in a rule
    //    somebody has to remember.
    case 'foulGiven':
    case 'penaltyGiven':
      return (event.team ?? 0) as TeamId;
    case 'goalScored':
      // The side that conceded kicks off.
      return (1 - (event.team ?? 0)) as TeamId;
    default:
      return -1;
  }
}

/**
 * Advance the match by one tick.
 *
 * Returns what the referee said, for the four consumers that need it: the narration, the sound layer, the
 * announcement channel and any test. The phase and the score have already been applied.
 */
export function playTick(
  state: MatchState,
  frame: TickFrame,
  dt: number,
  profile: RulesProfile,
  skills?: Skills,
): RuleEvent[] {
  if (OVER.has(state.phase)) return [];
  if (STOPPED.has(state.phase)) return awaitingRestart(state, frame, dt, profile, skills);

  // ⚠️ THINK, THEN MOVE, THEN STRIKE. The order is the contract: a kick decided BEFORE the bodies move
  //    would be aimed from where everybody used to be, and at 60Hz that is a metre of lie per tick.
  if (skills !== undefined) think(state, skills, profile.playable);

  step(state, frame, dt, steerAll(state));

  // ⚠️ A CHILD'S VERB BEATS THE AI'S, and the order is how that is enforced rather than hoped for. If the
  //    AI struck first, a seat's shot would be silently discarded on exactly the ticks where the two
  //    disagree - which is every tick that matters.
  // ⚠️ SWITCHING IS APPLIED BEFORE THE STRIKES, so a seat that switched and shot on the same tick shoots
  //    with the body it just took. The other order would fire the old body's shot and then hand her a new
  //    one, which is the single most confusing thing a control can do.
  for (const cmd of frame.cmds) {
    if (cmd.verb !== 'switch') continue;
    const next = nextControlled(state, cmd.seat);
    if (next !== null) state.controlled[cmd.seat] = next;
  }

  let struck = false;
  const fouls: RuleEvent[] = [];
  for (const cmd of frame.cmds) {
    const strike = strikeFor(state, cmd, state.controlled[cmd.seat]);
    if (strike === null) {
      // ⚠️ THIS BRANCH USED TO BE `continue`, AND THAT WAS THE WHOLE HOLE. A tackle out of reach of the
      //    ball produced nothing: the lunge cost the child nothing at all. A foul is not a fact about the
      //    world - the same two bodies in the same two places are a foul if she lunged and nothing if she
      //    did not - so `evaluate`, which reads the world a tick later, could never have found it. It is
      //    judged HERE, where the act is, and joins the referee's list as an event like any other.
      if (cmd.verb === 'tackle') {
        const who = state.controlled[cmd.seat];
        const foul = who === undefined ? null : judgeTackle(state, who, profile);
        if (foul !== null) fouls.push(...foulEvents(state, foul));
      }
      continue;
    }
    applyStrike(state, strike);
    struck = true;
    break; // one ball
  }

  // ⚠️ AND THE MACHINE IS JUDGED BY THE SAME FUNCTION. Until this ran, a foul was only ever judged for
  //    a command from a SEAT - so a child could be booked and sent off, and the eleven players she was
  //    playing against could not. A law that applies to one side of the pitch, and the side it applied to
  //    was hers.
  if (skills !== undefined) {
    for (const team of [0, 1] as const) {
      const who = challenger(state, team);
      if (who === null) continue;
      const foul = judgeTackle(state, who, profile);
      if (foul !== null) fouls.push(...foulEvents(state, foul));
    }
  }

  if (skills !== undefined && !struck) {
    const kick = decideKick(state, profile.playable);
    if (kick !== null) {
      state.ball.v = { x: kick.vx, y: kick.vy, z: kick.vz };
      state.ball.grounded = false;
      state.possession.holder = NOBODY;
      state.possession.lastTouch = kick.id;
    }
  }

  // The foul comes FIRST: it stopped play, so nothing the referee would have said about the world after
  // it is true any more - a ball that went out on the same tick went out after the whistle.
  const events = fouls.length > 0 ? fouls : evaluate(state, profile);
  if (events.length === 0) return events;

  applyEvents(state, events, profile);

  for (const event of events) {
    const taker = takerFor(event, state);
    if (taker === -1) continue;
    state.restartTaker = taker;
    applyRestart(state, event);
    break; // one ball, one placement: a tick that is both a throw-in and half time restarts once
  }

  return events;
}

/**
 * Play is stopped. The ball is already on its spot; nothing moves until the taker touches it.
 *
 * ⚠️ AND THAT WAIT IS THE ACCESSIBILITY AFFORDANCE, not a missing feature. A dead ball gives a child
 * using switch scanning all the time in the world to decide, which is WCAG 2.2.1 met by the shape of the
 * game rather than by a setting somebody has to find in a menu.
 */
function awaitingRestart(
  state: MatchState,
  frame: TickFrame,
  dt: number,
  profile: RulesProfile,
  skills?: Skills,
): RuleEvent[] {
  // ⚠️ THE BODIES STILL MOVE, AND THAT WAS A DEADLOCK BEFORE THEY DID. With play stopped nothing ran at
  //    all, so nobody ever walked to the spot, so the restart was never taken - a goal was scored and the
  //    match sat on the celebration for the remaining ninety seconds. Football does the same thing: at a
  //    dead ball the ball waits and the players reposition.
  if (skills !== undefined) {
    think(state, skills, profile.playable);
    step(state, frame, dt, steerAll(state), false);
  }

  const taker = state.restartTaker;
  if (taker === -1) return [];

  const near = nearestToBall(state);
  if (near === NOBODY || teamOf(near) !== taker) return [];

  // ⚠️ A KICKOFF ANSWERS A DIFFERENT EVENT FROM EVERY OTHER RESTART, and missing that wedged the match:
  //    after a goal the phase walked `goal -> kickoff` on `restartTaken`, and then sat there forever
  //    because `kickoff` only leaves on `ballMoved`. One restart, two names, and the phase table is where
  //    that fact lives rather than in anybody's head.
  const kind = state.phase === 'kickoff' ? 'ballMoved' : 'restartTaken';
  const events: RuleEvent[] = [{ kind, team: taker }];
  applyEvents(state, events, profile);
  state.possession.lastTouch = near;

  // The owner survives a `goal -> kickoff` step, because the side that conceded is also the side that
  // kicks off. It is released only when the ball is actually in play again.
  if (state.phase === 'live') state.restartTaker = -1;
  return events;
}

/** Who is standing on the ball. Index order, so an exact tie goes to the lower index. */
function nearestToBall(state: MatchState): number {
  let best = NOBODY;
  let bestD2 = 1;
  for (let i = 0; i < state.players.length; i++) {
    if (!onPitch(state, i)) continue;
    const dx = state.players[i].p.x - state.ball.p.x;
    const dy = state.players[i].p.y - state.ball.p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  }
  return best;
}
