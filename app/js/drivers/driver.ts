// SPDX-License-Identifier: AGPL-3.0-or-later
// WHO CALLS `step`, AND WHEN. The only thing that differs between the three clock modes.
//
// ========================= THE CONVERSION HAPPENS HERE AND NOWHERE ELSE =========================
// The engine's `startLoop` hands `PIXI.Ticker.deltaTime`, which counts FRAMES at a nominal 60Hz. The
// simulation counts SECONDS, at a fixed step. Frames become milliseconds once, at this boundary, and
// below it nobody ever sees a frame again. Every module that has to remember which unit it is in is a
// module that will one day forget.
//
// ⚠️ AND THE ENGINE'S DEFAULT CLAMP IS TOO TIGHT FOR AN ACCUMULATOR. `startLoop`'s `maxDt = 2` frames is
// about 33ms. A 200ms hitch would deliver 33ms of simulated time, and with an accumulator the world falls
// permanently behind the wall clock - once per hitch, forever, invisibly. The game passes `maxDt = 6` and
// clamps here as well, where the dropped time can be COUNTED. Dropping time is safe because the command
// stream is indexed by TICK and not by wall clock: fewer ticks happened that second, and the simulation
// is still an exact function of the frames it consumed. Silently falling behind is not safe, which is why
// `droppedMs` exists and is surfaced rather than swallowed.

import { DT } from '../sim/ball.ts';
import type { TickFrame, Command } from '../sim/command.ts';
import { step } from '../sim/step.ts';
import type { MatchState } from '../sim/state.ts';

/** Wall milliseconds per simulation tick. */
export const TICK_MS = 1000 / 60;

/** Wall milliseconds in one nominal render frame - what `deltaTime === 1` means. */
export const MS_PER_FRAME = 1000 / 60;

/** The ceiling `startLoop` should be given, in FRAMES, and the matching ceiling in ticks. */
export const MAX_DT_FRAMES = 6;
export const MAX_TICKS_PER_FRAME = 6;

/** Absorbs the last bit of `1000/60` so an exact number of ticks does not floor to one fewer. */
export const TICK_EPS = 1e-9;

/**
 * The paces an assisted match can be played at.
 *
 * ⚠️ NOTHING ABOVE 1, and the reason is the assisted driver's whole correctness argument: `tempo` scales
 * the WALL TIME going into the accumulator and never `DT`, so a slower match is the SAME match receiving
 * less time. A tempo above one would be a game running faster than the physics it was tuned for - a
 * different game, offered from a menu called assistances.
 */
export const TEMPO_CHOICES: readonly number[] = Object.freeze([0.5, 0.75, 1]);

/**
 * How the seats' decisions reach the simulation: every seat's command for one tick.
 *
 * ⚠️ IT USED TO RETURN ONE COMMAND, while `state.controlled` had been two seats long from the first day.
 * A second child could therefore be given a body, a marker and her own half of the keyboard and still
 * never appear in a single frame - and nothing was red, because one command is a correct answer for one
 * seat and every gate had one seat in it.
 */
export type CommandSource = (tick: number) => readonly Command[];

/**
 * What one tick DOES. A driver decides WHEN a tick happens and never what it contains.
 *
 * ⚠️ THE DEFAULT IS THE BARE SIMULATION, NOT A MATCH, and that is on purpose: a driver test should be
 * able to measure cadence without a referee in the room. A real match passes `playTick` bound to its
 * rules profile, and the drivers do not know the difference - which is what keeps "three clock modes,
 * one simulation" a property of the drivers rather than a coincidence of what they happen to call.
 */
export type TickFn = (state: MatchState, frame: TickFrame, dt: number) => void;

export interface Driver {
  /** Feed wall time; returns how many ticks actually ran. */
  advance(elapsedMs: number): number;
  /** 0..1 through the tick currently being rendered, for interpolation. */
  readonly alpha: number;
  paused: boolean;
  readonly maxTicksPerFrame: number;
  /** Wall time the accumulator had to throw away. Surfaced, never swallowed. */
  readonly droppedMs: number;
}

/**
 * ⚠️ SORTED HERE, AND `TickFrame` HAS ALWAYS SAID SO - *"Sorted by seat, always. Iteration order of the
 * commands is part of the determinism promise."* That was free while there was one command and became a
 * thing that has to be DONE the moment there were two. A replay recorded on a machine whose input layer
 * happened to answer in the other order would replay a different match, and the digest would report it as
 * a physics drift, which is the last place anybody would look for an input-ordering bug.
 */
