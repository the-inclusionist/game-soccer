// SPDX-License-Identifier: AGPL-3.0-or-later
// A CREST, TURNED INTO PIXELS. Pure, so the shape can be asserted without a canvas.
//
// ⚠️ INDICES, NOT COLOURS. The grid says "outside", "field" or "ink"; which colours those are is decided
// at the point of painting. That is what will let high contrast recolour a crest by semantic role later
// without this file learning anything about contrast.
//
// ⚠️ AND EIGHT BY EIGHT IS THE WHOLE BUDGET. At 320x180 a crest beside the score is eight pixels across,
// so a charge is three or four pixels of ink. Six shapes exist because a child can learn six and tell her
// club from another at that size; a sixty-shape heraldry would be a smudge with a taxonomy.

import type { Charge } from '../teams/clubs.ts';

export const CREST_SIZE = 8;

export const OUTSIDE = 0;
export const FIELD = 1;
export const INK = 2;

/**
 * The shield mask: full width at the top, tapering to a point at the bottom.
 *
 * A square would be cheaper and would also stop being a crest - a badge is recognisable by its OUTLINE
 * before any charge on it is legible, and at this size the outline is most of what a child sees.
 */
const SHIELD: readonly number[] = Object.freeze([
  // Cells inset from each edge, per row, top to bottom.
  0, 0, 0, 0, 1, 1, 2, 3,
]);

function insideShield(x: number, y: number): boolean {
  const inset = SHIELD[y];
  return x >= inset && x < CREST_SIZE - inset;
}

/** Where the ink goes, per charge. Each is a predicate over the shield's cells. */
const CHARGE_INK: Readonly<Record<Charge, (x: number, y: number) => boolean>> = Object.freeze({
  /** A vertical band down the middle. */
  pale: (x) => x === 3 || x === 4,
  /** A vertical band and a horizontal one. */
  cross: (x, y) => x === 3 || x === 4 || y === 3 || y === 4,
  /** A shallow V. */
  chevron: (x, y) => y === Math.abs(x - 3) + 2 || y === Math.abs(x - 3) + 3,
  /** A blob in the middle. */
  disc: (x, y) => (x - 3.5) * (x - 3.5) + (y - 3) * (y - 3) <= 2.6,
  /** A diagonal band. */
  bend: (x, y) => x - y === 0 || x - y === 1,
  /** Two opposite quarters. */
  quarters: (x, y) => (x < 4) === (y < 4),
});

/**
 * The grid for one charge. Row-major, `CREST_SIZE * CREST_SIZE` entries.
 *
 * It takes the CHARGE and not the crest, because the colours are not consulted: a signature that asked
 * for them would be inviting a future reader to use them here, which is exactly what the index grid
 * exists to prevent.
 */
export function crestPixels(charge: Charge): number[] {
  const out: number[] = [];

  for (let y = 0; y < CREST_SIZE; y++) {
    for (let x = 0; x < CREST_SIZE; x++) {
      if (!insideShield(x, y)) {
        out.push(OUTSIDE);
        continue;
      }
      out.push(CHARGE_INK[charge](x, y) ? INK : FIELD);
    }
  }

  return out;
}
