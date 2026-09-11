// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT A STOPPED MATCH DOES, AND WHAT IT MUST NOT DO.
//
// ========================= THE DEFECT THIS REPOSITORY ALREADY MADE ONCE =========================
// `play.ts` kept a hand-written list of the phases in which the ball waits: throw-in, corner, goal kick,
// free kick, goal, half time, kickoff. `penalty` was the newest phase and was never added to it, so a
// penalty fell THROUGH the seam into the live path: the ball was placed on the spot and the world went
// on running under a referee who only speaks while the phase is `live`. Measured at the time - the ball
// ended up at x = 95.9 on a ninety-metre pitch, two bodies pinned against the goal line chasing it, and
// the match never reached full time.
//
// The fix was to DERIVE the list by subtraction - every phase except `live` and the two in which there is
// no match - so that a phase nobody taught the seam about freezes the world rather than letting it run
// lawless. ⚠️ AND THAT DERIVATION WAS NEVER GATED. It is a comment and a `filter`, and the next person to
// find the subtraction clever-looking can write the list back out by hand without a single test going red.
//
// ⚠️ SO THIS GATE WALKS THE ENUMERATION INSTEAD OF NAMING PHASES. `PHASES` is the state machine's own
// list; a twelfth phase is covered the day it is declared, which is the whole difference between this and
// the list that forgot the penalty.
//
// ========================= AND THE OTHER HALF: A STOPPED MATCH IS NOT A FROZEN ONE =========================
// Bodies keep moving while the ball waits, and that is not decoration - it was a DEADLOCK before they did.
// With play stopped nothing ran at all, so nobody ever walked to the spot, so the restart was never taken:
// a goal was scored and the match sat on it for the rest of the half. Football does the same thing - at a
// dead ball the ball waits and the players reposition.
//
// ⚠️ AND THE CONCEDING SIDE IS THE HALF WORTH ASSERTING SEPARATELY. The absorption plan names the failure
// by its shape: a celebration in which the opponents are frozen. Here the side that conceded is also the
// side that kicks off, so if anybody were to be frozen it would be the OTHER one - and a gate that only
// looked at the whole pitch would pass with eleven statues on it.
import { describe, expect, it } from 'vitest';
import { createMatchState } from '../app/js/sim/state.ts';
import { playTick } from '../app/js/play.ts';
import { MATCH_PROFILE } from '../app/js/rules/profile.ts';
import { PHASES } from '../app/js/rules/phase.ts';
import { AWAY, HOME, SQUAD_SIZE, firstOf, type TeamId } from '../app/js/sim/ids.ts';
import { DT } from '../app/js/sim/ball.ts';
import { emptyFrame } from '../app/js/sim/command.ts';
import { AVERAGE } from '../app/js/ai/ratings.ts';
import { NOBODY } from '../app/js/sim/possession.ts';
import { PITCH } from '../app/js/sim/units.ts';

const skills = { 0: AVERAGE, 1: AVERAGE };

/** A match in `phase`, with the ball rolling hard across the middle of the pitch. */
function rolling(phase: (typeof PHASES)[number]) {
  const s = createMatchState(MATCH_PROFILE);
  s.phase = phase;
  s.ball.p = { x: PITCH.length / 2, y: PITCH.width / 2, z: 0 };
  s.ball.v = { x: 12, y: 0, z: 0 };
  s.ball.grounded = true;
  s.possession.holder = NOBODY;
  return s;
}

/**
 * How fast every body of `team` is travelling, added up.
 *
 * ⚠️ SPEED AND NOT DISPLACEMENT, and the first version of this file got it wrong. Asserting that their
 * POSITIONS changed passed with the away side's steering zeroed out, because `holdTheLine` pushes the
 * defending side back off the ball at a restart - so a gate on displacement measures a SHOVE and reports
 * it as walking. Eleven statues being slid ten yards would have passed it.
 *
 * Velocity is what a body has when it is moving under its own steam: `holdTheLine` writes positions and
 * touches nothing else.
 */
