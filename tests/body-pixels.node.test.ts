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
import { BODY, FACINGS, MIRRORED, PARTS, bodyCells, facingOf, outlineOf, type Facing, type Part } from '../app/js/render/body-pixels.ts';

const frames = [bodyCells('s', 0), bodyCells('s', 1)];
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
    expect(bodyCells('s', 2)).toEqual(bodyCells('s', 0));
    expect(bodyCells('s', -1)).toEqual(bodyCells('s', 0));
    // A facing nobody has is the camera one, for the same reason: a body that vanished because an index
    // arrived wrong is a body a child cannot find.
    expect(bodyCells('zz' as never, 0)).toEqual(bodyCells('s', 0));
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

// ========================= AND WHICH WAY HE IS FACING =========================
// ⚠️ `Body.facing` HAS BEEN IN THE SIMULATION SINCE THE FIRST DAY AND REACHED THE SCREEN AS NOTHING.
// It is a unit vector, the declaration's `focusOf` already hands it to the cane and the scanning path,
// and the picture was the one channel saying something else - a single silhouette whichever way a player
// ran. So this is not a feature being added so much as a disagreement being closed.
//
// ⚠️ AND AT TWENTY-SIX PIXELS IT IS THE LARGEST LEGIBILITY GAIN LEFT, larger than any amount of detail.
// A body that faces where it runs reads as a person; one that does not reads as a token sliding on grass,
// and no number of extra cells fixes that.
describe('which way a body is facing', () => {
  it('[Right] the cardinal directions come out cardinal', () => {
    expect(facingOf(0, 1)).toBe('s');
    expect(facingOf(0, -1)).toBe('n');
    expect(facingOf(1, 0)).toBe('e');
    expect(facingOf(-1, 0)).toBe('w');
  });

  it('[Right] and a true diagonal is a diagonal, not the nearest cardinal', () => {
    expect(facingOf(1, 1)).toBe('se');
    expect(facingOf(-1, 1)).toBe('sw');
    expect(facingOf(1, -1)).toBe('ne');
    expect(facingOf(-1, -1)).toBe('nw');
  });

  // ⚠️ [Zero] A BODY STANDING STILL KEEPS LOOKING AT THE CAMERA. Snapping to an arbitrary point when
  //    the vector is zero would make every stopped player face the same wrong way at once, which is the
  //    kind of thing that looks like a bug in the physics rather than in a table of eighths.
  it('[Zero] a body that is not pointing anywhere faces the camera', () => {
    expect(facingOf(0, 0)).toBe('s');
  });

  // ⚠️ [Boundary] THE EIGHTHS ARE EVEN, which is what stops the diagonals being slivers. A narrow
  //    diagonal band is one a running player crosses without the sprite ever changing, so the feature
  //    would exist and never be seen - the failure this repository has named ten times, in a new place.
  it('[Boundary] every eighth of the compass is WIDE, not merely reachable', () => {
    const count = new Map();
    const STEPS = 2000;
    let total = 0;
    for (let i = 0; i < STEPS; i++) {
      // A circle walked by rational steps rather than by an angle: no trigonometry, on purpose.
      const t = (i * 4) / STEPS - 2;
      for (const [x, y] of [[1, t], [-1, t], [t, 1], [t, -1]]) {
        const f = facingOf(x, y);
        count.set(f, (count.get(f) ?? 0) + 1);
        total++;
      }
    }

    // ⚠️ THE SHARE, NOT THE PRESENCE, AND A MUTATION IS WHY. The first version of this gate asked only
    //    that all eight facings were REACHABLE - and a mutation that squeezed the diagonals to the exact
    //    forty-five degree line left it green, because a sliver is still reachable. A diagonal band that
    //    narrow is one a running player crosses without the sprite ever changing: the feature would exist
    //    and never be seen, which is the failure this repository has named ten times, in a new place.
    for (const f of FACINGS) {
      const share = (count.get(f) ?? 0) / total;
      expect(share, `${f} is a sliver: ${(share * 100).toFixed(1)}% of directions`).toBeGreaterThan(0.05);
    }
  });

  it('[Interface] every facing is either drawn or mirrored from one that is', () => {
    for (const f of FACINGS) {
      const from = MIRRORED[f];
      expect(from === null || MIRRORED[from] === null, `${f} is mirrored from something mirrored`).toBe(true);
      expect(bodyCells(from ?? f, 0).length, `${f} has no figure`).toBeGreaterThan(0);
    }
  });

  // ⚠️ AND THE THREE VIEWS ARE THREE SHAPES. Front, side and back are what this procedural figure
  //    carries; if two of them were the same plan the facing would be a table nobody could see working.
  //    It is asserted on the plans rather than on all eight facings because the interim deliberately maps
  //    eight onto three - `docs/FIGURE-SPEC` asks the DRAWING for five, and this says so instead of
  //    pretending the placeholder already is.
  it('[Right] front, side and back are three different figures', () => {
    const key = (f: Facing) => bodyCells(f, 0).map((c) => c.x + ',' + c.y + ',' + c.part).sort().join(' ');
    expect(key('s')).not.toBe(key('e'));
    expect(key('s')).not.toBe(key('n'));
    expect(key('e')).not.toBe(key('n'));
  });

  // ⚠️ THE BACK OF A HEAD IS HAIR, which is the only thing that can tell front from back with flat
  //    colours and no face. Without the sixth part these two plans are identical cell for cell - the
  //    finding that put `hair` in `PARTS` before a single frame was drawn rather than after.
  it('[Right] the back view has hair where the front view has a face', () => {
    const front = bodyCells('s', 0).filter((c) => c.part === 'hair').length;
    const back = bodyCells('n', 0).filter((c) => c.part === 'hair').length;
    expect(back, 'the back of the head is not hair').toBeGreaterThan(front);
  });

  // ⚠️ AND A SIDE VIEW IS NARROWER, which is the cue an eye reads before any detail. A person seen
  //    from the side takes up less width; same argument as the three markers, applied to a body.
  it('[Right] and a side view is narrower than a front one', () => {
    const width = (f: Facing) => {
      const xs = bodyCells(f, 0).map((c) => c.x);
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(width('e'), 'the side view is no narrower than the front').toBeLessThan(width('s'));
  });
});
