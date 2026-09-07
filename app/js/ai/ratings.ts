// SPDX-License-Identifier: AGPL-3.0-or-later
// SIX NUMBERS PER CLUB, and every one of them applies at the POINT OF ACTION.
//
// ⚠️ NOTHING HERE BRANCHES ON SKILL. A weak side and a strong side run the same cascade, the same
// steering and the same rules; what differs is a top speed, a control radius, a pass error. That is what
// makes difficulty six floats instead of a second AI - and it is what makes the monotonicity gate
// meaningful, because a better passer completing more passes is then a consequence of arithmetic rather
// than of a branch somebody wrote to make the test pass.
//
// It is also ADR-0049: every reward deterministic. A rating shifts an outcome by shifting a number, never
// by rolling for it.

import type { BodyCaps } from '../sim/body.ts';

export interface Ratings {
  /** Top speed and acceleration. */
  readonly pace: number;
  /** How close the ball stays, and how clean a first touch is. */
  readonly control: number;
  /** Angular error on a pass. */
  readonly passing: number;
  /** Shot speed and accuracy. */
  readonly shooting: number;
  /** Tackle window, press trigger, interception reach. */
  readonly defending: number;
  /** How often the safe option is taken. */
  readonly composure: number;
}

/** The middle of every scale. A club with no rating is this one, and it is a real football side. */
export const AVERAGE: Ratings = Object.freeze({
  pace: 0.5,
  control: 0.5,
  passing: 0.5,
  shooting: 0.5,
  defending: 0.5,
  composure: 0.5,
});

/**
 * Movement caps from `pace`.
 *
 * Both numbers move together because they are the same fact about a body: a quick player reaches a higher
 * speed AND changes direction harder. Turning is the acceleration cap - there is no separate turn rate -
 * so one rating buys both, and a sprinting player still turns wide.
 */
export function capsFor(r: Ratings): BodyCaps {
  return { maxSpeed: 6.2 + 1.4 * r.pace, accel: 18 + 8 * r.pace };
}

/** Radians of error a pass may carry. A perfect passer has none, which is the honest end of the scale. */
export function passErrorOf(passing: number): number {
  return (1 - passing) * 0.2;
}

/** Metres. How close the ball stays to a dribbler. */
export function controlRadiusOf(control: number): number {
  return 0.7 + 0.4 * control;
}
