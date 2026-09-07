// SPDX-License-Identifier: AGPL-3.0-or-later
// WHO HAS THE BALL. And, separately, who touched it last.

import { teamOf, type PlayerId } from './ids.ts';
import type { SideCaps } from './body.ts';
import type { MatchState } from './state.ts';
import { onPitch } from './squads.ts';
import { dist2 } from './vec.ts';

/** No player. `-1` rather than `null` so the field is a number everywhere, including in the digest. */
export const NOBODY = -1;

/**
 * Metres. A player controls the ball inside this radius, when nobody has said otherwise.
 *
 * ⚠️ IT PROMISED TO BECOME A FUNCTION OF `control` AND NOW IT HAS, and the promise was kept in the shape
 * it was made in: *"ratings apply at the POINT OF ACTION rather than by branching the logic, so this
 * becomes `0.7 + 0.4 * control` and nothing else in this file changes."* The arithmetic lives in
 * `ai/ratings.controlRadiusOf`; this file receives the ANSWER, so it still knows nothing about clubs.
 *
 * ⚠️ AND IT IS EXACTLY `controlRadiusOf(0.5)`. A default that did not match the middle of the scale would
 * mean every gate driving the simulation without clubs described a different world from the game, and the
 * symptom would have been golden replays quietly ceasing to match.
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
 * Metres. How much closer a rival must be before he takes the ball off the current carrier, when nobody
 * has said otherwise. It is `tackleMarginOf(0.5)` exactly - see `ai/ratings`.
 *
 * ⚠️ WITHOUT THIS THE BALL GOES NOWHERE, and it was measured rather than predicted: two forwards
 * converging on the centre spot swapped possession every tick, each knocking the ball back the way the
 * other had just knocked it, and a six-thousand-tick match ended two metres from the kickoff. The margin
 * is also exactly what shielding is - a carrier with his body between the ball and an opponent keeps it -
 * so the fix and the football turn out to be the same thing.
 */
export const SHIELD_MARGIN = 0.35;

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
export function resolvePossession(state: MatchState, sides?: readonly [SideCaps, SideCaps]): void {
  const { ball, players, possession } = state;

  if (ball.p.z >= MAX_CONTROL_HEIGHT) {
    possession.holder = NOBODY;
    return;
  }

  // ⚠️ REACH IS PER SIDE NOW, so "within reach" and "nearest" are two questions where they used to be one
  //    initialiser. A single `bestD2` seeded with the radius answered both at once, and it cannot survive
  //    two radii: a deft dribbler a metre away and a clumsy one at ninety centimetres are both candidates
  //    or not depending on WHOSE radius the seed was.
  const reachOf = (i: number): number =>
    sides === undefined ? CONTROL_R : sides[teamOf(i)].controlRadius;

  let best = NOBODY;
  let bestD2 = Infinity;

  for (let i = 0; i < players.length; i++) {
    if (!onPitch(state, i)) continue;
    // Law 15: the man who took the restart may not play it again until somebody else has.
    if (i === state.tookRestart) continue;
    const d2 = dist2(players[i].p, ball.p);
    const r = reachOf(i);
    if (d2 >= r * r) continue;
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
    const heldReach = reachOf(held);
    // ⚠️ THE MARGIN IS THE CHALLENGER'S AND NOT THE CARRIER'S. It is what HE has to overcome, so it is his
    //    side's `defending` that sets it - reading it off the man being robbed would turn the rating into
    //    a shielding rating and put it on the wrong six numbers entirely.
    const margin =
      sides === undefined || best === NOBODY ? SHIELD_MARGIN : sides[teamOf(best)].tackleMargin;
    if (heldD2 < heldReach * heldReach && Math.sqrt(heldD2) - Math.sqrt(bestD2) < margin) {
      best = held;
    }
  }

  // ⚠️ TAKING THE BALL IS ITSELF A TOUCH, and leaving that out was a defect with a strange symptom: a
  //    player who won the ball and ran lost it again within a third of a second, every time. The cadence
  //    is counted on the global tick, so somebody who gained possession at tick 5 had to wait until tick 21
  //    for his first touch - and by then he had outrun a ball that had not moved. Football has no such
  //    gap: the first thing a player does with the ball is touch it.
  const gained = best !== possession.holder;
  possession.holder = best;
  if (best === NOBODY) return;

  // Somebody else has played it, so the restart is over and the taker is an ordinary player again.
  state.tookRestart = -1;

  possession.lastTouch = best;
  if (!gained && state.tick % TOUCH_PERIOD !== 0) return;

  // The touch. A carrier standing still SHIELDS the ball instead of knocking it away, which falls out of
  // using his own velocity rather than his facing: no speed, no touch, and no special case to write.
  const carrier = players[best];
  ball.v.x = carrier.v.x * TOUCH_GAIN;
  ball.v.y = carrier.v.y * TOUCH_GAIN;
  ball.grounded = true;
}
