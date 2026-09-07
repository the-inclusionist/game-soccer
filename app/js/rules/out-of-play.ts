// SPDX-License-Identifier: AGPL-3.0-or-later
// WHERE THE BALL WENT - one verdict per tick, never two.
//
// ⚠️ THE GOAL IS TESTED BEFORE THE GOAL LINE, and the order is the rule rather than an optimisation. A
// ball in the net has also wholly crossed the goal line; if the exits were checked first, every goal
// would be reported as a goal kick. One verdict, and the most specific one wins.

import type { Ball } from '../sim/ball.ts';
import { BALL, GOAL, PITCH } from '../sim/units.ts';

/** Which end of the pitch. `1` is the end at `x = PITCH.length`. */
export type EndId = 0 | 1;

export type BallVerdict =
  | { readonly kind: 'in' }
  | { readonly kind: 'touchline'; readonly side: 'far' | 'near'; readonly at: { x: number; y: number } }
  | { readonly kind: 'goalLine'; readonly end: EndId; readonly at: { x: number; y: number } }
  | { readonly kind: 'goal'; readonly end: EndId };

const IN: BallVerdict = Object.freeze({ kind: 'in' });

/**
 * Has the ball WHOLLY passed `line`, travelling in direction `dir`?
 *
 * Strict, and the strictness is the law: a ball still touching the line has not wholly crossed it. The
 * two `[Boundary]` tests that pin this down are the difference between a goal-line technology decision
 * and a coin toss.
 */
function wholly(coord: number, line: number, dir: 1 | -1): boolean {
  return (coord - line) * dir > BALL.radius;
}

export function judgeBall(ball: Ball): BallVerdict {
  const { x, y, z } = ball.p;

  for (const end of [0, 1] as const) {
    const line = end === 1 ? PITCH.length : 0;
    const dir = end === 1 ? 1 : -1;
    if (!wholly(x, line, dir)) continue;

    // Between the posts and under the bar. Both bounds are strict: a ball on the post or on the underside
    // of the bar has not passed it, and football agrees - the woodwork is part of the goal, not of the gap.
    const halfMouth = GOAL.width / 2;
    const acrossFromMiddle = y - PITCH.width / 2;
    const between = acrossFromMiddle > -halfMouth && acrossFromMiddle < halfMouth;
    const under = z < GOAL.height;

    if (between && under) return { kind: 'goal', end };
    return { kind: 'goalLine', end, at: { x: line, y } };
  }

  if (wholly(y, 0, -1)) return { kind: 'touchline', side: 'far', at: { x, y: 0 } };
  if (wholly(y, PITCH.width, 1)) return { kind: 'touchline', side: 'near', at: { x, y: PITCH.width } };

  return IN;
}
