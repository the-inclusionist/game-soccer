// SPDX-License-Identifier: AGPL-3.0-or-later
// THE DIGITS, AS PLANS - because this renderer has never drawn a letter.
//
// ========================= WHY A FONT AND NOT A `PIXI.Text` =========================
// Everything on this pitch is a plan of cells drawn with `drawRect`: the figure, the three markers, the
// ball, the pitch markings. A text object would be the one thing on the screen whose pixels nobody chose
// - it would anti-alias against a NEAREST-sampled world, land on fractional positions, and change shape
// between one browser's font stack and another's, which at a three-pixel glyph is the difference between
// a 6 and an 8.
//
// ⚠️ AND THE ONLY THING TO DRAW IS A NUMBER, WHICH IS A MEASUREMENT AND NOT A SHORTCUT. The plan for this
// item asks how many pixels a legible digit needs and whether a surname fits beside it. The answer to the
// second is that THIS GAME HAS NO PLAYER NAMES AT ALL - a body's whole identity is `shirtOf`, one to
// eleven - so there is no name to fit or to cut. Ten glyphs, and no alphabet.
import { describe, expect, it } from 'vitest';
import { DIGIT, digitCells } from '../app/js/render/digit-pixels.ts';
import { SQUAD_SIZE, shirtOf } from '../app/js/sim/ids.ts';

const key = (cells: readonly (readonly [number, number])[]): string =>
  [...cells].map(([x, y]) => `${x},${y}`).sort().join(' ');

const ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

describe('a digit', () => {
  it('[Boundary] fits in the three by five it is given', () => {
    for (const d of ALL) {
      for (const [x, y] of digitCells(d)) {
        expect(x, `digit ${d} has a cell outside the box`).toBeGreaterThanOrEqual(0);
        expect(x, `digit ${d} has a cell outside the box`).toBeLessThan(DIGIT.w);
        expect(y, `digit ${d} has a cell outside the box`).toBeGreaterThanOrEqual(0);
        expect(y, `digit ${d} has a cell outside the box`).toBeLessThan(DIGIT.h);
      }
    }
  });

  it('[Zero] and no cell is drawn twice, which would be a plan disagreeing with itself', () => {
    for (const d of ALL) {
      const cells = digitCells(d);
      expect(new Set(cells.map(([x, y]) => `${x},${y}`)).size, `digit ${d} repeats a cell`).toBe(cells.length);
    }
  });

  // ⚠️ THE GATE THIS FILE EXISTS FOR. At three by five a 6 and an 8 differ by one pixel if nobody checks,
  //    and a child reading the wrong number is a child driving a body she did not choose - which is worse
  //    than no number, because a wrong answer is one she will act on.
  it('[Right] no two digits are the same shape', () => {
    for (let a = 0; a < ALL.length; a++) {
      for (let b = a + 1; b < ALL.length; b++) {
        expect(key(digitCells(a)), `${a} and ${b} are the same glyph`).not.toBe(key(digitCells(b)));
      }
    }
  });

  // ⚠️ AND THEY DIFFER BY MORE THAN ONE PIXEL, which is the same assertion the markers needed and for the
  //    same reason: one pixel of difference at this size is a difference nobody can see, so it is not a
  //    difference. Two is the floor here rather than the markers' three, because ten glyphs in fifteen
  //    cells is a tighter box than three marks in twenty.
  it('[Right] and by more than a single pixel', () => {
    for (let a = 0; a < ALL.length; a++) {
      for (let b = a + 1; b < ALL.length; b++) {
        const mine = new Set(digitCells(a).map(([x, y]) => `${x},${y}`));
        const theirs = new Set(digitCells(b).map(([x, y]) => `${x},${y}`));
        const only = [...mine].filter((c) => !theirs.has(c)).length + [...theirs].filter((c) => !mine.has(c)).length;
        expect(only, `${a} and ${b} differ by too little to see`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  // ⚠️ [Interface] EVERY SHIRT THIS GAME CAN ISSUE IS DRAWABLE, asked of `shirtOf` rather than of a range
  //    somebody remembers to keep in step. A squad grows and this gate goes red instead of a child seeing
  //    a blank where her number should be.
  it('[Interface] every shirt number in a squad has a glyph for each of its digits', () => {
    for (let i = 0; i < SQUAD_SIZE; i++) {
      for (const ch of String(shirtOf(i))) {
        expect(digitCells(Number(ch)).length, `shirt ${shirtOf(i)} cannot draw "${ch}"`).toBeGreaterThan(0);
      }
    }
  });

  it('[Zero] and something that is not a digit has no glyph rather than a wrong one', () => {
    expect(digitCells(10)).toEqual([]);
    expect(digitCells(-1)).toEqual([]);
  });
});
