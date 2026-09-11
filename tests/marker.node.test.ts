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
import { MARKER, hintCells, markerCells } from '../app/js/render/marker-pixels.ts';

// ⚠️ THREE PLANS NOW, AND THE GATES BELOW WALK EVERY PAIR OF THEM. Two shapes needed one comparison;
//    three need three, and the one people forget is the pair that does not involve the new arrival. A
//    hint marker checked only against seat 0 could be seat 1's bars exactly.
const cells = [markerCells(0), markerCells(1), hintCells()];
const NAMES = ['seat 0', 'seat 1', 'the hint'];
const PAIRS: readonly (readonly [number, number])[] = [
  [0, 1],
  [0, 2],
  [1, 2],
];
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

describe('telling the three marks apart', () => {
  it('[Right] no two of the shapes are the same shape', () => {
    for (const [a, b] of PAIRS) {
      expect(key(cells[a]), `${NAMES[a]} and ${NAMES[b]} are the same silhouette`).not.toBe(key(cells[b]));
    }
  });

  // ⚠️ THE ASSERTION THAT CATCHES THE LAZY VERSION. "Make the new one the same wedge, one pixel lower"
  //    passes every test above and is invisible in play: two marks show the same silhouette and a child
  //    learns to look at the colour, which is what the shape was supposed to save her from.
  it('[Right] and none is just another one moved', () => {
    for (const [a, b] of PAIRS) {
      for (let dx = -MARKER.w; dx <= MARKER.w; dx++) {
        for (let dy = -MARKER.h; dy <= MARKER.h; dy++) {
          const shifted = cells[a].map(([x, y]) => [x + dx, y + dy] as const);
          expect(key(shifted), `${NAMES[b]} is ${NAMES[a]} shifted by ${dx},${dy}`).not.toBe(key(cells[b]));
        }
      }
    }
  });

  it('[Right] and they differ by more than a single pixel, which nobody can see at this size', () => {
    for (const [a, b] of PAIRS) {
      const mine = new Set(cells[a].map(([x, y]) => `${x},${y}`));
      const theirs = new Set(cells[b].map(([x, y]) => `${x},${y}`));
      const onlyOne =
        [...mine].filter((c) => !theirs.has(c)).length + [...theirs].filter((c) => !mine.has(c)).length;

      expect(onlyOne, `${NAMES[a]} and ${NAMES[b]} differ by too little to see`).toBeGreaterThanOrEqual(3);
    }
  });

  it('[Zero] a seat nobody is sitting in has no marker rather than a blank one', () => {
    expect(markerCells(2)).toEqual([]);
    expect(markerCells(-1)).toEqual([]);
  });

  // ⚠️ AND THE HINT IS NOT A SEAT, which is why it has a function of its own rather than being seat 2.
  //    Nobody drives it; it is a place a press would take her. Answering `markerCells(2)` with it would
  //    make "a mark over a body nobody is driving" reachable again, which is the one thing the gate above
  //    exists to forbid.
  it('[Interface] the hint has its own plan and is not reachable as a third seat', () => {
    expect(hintCells().length, 'the hint has no shape').toBeGreaterThan(0);
    expect(markerCells(2), 'the hint leaked in as a seat').toEqual([]);
  });
});
