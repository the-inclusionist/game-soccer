// SPDX-License-Identifier: AGPL-3.0-or-later
// CHOOSING WHO PLAYS, WITHOUT LOSING THE ONE RULE THAT IS NOT TASTE.
//
// ========================= WHY A CHOICE IS DANGEROUS HERE =========================
// The fixture used to come from a seed, and the generator RETRIED until the two kits cleared the luma
// gap - which made "the two sides are distinguishable" a property of the generator rather than of a lucky
// seed. Letting a child pick both clubs throws that away: she will pick the two she likes, and nothing in
// a seed is left to retry.
//
// So the clubs keep their identity - name, crest, first-choice kit - and the FIXTURE decides what is
// worn. When the two first choices are too close, the away side changes kit, which is what football
// itself does and is the only answer that keeps both the child's choice and the guarantee.
//
// ⚠️ AND THE GATE IS EVERY ORDERED PAIR, not a sample. Twelve clubs is 132 fixtures; a child will find
// the one bad pair on the first afternoon, and a spot check is how it would ship.
import { describe, expect, it } from 'vitest';
import { CLUBS, fixtureOf } from '../app/js/teams/roster.ts';
import { LUMA_GAP, lumaOf } from '../app/js/teams/clubs.ts';

const pairs: [number, number][] = [];
for (let h = 0; h < CLUBS.length; h++) {
  for (let a = 0; a < CLUBS.length; a++) if (h !== a) pairs.push([h, a]);
}

describe('the clubs a child can choose from', () => {
  it('[Interface] there are enough to choose between and few enough to read', () => {
    expect(CLUBS.length).toBeGreaterThanOrEqual(8);
    expect(CLUBS.length).toBeLessThanOrEqual(16);
  });

  it('[Zero] no two of them share a name', () => {
    expect(new Set(CLUBS.map((c) => c.nameKey)).size).toBe(CLUBS.length);
  });

  it('[Interface] a name is a dictionary KEY, so a club is not English', () => {
    for (const club of CLUBS) expect(club.nameKey, club.nameKey).toMatch(/^club\./);
  });

  // ⚠️ IDENTITY IS THE POINT OF CHOOSING. A child picks her club because it is HERS; if its crest changed
  //    with the opponent it would not be a club, it would be a colour scheme.
  it('[Right] a club keeps its crest and its name whoever it plays', () => {
    for (const [h, a] of pairs) {
      const asHome = fixtureOf(h, a).home;
      expect(asHome.nameKey, `${h} v ${a}`).toBe(CLUBS[h].nameKey);
      expect(asHome.crest, `${h} v ${a}`).toEqual(CLUBS[h].crest);
    }
  });

  it('[Right] and it is the same club whether it is at home or away', () => {
    for (const [h, a] of pairs) {
      expect(fixtureOf(h, a).home.crest).toEqual(fixtureOf(a, h).away.crest);
    }
  });
});

describe('every pairing a child can make', () => {
  // ⚠️ THE GATE THE WHOLE FEATURE HANGS ON. Two kits a child cannot tell apart is not an aesthetic
  //    problem: it is a child who cannot play. Hue is not enough, because a colour-blind child reads a
  //    mid red and a mid green as one colour.
  it('[Interface] the two outfield kits clear the luma gap - all 132 of them', () => {
    for (const [h, a] of pairs) {
      const f = fixtureOf(h, a);
      const gap = Math.abs(lumaOf(f.home.kit) - lumaOf(f.away.kit));
      expect(gap, `${CLUBS[h].nameKey} v ${CLUBS[a].nameKey}`).toBeGreaterThanOrEqual(LUMA_GAP);
    }
  });

  it('[Interface] and each keeper clears both outfield kits and the other keeper', () => {
    for (const [h, a] of pairs) {
      const f = fixtureOf(h, a);
      const shirts = [f.home.kit, f.away.kit, f.home.keeperKit, f.away.keeperKit];
      for (let i = 0; i < shirts.length; i++) {
        for (let j = i + 1; j < shirts.length; j++) {
          const gap = Math.abs(lumaOf(shirts[i]) - lumaOf(shirts[j]));
          expect(gap, `${CLUBS[h].nameKey} v ${CLUBS[a].nameKey}: shirt ${i} and ${j}`).toBeGreaterThanOrEqual(
            LUMA_GAP,
          );
        }
      }
    }
  });

  // The home side is at home: it wears what it always wears, and the visitor is the one who changes.
  it('[Right] the home club always wears its own first choice', () => {
    for (const [h, a] of pairs) expect(fixtureOf(h, a).home.kit, `${h} v ${a}`).toBe(CLUBS[h].kit);
  });

  it('[Right] and a visitor whose kit already reads keeps it rather than changing for nothing', () => {
    const changed = pairs.filter(([h, a]) => fixtureOf(h, a).away.kit !== CLUBS[a].kit);

    // Some must change, or the rule is doing nothing; and not all, or the first-choice kit is decoration.
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.length).toBeLessThan(pairs.length);
  });

  it('[Zero] the same pairing always gives the same fixture', () => {
    expect(fixtureOf(0, 5)).toEqual(fixtureOf(0, 5));
  });

  it('[Zero] a club never plays itself, however it is asked', () => {
    expect(() => fixtureOf(3, 3)).toThrow();
  });

  it('[Boundary] an index off the end is clamped rather than producing a club with no name', () => {
    expect(fixtureOf(-1, 99).home.nameKey).toBe(CLUBS[0].nameKey);
    expect(fixtureOf(-1, 99).away.nameKey).toBe(CLUBS[CLUBS.length - 1].nameKey);
  });
});
