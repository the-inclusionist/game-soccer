// SPDX-License-Identifier: AGPL-3.0-or-later
// THE STEP, AND THE PROMISE IT MAKES.
//
// ========================= THE PROMISE =========================
// (initial state, command stream) determines the state. Nothing else. Not the wall clock, not the frame
// rate, not the machine. Everything the plan builds on top of this - the three clock modes over one
// simulation, the golden replay, a future netcode - is that one sentence being true, and these are the
// tests that make it a measured property instead of an intention.
//
// ⚠️ THE COMMAND IS THE ONLY WAY IN. `step` takes no device, reads no keyboard and polls no pad: a frame
// of commands arrives and a new state comes out. That is what lets the turn-based driver hand it the same
// command for a burst of ticks, and what lets a replay hand it a recording.
import { describe, expect, it } from 'vitest';
import { digest } from '../app/js/sim/digest.ts';
import { createMatchState } from '../app/js/sim/state.ts';
import { DT } from '../app/js/sim/ball.ts';
import { emptyFrame, step } from '../app/js/sim/step.ts';
import { CONTROLLED_BY_SEAT, moveCommand } from '../app/js/sim/command.ts';

function run(ticks: number, frameFor: (t: number) => ReturnType<typeof emptyFrame>) {
  const s = createMatchState();
  for (let t = 0; t < ticks; t++) step(s, frameFor(t), DT);
  return s;
}

describe('the step is a function of its inputs and nothing else', () => {
  it('[One] advances the tick counter by exactly one', () => {
    const s = createMatchState();

    step(s, emptyFrame(0), DT);

    expect(s.tick).toBe(1);
  });

  // ⚠️ THE STREAM HAS TO MAKE THE WORLD MOVE, or this gate proves that nothing changes nothing. An empty
  //    command stream over a still pitch is deterministic by having no content, which is the shape a weak
  //    test takes when nobody checks it can fail. So both seats steer on a varying pattern and the ball is
  //    struck, and the digest is compared after ten thousand ticks of actual football.
  it('[Many] ten thousand ticks of a MOVING stream produce the same digest, twice', () => {
    const stream = (t: number) => ({
      tick: t,
      cmds: [
        moveCommand(t, 0, ((t % 120) - 60) / 60, ((t % 77) - 38) / 38),
        moveCommand(t, 1, ((t % 53) - 26) / 26, ((t % 91) - 45) / 45),
      ],
    });
    const a = run(10_000, stream);
    const b = run(10_000, stream);

    expect(digest(b)).toBe(digest(a));
    expect(a.players[9].p).not.toEqual(createMatchState().players[9].p);
  });

  it('[Right] a command actually reaches the world - one seat pushing right moves that body', () => {
    const seat = 0;
    const idle = run(120, (t) => emptyFrame(t));
    const pushed = run(120, (t) => ({ tick: t, cmds: [moveCommand(t, seat, 1, 0)] }));

    const who = CONTROLLED_BY_SEAT[seat];
    expect(pushed.players[who].p.x).toBeGreaterThan(idle.players[who].p.x + 1);
  });

  it('[Right] a step decides possession, so the referee never reads a stale holder', () => {
    const s = createMatchState();
    s.ball.p = { x: s.players[9].p.x, y: s.players[9].p.y, z: 0 };

    step(s, emptyFrame(0), DT);

    expect(s.possession.holder).toBe(9);
    expect(s.possession.lastTouch).toBe(9);
  });

  it('[Boundary] a body pushed off the touchline is held on the pitch, not lost', () => {
    const seat = 0;
    const s = createMatchState();
    for (let t = 0; t < 3000; t++) step(s, { tick: t, cmds: [moveCommand(t, seat, 0, -1)] }, DT);

    // ⚠️ BOTH HALVES, and the second half is the one that matters. `y >= 0` alone passes when the body
    //    never moved at all - it was green under a mutation that ignored every command. Asserting the
    //    body actually ARRIVED at the touchline is what makes this a clamp test instead of a tautology.
    expect(s.players[CONTROLLED_BY_SEAT[seat]].p.y).toBe(0);
  });
});
