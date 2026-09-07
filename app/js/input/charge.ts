// SPDX-License-Identifier: AGPL-3.0-or-later
// HOLDING, TURNED INTO A NUMBER - and three ways to reach the same numbers.
//
// ========================= WHY THE POWER LEAVES HERE AND NOT THE SIMULATION =========================
// The command carries an ALREADY INTEGRATED power. That is what makes the three clock modes one
// simulation: real time integrates a hold, the turn-based mode lets the child pick, press-to-release
// integrates between two edges, and the simulation sees one thing in all three. It also puts charging on
// the right side of a line the engine itself drew (`input/latch.ts`): an adaptation crosses from
// OPERATION into RULE only when it changes the set of reachable states or the probability of reaching
// them. Press-to-release reaches exactly the same powers as holding, so it is operation.
//
// ⚠️ ZERO GAME IMPORTS. Like `chord.ts`, this knows nothing about football. If the engine adopts it -
// and ADR-0077 already decided that hold-vs-latch is a per-action, per-player control option, which is
// this decision minus the magnitude - promoting it is a file move.

/** How many countable steps a power is reported in. Five, because a child counts five and not a bar. */
export const STEPS = 5;

/** Ticks of hold that mean full power. Three quarters of a second. */
const FULL_TICKS = 45;

/** Ticks before the charge starts to build at all, so a tap is a tap and not a nudge on the meter. */
const DEAD_TICKS = 3;

/**
 * What a tap is worth.
 *
 * ⚠️ IT IS THE ACCOMMODATION, NOT A ROUNDING DETAIL. If a zero-length hold gave zero power, a child who
 * cannot hold a button would get a pass that goes nowhere and would conclude the game is broken - and
 * nothing anywhere would report an error.
 */
const MIN_POWER = 0.4;

/** Ticks past full at which a charge fires itself. WCAG 2.1.2: a stuck switch must not trap a player. */
const RUNAWAY_TICKS = FULL_TICKS + 60;

/**
 * The three routes to a charged strike, as a list rather than only as a type.
 *
 * ⚠️ IT IS A VALUE BECAUSE A MENU HAS TO BE ABLE TO OFFER THEM. The type existed, the three routes were
 * implemented and gated, and `createSampler` took the mode - and the composition root never passed one,
 * so a child could not select any of them. `latch-stepped`, the only route with NO TIMING IN IT AT ALL,
 * was unreachable while the README listed it as done.
 */
export const CHARGE_MODES = ['hold', 'latch-timed', 'latch-stepped'] as const;

export type ChargeMode = (typeof CHARGE_MODES)[number];

export interface ChargeOut {
  /** 0..1, already integrated. */
  readonly power: number;
  /** 1..STEPS. The countable one, for the ear rather than the eye. */
  readonly step: number;
}

export interface Charge {
  /** Advance one tick with the button's held state; returns whatever fired. */
  tick(held: boolean): ChargeOut[];
  /** Abandon the charge without firing - a pause, a blur, being switched away from the player. */
  cancel(): void;
}

/** Power from a number of ticks held. Linear from the floor, because a curve is not countable. */
export function powerOf(ticks: number): number {
  const over = ticks - DEAD_TICKS;
  if (over <= 0) return MIN_POWER;
  const span = FULL_TICKS - DEAD_TICKS;
  const t = over >= span ? 1 : over / span;
  return MIN_POWER + (1 - MIN_POWER) * t;
}

/** The countable step a power lands on. */
export function stepOf(power: number): number {
  const t = (power - MIN_POWER) / (1 - MIN_POWER);
  const step = Math.round(t * (STEPS - 1)) + 1;
  return step < 1 ? 1 : step > STEPS ? STEPS : step;
}

/** The power a given step means, so stepping and holding land on the same numbers. */
function powerOfStep(step: number): number {
  const t = (step - 1) / (STEPS - 1);
  return MIN_POWER + (1 - MIN_POWER) * t;
}

const out = (power: number): ChargeOut[] => [{ power, step: stepOf(power) }];

export function createCharge(opts: { mode: ChargeMode }): Charge {
  let prev = false;
  let open = false;
  let ticks = 0;
  let step = 0;
  let idle = 0;

  const reset = () => {
    open = false;
    ticks = 0;
    step = 0;
    idle = 0;
  };

  return {
    cancel: reset,

    tick(held: boolean): ChargeOut[] {
      const down = held && !prev;
      const up = !held && prev;
      prev = held;

      if (opts.mode === 'latch-stepped') {
        // No clock anywhere: each press is one step, and a pause commits. The honest answer for a child
        // who can press but cannot time, and the default whenever one-switch or scanning is on.
        if (down) {
          step = step >= STEPS ? STEPS : step + 1;
          idle = 0;
          open = true;
          return [];
        }
        if (!open) return [];
        idle += 1;
        if (idle < 30) return [];
        const power = powerOfStep(step);
        reset();
        return out(power);
      }

      if (opts.mode === 'latch-timed') {
        // The holding is gone and the TIMING REMAINS, which is why this cannot be the only alternative.
        if (down) {
          if (!open) {
            open = true;
            ticks = 0;
            return [];
          }
          const power = powerOf(ticks);
          reset();
          return out(power);
        }
        if (!open) return [];
        ticks += 1;
        if (ticks < RUNAWAY_TICKS) return [];
        reset();
        return out(1);
      }

      if (down) {
        open = true;
        ticks = 0;
        return [];
      }
      if (!open) return [];

      if (up) {
        const power = powerOf(ticks);
        reset();
        return out(power);
      }

      ticks += 1;
      if (ticks < RUNAWAY_TICKS) return [];
      reset();
      return out(1);
    },
  };
}
