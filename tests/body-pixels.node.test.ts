// SPDX-License-Identifier: AGPL-3.0-or-later
// A PLAYER WITH ARMS AND LEGS, AT TWELVE PIXELS TALL.
//
// ========================= WHY THIS IS DATA AND NOT `drawRect` =========================
// The body was four stacked rectangles: a skin block, a kit block, a shorts block, in a 6x12 silhouette
// that is a rectangle. It reads as a PIECE, not as a person - and "it should have arms and legs" is a
// property of a SHAPE, which no amount of reading four fill calls will check.
//
// Written as cells, the questions become askable: is there a head above the torso, do the arms reach
// outside it, are there two legs with a gap between them, and does the running frame actually differ from
// the standing one. That is the same move `marker-pixels`, `crest-pixels` and `pitch-marks` made.
//
// ⚠️ AND THE BUDGET IS THE POINT, NOT AN OBSTACLE. Twenty-two of these share a 320x180 screen. A figure
// that spends its pixels on detail stops reading at a glance, and the child who loses first is the one
// with low vision - which is the population this projection was tilted for in the first place.
import { describe, expect, it } from 'vitest';
import { BODY, PARTS, bodyCells, outlineOf, type Part } from '../app/js/render/body-pixels.ts';

const frames = [bodyCells(0), bodyCells(1)];
const colsOf = (cells: readonly { x: number; y: number; part: Part }[], part: Part) =>
  [...new Set(cells.filter((c) => c.part === part).map((c) => c.x))].sort((a, b) => a - b);

describe('the figure fits where it has to', () => {
  it('[Boundary] every cell is inside the box, in both frames', () => {
    for (const [f, cells] of frames.entries()) {
      for (const c of cells) {
        expect(c.x, `frame ${f}`).toBeGreaterThanOrEqual(0);
        expect(c.y, `frame ${f}`).toBeGreaterThanOrEqual(0);
        expect(c.x, `frame ${f}`).toBeLessThan(BODY.w);
        expect(c.y, `frame ${f}`).toBeLessThan(BODY.h);
      }
    }
  });

  it('[Interface] and the box is a person, not a monument - about 1.8m at this projection', () => {
    expect(BODY.h).toBeGreaterThanOrEqual(11);
    expect(BODY.h).toBeLessThanOrEqual(14);
    expect(BODY.w).toBeLessThan(BODY.h);
  });

  it('[Zero] no cell is painted twice in a frame', () => {
    for (const [f, cells] of frames.entries()) {
      expect(new Set(cells.map((c) => `${c.x},${c.y}`)).size, `frame ${f}`).toBe(cells.length);
    }
  });

  it('[Interface] every cell names a part the renderer knows how to colour', () => {
    for (const cells of frames) for (const c of cells) expect(PARTS).toContain(c.part);
  });
});

describe('it is a person', () => {
  // ⚠️ THE WHOLE REQUEST, MADE CHECKABLE. "With legs and arms" is not a matter of taste once it is asked
  //    of the shape.
  it('[Right] the head sits above the shirt', () => {
    for (const [f, cells] of frames.entries()) {
      const headBottom = Math.max(...cells.filter((c) => c.part === 'head').map((c) => c.y));
      const shirtTop = Math.min(...cells.filter((c) => c.part === 'shirt').map((c) => c.y));
      expect(headBottom, `frame ${f}`).toBeLessThan(shirtTop);
    }
  });

  it('[Right] the arms reach OUTSIDE the shirt, one on each side', () => {
    for (const [f, cells] of frames.entries()) {
      const shirt = colsOf(cells, 'shirt');
      const arms = colsOf(cells, 'arm');
      expect(arms.length, `frame ${f}`).toBeGreaterThanOrEqual(2);
      expect(Math.min(...arms), `frame ${f}: no arm to the left of the shirt`).toBeLessThan(Math.min(...shirt));
      expect(Math.max(...arms), `frame ${f}: no arm to the right of the shirt`).toBeGreaterThan(Math.max(...shirt));
    }
  });

  it('[Right] there are two legs with grass between them, not one block', () => {
    for (const [f, cells] of frames.entries()) {
      const legs = colsOf(cells, 'leg');
      expect(legs.length, `frame ${f}`).toBeGreaterThanOrEqual(2);
      expect(Math.max(...legs) - Math.min(...legs), `frame ${f}: the legs touch`).toBeGreaterThanOrEqual(2);
    }
  });

  it('[Right] and the legs are the lowest thing on the figure', () => {
    for (const [f, cells] of frames.entries()) {
      const lowest = Math.max(...cells.map((c) => c.y));
      const legBottom = Math.max(...cells.filter((c) => c.part === 'leg').map((c) => c.y));
      expect(legBottom, `frame ${f}`).toBe(lowest);
    }
  });
});

describe('it runs', () => {
  // ⚠️ A SECOND FRAME THAT DIFFERS ONLY IN A PIXEL IS ONE FRAME. At this size a stride has to be a whole
  //    column or it is not visible at all.
  it('[Right] the running frame is a different shape, not a nudge', () => {
    const key = (cells: readonly { x: number; y: number }[]) =>
      cells.map((c) => `${c.x},${c.y}`).sort().join(' ');
    expect(key(frames[0])).not.toBe(key(frames[1]));

    const a = new Set(frames[0].map((c) => `${c.x},${c.y}`));
    const b = new Set(frames[1].map((c) => `${c.x},${c.y}`));
    const differing = [...a].filter((c) => !b.has(c)).length + [...b].filter((c) => !a.has(c)).length;
    expect(differing, 'the two frames are nearly the same picture').toBeGreaterThanOrEqual(4);
  });

  it('[Zero] and a frame index nobody has is the standing one rather than nothing', () => {
    expect(bodyCells(2)).toEqual(bodyCells(0));
    expect(bodyCells(-1)).toEqual(bodyCells(0));
  });
});

describe('the outline', () => {
  // A one-pixel outline is what separates twelve pixels of player from a field of grass, whatever colour
  // the kit is. Derived from the shape rather than drawn as a rectangle behind it, so it follows the arms.
  it('[Right] it surrounds the figure and never sits on top of it', () => {
    for (const cells of frames) {
      const filled = new Set(cells.map((c) => `${c.x},${c.y}`));
      const outline = outlineOf(cells);

      expect(outline.length).toBeGreaterThan(cells.length / 2);
      for (const o of outline) expect(filled.has(`${o.x},${o.y}`), `${o.x},${o.y}`).toBe(false);
    }
  });

  it('[Right] every outline cell actually touches the figure', () => {
    for (const cells of frames) {
      const filled = new Set(cells.map((c) => `${c.x},${c.y}`));
      for (const o of outlineOf(cells)) {
        const touches = [
          `${o.x - 1},${o.y}`,
          `${o.x + 1},${o.y}`,
          `${o.x},${o.y - 1}`,
          `${o.x},${o.y + 1}`,
        ].some((k) => filled.has(k));
        expect(touches, `${o.x},${o.y} floats`).toBe(true);
      }
    }
  });
});
