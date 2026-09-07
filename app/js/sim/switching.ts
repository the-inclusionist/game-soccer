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
