// SPDX-License-Identifier: AGPL-3.0-or-later
// METRES INTO PIXELS. The only place the two ever meet.
//
// ========================= AN AFFINE SQUASH, NOT A PERSPECTIVE DIVIDE =========================
// The whole pseudo-3D broadcast look is `y` multiplied by less than `x`, plus a vertical lift for height.
// A real perspective divide would make near players larger than far ones - and at twelve pixels tall one
// of the two stops reading - and it would put sprite scales on non-integer factors, which ADR-0001 bans
// outright. The camera tilt is therefore a RATIO between two constants, and it is about fifty-one degrees.
//
// ========================= AND WHY IT IS ITS OWN MODULE =========================
// If the projection lived in the renderer, a rule could reach for a pixel; if it lived in the simulation,
// changing how the game is drawn would change how it is played. One module, imported by the renderer and
// by nothing under `sim/` or `rules/`.
import { describe, expect, it } from 'vitest';
import { PITCH } from '../app/js/sim/units.ts';
import { SX, SY, SZ, WORLD_PX, project, projectPx } from '../app/js/project.ts';

describe('the projection', () => {
  it('[Zero] the corner of the pitch lands at the corner of the world, plus the margin', () => {
    const at = project({ x: 0, y: 0, z: 0 });

    expect(at.x).toBe(WORLD_PX.margin.x);
    expect(at.y).toBe(WORLD_PX.margin.top);
  });

  // ⚠️ THE TWO MARGINS DIFFER, and the asymmetry is the whole reason the stadium can be seen at all: the
  //    band above the far touchline is where the stands sit. With equal margins the pitch filled the world
  //    and the parallax layers were painted behind a texture that always covered them.
  it('[Right] there is room above the far touchline for something that is not grass', () => {
    expect(WORLD_PX.margin.top).toBeGreaterThan(WORLD_PX.margin.bottom * 2);
  });

  it('[Right] the far corner lands inside the world box, and the box is sized to hold it', () => {
    const at = project({ x: PITCH.length, y: PITCH.width, z: 0 });

    expect(at.x).toBe(WORLD_PX.w - WORLD_PX.margin.x);
    expect(at.y).toBe(WORLD_PX.h - WORLD_PX.margin.bottom);
  });

  it('[Right] across the pitch is squashed relative to along it - that IS the camera tilt', () => {
    expect(SY).toBeLessThan(SX);
    expect(SY / SX).toBeGreaterThan(0.5);
    expect(SY / SX).toBeLessThan(0.8);
  });

  it('[Right] height lifts the sprite and moves it NOWHERE horizontally', () => {
    const ground = project({ x: 45, y: 28, z: 0 });
    const high = project({ x: 45, y: 28, z: 2 });

    expect(high.x).toBe(ground.x);
    expect(high.y).toBe(ground.y - 2 * SZ);
  });

  // ⚠️ THE ONE PROPERTY A PERSPECTIVE DIVIDE WOULD BREAK. Two players the same size in metres must be the
  //    same size in pixels wherever they stand, or one of them stops being legible at twelve pixels tall.
  it('[Interface] a metre is the same number of pixels at the near touchline and at the far one', () => {
    const nearA = project({ x: 10, y: 2, z: 0 });
    const nearB = project({ x: 11, y: 2, z: 0 });
    const farA = project({ x: 10, y: 54, z: 0 });
    const farB = project({ x: 11, y: 54, z: 0 });

    expect(nearB.x - nearA.x).toBe(farB.x - farA.x);
  });

  it('[Interface] a goal is wide enough to aim at, and a player tall enough to see', () => {
    const postA = project({ x: PITCH.length, y: PITCH.width / 2 - 3.5, z: 0 });
    const postB = project({ x: PITCH.length, y: PITCH.width / 2 + 3.5, z: 0 });

    expect(postB.y - postA.y).toBeGreaterThanOrEqual(30);
    expect(1.8 * SZ).toBeGreaterThanOrEqual(11);
  });
});

describe('integer pixels', () => {
  // ⚠️ ADR-0001. NEAREST sampling on a fractional coordinate shimmers, and a shimmering pitch at 320x180
  //    is not a cosmetic problem: it is the thing that makes a low-vision child unable to track the ball.
  it('[Interface] a projected sprite position is always a whole pixel', () => {
    for (let x = 0; x <= PITCH.length; x += 7.3) {
      for (let y = 0; y <= PITCH.width; y += 3.7) {
        const at = projectPx({ x, y, z: 0.37 });
        expect(Number.isInteger(at.x)).toBe(true);
        expect(Number.isInteger(at.y)).toBe(true);
      }
    }
  });

  it('[Boundary] rounding is stable - the same input gives the same pixel, every time', () => {
    const a = projectPx({ x: 12.5, y: 7.5, z: 0 });
    const b = projectPx({ x: 12.5, y: 7.5, z: 0 });

    expect(a).toEqual(b);
  });

  it('[Right] a sub-pixel move does not move the sprite, and a whole-pixel move does', () => {
    const at = projectPx({ x: 20, y: 20, z: 0 });
    const nudged = projectPx({ x: 20 + 0.01, y: 20, z: 0 });
    const stepped = projectPx({ x: 20 + 1 / SX, y: 20, z: 0 });

    expect(nudged.x).toBe(at.x);
    expect(stepped.x).toBe(at.x + 1);
  });
});
