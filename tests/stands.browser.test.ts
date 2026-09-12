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
import { project, WORLD_PX } from '../app/js/project.ts';
import { STADIUM_LAYERS } from '../app/js/render/stadium-layers.ts';
import { ticks } from './helpers/ticks.ts';

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

/**
 * The bottom row of the stand band. `render/scene` puts the far crowd at row 10 for 24 rows and the near
 * stand at row 30 for 14, so the band ends at 44.
 */
const STANDS_BOTTOM = 44;

/**
 * Hold the ball at a spot until the camera has stopped moving.
 *
 * ⚠️ WAITING A FIXED TIME LOST ITS BET UNDER FULL-SUITE LOAD, twice. The camera lerps toward its target
 * at a fraction per FRAME, so how long it takes to arrive is a question about how many frames the machine
 * rendered - and with sixty-three other files running beside this one, 2500ms is a different number of
 * frames than it is alone. Waiting for the camera to SETTLE asks the thing the assertions are about.
 *
 * ⚠️ AND SETTLING WAS MEASURED IN WALL CLOCK, WHICH LOST THE SAME BET A THIRD TIME. "Three readings the
 * same" means the lerp has converged OR the page rendered no frames between them - and under sixty-five
 * other files the second is the ordinary case. It returned after 2.3 seconds with the camera twenty-two
 * pixels short, and the assertion then reported a stand band that was never given a chance to arrive.
 *
 * So stillness is counted in TICKS, not in milliseconds: a reading only counts once the simulation has
 * actually advanced, and only against a reading at least three ticks old. At a lerp of 0.12 per tick,
 * three ticks close a third of whatever gap remains - comfortably more than the half pixel that integer
 * rounding could otherwise hide - so a repeat reading means arrival and cannot mean a stalled page.
 *
 * ⚠️ AND THERE IS A FLOOR UNDER IT, because tick progress alone still lost the bet once in five full
 * suites. The camera lerps a fixed fraction PER RENDERED FRAME while `state.tick` counts SIMULATED ones,
 * and the two are not the same clock - a page that simulates in a burst and renders once can advance the
 * tick three times between two identical camera readings without the camera having gone anywhere. A lerp
 * of 0.12 needs about forty frames to close any gap on this world, so nothing is believed before four
 * seconds of them have passed. When frames are flowing this costs nothing; when they are not, it turns a
 * silent early return into the throw below.
 *
 * ⚠️ AND RUNNING OUT OF TIME THROWS rather than returning quietly. A silent timeout is what turned a
 * stalled page into an assertion about pixels; naming it says which of the two actually happened.
 */
const SETTLE_FLOOR = 240;

/**
 * ⚠️ THE DEADLINE IS IN TICKS NOW, BECAUSE IN MILLISECONDS IT WAS ARITHMETICALLY IMPOSSIBLE UNDER LOAD.
 * This loop needs `SETTLE_FLOOR` ticks of settled camera - 240, four seconds of nominal football - and it
 * was bounded by `Date.now() + 10_000`. 📏 Measured 2026-09-11: inside the full browser project the world
 * runs at SIX ticks a second, not sixty. 240 ticks is then forty seconds of wall clock against a
 * ten-second deadline, so the failure was not a race the file could lose - it was a race it could not win.
 * It passed alone and failed in the suite for that reason, and this file's own note about starved readings
 * shows somebody met the symptom here and treated the readings rather than the clock.
 *
 * The wall-clock ceiling stays, generous, for the only thing it is good for: a loop that never returns is
 * worse than one that fails.
 */
