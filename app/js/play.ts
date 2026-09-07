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
import { decideKick, steerAll, think, type Skills } from './ai/brain.ts';
import { PITCH } from './sim/units.ts';

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
  for (const cmd of frame.cmds) {
    const strike = strikeFor(state, cmd, state.controlled[cmd.seat]);
    if (strike === null) continue;
    applyStrike(state, strike);
    struck = true;
    break; // one ball
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

  const events = evaluate(state, profile);
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
