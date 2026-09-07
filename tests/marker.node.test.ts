// SPDX-License-Identifier: AGPL-3.0-or-later
// WHICH OF THE TWO PLAYERS IS MINE.
//
// ========================= THE MARKER IS THE DIFFERENCE BETWEEN A GAME AND A SCREENSAVER =========================
// A child who cannot find her own body on a pitch of twenty-two is not playing. With two seats that
// doubles: two markers of the same shape in the same colour tell each child that ONE of those two is
// hers, which is worse than one marker, because now she can be confidently wrong.
//
// ⚠️ SO THEY DIFFER IN SHAPE AND NOT ONLY IN COLOUR. Colour alone fails a colour-blind child, and this
// engine has a whole filter stack built on the premise that it does. Five pixels by four is not much room
// to be different in, which is exactly why the shapes are DATA here and gated, rather than two calls to
// `drawRect` nobody ever compares.
import { describe, expect, it } from 'vitest';
import { MARKER, markerCells } from '../app/js/render/marker-pixels.ts';

const cells = [markerCells(0), markerCells(1)];
const key = (c: readonly (readonly [number, number])[]): string =>
  [...c].map(([x, y]) => `${x},${y}`).sort().join(' ');

describe('a marker', () => {
  it('[Boundary] fits in the five by four it is given', () => {
    for (const [seat, plan] of cells.entries()) {
      for (const [x, y] of plan) {
        expect(x, `seat ${seat}`).toBeGreaterThanOrEqual(0);
        expect(y, `seat ${seat}`).toBeGreaterThanOrEqual(0);
        expect(x, `seat ${seat}`).toBeLessThan(MARKER.w);
        expect(y, `seat ${seat}`).toBeLessThan(MARKER.h);
      }
    }
  });

  it('[Interface] is big enough to see at 320x180 and small enough not to hide the player', () => {
    for (const [seat, plan] of cells.entries()) {
      expect(plan.length, `seat ${seat}`).toBeGreaterThanOrEqual(4);
      expect(plan.length, `seat ${seat}`).toBeLessThan(MARKER.w * MARKER.h);
    }
  });

  it('[Zero] and no cell is drawn twice, which would be a plan disagreeing with itself', () => {
    for (const [seat, plan] of cells.entries()) {
      expect(new Set(plan.map(([x, y]) => `${x},${y}`)).size, `seat ${seat}`).toBe(plan.length);
    }
  });
});

describe('telling the two seats apart', () => {
  it('[Right] the two shapes are not the same shape', () => {
    expect(key(cells[0])).not.toBe(key(cells[1]));
  });

  // ⚠️ THE ASSERTION THAT CATCHES THE LAZY VERSION. "Make the second one the same wedge, one pixel lower"
  //    passes every test above and is invisible in play: two children see the same silhouette and learn
  //    to look at the colour, which is what the shape was supposed to save them from.
  it('[Right] and one is not just the other moved', () => {
    for (let dx = -MARKER.w; dx <= MARKER.w; dx++) {
      for (let dy = -MARKER.h; dy <= MARKER.h; dy++) {
        const shifted = cells[0].map(([x, y]) => [x + dx, y + dy] as const);
        expect(key(shifted), `seat 1 is seat 0 shifted by ${dx},${dy}`).not.toBe(key(cells[1]));
      }
    }
  });

  it('[Right] and they differ by more than a single pixel, which nobody can see at this size', () => {
    const mine = new Set(cells[0].map(([x, y]) => `${x},${y}`));
    const theirs = new Set(cells[1].map(([x, y]) => `${x},${y}`));
    const onlyOne = [...mine].filter((c) => !theirs.has(c)).length + [...theirs].filter((c) => !mine.has(c)).length;

    expect(onlyOne).toBeGreaterThanOrEqual(3);
  });

  it('[Zero] a seat nobody is sitting in has no marker rather than a blank one', () => {
    expect(markerCells(2)).toEqual([]);
    expect(markerCells(-1)).toEqual([]);
  });
});
