// SPDX-License-Identifier: AGPL-3.0-or-later
// THE MARK OVER YOUR OWN PLAYER, as a plan rather than as two calls to `drawRect`.
//
// ========================= WHY THIS IS DATA AND NOT DRAWING CODE =========================
// With one seat the marker only had to EXIST. With two it has to be TELLABLE APART, and that is a
// property of the pair - which no amount of looking at either half will check. Written as cells, the
// difference between the two is something a test can measure; written as drawing calls inside the scene,
// it is something a person has to notice on a 320x180 screen with twenty-two other things moving.
//
// ⚠️ AND THEY DIFFER IN SHAPE, NOT ONLY IN COLOUR. A colour-blind child is the reason the engine carries a
// whole filter stack; a game that then said "yours is the yellow one" would be undoing that in the one
// place it matters most. Five by four is very little room to be different in, which is why the difference
// is a whole silhouette - a solid wedge against a pair of bars - rather than a shade.

/** The box a marker is drawn in, in pixels. Small: it sits over a body twelve pixels tall. */
export const MARKER = Object.freeze({ w: 5, h: 4 });

/** A filled pixel, as `[x, y]` inside the box. */
export type Cell = readonly [number, number];

/**
 * The first seat: a solid wedge pointing down at the head, three across and tapering to one.
 *
 * It is the shape this game already had when there was one seat, kept because the child who has been
 * playing solo should not have her marker change the day a friend sits down.
 */
const WEDGE: readonly Cell[] = Object.freeze([
  [1, 0],
  [2, 0],
  [3, 0],
  [2, 1],
  [2, 2],
]);

/**
 * The second seat: two bars, an equals sign.
 *
 * ⚠️ CHOSEN BECAUSE ITS OUTLINE IS DIFFERENT AT ONE PIXEL, not because it looks better. A wedge has one
 * wide row and a stem; this has two wide rows and no stem. At this size that is the largest difference
 * available, and it survives every colour-blindness filter and a black-and-white screen.
 */
const BARS: readonly Cell[] = Object.freeze([
  [1, 0],
  [2, 0],
  [3, 0],
  [1, 2],
  [2, 2],
  [3, 2],
]);

/**
 * The cells for one seat, or an empty plan for a seat nobody is sitting in.
 *
 * ⚠️ EMPTY RATHER THAN A DEFAULT. A third seat does not exist, and answering with the first seat's wedge
 * would draw a mark over a body nobody is driving - which is the one thing this whole marker exists to
 * make impossible.
 */
export function markerCells(seat: number): readonly Cell[] {
  if (seat === 0) return WEDGE;
  if (seat === 1) return BARS;
  return [];
}
