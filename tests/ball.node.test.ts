// SPDX-License-Identifier: AGPL-3.0-or-later
// THE BALL, AND THE THIRD AXIS.
//
// ========================= WHY HEIGHT IS A FIELD AND NOT AN EFFECT =========================
// A lofted through ball is one of the nine things the control scheme names, so `z` is a mechanic and not
// decoration. It also pays for itself on screen: at 320x180 the ball is three pixels, and the ONLY way
// three pixels can say "I am in the air" is a shadow that stays on the turf while the sprite rises.
//
// ========================= THE ARITHMETIC IS RESTRICTED, AND ON PURPOSE =========================
// Nothing under `sim/` may use `Math.hypot`, trigonometry or `Math.pow`: IEEE-754 specifies `sqrt` exactly
// and specifies those not at all, so they differ between a school Chromebook and a teacher's laptop. That
// difference is a desync in the netcode this simulation is being born ready for, and it would surface as
// "the replay diverges after forty seconds" with no other symptom. There is a source-scan gate for it.
import { describe, expect, it } from 'vitest';
import { DT, createBall, stepBall } from '../app/js/sim/ball.ts';

describe('a ball nobody touches', () => {
  // [Zero] — the case with no motion in it, and it is not trivial: it is the one that catches gravity
  // being applied to a ball already on the turf, and a drag term that turns a zero into a NaN.
  it('[Zero] resting on the turf, stays exactly where it is for ten seconds', () => {
    const ball = createBall({ x: 45, y: 28 });

    for (let i = 0; i < 600; i++) stepBall(ball, DT);

    expect(ball.p).toEqual({ x: 45, y: 28, z: 0 });
    expect(ball.v).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('a ball that leaves the turf', () => {
  // [One] — one kick, straight up, and the assertion is that it COMES BACK. Without gravity the ball
  // leaves the world and every rule downstream (out of play, goal, offside) reads a position that is not
  // on the pitch, which is a bug that never looks like a physics bug.
  it('[One] kicked straight up, returns to the turf and settles', () => {
    const ball = createBall({ x: 45, y: 28 });
    ball.v.z = 7;
    ball.grounded = false;

    for (let i = 0; i < 600; i++) stepBall(ball, DT);

    expect(ball.p.z).toBe(0);
    expect(ball.grounded).toBe(true);
    expect(Math.abs(ball.v.z)).toBeLessThan(0.001);
  });
});

// ========================= A BALL CANNOT BE ASLEEP IN THE AIR =========================
// `stepBall` returns immediately for a ball that is grounded and still, which is what stops a settled ball
// costing anything - and it trusted `grounded` without ever asking where the ball WAS.
//
// ⚠️ THAT COST FORTY-FOUR MINUTES OF EVERY MATCH. Measured on a real ninety-minute match: events happened
// in the first minute and at half time and NOWHERE ELSE, and for the last sixteen minutes the ball sat at
// exactly (5.7, 16.3, 1.20) without moving a millimetre. 1.2 is `MAX_CONTROL_HEIGHT` - so nobody could
// take it either, and the match ran to full time with a frozen ball in the middle of the pitch.
//
// It got there because a keeper's parry marked the ball grounded without putting it on the turf. But the
// invariant belongs HERE, where the shortcut is: a claim about `grounded` is a claim about a height, and
// this function is the one that can check it rather than trusting five callers to.
describe('a ball that says it has settled', () => {
  it('[Right] falls anyway if it is not actually on the turf', () => {
    const ball = createBall({ x: 45, y: 28 });
    ball.p.z = 1.2;
    ball.v = { x: 0, y: 0, z: 0 };
    ball.grounded = true; // the lie a parry used to tell

    for (let t = 0; t < 120; t++) stepBall(ball, DT);

    expect(ball.p.z, 'the ball hung in the air for two seconds').toBeLessThan(0.01);
  });

  it('[Zero] and a ball actually at rest on the turf still costs nothing', () => {
    const ball = createBall({ x: 45, y: 28 });
    ball.v = { x: 0, y: 0, z: 0 };
    ball.grounded = true;
    const before = { ...ball.p };

    for (let t = 0; t < 120; t++) stepBall(ball, DT);

    expect(ball.p).toEqual(before);
  });
});
