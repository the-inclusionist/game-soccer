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
  // Three of ours against a lone keeper: enough for a pass to exist, and nothing that looks like a match.
  squads: Object.freeze([3, 1]) as readonly [number, number],
});

/**
 * The lengths of a half a grown-up can choose, in minutes - and `'none'`.
 *
 * ⚠️ `'none'` IS NOT A BIG NUMBER. WCAG 2.2.1 is satisfied two ways here at once: ADJUSTABLE, because
 * every limit is an option, and REMOVABLE, because one of the options is that there is no limit. A very
 * long half is still a limit and still runs out, on the child least able to judge how long she needs.
 */
export const PERIOD_CHOICES: readonly (number | 'none')[] = Object.freeze([5, 10, 20, 'none']);

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
export function withPeriod(profile: RulesProfile, minutes: number | 'none'): RulesProfile {
  if (profile.clock === 'none') return profile;
  if (minutes === 'none') return Object.freeze({ ...profile, clock: 'none' as const, periodTicks: 0 });
  return Object.freeze({ ...profile, periodTicks: Math.round(minutes * TICKS_PER_MINUTE) });
}
