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

/** Pixels per metre along the pitch. */
export const SX = 8;

/** Pixels per metre across it. Less than `SX`, and the ratio is the tilt. */
export const SY = 5;

/** Pixels per metre of height. */
export const SZ = 7;

/** Pixels of grass beyond the touchlines, so the pitch has an edge rather than ending at the screen. */
const MARGIN_X = 24;

/**
 * The band above the far touchline, and it is deep on purpose.
 *
 * ⚠️ A SIXTEEN-PIXEL MARGIN MADE THE STADIUM UNREACHABLE. The stands are drawn in screen space behind the
 * world; with the pitch texture filling the world from edge to edge and the camera clamped inside it, the
 * background could never be seen. A parallax nobody can see is not a subtle parallax - it is a feature
 * that does not exist, and it passed its own unit tests. The far side needs room for the stands to sit in.
 */
const MARGIN_TOP = 46;

/** Below the near touchline the camera has less to show, and the crop is tighter there. */
const MARGIN_BOTTOM = 16;

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
