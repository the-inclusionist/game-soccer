// SPDX-License-Identifier: AGPL-3.0-or-later
// RUNNING AT WHERE THE BALL WILL BE.
//
// ========================= WHAT AIMING AT THE BALL COST =========================
// The cascade's chase rule returned the ball's CURRENT position, which is pure pursuit - the dog chasing
// the car. A body aimed that way curves in behind a moving ball and arrives permanently late: it never
// leads, so a ball played into space is one nobody reaches and a loose ball is won by whoever happened to
// be nearer rather than by whoever was quicker.
//
// ⚠️ AND THE ANSWER IS MARCHED RATHER THAN SOLVED, WHICH IS A RULE AND NOT A LIMITATION. The ball slows
// under drag, so its position at a time needs an exponential - and `Math.exp` and `Math.pow` are on this
// repository's forbidden list because neither is exactly rounded by IEEE-754, which would let two machines
// replaying one match disagree about where a body ran. Walking the path with the simulation's own
// integrator is EXACT by construction: it is not an approximation of what the ball will do, it is what the
// ball will do.
//
// ========================= AND INTERCEPTION IS FOR A LOOSE BALL ONLY =========================
// ⚠️ APPLYING IT TO A CARRIER TOO DEADLOCKED THE MATCH, measured: six thousand ticks from a kickoff with
// the phase never once changing, and one fixture of twelve producing no corner at all. Against a carrier
// the ball's velocity is his last dribble touch, so the march predicts where it would stop IF HE DROPPED
// IT - a point a metre ahead of him. The presser ran there, stopped, and the carrier walked away, again
// and again, for a hundred seconds of football.
//
// ⚠️ THE EASING WAS THE OBVIOUS SUSPECT AND WAS NOT THE CAUSE. `steerAll` slows a body inside
// `ARRIVE_RADIUS` and stops it dead within twenty centimetres, which is exactly the shape of "he arrives
// and waits" - and taking that radius to zero left both failures precisely where they were. The plan for
// a later item predicts that easing will bite a chaser, and it may yet; it did not bite here, and the
// difference between a suspect and a cause is a run.
import { describe, expect, it } from 'vitest';
import { MARCH_TICKS, meetingPoint } from '../app/js/ai/meet.ts';
import { DT } from '../app/js/sim/ball.ts';
import type { Ball } from '../app/js/sim/ball.ts';

const ball = (x: number, y: number, vx: number, vy: number): Ball => ({
  p: { x, y, z: 0 },
  v: { x: vx, y: vy, z: 0 },
  grounded: true,
});

describe('where to run to meet the ball', () => {
  // ⚠️ THE POINT OF THE WHOLE ITEM, IN ONE ASSERTION. A body level with a ball that is rolling away must
  //    be sent AHEAD of it - anywhere behind is the pursuit curve this replaces.
  it('[Right] a body is sent ahead of a ball rolling away from it, not at it', () => {
    const b = ball(50, 28, 12, 0);
    const meet = meetingPoint({ x: 45, y: 28 }, 7, b, DT);

    expect(meet.x, 'the meeting point is behind the ball').toBeGreaterThan(b.p.x);
  });

  // ⚠️ [Zero] A STILL BALL IS MET WHERE IT LIES. The march is about leading a moving ball; asked about one
  //    that is not moving it must not invent a lead, or every restart would send the taker past the spot.
  it('[Zero] a ball that is not moving is met exactly where it is', () => {
    const b = ball(50, 28, 0, 0);
    const meet = meetingPoint({ x: 40, y: 28 }, 7, b, DT);

    expect(meet.x).toBe(50);
    expect(meet.y).toBe(28);
  });

  // ⚠️ [Boundary] AND A BALL HE CANNOT CATCH IS STILL CHASED, to where it comes to rest. Returning his own
  //    position - "I give up" - would leave a body standing while a ball rolled to a stop ten metres away
  //    with nobody going for it, which is the deadlock this rule exists to prevent.
  it('[Boundary] a ball he can never catch sends him to where it stops', () => {
    const b = ball(50, 28, 30, 0);
    const slow = meetingPoint({ x: 10, y: 28 }, 1, b, DT);

    expect(slow.x, 'a hopeless chase gave up where it stood').toBeGreaterThan(50);
  });

  // ⚠️ [Interface] THE MARCH IS BOUNDED, which is what keeps this inside the AI budget pillar 1 sets. It
  //    runs once per DECISION - about four bodies a tick on the existing stagger - and never per frame
  //    for every body, which is the cost that budget forbids.
  it('[Interface] it never looks further ahead than its own horizon', () => {
    const b = ball(0, 28, 40, 0);
    const meet = meetingPoint({ x: 0, y: 0 }, 0.1, b, DT);

    // Where a 40 m/s ball has got to after the horizon, and not one step more.
    const probe = ball(0, 28, 40, 0);
    let far = 0;
    for (let t = 0; t < MARCH_TICKS; t++) {
      probe.p.x += probe.v.x * DT;
      far = probe.p.x;
    }
    expect(meet.x, 'the march ran past its horizon').toBeLessThanOrEqual(far + 1);
  });

  // ⚠️ AND IT DOES NOT MOVE THE BALL. It is asked what the ball WOULD do, sixty times a second, from
  //    inside the AI - and a version that walked the real one would advance the world as a side effect of
  //    somebody thinking about it, which is the worst kind of bug to look for.
  it('[Zero] asking the question leaves the ball exactly where it was', () => {
    const b = ball(50, 28, 12, 3);
    const before = { x: b.p.x, y: b.p.y, vx: b.v.x, vy: b.v.y };

    meetingPoint({ x: 45, y: 28 }, 7, b, DT);

    expect({ x: b.p.x, y: b.p.y, vx: b.v.x, vy: b.v.y }).toEqual(before);
  });
});
