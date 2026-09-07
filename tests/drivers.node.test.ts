// SPDX-License-Identifier: AGPL-3.0-or-later
// THREE CLOCK MODES, ONE SIMULATION - and this file is where that stops being a claim.
//
// ========================= THE CLAIM =========================
// Real time, real time with assistances, and turn based are not three games. They are three answers to
// "who calls `step`, and when". If that is true, then the same committed decisions must produce the SAME
// MATCH in all three - identical digest trail, not merely a similar-looking one. If it is false, the
// accessibility argument collapses with it: the turn-based mode would be a different, easier game rather
// than the same game at the child's own pace, and WCAG 2.2.1 would be satisfied by a substitution instead
// of by construction.
//
// ========================= WHY THE ASSISTED DRIVER SCALES THE ACCUMULATOR =========================
// Slow motion is LESS WALL TIME PER TICK, never a smaller `DT`. Scaling `DT` would change the physics -
// gravity per step, drag per step, every integration - and the slow-motion match would diverge from the
// full-speed one. Scaling the accumulator changes only how often a tick happens, so the world is bit for
// bit the same and only the clock on the wall is different. The gate below is what keeps that honest.
import { describe, expect, it } from 'vitest';
import { digest } from '../app/js/sim/digest.ts';
import { createMatchState } from '../app/js/sim/state.ts';
import { playTick } from '../app/js/play.ts';
import { MATCH_PROFILE } from '../app/js/rules/profile.ts';
import { moveCommand, type Command } from '../app/js/sim/command.ts';
import {
  MS_PER_FRAME,
  TICK_MS,
  createAssistedDriver,
  createRealtimeDriver,
  createTurnDriver,
} from '../app/js/drivers/driver.ts';

/** Four decisions a child makes, each held for a burst of ticks. The same input, three ways of feeding it. */
const DECISIONS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0.5 },
  { dx: 0.25, dy: -1 },
];
const BURST = 45;
const TOTAL = DECISIONS.length * BURST;

// Cyclic, so the stream is defined for ANY tick: a helper that runs out at tick 180 turns a driver test
// into a test of the helper. The decision still changes exactly on a BURST boundary, which is what the
// cross-check gate depends on.
const commandAt = (tick: number): readonly Command[] => {
  const d = DECISIONS[Math.floor(tick / BURST) % DECISIONS.length];
  return [moveCommand(tick, 0, d.dx, d.dy)];
};

