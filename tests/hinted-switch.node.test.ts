// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SWITCH SAYS IN ADVANCE WHO IT WOULD HAND HER.
//
// ========================= WHY THIS IS AN ACCESSIBILITY FEATURE AND NOT A POLISH =========================
// Pressing switch was a question with no visible answer: she pressed, and found out. For a child who
// cannot react quickly that is the worst shape a control can have - the cost of a wrong guess is paid in
// the half-second she has least of. Showing the answer BEFORE the press removes a reaction-time demand,
// which is the same class of accommodation as the stepped charge route: not easier, just not timed.
//
// ========================= AND SHOWING THE ANSWER EXPOSED THAT THE ANSWER JITTERED =========================
// ⚠️ MEASURED BEFORE ANYTHING WAS BUILT, over six fixtures with the scripted child driving: the nearest
// eligible body changed 902 times, and 23.8% of those changes lasted THREE TICKS OR FEWER. A quarter of
// the time the answer flipped to another player for fifty milliseconds and flipped back.
//
// ⚠️ AND THE FIRST MEASUREMENT OF WHY WAS THE WRONG QUESTION, which is worth keeping. The gap to the
// runner-up at the moment of a change reads 0.01 m at the median - and that proves nothing at all, because
// at the instant two players swap places they are equidistant BY DEFINITION. Measuring the gap at the
// crossing can only ever return zero. What separates a flicker from a real handover is what happens after.
//
// So the margin was swept instead:
//
//     margin   changes   flicker(<=3t)   median dwell   hint is not the nearest
//      0.00 m      902         23.8%           40t              0.0%
//      0.25 m      448          0.4%          158t              5.3%   <- the knee
//      0.50 m      397          0.5%          185t              8.0%
//      1.00 m      337          0.3%          190t             14.2%
//      2.00 m      270          0.0%          235t             24.5%
//
// A quarter of a metre does essentially all of the work: flicker falls sixty-fold, and everything past it
// buys nothing more while costing correctness steadily. The number is the knee of a measured curve.
import { describe, expect, it } from 'vitest';
import { createMatchState } from '../app/js/sim/state.ts';
import { playTick } from '../app/js/play.ts';
import { MATCH_PROFILE, withPeriod } from '../app/js/rules/profile.ts';
import { CLUBS } from '../app/js/teams/roster.ts';
import { DT } from '../app/js/sim/ball.ts';
import { HOLD_MARGIN, updateHints } from '../app/js/sim/switching.ts';
import { childFrame } from './helpers/scripted-child.ts';
import type { Command } from '../app/js/sim/command.ts';

const PROFILE = withPeriod(MATCH_PROFILE, 2.5);
const sides = { 0: CLUBS[0].ratings, 1: CLUBS[1].ratings };

function live() {
  const state = createMatchState(PROFILE);
  state.phase = 'live';
  return state;
}