function walking(s: ReturnType<typeof rolling>, team: TeamId): number {
  let sum = 0;
  for (let k = 0; k < SQUAD_SIZE; k++) {
    const v = s.players[firstOf(team) + k].v;
    sum += Math.sqrt(v.x * v.x + v.y * v.y);
  }
  return sum;
}

describe('a phase that is not live', () => {
  // ⚠️ EVERY PHASE THE MACHINE DECLARES, and `live` is the only exception the claim allows. `preMatch`
  //    and `fullTime` move nothing either - there is no match in them - so the sentence is exact as
  //    written: the ball moves in one phase and in no other.
  it('[Many] the ball waits in every phase but one, including any phase added later', () => {
    const moving: string[] = [];

    for (const phase of PHASES) {
      const s = rolling(phase);
      const was = s.ball.p.x;
      playTick(s, emptyFrame(0), DT, MATCH_PROFILE, skills);
      if (s.ball.p.x !== was) moving.push(phase);
    }

    expect(moving, 'a phase fell through the seam and the world ran under no laws').toEqual(['live']);
  });
});

describe('a goal, before the kickoff', () => {
  /** A goal just scored: the ball on the centre spot, the home side to restart. */
  function afterAGoal() {
    const s = createMatchState(MATCH_PROFILE);
    s.phase = 'goal';
    s.ball.p = { x: PITCH.length / 2, y: PITCH.width / 2, z: 0 };
    s.ball.v = { x: 0, y: 0, z: 0 };
    s.ball.grounded = true;
    s.possession.holder = NOBODY;
    s.restartTaker = HOME;
    return s;
  }

  it('[Right] both sides keep walking, so the celebration is not a freeze-frame', () => {
    const s = afterAGoal();

    for (let t = 0; t < 30; t++) playTick(s, emptyFrame(t), DT, MATCH_PROFILE, skills);

    expect(walking(s, HOME), 'the side that kicks off is frozen').toBeGreaterThan(1);
    expect(walking(s, AWAY), 'the side that conceded is frozen').toBeGreaterThan(1);
  });

  // ⚠️ AND IT ENDS UNDER ITS OWN STEAM, which is the wedge half. `full-match` catches this over six whole
  //    fixtures and takes minutes to do it; one fixture and four seconds of simulated time is the cheap
  //    tripwire that says which change broke it.
  it('[Right] and it ends by itself, without anybody at the keyboard', () => {
    const s = afterAGoal();

    let restarted = false;
    for (let t = 0; t < 600 && !restarted; t++) {
      playTick(s, emptyFrame(t), DT, MATCH_PROFILE, skills);
      if (s.phase === 'live' || s.phase === 'kickoff') restarted = true;
    }

    expect(restarted, 'the match never came back from the goal').toBe(true);
  });

  // ⚠️ [Zero] AND THE BALL STAYS ON THE SPOT WHILE THEY WALK. `step` is called with `moveBall` false here,
  //    and the two halves travel together: a change that let bodies move would be tempting to write as
  //    "just run the whole step", which would also roll the ball away from the spot it was placed on.
  it('[Zero] and the ball stays where it was put, even carrying pace', () => {
    const s = afterAGoal();
    // ⚠️ WITH VELOCITY ON IT, WHICH THE FIRST VERSION OF THIS GATE DID NOT HAVE. A ball at rest does not
    //    move whether the step is told to move it or not, so the gate could not fail: running the FULL
    //    step - the mutation it exists to catch - left it green. The spot is where the ball was placed;
    //    what must not happen is the world integrating it away from there.
    s.ball.v = { x: 12, y: 0, z: 0 };
    const was = { x: s.ball.p.x, y: s.ball.p.y };

    for (let t = 0; t < 30; t++) playTick(s, emptyFrame(t), DT, MATCH_PROFILE, skills);

    expect(s.ball.p.x).toBe(was.x);
    expect(s.ball.p.y).toBe(was.y);
  });
});