async function pinBallAt(y: number, ms = 120_000): Promise<void> {
  const pin = window.setInterval(() => {
    if (booted === null) return;
    booted.state.ball.p = { x: 45, y, z: 0 };
    booted.state.ball.v = { x: 0, y: 0, z: 0 };
  }, 8);
  try {
    const until = Date.now() + ms;
    const start = booted?.state.tick ?? 0;
    let last = Number.NaN;
    let lastTick = -1;
    let still = 0;
    while (Date.now() < until) {
      await new Promise((r) => setTimeout(r, 60));
      const tick = booted?.state.tick ?? -1;
      // No ticks since the last reading: the page is starved, not settled. Say nothing about the camera.
      if (tick - lastTick < 3) continue;
      lastTick = tick;
      const now = booted?.cameraAt().y ?? Number.NaN;
      still = now === last ? still + 1 : 0;
      last = now;
      // Four seconds of ticks is longer than any lerp on this world needs. Below that, "it stopped moving"
      // is not evidence of anything.
      if (still >= 3 && tick - start >= SETTLE_FLOOR) return;
      // ⚠️ AND THE GIVING-UP CONDITION IS TICKS TOO. Waiting past the ticks this needs, on a machine that
      //    is delivering them, means the camera genuinely never settled - which is the failure worth
      //    reporting. Waiting past a NUMBER OF SECONDS only means the machine was busy.
      if (tick - start >= SETTLE_FLOOR * 4) {
        throw new Error(`the camera never settled at y=${y} in ${String(SETTLE_FLOOR * 4)} ticks of football`);
      }
    }
  } finally {
    window.clearInterval(pin);
  }
  throw new Error(`the camera never settled at y=${y} within ${ms}ms - the page rendered too few frames`);
}

