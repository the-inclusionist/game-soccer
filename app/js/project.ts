// SPDX-License-Identifier: AGPL-3.0-or-later
// METRES INTO PIXELS, and this is the only module that knows both.
//
// ========================= THE WHOLE PSEUDO-3D IS THREE CONSTANTS =========================
// `x` scales one way, `y` scales less, and height lifts. That is an affine squash of the ground plane
// plus a vertical offset - not a perspective divide - and the ratio `SY/SX` IS the camera's tilt, about
// fifty-one degrees. A high tele, not a ground-level one.
//
// ⚠️ AND THE TILT IS AN ACCESSIBILITY CHOICE BEFORE IT IS AN AESTHETIC ONE. A true broadcast tilt puts
// six players on a 320x180 screen and the shape of the game disappears; a low-vision child then has no
// way to see where the play is. Fifty-one degrees shows about forty metres by thirty-six, which is a
// plausible tele crop AND a readable one.
//
// ⚠️ NO PERSPECTIVE DIVIDE AND NO ZOOM, EVER. A divide would make near players larger than far ones, and
// at twelve pixels tall one of the two stops reading; it would also put sprite scales on non-integer
// factors, which ADR-0001 forbids outright. "Zoom out for a goal kick" is a wider dead zone or it does
// not happen.

import { PITCH } from './sim/units.ts';

/**
 * Pixels per metre along the pitch.
 *
 * ⚠️ DOUBLED ON 2026-09-11, AND THE TILT WAS HELD EXACTLY. `SY/SX` was 5/8 and still is, so the pitch
 * keeps reading as a high tele rather than turning top-down; what changed is how much of it is on screen.
 *
 * ⚠️ THE COST WAS MEASURED AND IS NOT WHERE IT WAS EXPECTED. The baked pitch texture goes from
 * 768x306 to 1536x602 - 0.24 to 0.92 megapixels, about 0.9 MB to 3.7 MB of RGBA - and the scene BUILD
 * TIME does not move: a median of 40 ms against 39 over five cold builds. 1536 is comfortably inside the
 * 2048 texture limit of even a cheap tablet GPU, which is the hardware pillar 1 names.
 *
 * ⚠️ AND THE FIELD OF VIEW IT COSTS WAS THE REAL WORRY, SO IT WAS MEASURED TOO. At 320 pixels wide,
 * doubling halves what is on screen - about 40 metres of pitch becomes about 20 - and that sounds severe.
 * Every ball flight above `CONTROL_SPEED` across twelve fixtures, 2022 of them: median 1.3 m, p75 4.7,
 * p90 9.0, p99 28.5, max 45.2. **98.6% fit in a 20-metre window against 99.3% in the old 40.** The close
 * camera costs seven tenths of a percentage point of deliveries, because this game is played in short
 * bursts - the median flight is a dribble touch and the ninetieth percentile is a nine-metre pass.
 */
export const SX = 16;

/** Pixels per metre across it. Less than `SX`, and the ratio is the tilt - held at 5/8 through the change. */
export const SY = 10;

/** Pixels per metre of height. A 1.86 m player is 26 pixels tall, which is what `docs/FIGURE-SPEC` sizes. */
export const SZ = 14;

/** Pixels of grass beyond the touchlines, so the pitch has an edge rather than ending at the screen. */
const MARGIN_X = 48;

/**
 * The band above the far touchline, and it is deep on purpose.
 *
 * ⚠️ A SIXTEEN-PIXEL MARGIN MADE THE STADIUM UNREACHABLE. The stands are drawn in screen space behind the
 * world; with the pitch texture filling the world from edge to edge and the camera clamped inside it, the
 * background could never be seen. A parallax nobody can see is not a subtle parallax - it is a feature
 * that does not exist, and it passed its own unit tests. The far side needs room for the stands to sit in.
 */
const MARGIN_TOP = 92;

// ⚠️ AND RE-DERIVING IT FOUND THAT IT IS NOT WHAT DECIDES THE STANDS. Working the condition through,
// `MARGIN_TOP` CANCELS: the camera aims `BALL_SITS_LOW_BY` above the ball and centres a 180-tall viewport
// on it, so `camY` carries the margin as a term on both sides of "is the grass below screen row 10". What
// actually decides whether a stand can be seen is `BALL_SITS_LOW_BY` and the viewport height, and where
// the ball is across the pitch. All the margin has to do is be big enough that the grass does not cover
// the band when the camera is clamped at the top of the world: `MARGIN_TOP > 54`. It was 46, which is why
// this repository's record says the stands were never quite clear; 92 has room to spare.

/** Below the near touchline the camera has less to show, and the crop is tighter there. */
const MARGIN_BOTTOM = 32;

/** The world the camera pans over, in pixels. */
export const WORLD_PX = Object.freeze({
  w: PITCH.length * SX + MARGIN_X * 2,
  h: PITCH.width * SY + MARGIN_TOP + MARGIN_BOTTOM,
  margin: Object.freeze({ x: MARGIN_X, top: MARGIN_TOP, bottom: MARGIN_BOTTOM }),
});

export interface Pixel {
  readonly x: number;
  readonly y: number;
}

/** A world point, in pixels, unrounded. Use it for camera maths; use `projectPx` for anything drawn. */
export function project(at: { x: number; y: number; z: number }): Pixel {
  return {
    x: MARGIN_X + at.x * SX,
    y: MARGIN_TOP + at.y * SY - at.z * SZ,
  };
}

/**
 * A world point, snapped to a whole pixel.
 *
 * ⚠️ EVERY SPRITE GOES THROUGH THIS, AND SO DOES THE CAMERA - both, not one. Rounding only the camera
 * leaves sprites on fractional world coordinates and NEAREST sampling shimmers them; rounding only the
 * sprites lets the whole scene slide sub-pixel as a block. A shimmering pitch at 320x180 is not a
 * cosmetic problem: it is what stops a low-vision child from being able to track the ball.
 */
export function projectPx(at: { x: number; y: number; z: number }): Pixel {
  const p = project(at);
  return { x: Math.round(p.x), y: Math.round(p.y) };
}
