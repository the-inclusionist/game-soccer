// SPDX-License-Identifier: AGPL-3.0-or-later
// HOLDING IS A MAGNITUDE, and the alternative to holding is not optional.
//
// ========================= THE FIRST ASSERTION PROTECTS A CHILD =========================
// A tap must produce a usable pass. If a zero-length hold gives zero power, the child who cannot hold a
// button gets a pass that goes nowhere and concludes the game is broken - and nothing anywhere reports an
// error. `minPower` is that floor, and it is the accommodation rather than a rounding detail.
//
// ========================= AND WHY THERE IS A COUNTABLE STEP =========================
// A power BAR is nothing to a child who cannot see it. "Three of five" is something, with a tone per
// step. So power is emitted twice: as a continuous number for the simulation, and as a countable one for
// the screen reader. It is the same lesson the 2048 learned when its objective counted DOUBLINGS instead
// of tile values.
//
// ========================= THE THREE MODES, AND WHY TWO ARE NOT ENOUGH =========================
// `hold` demands sustained actuation. `latch-timed` removes the holding and KEEPS THE TIMING, which is
// half the barrier and is why it cannot be the only alternative. `latch-stepped` demands no timing at
// all: each press is one step, and a pause fires. ADR-0077 already decided latching is a per-action,
// per-player option; a charge is that decision with a magnitude attached.
import { describe, expect, it } from 'vitest';
import { STEPS, createCharge, powerOf, stepOf } from '../app/js/input/charge.ts';

describe('the charge curve', () => {
  // ⚠️ FIRST, AND IT IS FIRST ON PURPOSE.
  it('[Zero] a tap - zero ticks held - still fires, at the floor and never at nothing', () => {
    const p = powerOf(0);

    expect(p).toBeGreaterThan(0);
    expect(stepOf(p)).toBeGreaterThanOrEqual(1);
  });

  it('[One] a full hold is full power and the top step', () => {
    const p = powerOf(1000);

    expect(p).toBe(1);
    expect(stepOf(p)).toBe(STEPS);
  });

  it('[Interface] the step is a whole number between one and five, always', () => {
    for (let ticks = 0; ticks < 200; ticks++) {
      const s = stepOf(powerOf(ticks));
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(STEPS);
    }
  });

  it('[Interface] power never goes down as the hold gets longer', () => {
    let last = -1;
    for (let ticks = 0; ticks < 200; ticks++) {
      const p = powerOf(ticks);
      expect(p).toBeGreaterThanOrEqual(last);
      last = p;
    }
  });

  it('[Boundary] every step from one to five is reachable by holding', () => {
    const reached = new Set<number>();
    for (let ticks = 0; ticks < 200; ticks++) reached.add(stepOf(powerOf(ticks)));

    expect([...reached].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('holding', () => {
  function hold(mode: 'hold', ticks: number) {
    const c = createCharge({ mode });
    const fired: number[] = [];
    for (let t = 0; t < ticks; t++) for (const p of c.tick(true)) fired.push(p.power);
    for (const p of c.tick(false)) fired.push(p.power);
    return fired;
  }

  it('[One] press, hold, release fires exactly once', () => {
    expect(hold('hold', 20)).toHaveLength(1);
  });

  it('[Right] a longer hold fires harder', () => {
    expect(hold('hold', 40)[0]).toBeGreaterThan(hold('hold', 5)[0]);
  });

  // ⚠️ WCAG 2.1.2, NO KEYBOARD TRAP. A stuck switch must not freeze a child's player forever, so a charge
  //    that outlives its window fires itself. It is not a gameplay rule; it is an escape hatch.
  it('[Boundary] a charge held past its window fires ITSELF rather than trapping the player', () => {
    const c = createCharge({ mode: 'hold' });
    const fired: number[] = [];

    for (let t = 0; t < 400; t++) for (const p of c.tick(true)) fired.push(p.power);

    expect(fired).toHaveLength(1);
    expect(fired[0]).toBe(1);
  });

  it('[Zero] releasing without ever pressing fires nothing', () => {
    const c = createCharge({ mode: 'hold' });

    expect([...c.tick(false), ...c.tick(false)]).toEqual([]);
  });

  it('[Right] a cancelled charge fires nothing at all', () => {
    const c = createCharge({ mode: 'hold' });
    c.tick(true);
    c.tick(true);
    c.cancel();

    expect([...c.tick(false)]).toEqual([]);
  });
});

describe('the alternatives to holding', () => {
  it('[Right] press-to-start and press-to-release reaches power without a sustained hold', () => {
    const c = createCharge({ mode: 'latch-timed' });
    const fired: number[] = [];

    for (const p of c.tick(true)) fired.push(p.power); // press: starts
    for (let t = 0; t < 20; t++) for (const p of c.tick(false)) fired.push(p.power);
    for (const p of c.tick(true)) fired.push(p.power); // press: fires

    expect(fired).toHaveLength(1);
    expect(fired[0]).toBeGreaterThan(powerOf(0));
  });

  it('[Right] stepping demands NO timing - each press is one step, and a pause fires', () => {
    const c = createCharge({ mode: 'latch-stepped' });
    const fired: { power: number; step: number }[] = [];
    const press = () => {
      c.tick(true);
      c.tick(false);
    };

    press();
    press();
    press();
    for (let t = 0; t < 60; t++) for (const p of c.tick(false)) fired.push(p);

    expect(fired).toHaveLength(1);
    expect(fired[0].step).toBe(3);
  });

  // ⚠️ THE CONFORMANCE ASSERTION, AND THE ONE THAT WOULD ROT IN SILENCE. If stepping could not reach the
  //    same powers as holding, the accommodation would be a weaker game rather than the same game - and
  //    every unit test above would still pass.
  it('[Cross-check] stepping reaches EXACTLY the same set of steps that holding does', () => {
    const byHolding = new Set<number>();
    for (let ticks = 0; ticks < 200; ticks++) byHolding.add(stepOf(powerOf(ticks)));

    const byStepping = new Set<number>();
    for (let presses = 1; presses <= STEPS; presses++) {
      const c = createCharge({ mode: 'latch-stepped' });
      for (let i = 0; i < presses; i++) {
        c.tick(true);
        c.tick(false);
      }
      for (let t = 0; t < 60; t++) for (const p of c.tick(false)) byStepping.add(p.step);
    }

    expect([...byStepping].sort()).toEqual([...byHolding].sort());
  });

  it('[Boundary] stepping past the top stays at the top rather than wrapping to nothing', () => {
    const c = createCharge({ mode: 'latch-stepped' });
    for (let i = 0; i < STEPS + 4; i++) {
      c.tick(true);
      c.tick(false);
    }

    const fired: { step: number }[] = [];
    for (let t = 0; t < 60; t++) for (const p of c.tick(false)) fired.push(p);

    expect(fired[0].step).toBe(STEPS);
  });
});
