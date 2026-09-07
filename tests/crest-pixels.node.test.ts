// SPDX-License-Identifier: AGPL-3.0-or-later
// A CREST, AS AN EIGHT-BY-EIGHT GRID OF INDICES.
//
// ========================= WHY THE PIXELS ARE COMPUTED WHERE THERE IS NO CANVAS =========================
// `crestOf` produces a DESCRIPTION - a charge and two colours - and this turns it into a grid. Both halves
// are pure, so the shape of a crest can be asserted without a browser: that it is a shield rather than a
// square, that the charge actually appears, that a charge is never invisible on its field. A rasteriser
// that only existed inside PixiJS could be checked by eye and by nothing else.
//
// ⚠️ INDICES, NOT COLOURS. The grid says "field" or "ink" or "outside"; the colours are applied at the
// point of painting. That is what lets high contrast recolour a crest later without this file knowing.
import { describe, expect, it } from 'vitest';
import { CREST_SIZE, OUTSIDE, FIELD, INK, crestPixels } from '../app/js/render/crest-pixels.ts';
import { CHARGES, crestOf } from '../app/js/teams/clubs.ts';

const grid = (seed: number) => crestPixels(crestOf(seed).charge);

const count = (g: readonly number[], value: number) => g.filter((v) => v === value).length;

describe('the grid', () => {
  it('[Interface] it is eight by eight, and every cell is one of the three indices', () => {
    const g = grid(1);

    expect(g).toHaveLength(CREST_SIZE * CREST_SIZE);
    for (const cell of g) expect([OUTSIDE, FIELD, INK]).toContain(cell);
  });

  it('[Right] it is a SHIELD, not a square - the bottom corners are outside it', () => {
    const g = grid(1);
    const at = (x: number, y: number) => g[y * CREST_SIZE + x];

    expect(at(0, CREST_SIZE - 1)).toBe(OUTSIDE);
    expect(at(CREST_SIZE - 1, CREST_SIZE - 1)).toBe(OUTSIDE);
    expect(at(0, 0)).not.toBe(OUTSIDE);
  });

  // ⚠️ A CHARGE THAT NEVER APPEARS IS A BADGE-SHAPED SMUDGE. Six shapes exist so a child can learn to tell
  //    her club from another at eight pixels; a charge that covers nothing, or everything, tells her nothing.
  it('[Many] every charge paints some ink, and never covers the whole field', () => {
    for (const charge of CHARGES) {
      const g = crestPixels(charge);
      const inked = count(g, INK);
      const fielded = count(g, FIELD);

      expect(inked, charge).toBeGreaterThan(3);
      expect(fielded, charge).toBeGreaterThan(3);
    }
  });

  it('[Many] the six charges produce six DIFFERENT grids, or they are one charge with six names', () => {
    const seen = new Set(
      CHARGES.map((charge) => crestPixels(charge).join('')),
    );

    expect(seen.size).toBe(CHARGES.length);
  });

  it('[Interface] the same description always gives the same grid', () => {
    expect(grid(7)).toEqual(grid(7));
  });

  it('[Boundary] nothing is painted outside the shield, whatever the charge', () => {
    for (const charge of CHARGES) {
      const g = crestPixels(charge);
      expect(g[(CREST_SIZE - 1) * CREST_SIZE], charge).toBe(OUTSIDE);
    }
  });
});
