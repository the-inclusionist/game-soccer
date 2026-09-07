// SPDX-License-Identifier: AGPL-3.0-or-later
// A PLAYER, CELL BY CELL. Head, arms, shirt, shorts, two legs - at twelve pixels tall.
//
// ========================= WHY THE OLD ONE WAS FOUR RECTANGLES =========================
// The body was a skin block on a kit block on a shorts block, inside a 6x12 silhouette that was a
// rectangle. It reads as a PIECE rather than as a person, and "it should have arms and legs" is a
// property of a SHAPE - which no amount of reading four fill calls can check.
//
// As cells the questions become askable, and `tests/body-pixels.node.test.ts` asks them: is the head
// above the shirt, do the arms reach outside it, are there two legs with grass between them, is the
// running frame a different picture rather than a nudge.
//
// ========================= THE BUDGET IS THE DESIGN, NOT AN OBSTACLE =========================
// ⚠️ TWENTY-TWO OF THESE SHARE A 320x180 SCREEN. Every pixel spent on detail is spent against legibility,
// and the child who loses first is the one with low vision - the population this projection was tilted
// for in the first place. So: three columns of shirt, one column of arm on each side, two legs with a gap.
// Nothing else fits, and nothing else needs to.
//
// ⚠️ AND THE OUTLINE IS DERIVED, NOT DRAWN BEHIND. The old one was a filled rectangle under the figure,
// which is why the silhouette was a rectangle however the figure was shaped. Taking the empty
// four-neighbours of the filled cells makes the outline follow the arms and the gap between the legs -
// and that outline is the single biggest thing separating a player from grass, whatever colour the kit is.

/** The box a figure is drawn in. Seven by thirteen: about 1.8m at this projection's vertical scale. */
export const BODY = Object.freeze({ w: 7, h: 13 });

/** The parts a renderer knows how to colour. `shirt` is the club's; the rest are the same for everybody. */
export const PARTS = ['head', 'shirt', 'arm', 'shorts', 'leg'] as const;

export type Part = (typeof PARTS)[number];

export interface Cell {
  readonly x: number;
  readonly y: number;
  readonly part: Part;
}

const cell = (x: number, y: number, part: Part): Cell => ({ x, y, part });

/**
 * The figure standing still, and the figure mid-stride.
 *
 * ⚠️ A STRIDE HAS TO BE A WHOLE COLUMN. At this size a leg moved by one pixel is a leg that did not move,
 * so the running frame swings both legs out and drops one arm - four changed cells, which is the smallest
 * difference an eye can catch on a body twelve pixels tall crossing the screen.
 */
function standing(): Cell[] {
  return [
    // Head: three wide, three tall, centred.
    cell(2, 0, 'head'), cell(3, 0, 'head'), cell(4, 0, 'head'),
    cell(2, 1, 'head'), cell(3, 1, 'head'), cell(4, 1, 'head'),
    cell(3, 2, 'head'),

    // Shoulders and shirt.
    cell(2, 3, 'shirt'), cell(3, 3, 'shirt'), cell(4, 3, 'shirt'),
    cell(2, 4, 'shirt'), cell(3, 4, 'shirt'), cell(4, 4, 'shirt'),
    cell(2, 5, 'shirt'), cell(3, 5, 'shirt'), cell(4, 5, 'shirt'),
    cell(2, 6, 'shirt'), cell(3, 6, 'shirt'), cell(4, 6, 'shirt'),

    // Arms, one column each side and OUTSIDE the shirt - which is the whole point of the seventh column.
    cell(1, 4, 'arm'), cell(1, 5, 'arm'), cell(1, 6, 'arm'),
    cell(5, 4, 'arm'), cell(5, 5, 'arm'), cell(5, 6, 'arm'),

    cell(2, 7, 'shorts'), cell(3, 7, 'shorts'), cell(4, 7, 'shorts'),
    cell(2, 8, 'shorts'), cell(3, 8, 'shorts'), cell(4, 8, 'shorts'),

    // Two legs with a column of grass between them: at this size that gap is what says "legs" at all.
    cell(2, 9, 'leg'), cell(4, 9, 'leg'),
    cell(2, 10, 'leg'), cell(4, 10, 'leg'),
    cell(2, 11, 'leg'), cell(4, 11, 'leg'),
    cell(2, 12, 'leg'), cell(4, 12, 'leg'),
  ];
}

function running(): Cell[] {
  const out = standing().filter((c) => !(c.part === 'leg' || (c.part === 'arm' && c.x === 5)));
  return [
    ...out,
    // The legs swing wide, one column further out on each side.
    cell(2, 9, 'leg'), cell(4, 9, 'leg'),
    cell(1, 10, 'leg'), cell(5, 10, 'leg'),
    cell(1, 11, 'leg'), cell(5, 11, 'leg'),
    cell(0, 12, 'leg'), cell(6, 12, 'leg'),
    // ...and the trailing arm comes back, which is what stops the stride reading as a scissor.
    cell(5, 3, 'arm'), cell(5, 4, 'arm'), cell(5, 5, 'arm'),
  ];
}

/**
 * The cells of one frame.
 *
 * ⚠️ AN UNKNOWN FRAME IS THE STANDING ONE, not an empty figure. A player who vanished because an index
 * arrived wrong is a player a child cannot find, and the failure would look like the game losing bodies.
 */
export function bodyCells(frame: number): readonly Cell[] {
  return frame === 1 ? running() : standing();
}

/**
 * The one-pixel outline: every empty four-neighbour of a filled cell.
 *
 * It may sit outside the box - an arm on column 0 needs an outline on column -1 - and the renderer draws
 * the whole thing offset by one, which is why the sprite is two pixels wider than `BODY`.
 */
export function outlineOf(cells: readonly Cell[]): readonly { readonly x: number; readonly y: number }[] {
  const filled = new Set(cells.map((c) => `${c.x},${c.y}`));
  const edge = new Map<string, { x: number; y: number }>();

  for (const c of cells) {
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const x = c.x + dx;
      const y = c.y + dy;
      const key = `${x},${y}`;
      if (!filled.has(key)) edge.set(key, { x, y });
    }
  }

  return [...edge.values()];
}