const frameOf = (tick: number, source: CommandSource): TickFrame => ({
  tick,
  cmds: [...source(tick)].sort((a, b) => a.seat - b.seat),
});

/**
 * The shared accumulator. `tempo` scales the WALL TIME going in, never `DT`.
 *
 * That distinction is the assisted mode's whole correctness argument: at half tempo the world receives
 * half as much wall time and therefore runs half as many ticks, but each tick is identical to a full-speed
 * one. Scaling `DT` instead would change gravity per step, drag per step and every integration, and the
 * slow-motion match would be a different match.
 */
function makeDriver(state: MatchState, source: CommandSource, tempo: number, tick: TickFn): Driver {
  let acc = 0;
  let dropped = 0;

  const driver: Driver = {
    paused: false,
    maxTicksPerFrame: MAX_TICKS_PER_FRAME,
    get alpha() {
      return acc / TICK_MS;
    },
    get droppedMs() {
      return dropped;
    },
    advance(elapsedMs: number): number {
      if (driver.paused) return 0;
      acc += elapsedMs * tempo;

      // ⚠️ FLOOR DIVISION, NOT REPEATED SUBTRACTION, AND THE DIFFERENCE IS A MEASURED BUG.
      //    `TICK_MS` is 1000/60, which has no exact binary representation. Subtracting it in a loop leaves
      //    a residue each time, and five ticks' worth of wall time produced FOUR ticks - a driver running
      //    1.7% slow for the life of the match, with nothing anywhere to say so. Ten thousand accumulated
      //    ticks produced 9999. One division and one multiplication have a single rounding instead of N,
      //    and `TICK_EPS` absorbs the last bit so that a value which IS five ticks does not floor to four.
      const want = Math.floor((acc + TICK_EPS) / TICK_MS);
      const ran = want > MAX_TICKS_PER_FRAME ? MAX_TICKS_PER_FRAME : want;

      for (let i = 0; i < ran; i++) tick(state, frameOf(state.tick, source), DT);

      acc -= ran * TICK_MS;
      if (want > MAX_TICKS_PER_FRAME) {
        dropped += acc;
        acc = 0;
      }
      return ran;
    },
  };

  return driver;
}

export function createRealtimeDriver(
  state: MatchState,
  source: CommandSource,
  tick: TickFn = step,
): Driver {
  return makeDriver(state, source, 1, tick);
}

/**
 * Real time with the assistances an adult can turn on. `tempo` is the reduced-pace option; pausing
 * anywhere is `paused`, and it is a field rather than a method because a pause has no duration.
 *
 * The adjustable match clock and the configurable charge threshold are NOT here: one is a rules profile
 * and the other is an input-layer parameter. A driver that owned them would be a second place for a rule
 * to live.
 */
export function createAssistedDriver(
  state: MatchState,
  source: CommandSource,
  opts: { tempo: number; tick?: TickFn },
): Driver {
  return makeDriver(state, source, opts.tempo, opts.tick ?? step);
}

export interface TurnDriver extends Driver {
  /** Run one burst: ticks until the next decision point. Returns how many ticks ran. */
  commit(): number;
}

/**
 * No clock at all. `advance` ignores wall time entirely and returns zero, which is not a stub: it is the
 * mode's defining property, and WCAG 2.2.1 is satisfied by there being nothing to adjust.
 *
 * ⚠️ `ceiling` IS A CEILING AND NOT A PERIOD. Today it is the only condition, because possession and the
 * referee do not exist yet; when they do, a burst also ends when possession changes, when the seat's
 * player touches the ball, or when a restart is awarded. The ceiling stays regardless, because a child
 * must never be locked out of a decision by a burst that never ends.
 */
export function createTurnDriver(
  state: MatchState,
  source: CommandSource,
  opts: { ceiling: number; tick?: TickFn },
): TurnDriver {
  const tick = opts.tick ?? step;
  return {
    paused: false,
    maxTicksPerFrame: opts.ceiling,
    alpha: 0,
    droppedMs: 0,
    advance(): number {
      return 0;
    },
    commit(): number {
      let ran = 0;
      while (ran < opts.ceiling) {
        tick(state, frameOf(state.tick, source), DT);
        ran += 1;
      }
      return ran;
    },
  };
}
