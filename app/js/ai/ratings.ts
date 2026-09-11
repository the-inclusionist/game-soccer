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
export function capsBySide(home: Ratings, away: Ratings, pace = 1): readonly [SideCaps, SideCaps] {
  return [sideOf(home, pace), sideOf(away, pace)];
}

function sideOf(r: Ratings, pace: number): SideCaps {
  const caps = capsFor(r);
  return {
    // ⚠️ THE PROFILE'S PACE MULTIPLIES WHAT A BODY CAN DO, and it is how one simulation serves two match
    //    lengths - see `rules/profile`. It scales the CAPS and not the ratings: a quick club is still
    //    quicker than a slow one at any pace, which is what keeps the six numbers meaning what they say.
    body: { maxSpeed: caps.maxSpeed * pace, accel: caps.accel * pace },
    controlRadius: controlRadiusOf(r.control),
    tackleMargin: tackleMarginOf(r.defending),
    pressureRate: pressureRateOf(r.defending),
  };
}

/** Radians of error a pass may carry. A perfect passer has none, which is the honest end of the scale. */
export function passErrorOf(passing: number): number {
  // ⚠️ AND THE PLAN'S OWN VERIFICATION ITEM DOES NOT HOLD, which was measured rather than assumed. It
  // asks that `passing 0.9` complete strictly more passes than `0.3` in a real match. Sixty matches -
  // twelve opponents at each of five ratings, counting balls struck above `CONTROL_SPEED` by the home
  // side and who collected them:
  //
  //     passing   completed   of   rate
  //       0.9         45      146   30.8%
  //       0.7         57      142   40.1%
  //       0.5         45      145   31.0%
  //       0.3         43      141   30.5%
  //       0.1         44      143   30.8%
  //
  // Flat. The 0.7 row is noise rather than a trend - nothing either side of it moves.
  //
  // ⚠️ AND SUSTAINED-CONTACT POSSESSION DID NOT FIX IT, which was the whole reason the Dev chose that
  // model. Re-measured the same way afterwards, twelve opponents at each rating:
  //
  //     passing   completed   of   rate
  //       0.9         44      126   34.9%
  //       0.7         24      120   20.0%
  //       0.5         43      159   27.0%
  //       0.3         45      134   33.6%
  //       0.1         36      147   24.5%
  //
  // The SPREAD widened - 20% to 35% against a flat 31% before - and the ORDER did not appear: 0.9 and 0.3
  // are within a point of each other and 0.7 is the worst of the five. More variance is not more signal.
  //
  // ⚠️ I REPORTED THIS AS FIXED FROM TWO POINTS OF A FIVE-POINT SWEEP. Having measured 0.9 and 0.1 and
  // seen 34.9 against 24.5, I wrote that the rating now mattered. It was the endpoints of a noisy set read
  // as a trend, and the middle three say otherwise. The correction is here rather than only in a commit
  // message because the wrong version was in one of those too.
  //
  // ⚠️ AND WIDENING THIS NUMBER WOULD NOT FIX IT, which is why it is written here instead of tuned. At
  // 0.5 the error is already 0.1 rad, which over a fifteen-metre pass is 1.5 metres - well outside the
  // 0.9 m control radius - and the receiver collects it anyway, because he moves to it and the pass is
  // led into his path. Completion in this game is decided by whether an OPPONENT is nearer, not by how
  // straight the ball was hit: measured elsewhere, 88.7% of all changes of possession go to the other
  // side and the nearest opponent is a metre away.
  //
  // So the gate the plan asked for was written, measured, and NOT shipped: a gate asserting something
  // false is worse than none, and one asserting the flatness would freeze it.
  // ========================= RE-MEASURED 2026-09-11, AND HALF OF THE ABOVE IS DEAD =========================
  // ⚠️ THE 31% IS GONE AND IT WAS THE NUMBER EVERYTHING ELSE HUNG ON. `sim/possession` names the old
  // per-tick possession model as the cause of it and then REPLACES that model, and nobody re-measured
  // afterwards - so the tables above describe a build that no longer exists, and this file has been
  // telling every later reader a fact about a different game. Same method, word for word: balls struck
  // above `CONTROL_SPEED` by the home side, and who collected them.
  //
  //     passing   completed   of   rate
  //       0.9         177     211   83.9%
  //       0.7         150     203   73.9%
  //       0.5         147     187   78.6%
  //       0.3         155     198   78.3%
  //       0.1         139     177   78.5%
  //
  // Completion is about FOUR IN FIVE, not one in three. The shield and sustained contact did exactly what
  // they were chosen to do, and this game has had a passing game in it for days with its own source
  // saying otherwise.
  //
  // ⚠️ AND THE RATING STILL DOES NOT MOVE IT, which is now established rather than merely repeated. The
  // 0.9 row looked higher, so the two ends were re-run at FOUR TIMES the sample - four home clubs against
  // eleven opponents each, 1456 passes:
  //
  //     passing   completed   of   rate
  //       0.9         612     750   81.6%
  //       0.3         554     706   78.5%
  //
  // A gap of 3.1 points against a standard error of 2.1: **1.49 standard errors**. And it SHRANK as the
  // sample grew - 5.6 points at n=200, 3.1 at n=750 - which is the signature of noise rather than of a
  // small real effect, because a real one holds its size and gains significance.
  //
  // ⚠️ SO THE PLAN'S GATE STILL CANNOT SHIP, BUT FOR A CURRENT REASON INSTEAD OF A STALE ONE. What
  // survives of the old diagnosis is the mechanism: at 0.3 the error is 0.14 rad, which over a
  // nine-metre pass is 1.26 m, and the receiver RUNS AT THE BALL - so the scatter is absorbed by his
  // movement before it can decide anything. What dies with the 31% is the "88.7% of possession changes go
  // to the other side" beside it, which belongs to the same vanished build.
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
  // 0.40 rad at the worst rating. The goal is 7 m wide and the AI shoots from at most `SHOOT_RANGE` = 22 m,
  // so missing needs an angle above 3.5/22 = 0.159 rad.
  //
  // ⚠️ IT WAS 0.20, AND 0.20 IS THE THRESHOLD COMPUTED FOR A RATING NO CLUB HAS. The twelve clubs are
  // generated with a swing of 0.10 to 0.24 either side of the middle, so their shooting runs 0.26 to 0.74
  // and never reaches either end. At 0.26 the old error was 0.148 rad - 3.26 m across at 22 m, INSIDE the
  // 3.5 m post - so no club could miss the target from any distance it was willing to shoot from, and the
  // gates said otherwise only because they asked at shooting 0.
  //
  // Measured before this changed, six five-minute matches: 6.00 shots a match, of which 2.17 scored, 2.17
  // were blocked by a body, 0.67 went out for a corner, 0.67 stopped on the grass, and NOUGHT went out for
  // a goal kick. Football sends about a third of its shots off target and goal kicks are what those turn
  // into; the count sat at 0.67 a match against a band of 3 to 4.5.
  //
  // ⚠️ AND A PERFECT FINISHER STILL HAS NONE, which keeps the honest end of the scale honest and is the
  // same shape `passErrorOf` uses. At 0.5 the error is 0.2 rad: 4.4 m across at 22 m, so an ordinary club
  // misses from the edge of its range and 2.4 m at 12 m, so it scores from the edge of the box. The best
  // club the game ships, 0.74, is 2.3 m across at 22 m and still hits - which is what makes the rating
  // readable as skill rather than as a dice.
  // ⚠️ AND 0.40 IS A CHOICE BETWEEN GOALS AND DEAD BALLS, not an optimum - swept, with a child playing,
  // six five-minute matches at each value (bands: goals 2-3, corners 1.5-3, goal kicks 3-4.5):
  //
  //     error   goals   corners   goal kicks   scorelines
  //      0.20    4.50      0.17         0.33   7-0  5-0  5-0  1-0  1-0  8-0
  //      0.30    2.83      0.50         1.83   4-0  1-0  1-0  3-0  5-0  3-0
  //      0.40    2.67      0.67         2.50   4-0  3-0  1-0  2-0  3-0  2-1
  //      0.50    1.17      1.50         2.33   3-0  0-0  1-0  0-0  0-1  2-0
  //      0.60    0.67      1.50         3.00   1-0  0-0  0-0  0-0  0-0  3-0
  //
  // ⚠️ NO VALUE SATISFIES ALL THREE, and the reason is football: a shot that misses becomes a goal kick
  // and a shot on target becomes a save, a rebound and a corner. The same ball cannot be both. Corners and
  // goal kicks are bought with goals, one for one.
  //
  // 0.40 is kept because a children's game with 0.67 goals in it is a worse game than one short of
  // corners - five of the six fixtures at 0.60 finish goalless or 1-0. It is a PRODUCT decision and it is
  // the Dev's to change: 0.60 lands three bands and 0.40 lands two, and the third band costs the goals.
  return (1 - shooting) * 0.4;
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
/**
 * How fast a side builds pressure on the man with the ball. Average is exactly 1.
 *
 * ⚠️ IT IS THE WIRE THAT KEEPS `defending` MEANING SOMETHING. The ball is won by sustained contact, so
 * the margin `tackleMarginOf` scales is reached far less often than it was - and a rating whose only wire
 * runs through a branch nobody takes is precisely the defect this change was made to fix for `passing`,
 * which measured flat at 31% completion across every rating over sixty matches.
 *
 * ⚠️ AND 0.5 IS EXACTLY ONE, like every other rating here, so a match driven with no clubs at all is
 * the world every other gate describes.
 */
export function pressureRateOf(defending: number): number {
  return 0.5 + defending;
}

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

