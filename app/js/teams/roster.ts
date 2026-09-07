// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CLUBS A CHILD CHOOSES BETWEEN, and what they wear when two of them meet.
//
// ========================= WHY A CHOICE NEEDED A NEW MODULE =========================
// `makeFixture(seed)` generated two clubs together and RETRIED until their kits cleared the luma gap,
// which made "the two sides are distinguishable" a property of the generator rather than of a lucky seed.
// The moment a child picks both sides herself, there is no seed left to retry: she will pick the two she
// likes, and one of those pairs is the one nobody can read.
//
// So identity and dress are separated. A club HAS a name, a crest and a first-choice kit and keeps them
// whoever it plays - a club whose crest changed with the opponent would not be a club, it would be a
// colour scheme, and there would be nothing to choose. What the FIXTURE decides is what is worn: the home
// side wears its own, and a visitor whose kit does not read against it changes.
//
// ⚠️ THAT IS WHAT FOOTBALL ITSELF DOES, which is worth saying because it is not a coincidence. The change
// kit exists in the real game for exactly this reason, and borrowing the answer means the rule a child
// meets on the screen is one she already understands from watching a match.
//
// ⚠️ AND IT HOLDS BY CONSTRUCTION, NOT BY SEARCH. `clubs.ts` picks four brightness bands far enough apart
// that any two of them clear the gap; a first-choice kit sits on one extreme and its change kit on the
// other, and the two keepers take the two middle bands. There is no loop that could fail to terminate and
// no seed that could defeat it - `tests/roster.node.test.ts` walks all 132 ordered pairings.

import { BANDS, LUMA_GAP, NAME_KEYS, colourAt, crestOf, lumaOf, type Crest, type Fixture } from './clubs.ts';
import { createRng } from '@the-inclusionist/engine/core/rng.js';
import type { Ratings } from '../ai/ratings.ts';

/**
 * A club as a thing a child can pick, rather than as half of a generated fixture.
 *
 * `kit` is what it wears at home and prefers away; `changeKit` is what it wears when the home side has
 * got there first with something too close.
 */
export interface ClubIdentity {
  readonly nameKey: string;
  readonly crest: Crest;
  readonly kit: number;
  readonly changeKit: number;
  /**
   * The six numbers `ai/ratings` applies at the point of action.
   *
   * ⚠️ THEY ADD UP TO THE SAME TOTAL FOR EVERY CLUB, which is the decision this whole field turns on. A
   * child picks the badge she likes; if that badge carried a worse team she would have been punished for a
   * choice the game invited her to make on looks, with nothing on the screen to warn her. So clubs differ
   * in SHAPE and never in strength - one quick and careless, another slow and composed, and neither the
   * right answer.
   *
   * It is ADR-0006 territory too: a game where some clubs are simply better has a ladder in it, and a
   * child learns to pick the strong one rather than the one that is hers.
   */
  readonly ratings: Ratings;
}

/** The six, in one fixed order, so a shape can be built and read back the same way. */
const KEYS = ['pace', 'control', 'passing', 'shooting', 'defending', 'composure'] as const;

/**
 * Six numbers that differ from each other and add up to exactly six halves.
 *
 * ⚠️ BUILT AS PAIRS THAT CANCEL, not drawn and then normalised. Normalising a random draw would keep
 * the total right and let one club come out low on everything but one - strong on paper, unplayable in
 * fact. Taking the six in three pairs and moving one up by exactly what the other comes down by keeps the
 * total exact by construction and keeps every club within a band of the middle.
 */
function shapeFor(rng: () => number): Ratings {
  const out: Record<string, number> = {};
  for (let pair = 0; pair < 3; pair++) {
    // 0.10 to 0.24 either side of the middle: enough to feel, never enough to make a club a bad choice.
    const swing = 0.1 + rng() * 0.14;
    const up = rng() < 0.5;
    out[KEYS[pair * 2]] = 0.5 + (up ? swing : -swing);
    out[KEYS[pair * 2 + 1]] = 0.5 - (up ? swing : -swing);
  }
  return out as unknown as Ratings;
}

