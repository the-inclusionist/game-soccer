// SPDX-License-Identifier: AGPL-3.0-or-later
// WHO THINKS THIS TICK. One division, and it is what makes the game run in a classroom.
//
// Twenty-two agents deciding every tick is twenty-two decisions per tick. Spread over six ticks it is
// under four, and nothing on screen changes: a footballer does not re-plan sixty times a second, and the
// steering that carries him to the cached point DOES run every tick, so the movement stays smooth.
//
// ⚠️ A PURE FUNCTION OF THE TICK, never of a counter or a timer. A schedule that advanced on its own
// would be state outside the state, invisible to the digest and unreproducible in a replay.

import type { PlayerId } from '../sim/ids.ts';

/** Ticks between one agent's decisions. Six at 60Hz is 10Hz per agent. */
export const THINK_PERIOD = 6;

export function thinksThisTick(id: PlayerId, tick: number): boolean {
  return (tick + id) % THINK_PERIOD === 0;
}
