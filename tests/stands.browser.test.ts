// SPDX-License-Identifier: AGPL-3.0-or-later
// THE STANDS, MEASURED INSTEAD OF ARGUED ABOUT FROM SCREENSHOTS.
//
// ========================= WHY THIS TOOK SO LONG TO PIN DOWN =========================
// `stadium-layers` was built, gated on its own maths and on reduced motion, and reported by the README as
// "not yet seen in a captured frame" for months. Every attempt to settle it compared two pictures, and a
// picture cannot say WHERE THE CAMERA IS - so the argument went round twice and found one real bug by
// accident (the pitch texture was thirty-six pixels out of line) without ever answering the question.
//
// The camera is a number. Once it can be read, the question stops being visual:
//
//   · the stand layers live in SCREEN space, fixed, at rows 10 to 44;
//   · the grass begins at world row `grassTop`, which reaches the screen at `grassTop - camY`;
//   · so they are visible exactly when `camY < grassTop - 10`, and never otherwise.
//
// ⚠️ AND THE BALL HAS TO BE PINNED EVERY FRAME. A ball placed on the touchline does not stay there:
// twenty-two players take it back toward the middle within a tick and the camera follows it home, which
// is how every screenshot this repository ever took came out showing the halfway line.
import { beforeEach, describe, expect, it } from 'vitest';
import { bootar } from '../app/js/boot/main.ts';
import { WORLD_PX } from '../app/js/project.ts';
import { STADIUM_LAYERS } from '../app/js/render/stadium-layers.ts';

const SHELL_SRC = await import('./boot.browser.test.ts?raw');
const SHELL = (() => {
  const src = SHELL_SRC.default;
  const from = src.indexOf('const SHELL = `') + 'const SHELL = `'.length;
  return src.slice(from, src.indexOf('`;', from));
})();

let booted: ReturnType<typeof bootar> = null;

beforeEach(() => {
  booted?.stop();
  booted = null;
  document.body.innerHTML = SHELL;
});

/** Where the grass starts, in world pixels. Mirrors `pitchTexture`; see the note on the gate below. */
const GRASS_TOP = WORLD_PX.margin.top - 10;

/** The topmost row any stand layer occupies, in screen space. */
const STANDS_TOP = 10;

/** Hold the ball at a spot for a while, against twenty-two players who want it back. */
async function pinBallAt(y: number, ms: number): Promise<void> {
  const pin = window.setInterval(() => {
    if (booted === null) return;
    booted.state.ball.p = { x: 45, y, z: 0 };
    booted.state.ball.v = { x: 0, y: 0, z: 0 };
  }, 8);
  await new Promise((r) => setTimeout(r, ms));
  window.clearInterval(pin);
}

describe('where the camera actually goes', () => {
  it('[Interface] it can be read at all, which it could not before', () => {
    booted = bootar(document, window);

    const at = booted!.cameraAt();

    expect(Number.isFinite(at.x)).toBe(true);
    expect(Number.isFinite(at.y)).toBe(true);
  });

  it('[Right] with the ball in the middle it sits well down the world, as a tele camera should', async () => {
    booted = bootar(document, window);
    booted!.state.phase = 'live';

    await pinBallAt(28, 1200);

    expect(booted!.cameraAt().y).toBeGreaterThan(GRASS_TOP);
  });

  // ⚠️ THE GATE THE README HAS BEEN OWING. Not "do the stands look right" - which no assertion can ask -
  //    but the arithmetic that decides whether a single row of them can be on the screen at all.
  it('[Right] with the ball on the far touchline it clears the stand band', async () => {
    booted = bootar(document, window);
    booted!.state.phase = 'live';

    await pinBallAt(0.5, 2500);

    const camY = booted!.cameraAt().y;
    expect(camY, 'the camera never reached the top of the world').toBeLessThan(GRASS_TOP - STANDS_TOP);
  });

  // ⚠️ THE GATE THAT WOULD HAVE CAUGHT ALL OF THIS ON DAY ONE. `generateTexture` crops to the graphics'
  //    bounds, so the pitch texture began at the grass and a sprite at (0, 0) put world row 36 on screen
  //    row 0 - the band left clear for the stands was covered, and the parallax could never be seen.
  //    The crop is measured and the sprite positioned by it now; this asks that the grass is where the
  //    projection says, which is the whole of what was wrong.
  it('[Right] the grass begins where the projection says, not at the top of the screen', async () => {
    booted = bootar(document, window);
    booted!.state.phase = 'live';

    await pinBallAt(0.5, 2500);

    const camY = booted!.cameraAt().y;
    expect(booted!.pitchTopOnScreen(), 'the pitch is drawn at the wrong height').toBeCloseTo(GRASS_TOP - camY, 0);
  });

  it('[Right] so with the camera at the top of the world there is room for the stands', async () => {
    booted = bootar(document, window);
    booted!.state.phase = 'live';

    await pinBallAt(0.5, 2500);

    // The stand band is rows 10..44. Anything the grass does not cover above `STANDS_TOP` is stand.
    expect(booted!.pitchTopOnScreen()).toBeGreaterThan(STANDS_TOP);
  });

  it('[Boundary] and it never leaves the world, at either end', async () => {
    booted = bootar(document, window);
    booted!.state.phase = 'live';

    await pinBallAt(55, 1200);
    const low = booted!.cameraAt().y;
    await pinBallAt(0.5, 1800);
    const high = booted!.cameraAt().y;

    for (const y of [low, high]) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(WORLD_PX.h - 180);
    }
    expect(high).toBeLessThan(low);
  });
});

describe('the layers themselves', () => {
  it('[Interface] all three drift vertically, which the engine own table does not', () => {
    for (const layer of STADIUM_LAYERS) expect(layer.fy, layer.key).toBeGreaterThan(0);
  });

  it('[Right] and a nearer layer moves more than a farther one, which is what parallax IS', () => {
    for (let i = 1; i < STADIUM_LAYERS.length; i++) {
      expect(STADIUM_LAYERS[i].factor).toBeGreaterThan(STADIUM_LAYERS[i - 1].factor);
      expect(STADIUM_LAYERS[i].fy).toBeGreaterThan(STADIUM_LAYERS[i - 1].fy);
    }
  });
});
