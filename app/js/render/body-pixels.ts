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

/**
 * The parts a renderer knows how to colour. `shirt` is the club's; the rest are the same for everybody.
 *
 * ⚠️ `hair` ARRIVED WHEN FACING DID, AND IT HAD TO. With five flat parts a figure seen from the front
 * and the same figure seen from BEHIND are the identical plan of cells - there is no face at this size,
 * so nothing tells them apart. A sixth index, painted a fixed dark colour, is the cheapest thing that
 * does: hair on the top rows for a front view and over the whole head for a back one.
 *
 * ⚠️ AND IT IS ADDED BEFORE THE ART IS DRAWN RATHER THAN AFTER, which is the entire reason this item
 * sits ahead of the drawing in the plan. `docs/FIGURE-SPEC` is the Dev's brief; a part discovered to be
 * missing once he has painted eight facings is a repaint, and discovered now it is one more row in a
 * table. It is a FIXED colour and never a club one, so the kit palettes and the luminance guarantee
 * between them are untouched.
 */
export const PARTS = ['head', 'hair', 'shirt', 'arm', 'shorts', 'leg'] as const;

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
 * The eight ways a body can face, starting at the camera and going clockwise.
 *
 * ⚠️ EIGHT AND NOT FOUR, and the reason is the simulation rather than taste: `Body.facing` is already a
 * unit vector and eight points fall out of it by COMPARISON alone, which is what the arithmetic rule of
 * this repository leaves available. Four would make a diagonal run read as a player sliding sideways, and
 * diagonal running is the ordinary case in football rather than the exception.
 */
export const FACINGS = ['s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw'] as const;

export type Facing = (typeof FACINGS)[number];

/**
 * Which way this body is facing, from the direction it is pointing in the WORLD.
 *
 * ⚠️ WORLD SPACE AND NOT SCREEN SPACE. The projection squashes the far axis, so a body running directly
 * away covers fewer screen pixels than one running across - and bucketing the SCREEN direction would draw
 * a back view as a side one whenever somebody ran slowly upfield. What is shown is which way he is really
 * going.
 *
 * ⚠️ AND IT IS ALL COMPARISONS, with no angle anywhere. `Math.atan2` is what this would obviously be
 * written with, and it is on this repository's forbidden list for a reason that applies here too: it is
 * not exactly rounded, so two machines replaying one match could disagree about which sprite to draw.
 */
export function facingOf(x: number, y: number): Facing {
  // A body standing dead still keeps looking at the camera rather than snapping to an arbitrary point.
  if (x === 0 && y === 0) return 's';

  const ax = x < 0 ? -x : x;
  const ay = y < 0 ? -y : y;
  // The diagonal band is where neither axis is more than twice the other. Anything narrower would make
  // the diagonals slivers a running player passes straight through without the sprite ever changing.
  const diagonal = ax * 2 > ay && ay * 2 > ax;

  if (diagonal) {
    if (y > 0) return x > 0 ? 'se' : 'sw';
    return x > 0 ? 'ne' : 'nw';
  }
  if (ax > ay) return x > 0 ? 'e' : 'w';
  return y > 0 ? 's' : 'n';
}

/**
 * For each facing, the one it is MIRRORED from, or `null` when it is drawn in its own right.
 *
 * ⚠️ FIVE DRAWN AND EIGHT SHOWN IS WHAT `docs/FIGURE-SPEC` ASKS OF THE DRAWING. Mirroring is safe here
 * only because no shirt number is ever on the sprite - the number a child needs is on the DOM mirror and
 * on a plate above her head, where a screen reader reaches it - so there is no text to come out backwards
 * and nothing else on the figure is left-or-right specific.
 */
export const MIRRORED: Readonly<Record<Facing, Facing | null>> = Object.freeze({
  s: null,
  se: null,
  e: null,
  ne: null,
  n: null,
  nw: 'ne',
  w: 'e',
  sw: 'se',
});

/**
 * Which view each facing is built from, which for the procedural figure is fewer than five.
 *
 * ⚠️ THE INTERIM SHIPS THREE VIEWS WHERE THE CONTRACT ASKS FOR FIVE, and it says so rather than
 * pretending otherwise. Front, side and back are what six flat-coloured parts can carry honestly; the
 * diagonals borrow their nearest neighbour. When the drawing arrives it fills this table with five and
 * nothing else in the game moves - which is the whole reason the table exists before the art does.
 */
const VIEW: Readonly<Record<Facing, 'front' | 'side' | 'back'>> = Object.freeze({
  s: 'front',
  se: 'side',
  e: 'side',
  ne: 'side',
  n: 'back',
  nw: 'side',
  w: 'side',
  sw: 'side',
});

/**
 * The cells of one pose, facing one way.
 *
 * ⚠️ AN UNKNOWN FRAME IS THE STANDING ONE, not an empty figure. A player who vanished because an index
 * arrived wrong is a player a child cannot find, and the failure would look like the game losing bodies.
 */
export function bodyCells(facing: Facing, frame: number): readonly Cell[] {
  const view = VIEW[facing] ?? 'front';
  const base = frame === 1 ? running() : standing();
  if (view === 'front') return base;
  if (view === 'back') return base.map((c) => (c.part === 'head' ? cell(c.x, c.y, 'hair') : c));
  return sideOf(base);
}

/**
 * A front view turned side on: the far arm hidden behind the torso, and the figure a column narrower.
 *
 * ⚠️ NARROWER IS THE WHOLE CUE AT THIS SIZE. A person seen from the side takes up less width, and that
 * change of silhouette is what an eye reads before any detail - the same argument the three markers are
 * built on, applied to a body.
 */
function sideOf(base: readonly Cell[]): readonly Cell[] {
  const out: Cell[] = [];
  for (const c of base) {
    // The far arm is behind the torso from here, so it is simply not drawn.
    if (c.part === 'arm' && c.x < 3) continue;
    out.push(c.x > 3 ? cell(c.x - 1, c.y, c.part) : c);
  }
  // Two legs one behind the other read as one leg, which is what a side view of a stride looks like.
  const seen = new Set();
  return out.filter((c) => {
    const key = c.x + ',' + c.y;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