describe('the drivers', () => {
  it('[Right] the real-time driver runs one tick per tick-worth of wall time', () => {
    const s = createMatchState();
    const d = createRealtimeDriver(s, commandAt);

    // Five, and not fifty: a single call is capped at `maxTicksPerFrame` on purpose, and asking for more
    // measures the cap rather than the cadence. The cap has its own test below.
    const ran = d.advance(TICK_MS * 5);

    expect(ran).toBe(5);
    expect(s.tick).toBe(5);
  });

  it('[Boundary] a hitch is capped, and the dropped time is counted rather than silently lost', () => {
    const s = createMatchState();
    const d = createRealtimeDriver(s, commandAt);

    d.advance(TICK_MS * 500);

    expect(s.tick).toBeLessThanOrEqual(d.maxTicksPerFrame);
    expect(d.droppedMs).toBeGreaterThan(0);
  });

  it('[Zero] a paused driver runs no ticks at all, however much time passes', () => {
    const s = createMatchState();
    const d = createAssistedDriver(s, commandAt, { tempo: 1 });
    d.paused = true;

    expect(d.advance(TICK_MS * 100)).toBe(0);
    expect(s.tick).toBe(0);
  });

  // ⚠️ THE GATE THE WHOLE DESIGN RESTS ON.
  it('[Cross-check] real time, half-speed and turn based produce the SAME digest trail', () => {
    const realtime = createMatchState();
    const rt = createRealtimeDriver(realtime, commandAt);
    while (realtime.tick < TOTAL) rt.advance(MS_PER_FRAME);

    const slow = createMatchState();
    const half = createAssistedDriver(slow, commandAt, { tempo: 0.5 });
    while (slow.tick < TOTAL) half.advance(MS_PER_FRAME);

    const turn = createMatchState();
    const td = createTurnDriver(turn, commandAt, { ceiling: BURST });
    while (turn.tick < TOTAL) td.commit();

    expect(digest(slow)).toBe(digest(realtime));
    expect(digest(turn)).toBe(digest(realtime));
  });

  it('[Right] half speed needs twice the wall time to reach the same tick', () => {
    const a = createMatchState();
    const b = createMatchState();
    const full = createAssistedDriver(a, commandAt, { tempo: 1 });
    const half = createAssistedDriver(b, commandAt, { tempo: 0.5 });

    full.advance(TICK_MS * 6);
    half.advance(TICK_MS * 6);

    expect(a.tick).toBe(6);
    expect(b.tick).toBe(3);
  });

  // ⚠️ THE REGRESSION THAT PAID FOR ITSELF THE DAY IT WAS WRITTEN.
  //    `TICK_MS` is 1000/60 and has no exact binary form. The first accumulator subtracted it in a loop,
  //    and five ticks of wall time produced FOUR ticks - a simulation running 1.7% slow for the whole
  //    match, with no error anywhere and nothing on screen to see. Over ten seconds of real frames the
  //    loss compounds. Neither the cadence test nor the cross-check gate could catch it: both drivers were
  //    slow by the same amount, so they still agreed with each other.
  it('[Right] six hundred real frames deliver six hundred ticks, not five hundred and ninety-nine', () => {
    const s = createMatchState();
    const d = createRealtimeDriver(s, commandAt);

    for (let i = 0; i < 600; i++) d.advance(MS_PER_FRAME);

    expect(s.tick).toBe(600);
    expect(d.droppedMs).toBe(0);
  });

  // ⚠️ THE DRIVER DECIDES *WHEN*, NEVER *WHAT*. Handing it a full match tick - simulation, referee and
  //    restart - changes nothing about its cadence, which is the property that makes the cross-check gate
  //    above mean anything: if a driver could alter what a tick contains, three drivers agreeing would
  //    prove only that they were all doing the same wrong thing.
  it('[Interface] a driver runs a FULL match tick as readily as a bare simulation one', () => {
    const s = createMatchState();
    s.phase = 'live';
    for (const p of s.players) p.p = { x: 45, y: 28 };
    s.ball.p = { x: 30, y: 0.2, z: 0 };
    s.ball.v = { x: 0, y: -30, z: 0 };

    const d = createRealtimeDriver(s, commandAt, (st, fr, dt) => {
      playTick(st, fr, dt, MATCH_PROFILE);
    });
    d.advance(TICK_MS);

    expect(s.phase).toBe('throwIn');
    expect(s.ball.p.y).toBe(0);
  });

  it('[Interface] the turn driver has no clock: advancing wall time moves nothing', () => {
    const s = createMatchState();
    const d = createTurnDriver(s, commandAt, { ceiling: BURST });

    expect(d.advance(TICK_MS * 1000)).toBe(0);
    expect(s.tick).toBe(0);
  });
});

// ========================= TWO SEATS THROUGH ONE DRIVER =========================
// The command source produced ONE command while `state.controlled` had always been two seats long, so a
// second child could be given a body, a marker and a keyboard and still not appear in any frame - and no
// gate above would notice, because one seat is a correct answer for one seat.
describe('a frame with two seats in it', () => {
  const twoSeats = () => {
    const state = createMatchState(MATCH_PROFILE);
    seen.length = 0;
    return createRealtimeDriver(
      state,
      // Deliberately OUT of seat order: the frame is what has to be sorted, not the source.
      (tick) => [moveCommand(tick, 1, 1, 0), moveCommand(tick, 0, -1, 0)],
      (_s, frame) => {
        seen.push(frame.cmds.map((c) => c.seat).join(','));
        _s.tick += 1;
      },
    );
  };
  const seen: string[] = [];

  it('[Right] both seats reach the simulation', () => {
    twoSeats().advance(100);

    expect(seen.length).toBeGreaterThan(0);
    expect(seen[0].split(',')).toHaveLength(2);
  });

  // ⚠️ `TickFrame` SAYS "Sorted by seat, always. Iteration order is part of the determinism promise."
  //    That was free while there was one command. With two it is a thing that has to be DONE, and a
  //    replay recorded on a machine whose input layer happened to answer in the other order would diverge
  //    from the match that was played - reported as a physics drift, which is where nobody would look.
  it('[Interface] and they arrive in seat order however the input layer answered', () => {
    twoSeats().advance(100);

    expect(seen[0]).toBe('0,1');
  });
});
