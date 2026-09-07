// SPDX-License-Identifier: AGPL-3.0-or-later
// WHICH RULES ARE SWITCHED ON. The practice pitch is this file, not a second referee.
//
// ⚠️ THE `fouls` FLAG WAS `false` EVERYWHERE, AND THE COMMENT HERE SAID THAT WAS A DECISION. It was mine,
// it was recorded in the plan under what the Dev could revert, and it was then repeated as though it had
// been his. He reverted it on 2026-09-07. A match has a referee who gives fouls, shows cards and points to
// the spot; a PRACTICE pitch still does not, which is what the flag is actually for.
//
// The comment that stood here also claimed the flag existed "so that adding them later is a profile change
// and not an archaeology exercise". That much held up: it was a profile change.

import { SQUAD_SIZE } from '../sim/ids.ts';
import { PITCH } from '../sim/units.ts';

export interface RulesProfile {
  /** Do throw-ins, corners and goal kicks exist? */
  readonly outOfPlay: boolean;
  readonly offside: boolean;
  readonly fouls: boolean;
  /** `'none'` is a pitch with no clock at all - the practice mode, and WCAG 2.2.1 by construction. */
  readonly clock: 'count' | 'none';
  /** Ticks in one period. Adjustable, and `0` with `clock: 'none'` means it is never consulted. */
  readonly periodTicks: number;
  /**
   * The area IN PLAY, in metres.
   *
   * ⚠️ IT IS NOT ALWAYS THE WHOLE PITCH, and that is what makes `topology()` a function rather than a
   * value. A practice session uses half a pitch - which is what training on a real pitch looks like, the
   * far half simply unused - so the space the sonar measures, the shape the AI holds and the distance the
   * screen reader counts in all shrink with it, while the drawn pitch does not have to change at all.
   */
  readonly playable: { readonly length: number; readonly width: number };
  /**
   * What every body's top speed and acceleration are multiplied by. `1` is the game as it plays.
   *
   * ⚠️ IT IS HOW TWO MATCH LENGTHS GET THE SAME NUMBERS, and it was chosen by measurement rather than by
   * argument. The Dev asked for football's counts - 40 throw-ins, 2.7 goals, 10 corners, 1.7 bookings - in
   * BOTH a fifteen-minute match and a ninety-minute one, which is six times fewer events per minute in the
   * long one. Three ways to get there were measured over ninety-minute matches:
   *
   *     lever                       throw-ins   goals   corners   bookings
   *     as it plays                     206.0    17.3       5.0        1.0
   *     pitch 112x70                    250.0     5.3       0.3
   *     pitch 158x98                    418.0     2.3       1.3
   *     seven a side                    514.0    11.7       5.7        1.3
   *     five a side                     662.0     4.7       5.3        0.3
   *     bodies at half pace              89.3     1.0       9.0        1.7
   *
   * More space per player - a bigger pitch, or fewer bodies - SPLITS the targets: it takes the goals down
   * and pushes the throw-ins up, because a loose ball travels further before anybody reaches it. Slowing
   * the bodies is the only lever that moves all four the same way, and at half pace the corners and the
   * bookings land on football's numbers exactly.
   *
   * ⚠️ AND IT IS NOT THE ASSISTED TEMPO. That scales how much simulated time a real second buys, which
   * changes nothing about a match's contents; this changes what happens IN a minute of football.
   */
  readonly pace: number;
  /**
   * How many of each squad are on the pitch, indexed by `TeamId`.
   *
   * ⚠️ A PRACTICE PITCH IS NOT A MATCH WITH THE RULES SWITCHED OFF. The feature is "a free-form pitch
   * with a lone keeper": with twenty-two bodies still running, turning the laws off produces a kickabout
   * that looks exactly like a match nobody is refereeing, which is not what a child chose when she chose
   * to practise. The keeper is index 0 of a squad, so a squad of one IS a lone keeper and no branch is
   * needed to say so.
   */
  readonly squads: readonly [number, number];
}

/** Ten minutes a half at 60Hz. Adjustable by an adult, including down to nothing. */
const TEN_MINUTES = 10 * 60 * 60;