describe('where the camera actually goes', () => {
  it('[Interface] it can be read at all, which it could not before', () => {
    booted = bootar(document, window);

    const at = booted!.cameraAt();

    expect(Number.isFinite(at.x)).toBe(true);
    expect(Number.isFinite(at.y)).toBe(true);
  });

  // ⚠️ ADR-0001 ASKS FOR ROUNDING AT TWO POINTS AND ONLY ONE OF THEM WAS GATED. `tests/project` sweeps a
  //    grid of world positions and proves `projectPx` returns whole pixels - but that is the projection,
  //    a pure function, and the plan is explicit that rounding the sprites alone is not enough: the world
  //    CONTAINER has to land on a whole pixel too, or the baked pitch slides sub-pixel underneath sprites
  //    that have snapped, and NEAREST sampling turns the difference into a shimmer. `scene.ts` does round
  //    it - `world.position.set(-camX, -camY)` from the rounded pair - and nothing anywhere asked.
  //
  // ⚠️ AND THE CAMERA HAS TO BE MOVING FOR THE QUESTION TO MEAN ANYTHING, which is why the distinct-values
  //    assertion is not decoration. A camera parked on an integer by accident passes an integrality check
  //    without the check having tested anything - and this file's own history is a camera read while the
  //    page was starved, so a reading taken across ticks that did not happen is the known failure here.
  it('[Many] and it lands on a whole pixel every time, while it is moving', async () => {
    booted = bootar(document, window);
    booted!.state.phase = 'live';

    const seenX = new Set<number>();
    const seenY = new Set<number>();

    for (let sample = 0; sample < 20; sample++) {
      await ticks(booted, 5);
      const at = booted!.cameraAt();

      expect(Number.isInteger(at.x), `camera x was ${String(at.x)} on sample ${String(sample)}`).toBe(
        true,
      );
      expect(Number.isInteger(at.y), `camera y was ${String(at.y)} on sample ${String(sample)}`).toBe(
        true,
      );
      seenX.add(at.x);
      seenY.add(at.y);
    }

    // A camera that never moved would pass the integrality check above without it having asked anything.
    expect(seenX.size + seenY.size, 'the camera never moved, so nothing was tested').toBeGreaterThan(2);
  });

  it('[Right] with the ball in the middle it sits well down the world, as a tele camera should', async () => {
    booted = bootar(document, window);
    booted!.state.phase = 'live';

    await pinBallAt(28);

    expect(booted!.cameraAt().y).toBeGreaterThan(GRASS_TOP);
  });

  // ⚠️ THE GATE THE README HAS BEEN OWING. Not "do the stands look right" - which no assertion can ask -
  //    but the arithmetic that decides whether a single row of them can be on the screen at all.
  it('[Right] with the ball on the far touchline it clears the stand band', async () => {
    booted = bootar(document, window);
    booted!.state.phase = 'live';

    await pinBallAt(0.5);

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

    await pinBallAt(0.5);

    const camY = booted!.cameraAt().y;
    expect(booted!.pitchTopOnScreen(), 'the pitch is drawn at the wrong height').toBeCloseTo(GRASS_TOP - camY, 0);
  });

  it('[Right] so with the camera at the top of the world there is room for the stands', async () => {
    booted = bootar(document, window);
    booted!.state.phase = 'live';

    await pinBallAt(0.5);

    // The stand band is rows 10..44. Anything the grass does not cover above `STANDS_TOP` is stand.
    expect(booted!.pitchTopOnScreen()).toBeGreaterThan(STANDS_TOP);
  });

  it('[Boundary] and it never leaves the world, at either end', async () => {
    booted = bootar(document, window);
    booted!.state.phase = 'live';

    await pinBallAt(55);
    const low = booted!.cameraAt().y;
    await pinBallAt(0.5);
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

// ========================= AND SEEN IN A MATCH, NOT ONLY IN A RIGGED FRAME =========================
// Making the stands visible with the ball pinned against the far touchline proved the pixels were right
// and proved nothing about the game: no match ever holds the ball there. The camera used to aim twelve
// pixels above the ball, which puts it at `camY = 84` on the halfway line and covers the band completely.
//
// ⚠️ THE FIX IS THE FRAMING, NOT A TRICK TO EXPOSE A BACKGROUND. In a televised match the ball sits LOW in
// frame and the far stand fills the top of it; a camera centred on the ball shows as much empty grass
// behind the play as in front of it. The stands becoming visible is the consequence of getting that right.
describe('the stands in an ordinary match', () => {
  // ⚠️ THE FAR HALF, AND NOT THE WHOLE PITCH, AND THAT IS GEOMETRY RATHER THAN A SHORTFALL. The viewport
  //    is 180 rows; the stand band takes 34 of them; the pitch is 280 rows tall. Whatever the camera does,
  //    it shows about half the width of the pitch at a time - so a frame with stands in it is a frame
  //    looking ACROSS the pitch at the far side, which is what a televised match looks like. Asking for
  //    stands with play on the near touchline would be asking for both halves at once.
  //
  // ⚠️ AND THE BOUNDARY IS HYSTERETIC, measured: the camera has a dead zone, so where it settles depends
  //    on where it came from - the same ball position gives a different row arriving from the far side
  //    than from the middle. The gate therefore asks about the far half from a FRESH boot, which is the
  //    only version of the question with one answer.
  // ⚠️ RE-DERIVED FOR THE CLOSE CAMERA ON 2026-09-11, AND THE BAND NARROWED. It used to ask about the
  //    far HALF - y of 4, 14 and 24 metres - and that was true at eight pixels per metre. At sixteen the
  //    condition works out to `ball.y * SY < 128`, so the band is the far THIRTEEN METRES and not the far
  //    twenty-five. The gate was re-derived rather than re-blessed, which is the whole point of writing
  //    the derivation down: `MARGIN_TOP` cancels out of it, and what decides the band is how far above
  //    the ball the camera aims against the height of the viewport.
  //
  // ⚠️ AND IT ASKS BOTH HALVES NOW, WHICH THE OLD ONE DID NOT. A one-sided "the stands are visible
  //    here" passes just as well on a camera that has stopped moving at all. Asking that they are COVERED
  //    by mid-pitch is what says the band is a band. The two probes sit clear of the dead zone, which is
  //    40 rows tall and makes the exact boundary hysteretic - the same ball position settles differently
  //    depending on where the camera came from, which is why the fresh boot matters and why neither probe
  //    is placed at 13.
  it('[Right] in the far thirteen metres, and covered by mid-pitch', async () => {
    booted = bootar(document, window);
    booted!.state.phase = 'live';

    for (const y of [2, 8]) {
      await pinBallAt(y);
      expect(booted!.pitchTopOnScreen(), `covered with the ball at y=${y}`).toBeGreaterThan(STANDS_TOP);
    }

    await pinBallAt(24);
    expect(booted!.pitchTopOnScreen(), 'the stands are somehow still visible at mid-pitch').toBeLessThan(
      STANDS_TOP,
    );
  });

  // ⚠️ AND THE NEAR TOUCHLINE IS STILL REACHABLE, which is the thing a lower camera could have cost. A
  //    frame that shows the stands and loses a third of the pitch is a worse frame.
  it('[Boundary] while the near touchline is still in view when play goes there', async () => {
    booted = bootar(document, window);
    booted!.state.phase = 'live';

    await pinBallAt(55);

    const camY = booted!.cameraAt().y;
    // ⚠️ THROUGH `project`, NOT THROUGH A HAND-WRITTEN COPY OF IT. This line used to read
    //    `WORLD_PX.margin.top + 55 * 5`, with the vertical scale spelled out as a literal 5 - so when the
    //    camera doubled, the gate went on measuring the OLD projection and reported that the near
    //    touchline had left the screen when it had not. A test that re-implements the thing it is
    //    checking is a test that can be wrong on its own. The independent half of the claim is the
    //    screen's 0..180, which is not the projection's to move.
    const ballRow = project({ x: 45, y: 55, z: 0 }).y - camY;
    expect(ballRow, 'play at the near touchline is off the bottom of the screen').toBeLessThan(180);
    expect(ballRow, 'play at the near touchline is off the top of the screen').toBeGreaterThan(0);
  });
});

// ========================= AND THE MARGIN HAD NO GATE AT ALL, WHICH A MUTATION FOUND =========================
// The plan for the close camera prescribed this mutation: leave `MARGIN_TOP` at its old value while
// doubling the scale, and the stands gate above must fall - the idea being that it would prove the gate
// measures the framing rather than agreeing with itself.
//
// ⚠️ IT WAS RUN AND THE GATE DID NOT FALL. Ten green with the margin halved. Working the condition
// through says why, and it is worth more than the mutation was: `MARGIN_TOP` CANCELS out of "is the grass
// below screen row 10", because the camera aims a fixed number of pixels above the ball and centres a
// fixed-height viewport on it, so the margin appears on both sides. What decides the band is
// `BALL_SITS_LOW_BY` against the viewport height. The prescribed mutation was aimed at the wrong constant.
//
// ⚠️ WHICH LEFT A REAL GAP: the margin could be set to anything above the clamp and NOTHING noticed.
// Its actual job is the one its own header states - with the camera clamped at the top of the world, the
// grass has to start below the WHOLE band, not below its first row. The gate above only ever asked about
// row 10, so a margin that clipped the bottom half of the stands passed it.
describe('the margin above the far touchline', () => {
  // ⚠️ THE WHOLE BAND, NOT ITS TOP ROW. At the old margin the grass began at row 36 and the band runs
  //    to 44 - so eight rows of stand were under grass, and every gate was green. That is the "correct and
  //    invisible" shape this repository keeps finding, in the one place it had already found it once.
  it('[Boundary] leaves room for the ENTIRE stand band, not just its first row', async () => {
    booted = bootar(document, window);
    booted!.state.phase = 'live';

    await pinBallAt(2);

    expect(booted!.pitchTopOnScreen(), 'the grass cuts into the stand band').toBeGreaterThan(STANDS_BOTTOM);
  });
});