/**
 * The roster.
 *
 * ⚠️ THE FIRST CHOICES ALTERNATE DARK AND LIGHT, which is the whole reason a change kit is ever needed
 * and also the reason it is enough. Half the clubs prefer the dark band and half the light one, so a
 * pairing clashes exactly when both prefer the same - and the visitor's change kit is on the other
 * extreme, which clears the gap against anything on this one.
 */
export const CLUBS: readonly ClubIdentity[] = Object.freeze(
  NAME_KEYS.map((nameKey, i) => {
    // One stream per club, so adding a thirteenth club cannot change what the first twelve look like.
    const rng = createRng(i * 2654435761 + 17);
    const prefersDark = i % 2 === 0;
    return Object.freeze({
      nameKey,
      crest: crestOf(i + 1),
      kit: colourAt(rng.rnd, prefersDark ? BANDS[0] : BANDS[3]),
      changeKit: colourAt(rng.rnd, prefersDark ? BANDS[3] : BANDS[0]),
      // ⚠️ `Math.cos` LIVES IN `colourAt` AND IS BANNED THREE FOLDERS AWAY, and these numbers are the
      //    reason that note in `clubs.ts` mattered: a rating DOES enter the simulation. The arithmetic
      //    here is `+ - *` and a seeded stream, which the gate over `sim/`, `rules/` and `ai/` permits -
      //    and the ratings are computed ONCE, at module load, so no per-tick arithmetic is added at all.
      ratings: shapeFor(rng.rnd),
    });
  }),
);

/** An index a child could not have produced still has to name a club, not `undefined`. */
const clamped = (i: number): number => (i < 0 ? 0 : i >= CLUBS.length ? CLUBS.length - 1 : Math.floor(i));

/**
 * Two chosen clubs, dressed so a child can tell them apart.
 *
 * ⚠️ IT THROWS ON A CLUB PLAYING ITSELF rather than quietly picking somebody else. Every path that can
 * produce it is a defect in the caller - two `<select>`s with the same value, an index arriving twice -
 * and a fixture that silently substituted an opponent would leave the screen saying one thing and the
 * pitch showing another.
 */
export function fixtureOf(homeIndex: number, awayIndex: number): Fixture {
  const h = clamped(homeIndex);
  const a = clamped(awayIndex);
  if (h === a) throw new Error(`a club cannot play itself: ${CLUBS[h].nameKey}`);

  const home = CLUBS[h];
  const away = CLUBS[a];
  const reads = Math.abs(lumaOf(home.kit) - lumaOf(away.kit)) >= LUMA_GAP;

  return {
    home: { nameKey: home.nameKey, crest: home.crest, kit: home.kit, keeperKit: keeperShirt(0) },
    away: {
      nameKey: away.nameKey,
      crest: away.crest,
      kit: reads ? away.kit : away.changeKit,
      keeperKit: keeperShirt(1),
    },
  };
}

/**
 * A keeper's shirt: the two middle bands, one per side.
 *
 * ⚠️ THE BANDS AND NOT A RANDOM COLOUR. A keeper has to read against BOTH outfield kits AND against the
 * other keeper - four shirts, six pairs, every one of which must clear the gap. Bands 1 and 2 satisfy all
 * six by construction, because the outfield kits are always on the two extremes. Picking a colour and
 * hoping is how the seeded generator came to fail 361 of 500 fixtures before `colourAt` was fixed.
 *
 * ⚠️ THE HUE IS FIXED PER SIDE AND THAT IS DELIBERATE. A keeper is not a club - she is the one shirt on
 * the pitch that must never be mistaken for anything - so it is the same shirt in every fixture, and a
 * child learns it once instead of relearning it per match.
 */
function keeperShirt(side: 0 | 1): number {
  const hue = side === 0 ? 0.18 : 0.62;
  return colourAt(() => hue, BANDS[side === 0 ? 1 : 2]);
}