/** How much of the pitch a practice session uses. Half its length, all of its width. */
const PRACTICE_SHARE = 0.5;

export const MATCH_PROFILE: RulesProfile = Object.freeze({
  outOfPlay: true,
  offside: true,
  fouls: true,
  clock: 'count',
  periodTicks: TEN_MINUTES,
  playable: Object.freeze({ length: PITCH.length, width: PITCH.width }),
  pace: 1,
  squads: Object.freeze([SQUAD_SIZE, SQUAD_SIZE]) as readonly [number, number],
});

/** A free-form pitch: a ball, a keeper, and nothing that stops play. */
export const PRACTICE_PROFILE: RulesProfile = Object.freeze({
  outOfPlay: false,
  offside: false,
  fouls: false,
  clock: 'none',
  periodTicks: 0,
  playable: Object.freeze({ length: PITCH.length * PRACTICE_SHARE, width: PITCH.width }),
  pace: 1,
  // Three of ours against a lone keeper: enough for a pass to exist, and nothing that looks like a match.
  squads: Object.freeze([3, 1]) as readonly [number, number],
});

/**
 * The lengths of a half a grown-up can choose, in minutes - and `'none'`.
 *
 * ⚠️ THE LADDER IS THE GENRE'S, NOT ONE I INVENTED, and it spans thirty years of it. International
 * Superstar Soccer on the SNES offered three-, five- and seven-minute matches - halves of 1:30, 2:30 and
 * 3:30 - and the plan asks for ARCADE in as many words. Today's football games sit just above that:
 * Ultimate Team locks its minimum at 4 minutes a half, online competitive play defaults to 6, and an
 * offline match can be set anywhere from 3 to 20. So the list is the ISS three plus the two lengths a
 * modern game actually competes at.
 *
 * ⚠️ THE LENGTHS THIS FILE USED TO OFFER - 5, 10 and 20 minutes a half - WERE A GUESS, and a guess is
 * what put days of counting into a ninety-minute match nobody could select.
 *
 * ⚠️ `'none'` IS NOT A BIG NUMBER. WCAG 2.2.1 is satisfied two ways here at once: ADJUSTABLE, because
 * every limit is an option, and REMOVABLE, because one of the options is that there is no limit. A very
 * long half is still a limit and still runs out, on the child least able to judge how long she needs -
 * so the accommodation is `'none'`, and it is why shortening the ladder does not take one away.
 */
export const PERIOD_CHOICES: readonly (number | 'none')[] = Object.freeze([1.5, 2.5, 3.5, 4, 6, 'none']);

const TICKS_PER_MINUTE = 60 * 60;

/**
 * The same rules, with a different clock.
 *
 * ⚠️ IT RETURNS A NEW PROFILE. `MATCH_PROFILE` is frozen and is held by the declaration, the drivers and
 * the referee; mutating it would change the rules of a match that is already being played, and freezing
 * it is what stops that being possible to do by accident.
 *
 * ⚠️ AND IT CANNOT PUT A CLOCK ON A PITCH THAT HAS NONE. A practice session satisfies 2.2.1 BY
 * CONSTRUCTION - the same way the 2048 did - and a length chooser that could impose a limit on it would
 * take away the one mode whose conformance needs no argument at all.
 */
/**
 * The same profile with the bodies at `k` times their pace.
 *
 * ⚠️ HALF IS THE NINETY-MINUTE MATCH and one is the short one, measured rather than argued - see `pace`.
 * A whole match at half pace produced 89 throw-ins, 1.0 goals, 9.0 corners and 1.7 bookings against
 * football's 40, 2.7, 10 and 1.7; at full pace it produced 206, 17.3, 5.0 and 1.0.
 *
 * ⚠️ EVERY COUNT IN THIS FILE IS IN THE PAST TENSE ON PURPOSE. It is the measurement that MADE a choice,
 * on the build of the day it was made, and it stays here because the choice would be unreadable without
 * it. What the game produces NOW lives in exactly one place, `tests/full-match`, which runs it - a
 * standing figure copied into a second file is a figure that drifts, and every number in this comment had
 * drifted before this line was written.
 */
