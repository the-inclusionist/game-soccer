// SPDX-License-Identifier: AGPL-3.0-or-later
// SIX NUMBERS PER CLUB, AND THE REASON THEY ALL ADD UP TO THE SAME THING.
//
// ========================= ANOTHER SYSTEM THAT EXISTED AND WAS UNREACHABLE =========================
// `ai/ratings` has six ratings, applies every one of them at the point of action, and is gated by a
// monotonicity test - a better passer completes strictly more passes. The composition root passed
// `{ 0: AVERAGE, 1: AVERAGE }`. Every club played identically, so twelve clubs were twelve palettes.
//
// It is the fourth time in this repository: a module that is right, a gate that is right, and no wire.
//
// ========================= AND WHY NO CLUB IS BETTER THAN ANOTHER =========================
// ⚠️ THE SIX ADD UP TO THE SAME TOTAL FOR EVERY CLUB. A child picks the badge she likes; if that badge
// carried a worse team she would have been punished for a choice the game invited her to make on looks,
// and she would have no way to know. So clubs differ in SHAPE and not in strength: one is quick and
// careless, another slow and composed, and neither is the right answer.
//
// That is also ADR-0006 territory. A game where some clubs are simply better is a game with a ladder in
// it, and a child learns to pick the strong one rather than the one that is hers.
import { describe, expect, it } from 'vitest';
import { CLUBS } from '../app/js/teams/roster.ts';
import { AVERAGE, capsFor, controlRadiusOf, passErrorOf } from '../app/js/ai/ratings.ts';

const KEYS = ['pace', 'control', 'passing', 'shooting', 'defending', 'composure'] as const;
const total = (r: Record<string, number>) => KEYS.reduce((n, k) => n + r[k], 0);

describe('every club has ratings', () => {
  it('[Interface] all six, on every club, as real numbers in range', () => {
    for (const club of CLUBS) {
      for (const key of KEYS) {
        const v = club.ratings[key];
        expect(Number.isFinite(v), `${club.nameKey}/${key}`).toBe(true);
        expect(v, `${club.nameKey}/${key}`).toBeGreaterThan(0);
        expect(v, `${club.nameKey}/${key}`).toBeLessThan(1);
      }
    }
  });

  it('[Zero] and the same club is always the same club', () => {
    expect(CLUBS[3].ratings).toEqual(CLUBS[3].ratings);
  });
});

describe('no club is better than another', () => {
  // ⚠️ THE GATE THE WHOLE DESIGN RESTS ON. A child picks a badge; if the badge carried a worse team she
  //    would be punished for choosing on looks, with nothing on the screen to warn her.
  it('[Interface] the six add up to the same total for every one of them', () => {
    const totals = CLUBS.map((c) => total(c.ratings as unknown as Record<string, number>));

    for (const [i, t] of totals.entries()) expect(t, CLUBS[i].nameKey).toBeCloseTo(totals[0], 6);
  });

  it('[Right] and that total is the one a side of all-average players would have', () => {
    expect(total(CLUBS[0].ratings as unknown as Record<string, number>)).toBeCloseTo(
      total(AVERAGE as unknown as Record<string, number>),
      6,
    );
  });

  // ⚠️ EQUAL TOTALS WOULD BE SATISFIED BY MAKING EVERY CLUB AVERAGE, which is the lazy answer and leaves
  //    twelve palettes again. They have to actually DIFFER.
  it('[Right] no two clubs are the same side', () => {
    const shapes = CLUBS.map((c) => KEYS.map((k) => c.ratings[k].toFixed(4)).join(','));

    expect(new Set(shapes).size).toBe(CLUBS.length);
  });

  it('[Right] and the difference is big enough to feel, not a rounding error', () => {
    for (const key of KEYS) {
      const values = CLUBS.map((c) => c.ratings[key]);
      expect(Math.max(...values) - Math.min(...values), key).toBeGreaterThan(0.2);
    }
  });

  // ⚠️ "EVERY CLUB IS THE BEST AT SOMETHING" WAS THE FIRST VERSION OF THIS, AND IT CANNOT HOLD. Twelve
  //    clubs and six ratings leave twelve extreme positions in total, and one club can own two of them -
  //    so somebody is always in the middle of the pack everywhere, by counting rather than by any fault
  //    in the design.
  //
  //    What has to be true, and is, is that no club is AVERAGE at everything: each one has a real
  //    strength and a real weakness of its own, which is what makes it a side rather than a palette.
  it('[Right] every club has a strength and a weakness of its own', () => {
    for (const club of CLUBS) {
      const highs = KEYS.filter((k) => club.ratings[k] > 0.5 + 0.05);
      const lows = KEYS.filter((k) => club.ratings[k] < 0.5 - 0.05);

      expect(highs.length, `${club.nameKey} is good at nothing in particular`).toBeGreaterThan(0);
      expect(lows.length, `${club.nameKey} is weak at nothing in particular`).toBeGreaterThan(0);
    }
  });
});

describe('the ratings reach the game they were written for', () => {
  // The consumers `ai/ratings` already exposes. If a club's numbers could not move these, they would be
  // decoration on a card.
  it('[Right] a quicker club really is quicker', () => {
    const fast = CLUBS.reduce((a, b) => (a.ratings.pace > b.ratings.pace ? a : b));
    const slow = CLUBS.reduce((a, b) => (a.ratings.pace < b.ratings.pace ? a : b));

    expect(capsFor(fast.ratings).maxSpeed).toBeGreaterThan(capsFor(slow.ratings).maxSpeed);
    expect(capsFor(fast.ratings).accel).toBeGreaterThan(capsFor(slow.ratings).accel);
  });

  it('[Right] a better passer really passes straighter', () => {
    const good = CLUBS.reduce((a, b) => (a.ratings.passing > b.ratings.passing ? a : b));
    const poor = CLUBS.reduce((a, b) => (a.ratings.passing < b.ratings.passing ? a : b));

    expect(passErrorOf(good.ratings.passing)).toBeLessThan(passErrorOf(poor.ratings.passing));
  });

  it('[Right] and a better dribbler keeps the ball closer', () => {
    const good = CLUBS.reduce((a, b) => (a.ratings.control > b.ratings.control ? a : b));
    const poor = CLUBS.reduce((a, b) => (a.ratings.control < b.ratings.control ? a : b));

    expect(controlRadiusOf(good.ratings.control)).toBeGreaterThan(controlRadiusOf(poor.ratings.control));
  });
});
