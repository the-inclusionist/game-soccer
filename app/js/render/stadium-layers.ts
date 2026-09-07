// SPDX-License-Identifier: AGPL-3.0-or-later
// THE STADIUM'S LAYERS, as data. Pure, so the numbers can be argued without a canvas.
//
// ⚠️ THE ENGINE'S OWN `PARALLAX` TABLE IS NOT USED, and the reason is one number. Its three layers all
// carry `fy: 0` - no vertical movement - which is right for the platformer, whose camera hardly pans up
// and down, and wrong for a broadcast camera whose entire character is depth panning. Reusing the engine's
// `posicoesParallax` is reusing a CALCULATION; reusing its table would be inheriting a DECISION that was
// taken for a different game.

/** One parallax layer. `factor` is horizontal drift, `fy` vertical - both fractions of the camera. */
export interface StadiumLayer {
  readonly key: string;
  readonly factor: number;
  readonly fy: number;
}

/**
 * Three layers, from the horizon to the hoardings.
 *
 * ⚠️ VERTICAL IS ALWAYS SMALLER THAN HORIZONTAL. A stand that drifted as much vertically as horizontally
 * would read as a lift rather than as distance - the same reason the camera's own vertical gain is half
 * its horizontal one.
 */
export const STADIUM_LAYERS: readonly StadiumLayer[] = Object.freeze([
  { key: 'sky', factor: 0.1, fy: 0.04 },
  { key: 'far', factor: 0.28, fy: 0.11 },
  { key: 'near', factor: 0.52, fy: 0.21 },
]);

const clamp255 = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

/**
 * Three shades of a crowd, close together.
 *
 * ⚠️ A CROWD IS TEXTURE, NOT DETAIL. At 320x180 a face is one pixel, and a high-contrast speckle behind
 * the pitch competes with the ball for the attention of a child who is already struggling to track it.
 * The bands sit within a few percent of each other on purpose, and there is a gate that says so.
 */
export function crowdBands(base: number): number[] {
  const r = (base >> 16) & 0xff;
  const g = (base >> 8) & 0xff;
  const b = base & 0xff;

  return [-10, 0, 10].map((shift) =>
    ((clamp255(r + shift) << 16) | (clamp255(g + shift) << 8) | clamp255(b + shift)) >>> 0,
  );
}
