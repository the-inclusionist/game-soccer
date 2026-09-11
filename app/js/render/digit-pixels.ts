// SPDX-License-Identifier: AGPL-3.0-or-later
// TEN GLYPHS, AS PLANS. The only characters this game ever draws on the pitch.
//
// ========================= WHY A FONT AND NOT A TEXT OBJECT =========================
// Everything on this pitch is a plan of cells: the figure, the three markers, the ball, the markings. A
// text object would be the one thing on screen whose pixels nobody chose - anti-aliased against a
// NEAREST-sampled world, landing on fractional positions, and shaped by whichever font stack the browser
// happens to have. At three pixels wide that last one is the difference between a 6 and an 8.
//
// ⚠️ AND THERE IS NO ALPHABET HERE BECAUSE THERE ARE NO NAMES. The plan for this item asks how many
// pixels a legible digit needs and whether a surname fits beside it; the answer to the second is that
// this game has no player names at all. A body's whole identity is `shirtOf` - one to eleven - so there
// is no name to fit, to abbreviate, or to cut. The reference game shows "9 GOUIRI" because it ships real
// squads; we ship fictional clubs on purpose, and the number is the honest whole of it.
//
// ⚠️ THREE BY FIVE IS THE FLOOR AND NOT A CHOICE. Below it digits stop being told apart - a 3, an 8 and
// a 9 all become a blob with a notch - and this is the size every pixel font since the arcades has
// settled on for the same reason. At the doubled camera each cell is drawn two pixels square, so a shirt
// number stands six by ten on screen, which is why it can be there at all: at the old scale it would
// have been three pixels tall over a thirteen-pixel body and unreadable beside its own marker.

/** The box one digit is drawn in, in plan cells. */
export const DIGIT = Object.freeze({ w: 3, h: 5 });

/** A filled pixel, as `[x, y]` inside the box. */
export type Cell = readonly [number, number];

/**
 * The glyphs, written as rows so a person can read them here rather than decoding coordinates.
 *
 * ⚠️ THE SHAPES ARE PAIRWISE DISTINCT AND A GATE SAYS SO. At this size a 6 and an 8 differ by one pixel
 * if nobody checks, and a child reading the wrong number is a child driving a body she did not choose -
 * worse than no number at all, because a wrong answer is one she will act on.
 */
const ROWS: readonly (readonly string[])[] = Object.freeze([
  // A ROUNDED zero, not a rectangle: against the 8 above it a boxed zero differs by ONE pixel - the
  // middle bar - and a child reading 10 as 18 is a child told the wrong player. Cutting the corners is
  // what every small pixel font does, and here a gate is why.
  ['.#.', '#.#', '#.#', '#.#', '.#.'], // 0
  ['.#.', '##.', '.#.', '.#.', '###'], // 1
  ['###', '..#', '###', '#..', '###'], // 2
  ['###', '..#', '###', '..#', '###'], // 3
  ['#.#', '#.#', '###', '..#', '..#'], // 4
  ['###', '#..', '###', '..#', '###'], // 5
  // The 6 CURLS rather than sitting under a flat bar - a flat-topped 6 differs from the 5 above it by
  // one pixel at its lower left, and both are shirts.
  ['#..', '#..', '###', '#.#', '###'], // 6
  ['###', '..#', '..#', '..#', '..#'], // 7
  ['###', '#.#', '###', '#.#', '###'], // 8
  // And a 9 with a TAIL rather than a flat foot, for the same reason the zero is rounded: against the 3
  // a square-footed 9 differs by the single pixel at its top left, and 3 and 9 are both shirts a child
  // wears. Two pixels is the floor here rather than the markers' three - ten glyphs in fifteen cells is
  // a tighter box than three marks in twenty - and every pair now clears it.
  ['###', '#.#', '###', '..#', '.##'], // 9
]);

const PLANS: readonly (readonly Cell[])[] = Object.freeze(
  ROWS.map((rows) => {
    const cells: Cell[] = [];
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[y].length; x++) if (rows[y][x] === '#') cells.push([x, y]);
    }
    return Object.freeze(cells);
  }),
);

/**
 * The cells of one digit, or an empty plan for anything that is not one.
 *
 * ⚠️ EMPTY RATHER THAN A FALLBACK GLYPH. A zero drawn for an out-of-range value would put a number on a
 * shirt that does not carry it, which is the one thing this whole tag exists to make impossible.
 */
export function digitCells(digit: number): readonly Cell[] {
  return PLANS[digit] ?? [];
}