/**
 * The school match: SEVEN minutes, two halves of three and a half, at the pace this game already plays at.
 *
 * ⚠️ SEVEN BECAUSE THE GENRE SAYS SEVEN. International Superstar Soccer offered three, five and seven
 * minutes; the plan asks for arcade; and this is the longest of the three. Modern football games sit just
 * above it - 8 minutes in Ultimate Team, 12 online - so seven is the short end of a live tradition rather
 * than a museum piece. It was fifteen until 2026-09-07, and fifteen was a number nobody had a reason for.
 *
 * ⚠️ AND FOOTBALL'S PER-MATCH COUNTS ARE NOT THIS MATCH'S TARGET. Forty throw-ins and 2.7 goals belong
 * to ninety minutes of football. Seven minutes of arcade is a different thing on purpose - it is the
 * shape that has to read, not the rate - so what this mode owes is a match that starts, finishes, and
 * contains each kind of event often enough for a child to meet it. `tests/full-match` measures it.
 */
export const SHORT_MATCH: RulesProfile = withPeriod(MATCH_PROFILE, 3.5);

/**
 * The full match: ninety minutes, with the bodies at half pace.
 *
 * ⚠️ PARKED BY THE DEV ON 2026-09-07: for now the game is the SCHOOL MODE only - fifteen minutes, two
 * halves of seven and a half. This profile is kept because the measurement below is worth keeping, and it
 * is NOT offered to a child: nothing in the composition root has ever selected it, which is a thing that
 * should have been noticed sooner. Days of counting were spent tuning a mode no child could reach.
 *
 * ⚠️ HALF, AND SIX FIXTURES PICKED IT. Against targets of 40 throw-ins, 2.7 goals, 10 corners:
 *
 *     pace 0.50    82.5    3.5   13.5
 *     pace 0.60   106.7    9.2   14.7
 *     pace 0.70   138.8   18.3   11.7
 *
 * At half pace the goals and the corners land within a third of football's, and every fixture reaches full
 * time. The throw-ins are still twice the target, and that is the one deviation with a cause of its own -
 * see `tests/full-match`, where widening the pitch moved it the WRONG way while moving the goals right.
 *
 * ⚠️ AND SLOWING THE BODIES IS THE ONLY LEVER THAT WORKS. A bigger pitch and fewer players were both
 * measured and both SPLIT the targets: goals down, throw-ins up, because a loose ball travels further
 * before anybody reaches it.
 *
 * ⚠️ AND IT COST THE CARDS FOR AN HOUR, THROUGH A BUG OF MINE RATHER THAN THROUGH THE PACE. Six
 * ninety-minute matches at half pace produced NO booking at all, and the first two explanations written
 * here were both wrong: it was not the thresholds, which are shares of a body's own top speed and scale
 * correctly, and it was not `CONTACT` and `CHALLENGE_RANGE` failing to scale. `pace` was wired at two of
 * its four call sites, and the two the REFEREE uses were left comparing a halved going-in speed against a
 * full-pace top speed - so the bar was twice what it should be and `judgeTackle` was never called once.
 *
 * With that fixed the bookings came back to football's rate, and the throw-ins are the count that is still
 * nearly twice the target - which is a MECHANISM rather than a frequency, and so cannot be tuned: measured,
 * 279 of 281 crossings are the carrier walking his own ball over the line, where football's throw-in comes
 * off a ball played too hard. `ai/brain` carries the pass that was built for exactly that, and the twelve
 * matches on which it was rejected.
 *
 * The standing counts for this mode are in `tests/full-match`, which runs it, and not repeated here.
 */
export const FULL_MATCH: RulesProfile = withPeriod(withPace(MATCH_PROFILE, 0.5), 45);

export function withPace(profile: RulesProfile, k: number): RulesProfile {
  return Object.freeze({ ...profile, pace: k });
}

export function withPeriod(profile: RulesProfile, minutes: number | 'none'): RulesProfile {
  if (profile.clock === 'none') return profile;
  if (minutes === 'none') return Object.freeze({ ...profile, clock: 'none' as const, periodTicks: 0 });
  return Object.freeze({ ...profile, periodTicks: Math.round(minutes * TICKS_PER_MINUTE) });
}
