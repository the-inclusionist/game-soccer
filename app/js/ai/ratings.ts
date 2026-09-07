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

import type { BodyCaps, SideCaps } from '../sim/body.ts';

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

/**
 * The two sides' caps, ready for `sim/step`.
 *
 * ⚠️ TWO OBJECTS AND NOT TWENTY-TWO. Pace is a fact about a CLUB, so a per-player array would be twenty
 * allocations a tick to say the same two things - and pillar 1 names the hardware this runs on. It also
 * says the shape of the rule out loud: every player of a side is as quick as his side.
 */
export function capsBySide(home: Ratings, away: Ratings): readonly [SideCaps, SideCaps] {
  return [sideOf(home), sideOf(away)];
}

function sideOf(r: Ratings): SideCaps {
  return {
    body: capsFor(r),
    controlRadius: controlRadiusOf(r.control),
    tackleMargin: tackleMarginOf(r.defending),
  };
}

/** Radians of error a pass may carry. A perfect passer has none, which is the honest end of the scale. */
export function passErrorOf(passing: number): number {
  return (1 - passing) * 0.2;
}

/**
 * Radians a shot leans off the middle of the mouth.
 *
 * ⚠️ AN ANGLE, NOT A DISTANCE, and that is what makes a rating read as skill instead of as a dice. The
 * same finisher who sprays it from thirty metres puts it away from six yards, because an angle costs more
 * the further the ball has to travel - which is how finishing actually works.
 *
 * ⚠️ AND A PERFECT FINISHER'S ERROR IS ZERO. The honest end of the scale, not a floor somebody chose to
 * keep the game interesting.
 */
export function shotErrorOf(shooting: number): number {
  // 0.20 rad at the worst rating, and the number was MEASURED rather than picked: the goal is 7m wide, so
  // missing it from twenty-two metres needs more than 3.5/22 = 0.159 rad. Below that a hopeless finisher
  // still hits the target from distance and the match still has no goal kicks in it. From three metres
  // the same error is 0.6m across - comfortably inside the posts, which is the other half of the claim.
  return (1 - shooting) * 0.2;
}

/** Metres. How close the ball stays to a dribbler. */
export function controlRadiusOf(control: number): number {
  return 0.7 + 0.4 * control;
}

/**
 * Metres. How much closer than the carrier a challenger has to be before the carrier stops shielding it.
 *
 * ⚠️ THIS IS `defending`, AND THE OBVIOUS WIRE WAS BACKWARDS. `ai/ratings` calls the rating "tackle window,
 * press trigger, interception reach", and the tempting place to spend it is `ai/brain`'s challenge range -
 * how close the presser gets before going in. But `challenger` decides who has committed a FOUL; it wins
 * nobody the ball. A good defender challenging from further out would give away more free kicks and take
 * possession no more often, so the better a club defended the worse it would play.
 *
 * A ball changes hands in `sim/possession`, through this one number, and a good defender needs less of an
 * advantage to take it. `0.5` is exactly `SHIELD_MARGIN`, so an average club plays the game the constant
 * described.
 *
 * ⚠️ AND IT GOES DOWN AS THE RATING GOES UP, which is the only one of the six that does. A window is a
 * handicap, so being better at defending means needing LESS of it - and a sign error here would be a
 * rating that quietly made good defenders worse, with nothing on the screen to say so.
 */
export function tackleMarginOf(defending: number): number {
  return 0.5 - 0.3 * defending;
}

/**
 * Metres. How close an opponent has to be before the carrier plays the ball rather than dribbling on.
 *
 * ⚠️ THIS IS `composure`, AND "THE SAFE OPTION" HAS EXACTLY ONE MEANING HERE: let the ball go before
 * somebody takes it off you. A composed side plays it while the defender is still three metres away; a
 * nervous one holds on until he is on top of it, which is when a tackle is a tackle and a pass is a
 * hopeful ball. `decideKick` already owns the decision - this is only WHEN.
 *
 * `2.6` at the middle of the scale is `PRESSED_AT` exactly, so a match with no clubs in it plays the game
 * that constant described.
 *
 * ⚠️ AND IT MOVES THE TRIGGER RATHER THAN REMOVING IT. Even the calmest side keeps the ball with nobody
 * near it: a carrier who passed whenever a pass existed would produce a match of nothing but passing, and
 * dribbling is half of what a child watches for.
 */
export function pressedAtOf(composure: number): number {
  return 2.0 + 1.2 * composure;
}
