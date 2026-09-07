// SPDX-License-Identifier: AGPL-3.0-or-later
// WHO HAS THE BALL. And, separately, who touched it last.

import type { PlayerId } from './ids.ts';
import type { MatchState } from './state.ts';
import { onPitch } from './squads.ts';
import { dist2 } from './vec.ts';

/** No player. `-1` rather than `null` so the field is a number everywhere, including in the digest. */
export const NOBODY = -1;

/**
 * Metres. A player controls the ball inside this radius.
 *
 * ⚠️ IT WILL BECOME A FUNCTION OF THE `control` RATING, and the constant is the rating at 0.5. Ratings
 * apply at the POINT OF ACTION rather than by branching the logic, so this becomes `0.7 + 0.4 * control`
 * and nothing else in this file changes.
 */
export const CONTROL_R = 0.9;

/** Metres. Above this the ball is in the air and nobody is dribbling it - it can only be headed. */
export const MAX_CONTROL_HEIGHT = 1.2;

/**
 * Ticks between touches while dribbling. About a third of a second, which is a footballer's stride.
 *
 * ⚠️ A DRIBBLE IS A SERIES OF TOUCHES, NOT GLUE, and the difference is the whole defensive half of the
 * game. A ball welded to the carrier can never be tackled, never intercepted and never run away from him;
 * between touches this one rolls free, which is what makes defending possible at all. Reading the cadence
 * off the tick rather than off a counter keeps it a pure function of the state, so a replay reproduces
 * every touch.
 */
export const TOUCH_PERIOD = 21;

/** How much faster than the carrier the ball is knocked. Under 1 and he would kick it into his own feet. */
const TOUCH_GAIN = 1.25;

/**
 * Metres. How much closer a rival must be before he takes the ball off the current carrier.
 *
 * ⚠️ WITHOUT THIS THE BALL GOES NOWHERE, and it was measured rather than predicted: two forwards
 * converging on the centre spot swapped possession every tick, each knocking the ball back the way the
 * other had just knocked it, and a six-thousand-tick match ended two metres from the kickoff. The margin
 * is also exactly what shielding is - a carrier with his body between the ball and an opponent keeps it -
 * so the fix and the football turn out to be the same thing.
 */
const SHIELD_MARGIN = 0.35;

export interface Possession {
  /** Who is dribbling right now, or `NOBODY`. */
  holder: PlayerId;
  /**
   * Who touched it last, and it OUTLIVES the holder. A corner and a goal kick are the same event told
   * apart by this one fact, and it is asked after the ball has already gone out - when `holder` is
   * necessarily `NOBODY`.
   */
  lastTouch: PlayerId;
}

export function createPossession(): Possession {
  return { holder: NOBODY, lastTouch: NOBODY };
}

/**
 * Decide who, if anyone, has the ball this tick.
 *
 * One pass over the squads in index order, keeping the smallest squared distance and the smallest index
 * on a tie. No sort: a comparator's tie-breaking would silently become part of the simulation's
 * determinism, and nothing would say so.
 */
export function resolvePossession(state: MatchState): void {
  const { ball, players, possession } = state;

  if (ball.p.z >= MAX_CONTROL_HEIGHT) {
    possession.holder = NOBODY;
    return;
  }

  const reach = CONTROL_R * CONTROL_R;
  let best = NOBODY;
  let bestD2 = reach;

  for (let i = 0; i < players.length; i++) {
    if (!onPitch(state, i)) continue;
    const d2 = dist2(players[i].p, ball.p);
    // Strictly nearer, so an exact tie leaves `best` on the LOWER index that got there first.
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  }

  // The carrier shields: he keeps the ball unless the challenger is CLEARLY closer. Compared in metres
  // rather than in squared metres, because a margin in squared units would mean different things at
  // different distances - and this margin is a body's width, which does not change with range.
  const held = possession.holder;
  if (held !== NOBODY && held !== best) {
    const heldD2 = dist2(players[held].p, ball.p);
    if (heldD2 < reach && Math.sqrt(heldD2) - Math.sqrt(bestD2) < SHIELD_MARGIN) best = held;
  }

  // ⚠️ TAKING THE BALL IS ITSELF A TOUCH, and leaving that out was a defect with a strange symptom: a
  //    player who won the ball and ran lost it again within a third of a second, every time. The cadence
  //    is counted on the global tick, so somebody who gained possession at tick 5 had to wait until tick 21
  //    for his first touch - and by then he had outrun a ball that had not moved. Football has no such
  //    gap: the first thing a player does with the ball is touch it.
  const gained = best !== possession.holder;
  possession.holder = best;
  if (best === NOBODY) return;

  possession.lastTouch = best;
  if (!gained && state.tick % TOUCH_PERIOD !== 0) return;

  // The touch. A carrier standing still SHIELDS the ball instead of knocking it away, which falls out of
  // using his own velocity rather than his facing: no speed, no touch, and no special case to write.
  const carrier = players[best];
  ball.v.x = carrier.v.x * TOUCH_GAIN;
  ball.v.y = carrier.v.y * TOUCH_GAIN;
  ball.grounded = true;
}
