// SPDX-License-Identifier: AGPL-3.0-or-later
// THE BALL. Pure: no DOM, no PixiJS, no clock, no randomness.
//
// ========================= THE STEP IS FIXED AND IT IS IN SECONDS =========================
// The engine's `startLoop` hands `PIXI.Ticker.deltaTime`, which counts FRAMES at a nominal 60Hz, and its
// tuning constants are per-frame. This simulation does not work that way: `DT` is a literal 1/60 of a
// second, never derived from a measured elapsed time, because a simulation whose step depends on how fast
// the machine happens to be is a simulation that cannot be replayed, cannot be checked by a digest, and
// cannot be handed to a peer over a network. The conversion from frames to milliseconds happens once, at
// the boundary, in the driver — and never again below it.

import { BALL } from './units.ts';

/** Seconds of world time per simulation tick. A literal, and it is load-bearing that it is one. */
export const DT = 1 / 60;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Ball {
  /** Metres. `x` runs along the pitch, `y` across it, `z` up from the turf. */
  p: Vec3;
  /** Metres per second. */
  v: Vec3;
  /** On the turf and not bouncing. The flag exists so `stepBall` can leave a still ball alone. */
  grounded: boolean;
}

/** A ball placed at rest on the turf. `z` is not a parameter: a ball is put DOWN somewhere. */
export function createBall(at: { x: number; y: number }): Ball {
  return { p: { x: at.x, y: at.y, z: 0 }, v: { x: 0, y: 0, z: 0 }, grounded: true };
}

/**
 * Advance the ball by one tick.
 *
 * A grounded ball with no velocity is left EXACTLY alone — not multiplied by a drag factor, not moved by
 * a zero. Touching it would accumulate float noise into a position that nothing is changing, and the
 * digest would drift on a ball sitting still on the centre spot.
 */
export function stepBall(ball: Ball, dt: number): void {
  // ⚠️ AND IT HAS TO BE ON THE TURF, not merely to say so. This shortcut trusted `grounded` alone, and a
  //    ball marked grounded at a height with no velocity was frozen for ever - gravity is below this line.
  //    Measured on a real ninety-minute match: the ball sat at (5.7, 16.3, 1.20) for the last sixteen
  //    minutes, and 1.2 is `MAX_CONTROL_HEIGHT`, so nobody could pick it up either. Events happened in the
  //    first minute and at half time and nowhere else.
  //
  //    A keeper's parry was telling the lie, and it is fixed there too - but the invariant belongs here,
  //    where the shortcut is. A claim about `grounded` is a claim about a HEIGHT, and this is the one
  //    function that can check it instead of trusting every caller to.
  // ⚠️ A BALL ABOVE THE TURF IS NOT GROUNDED, WHATEVER IT SAYS. The flag routes the physics - grounded
  //    takes the rolling branch, which has no gravity in it - so a caller that set it while the ball was in
  //    the air did not merely mislabel the ball, it switched gravity off for the rest of the match.
  //
  //    Measured on a real ninety-minute match: events happened in the first minute and at half time and
  //    NOWHERE else, and for the last sixteen minutes the ball sat at exactly (5.7, 16.3, 1.20) without
  //    moving. 1.2 is `MAX_CONTROL_HEIGHT`, so nobody could pick it up either.
  //
  //    A keeper's parry was telling the lie and is fixed there too, but the invariant belongs here: this is
  //    the one function that knows both the flag and the height, so it is the one that can refuse.
  if (ball.p.z > 0) ball.grounded = false;

  if (ball.grounded && ball.v.x === 0 && ball.v.y === 0 && ball.v.z === 0) return;

  if (!ball.grounded) {
    ball.v.z -= BALL.gravity * dt;
    const keep = 1 - BALL.airDrag * dt;
    ball.v.x *= keep;
    ball.v.y *= keep;
    ball.v.z *= keep;
  } else {
    // Rolling. A ball on the turf loses ground speed and then STOPS exactly, rather than creeping by a
    // millimetre a second forever - a creeping ball never settles, and a position that never settles is a
    // digest that never repeats.
    const keep = 1 - BALL.rollDrag * dt;
    ball.v.x *= keep;
    ball.v.y *= keep;
    if (groundSpeed(ball) < BALL.stopSpeed) {
      ball.v.x = 0;
      ball.v.y = 0;
    }
  }

  clampSpeed(ball);

  ball.p.x += ball.v.x * dt;
  ball.p.y += ball.v.y * dt;
  ball.p.z += ball.v.z * dt;

  if (ball.p.z <= 0) land(ball);
}

/**
 * The ball reached the turf. Either it bounces, or it is slow enough to be declared settled.
 *
 * `z` is snapped to exactly 0 in both branches. Leaving it at the negative value the integration produced
 * would put the ball a hair under the pitch, and every height comparison downstream - can this be headed,
 * is it under the crossbar - would read a number that is almost but not quite the ground.
 */
function land(ball: Ball): void {
  ball.p.z = 0;
  if (-ball.v.z < BALL.settleSpeed) {
    ball.v.z = 0;
    ball.grounded = true;
    return;
  }
  ball.v.z = -ball.v.z * BALL.restitution;
  ball.v.x *= BALL.bounceGrip;
  ball.v.y *= BALL.bounceGrip;
  ball.grounded = false;
}

/** Speed over the turf, ignoring height. `Math.sqrt` is exactly rounded by IEEE-754; `Math.hypot` is not. */
export function groundSpeed(ball: Ball): number {
  return Math.sqrt(ball.v.x * ball.v.x + ball.v.y * ball.v.y);
}

function clampSpeed(ball: Ball): void {
  const s2 = ball.v.x * ball.v.x + ball.v.y * ball.v.y + ball.v.z * ball.v.z;
  if (s2 <= BALL.maxSpeed * BALL.maxSpeed) return;
  const k = BALL.maxSpeed / Math.sqrt(s2);
  ball.v.x *= k;
  ball.v.y *= k;
  ball.v.z *= k;
}
