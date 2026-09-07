// SPDX-License-Identifier: AGPL-3.0-or-later
// THE LINES ON THE GRASS, IN METRES, AS DATA.
//
// ========================= WHY THIS IS NOT DRAWING CODE =========================
// `pitchTexture` drew a penalty area 16.5m deep and 40.3m wide - the real laws' numbers, baked in as
// literals. The referee gives penalties inside `BOX`, which is 14 by 32, because this pitch is 90 by 56
// and not 105 by 68.
//
// So the painted box and the refereed box were different rectangles. A child stands inside the line she
// can see, is fouled, and gets a free kick; or stands outside it and gets a penalty. There is no learning
// a rule whose picture is wrong - and nothing would have reported it, because the drawing was correct
// code producing a box that looked like a box.
//
// `units.ts` predicted exactly this: *"whether the box is painted on the grass is `render/`, and the two
// must not disagree - so the renderer reads this rather than keeping a rectangle of its own."* It was
// written the same day the constant was, and the renderer was already disagreeing with it.
//
// ⚠️ SO THE MARKINGS ARE DATA, in METRES, and the projection happens where every other projection happens.
// "The picture agrees with the law" becomes something a test asks rather than something somebody notices.
// It is the same move `marker-pixels` and `crest-pixels` made, for the same reason.

import { BOX, PENALTY_SPOT, PITCH } from '../sim/units.ts';

/** A straight line on the grass, in metres. A rectangle is four of these; a stripe is one. */
export interface Line {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** Which goal line: 0 is `x = 0`, 1 is the far one. Not a team - the ends swap and the paint does not. */
export type End = 0 | 1;

/**
 * The penalty area at one end.
 *
 * ⚠️ DERIVED FROM `BOX` AND NOTHING ELSE. Every number here is the referee's; if the area should be a
 * different size, the constant moves and the paint follows, which is the only arrangement in which the
 * two cannot drift apart again.
 */
export function boxAt(end: End): Rect {
  const half = BOX.width / 2;
  return {
    x0: end === 0 ? 0 : PITCH.length,
    x1: end === 0 ? BOX.depth : PITCH.length - BOX.depth,
    y0: PITCH.width / 2 - half,
    y1: PITCH.width / 2 + half,
  };
}

/** The penalty spot at one end - the exact point `rules/restart` places the ball on. */
export function penaltySpotAt(end: End): { readonly x: number; readonly y: number } {
  return { x: end === 0 ? PENALTY_SPOT : PITCH.length - PENALTY_SPOT, y: PITCH.width / 2 };
}

/**
 * The centre circle.
 *
 * Its radius is the keep-out distance, which is what the circle is FOR: at a kickoff it is the ring
 * everybody but the taker stands outside of. Drawing it at some other size would paint a line that means
 * nothing.
 */
export function centreCircle(): { readonly x: number; readonly y: number; readonly r: number } {
  return { x: PITCH.length / 2, y: PITCH.width / 2, r: 9.15 };
}

/** Every straight line, in metres: the boundary, the halfway line, and the two areas. */
export function pitchLines(): readonly Line[] {
  const out: Line[] = [
    { x0: 0, y0: 0, x1: PITCH.length, y1: 0 },
    { x0: 0, y0: PITCH.width, x1: PITCH.length, y1: PITCH.width },
    { x0: 0, y0: 0, x1: 0, y1: PITCH.width },
    { x0: PITCH.length, y0: 0, x1: PITCH.length, y1: PITCH.width },
    { x0: PITCH.length / 2, y0: 0, x1: PITCH.length / 2, y1: PITCH.width },
  ];

  for (const end of [0, 1] as const) {
    const b = boxAt(end);
    // Three sides: the fourth is the goal line itself, already drawn above.
    out.push({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y0 });
    out.push({ x0: b.x0, y0: b.y1, x1: b.x1, y1: b.y1 });
    out.push({ x0: b.x1, y0: b.y0, x1: b.x1, y1: b.y1 });
  }

  return out;
}
