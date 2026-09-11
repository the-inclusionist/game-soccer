// SPDX-License-Identifier: AGPL-3.0-or-later
// WHERE TO RUN TO MEET A MOVING BALL, rather than where the ball is now.
//
// ========================= WHY AIMING AT THE BALL IS THE WRONG ANSWER =========================
// The cascade's chase rule returned the ball's CURRENT position, which is pure pursuit - the dog chasing
// the car. A body aimed that way curves in behind a moving ball and arrives permanently late: it never
// leads, so a pass played into space is a pass nobody reaches and a loose ball is one the nearer side
// always wins by being nearer rather than by being quicker.
//
// What a person does instead is run at where the ball WILL BE. That is one question - which point on the
// ball's path can I get to first - and it has an exact answer.
//
// ========================= AND THE ANSWER IS MARCHED, NOT SOLVED =========================
// ⚠️ THERE IS NO CLOSED FORM AVAILABLE HERE AND THAT IS A RULE RATHER THAN A LIMITATION. The ball slows
// under drag, so its position at time t needs an exponential - and `Math.exp` and `Math.pow` are on this
// repository's forbidden list because neither is exactly rounded by IEEE-754, which would let two
// machines replaying one match disagree about where a body ran.
//
// ⚠️ SO THE PATH IS WALKED WITH THE SIMULATION'S OWN INTEGRATOR, which is not a workaround: it is EXACT
// by construction, because it is literally what the ball will do. A closed form would be an approximation
// of this; this is the thing itself.
//
// ⚠️ AND IT COSTS ONE MARCH PER DECISION, NOT ONE PER FRAME. `ai/schedule` already staggers thinking so
// that about four bodies decide on any tick, and this runs inside that budget. A version that marched for
// every body every frame is exactly the per-frame cost pillar 1 forbids, and it would be the same answer
// computed sixty times a second for a ball that has not changed its mind.

import { stepBall } from '../sim/ball.ts';
import type { Ball } from '../sim/state.ts';
import type { Vec2 } from '../sim/vec.ts';

/**
 * How many ticks ahead the march looks. A second and a quarter.
 *
 * ⚠️ FROM THE MEASURED FLIGHTS AND NOT FROM A ROUND NUMBER. Twelve fixtures: a ball flight above the
 * control speed is 9 m at the ninetieth percentile and 28.5 m at the ninety-ninth, leaving at about 26
 * metres a second and slowing. Seventy-five ticks covers the longest of them with room; looking further
 * would be spending ticks on a part of the path that will have been overtaken by events long before the
 * ball gets there.
 */
export const MARCH_TICKS = 75;

/**
 * The first point on the ball's path this body can be at no later than the ball.
 *
 * Returns where the ball comes to rest when there is no such point - which is the honest answer to "I
 * cannot cut this off": chase it down rather than give up, and be there when it stops.
 *
 * ⚠️ THE BODY IS TREATED AS TRAVELLING IN A STRAIGHT LINE AT ITS TOP SPEED, which overstates it - a body
 * has to turn, and turning costs it. The overstatement is deliberate and one-directional: it makes him
 * commit to a point slightly earlier on the path than he can truly reach, so he arrives a shade late
 * rather than standing and waiting at a spot the ball beat him to. Late and moving is recoverable;
 * stopped and wrong is not.
 */
export function meetingPoint(from: Vec2, topSpeed: number, ball: Ball, dt: number): Vec2 {
  // A copy, because this asks what the ball WOULD do - the real one must not move because somebody thought.
  const probe: Ball = {
    p: { x: ball.p.x, y: ball.p.y, z: ball.p.z },
    v: { x: ball.v.x, y: ball.v.y, z: ball.v.z },
    grounded: ball.grounded,
  };

  for (let t = 1; t <= MARCH_TICKS; t++) {
    stepBall(probe, dt);
    const dx = probe.p.x - from.x;
    const dy = probe.p.y - from.y;
    const gap = Math.sqrt(dx * dx + dy * dy);
    // How far he could have travelled by then. `t * dt` seconds of running.
    if (gap <= topSpeed * t * dt) return { x: probe.p.x, y: probe.p.y };
  }

  return { x: probe.p.x, y: probe.p.y };
}
