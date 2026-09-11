// SPDX-License-Identifier: AGPL-3.0-or-later
// HANDING A SEAT A DIFFERENT BODY.
//
// ⚠️ IT IS A SIMULATION ACT AND NOT AN INPUT ONE, and that is why it travels as a command. A replay must
// replay it: a recording where the seat silently stayed on the first forward would diverge from the match
// that was actually played, and the digest would report it as a physics drift.

import { firstOf, isKeeper, teamOf, type PlayerId } from './ids.ts';
import type { MatchState } from './state.ts';
import { onPitch } from './squads.ts';
import { dist2 } from './vec.ts';

/**
 * The body this seat should be given: the nearest of its own side to the ball.
 *
 * Excluded, and each for its own reason: the KEEPER, because a child who pressed switch and was handed the
 * goalkeeper has lost her outfield player and her goal at once; the body the OTHER seat is driving, because
 * two seats on one body is two children fighting over one pair of legs; and anybody not on the pitch.
 */
export function nextControlled(state: MatchState, seat: number): PlayerId | null {
  const me = state.controlled[seat];
  if (me === undefined) return null;

  const team = teamOf(me);
  const first = firstOf(team);
  const taken = state.controlled.filter((_, i) => i !== seat);

  let best: PlayerId | null = null;
  let bestD2 = Infinity;

  for (let k = 0; k < state.onPitch[team]; k++) {
    const id = first + k;
    if (id === me || isKeeper(id) || taken.includes(id) || !onPitch(state, id)) continue;
    const d2 = dist2(state.players[id].p, state.ball.p);
    if (d2 < bestD2) {
      bestD2 = d2;
      best = id;
    }
  }

  return best;
}

/**
 * Metres a rival must beat the sitting candidate by before the hint moves to him.
 *
 * ⚠️ THE KNEE OF A MEASURED CURVE, NOT A ROUND NUMBER. Six fixtures with the scripted child driving,
 * sweeping the margin and reading what it buys against what it costs:
 *
 *     margin   changes   flicker(<=3t)   median dwell   hint is not the nearest
 *      0.00 m      902         23.8%           40t              0.0%
 *      0.25 m      448          0.4%          158t              5.3%   <- here
 *      0.50 m      397          0.5%          185t              8.0%
 *      1.00 m      337          0.3%          190t             14.2%
 *      2.00 m      270          0.0%          235t             24.5%
 *
 * A quarter of a metre takes the flicker down sixty-fold. Everything past it buys nothing further and
 * costs correctness steadily - at two metres the hint names a body who is not the nearest a quarter of
 * the time, which is a different feature and a worse one.
 *
 * ⚠️ AND IT IS A QUARTER OF A METRE, WHICH IS LESS THAN A STRIDE. "He keeps the place unless somebody
 * beats him by less than half a step" is a sentence a person can check against what they see.
 */
export const HOLD_MARGIN = 0.25;

/**
 * Settle who each seat would be handed, and write it into the world.
 *
 * ⚠️ THE HINT IS THE ANSWER, AND THE SWITCH TAKES IT RATHER THAN RE-DERIVING ONE. That is the whole
 * promise of showing it: a marker naming a body the press then fails to hand her is worse than no marker,
 * because she would learn not to trust it - and an accommodation nobody trusts is an accommodation nobody
 * uses. One fact, in one place, read by the renderer, the mirror and `play`.
 *
 * ⚠️ AND THE SITTING BODY IS DEFENDED RATHER THAN RECOMPUTED. Without that, showing the answer would
 * only have revealed that the answer jitters: nearly a quarter of all changes lasted three ticks, because
 * two bodies equidistant to the centimetre swap every time the ball twitches.
 */
export function updateHints(state: MatchState): void {
  for (let seat = 0; seat < state.hinted.length; seat++) {
    const best = nextControlled(state, seat);
    if (best === null) {
      state.hinted[seat] = -1;
      continue;
    }

    const sitting = state.hinted[seat];
    // A body who has left the pitch, been taken by the other seat, or become the one she is driving is no
    // longer a candidate at all - `nextControlled` already refuses those, so agreeing with it is the test.
    const stillEligible = sitting >= 0 && sitting !== state.controlled[seat] && onPitch(state, sitting);
    if (!stillEligible) {
      state.hinted[seat] = best;
      continue;
    }

    const sittingD = Math.sqrt(dist2(state.players[sitting].p, state.ball.p));
    const bestD = Math.sqrt(dist2(state.players[best].p, state.ball.p));
    state.hinted[seat] = sittingD - bestD > HOLD_MARGIN ? best : sitting;
  }
}
