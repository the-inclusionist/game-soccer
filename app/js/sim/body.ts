// SPDX-License-Identifier: AGPL-3.0-or-later
// A PLAYER'S MOVEMENT. One body, one tick.
//
// ========================= TURNING IS THE ACCELERATION CAP, NOT A TURN RATE =========================
// There is no separate turn-speed number here, and the absence is deliberate. A body steers by having a
// bounded change of velocity: reversing at full speed costs the same budget as accelerating from rest,
// so a sprinting player turns wide and a walking one turns on the spot, out of one constant. A separate
// turn rate would be a second place for the same fact to live, and the two would disagree.

import { PITCH } from './units.ts';
import { clamp, clampLen, len2, norm, type Vec2 } from './vec.ts';
import type { Body } from './state.ts';

export interface BodyCaps {
  /** Metres per second. */
  maxSpeed: number;
  /** Metres per second squared. Also the turning budget - see the header. */
  accel: number;
}

/** A body with no ratings yet. Ratings arrive with the AI and replace these at the point of ACTION. */
export const DEFAULT_CAPS: BodyCaps = Object.freeze({ maxSpeed: 6.9, accel: 22 });

/**
 * What one side's bodies can do, which is everything a club changes about the simulation.
 *
 * ⚠️ CAPS AND NOT RATINGS, and that is the whole reason `sim/` can be tested with no clubs in it. The seam
 * turns a club into these numbers; nothing here ever learns that a club exists, that there are six
 * ratings, or which of them produced which field.
 *
 * It is one type rather than a parameter per ability because it grows: `pace` arrived first, `control`
 * second, and a signature that took each of them separately would be re-plumbed through four files every
 * time a rating is wired.
 */
export interface SideCaps {
  readonly body: BodyCaps;
  /** Metres. How close the ball stays to a dribbler on this side. See `sim/possession`. */
  readonly controlRadius: number;
}

/**
 * Advance one body toward `desired`, a direction with magnitude 0..1 (a stick, already deadzoned).
 *
 * The body is kept on the pitch. A player pushed at the touchline stops there rather than leaving the
 * world - out of play is a rule about the BALL, and a body that wanders off the pitch would be read by
 * every later rule as a legal position that simply is not there.
 */
export function stepBody(body: Body, desired: Vec2, dt: number, caps: BodyCaps = DEFAULT_CAPS): void {
  const target = clampLen(desired, 1);
  const wanted = { x: target.x * caps.maxSpeed, y: target.y * caps.maxSpeed };
  const delta = clampLen({ x: wanted.x - body.v.x, y: wanted.y - body.v.y }, caps.accel * dt);

  body.v.x += delta.x;
  body.v.y += delta.y;

  body.p.x = clamp(body.p.x + body.v.x * dt, 0, PITCH.length);
  body.p.y = clamp(body.p.y + body.v.y * dt, 0, PITCH.width);

  // Facing follows movement, and a body that is not moving KEEPS the direction it last faced. Resetting
  // it to a default would spin a standing player to face east, which the sonar would then narrate.
  if (len2(body.v) > 0) {
    const f = norm(body.v);
    body.facing.x = f.x;
    body.facing.y = f.y;
  }
}