describe('the hinted switch', () => {
  // ⚠️ THE HINT AND THE SWITCH ARE ONE FACT, WHICH IS THE WHOLE PROMISE. A marker that names a body the
  //    press then fails to hand her is worse than no marker: she would learn not to trust it, and an
  //    accommodation nobody trusts is an accommodation nobody uses. So the switch does not re-derive an
  //    answer - it TAKES the one already standing in the world.
  it('[Right] pressing switch hands her the HINTED body, not the nearest one', () => {
    const state = live();
    updateHints(state);
    const sitting = state.hinted[0];

    const taken = [...state.controlled, sitting];
    const rival = state.players.findIndex((_, i) => i > 0 && i < 11 && !taken.includes(i));
    for (let i = 0; i < state.players.length; i++) {
      if (i !== sitting && i !== rival) state.players[i].p = { x: 2 + (i % 4), y: 2 + Math.floor(i / 4) };
    }

    // ⚠️ THE TWO ARE MADE TO DISAGREE ON PURPOSE, and that is the whole gate. The rival is NEARER the
    //    ball than the sitting body - but by less than the margin, so the hint stays put. A press now has
    //    a right answer and a wrong one, and they are different bodies. A version of this that pressed at
    //    arbitrary ticks in a running match passed with the switch re-deriving its own answer, because the
    //    hint and the nearest agree 94.7% of the time and four presses never landed on the other 5.3%.
    state.ball.p = { x: 45, y: 28, z: 0 };
    state.players[sitting].p = { x: 45, y: 30 };
    state.players[rival].p = { x: 45, y: 30 - (HOLD_MARGIN - 0.05) };
    updateHints(state);
    expect(state.hinted[0], 'the fixture did not produce a disagreement to test').toBe(sitting);

    const cmd: Command = { tick: 0, seat: 0, dx: 0, dy: 0, verb: 'switch', power: 0, flags: 0 };
    playTick(state, { tick: 0, cmds: [cmd] }, DT, PROFILE, sides as never);

    expect(state.controlled[0], 'the switch handed her somebody the marker was not naming').toBe(sitting);
  });

  // ⚠️ AND THE HINT IS STEADY, which is the reason the margin exists at all. A marker that changes every
  //    few ticks is not a hint; it is a thing moving on the screen, and for the child this is FOR it is
  //    strictly worse than nothing, because she is the one who cannot read it before it moves.
  it('[Right] the hint does not flicker between two bodies a hair apart', () => {
    const state = live();
    updateHints(state);
    const sitting = state.hinted[0];
    const taken = [...state.controlled, sitting];
    const rival = state.players.findIndex((_, i) => i > 0 && i < 11 && !taken.includes(i));
    for (let i = 0; i < state.players.length; i++) {
      if (i !== sitting && i !== rival) state.players[i].p = { x: 2 + (i % 4), y: 2 + Math.floor(i / 4) };
    }
    state.ball.p = { x: 45, y: 28, z: 0 };

    // ⚠️ THE FLICKER IS BUILT RATHER THAN WAITED FOR. Two bodies a centimetre either side of each other,
    //    swapping which is nearer every tick, is exactly the situation the slate produced 902 times - and
    //    sampling a real match for it made a gate that could not fail, because over three thousand ticks
    //    the ratio was noise either way. Constructed, it takes one line to answer and it answers every run.
    let moves = 0;
    for (let t = 0; t < 200; t++) {
      const wobble = t % 2 === 0 ? 0.01 : -0.01;
      state.players[sitting].p = { x: 45, y: 30 };
      state.players[rival].p = { x: 45, y: 30 + wobble };
      const before = state.hinted[0];
      updateHints(state);
      if (state.hinted[0] !== before) moves++;
    }

    expect(moves, 'the hint chased a centimetre of wobble').toBe(0);
  });

  // ⚠️ [Boundary] A HAIR IS NOT ENOUGH AND A STRIDE IS. The two halves are one gate on purpose: a margin
  //    that only ever refused would be indistinguishable from a hint that never moves, which is the other
  //    way to fail this. Both directions are asserted against the same sitting body.
  it('[Boundary] a rival must beat the sitting body by more than the margin to take the hint', () => {
    const state = live();
    updateHints(state);
    const sitting = state.hinted[0];
    expect(sitting, 'nobody was hinted at all').toBeGreaterThanOrEqual(0);

    // Put the ball on the sitting body, then a rival a hair nearer than he is, then clearly nearer.
    const rival = [...state.controlled, sitting];
    const other = state.players.findIndex((_, i) => i > 0 && i < 11 && !rival.includes(i));
    expect(other, 'no third body to test with').toBeGreaterThan(0);

    // Everybody else is parked in a corner so the only question on the pitch is these two.
    for (let i = 0; i < state.players.length; i++) {
      if (i !== sitting && i !== other) state.players[i].p = { x: 2 + (i % 4), y: 2 + Math.floor(i / 4) };
    }
    state.ball.p = { x: 45, y: 28, z: 0 };

    // The sitting body two metres off, and the rival NEARER than him - by a hair, then by a stride.
    state.players[sitting].p = { x: 45, y: 30 };
    state.players[other].p = { x: 45, y: 30 - (HOLD_MARGIN - 0.05) };
    updateHints(state);
    expect(state.hinted[0], 'a hair nearer was enough to move the hint').toBe(sitting);

    state.players[other].p = { x: 45, y: 30 - (HOLD_MARGIN + 0.5) };
    updateHints(state);
    expect(state.hinted[0], 'a body clearly nearer did not take the hint').toBe(other);
  });

  // ⚠️ AND IT IS IN THE WORLD, SO A REPLAY REPRODUCES IT. The hint decides which body a press hands her,
  //    which makes it a fact about the match and not about the screen - the same argument that turned
  //    `controlled` from a boot-time constant into state the day `switch` became a verb.
  it('[Zero] the same match twice hints the same bodies, tick for tick', () => {
    const trace = (): string => {
      const state = live();
      const out: number[] = [];
      for (let t = 0; t < 600; t++) {
        playTick(state, childFrame(state, t), DT, PROFILE, sides as never);
        out.push(state.hinted[0]);
      }
      return out.join(',');
    };
    expect(trace()).toBe(trace());
  });
});
