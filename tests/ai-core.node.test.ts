// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CHEAP HALF OF THE AI: who thinks this tick, where home is, and what a rating does.
//
// ========================= THE COST BUDGET IS A REQUIREMENT, NOT A TUNING =========================
// Pillar 1 is a Positivo tablet and a school Chromebook at 60fps. Twenty-two agents each deciding every
// tick is twenty-two decisions per tick; staggered over six ticks it is under four. That single division
// is the difference between a game that runs in a classroom and one that does not, so it is a gate with a
// number in it rather than a comment saying "keep it cheap".
//
// ========================= AND RATINGS APPLY AT THE POINT OF ACTION =========================
// A weak side and a strong side run the SAME cascade. Nothing branches on skill: the numbers enter where
// the action happens - top speed, control radius, pass error. That is what makes difficulty six floats
// instead of a second AI, and it is what lets the monotonicity gate mean something.
import { describe, expect, it } from 'vitest';
import { SQUAD_SIZE } from '../app/js/sim/ids.ts';
import { PITCH } from '../app/js/sim/units.ts';
import { THINK_PERIOD, thinksThisTick } from '../app/js/ai/schedule.ts';
import { FORMATION_442, homeSpot } from '../app/js/ai/formation.ts';
import { AVERAGE, capsFor, passErrorOf } from '../app/js/ai/ratings.ts';

describe('the think schedule', () => {
  it('[Many] every player thinks exactly once per period, and never two on the same tick twice', () => {
    const counts = new Array<number>(SQUAD_SIZE * 2).fill(0);

    for (let tick = 0; tick < THINK_PERIOD; tick++) {
      for (let id = 0; id < SQUAD_SIZE * 2; id++) {
        if (thinksThisTick(id, tick)) counts[id] += 1;
      }
    }

    expect(counts.every((c) => c === 1)).toBe(true);
  });

  // The gate with the number in it. Twenty-two agents over six hundred ticks would be 13 200 decisions
  // without the stagger; with it, 2 200.
  it('[Performance] six hundred ticks cost at most a quarter of the naive budget', () => {
    let decisions = 0;

    for (let tick = 0; tick < 600; tick++) {
      for (let id = 0; id < SQUAD_SIZE * 2; id++) {
        if (thinksThisTick(id, tick)) decisions += 1;
      }
    }

    expect(decisions).toBe((600 / THINK_PERIOD) * SQUAD_SIZE * 2);
    expect(decisions).toBeLessThanOrEqual((600 * SQUAD_SIZE * 2) / 4);
  });

  // ⚠️ AND THE GATE ABOVE MEASURES A SUM WHEN THE REQUIREMENT IS A PEAK. Measured 2026-09-11 by changing
  // `(tick + id) % THINK_PERIOD` to `tick % THINK_PERIOD` - which is the plan's own named mutation, "remove
  // the stagger" - every one of the three gates in this describe stayed GREEN. All twenty-two then think on
  // tick 0 and none on the five after it: six hundred ticks still cost 2 200 decisions, the average is still
  // under four, and the frame that has to draw twenty-two decisions is the dropped frame on the Positivo
  // tablet that pillar 1 names. A sum over six hundred ticks averages away exactly the spike it forbids.
  //
  // ⚠️ THE MUTATION IS CAUGHT, AND THAT IS THE TRAP. Eight gates went red in `ai-brain`, `ai-fouls` and
  // `golden-match` - all of them saying "the match is no longer the recorded match", none of them saying
  // "a frame got four times dearer". A golden trail is re-blessable BY DESIGN, because the AI gets retuned
  // on purpose; the day someone re-blesses it for a legitimate reason, a cost regression rides along and the
  // only gate with a cost number in it is still green. So the peak is measured here, where it is the claim.
  it('[Performance] no single tick costs more than four decisions, however the total falls out', () => {
    const perTick: number[] = [];

    for (let tick = 0; tick < THINK_PERIOD; tick++) {
      let thinking = 0;
      for (let id = 0; id < SQUAD_SIZE * 2; id++) {
        if (thinksThisTick(id, tick)) thinking += 1;
      }
      perTick.push(thinking);
    }

    // ⚠️ FOUR IS WRITTEN OUT AS WELL AS DERIVED, because an expectation computed only from `THINK_PERIOD`
    // and `SQUAD_SIZE` moves with the constants it exists to pin - the trap this project has met before.
    // Twenty-two over six is three and four-sixths, so four is the ceiling and three the floor.
    expect(Math.max(...perTick)).toBe(4);
    expect(Math.max(...perTick)).toBe(Math.ceil((SQUAD_SIZE * 2) / THINK_PERIOD));

    // And no tick is idle: an empty tick is a crowded one somewhere else in the period.
    expect(Math.min(...perTick)).toBe(Math.floor((SQUAD_SIZE * 2) / THINK_PERIOD));
  });

  it('[Interface] the schedule is a pure function of the tick, so a replay reproduces it', () => {
    expect(thinksThisTick(7, 13)).toBe(thinksThisTick(7, 13));
    expect(thinksThisTick(7, 13)).toBe(thinksThisTick(7, 13 + THINK_PERIOD));
  });
});

describe('the formation', () => {
  it('[Many] a 4-4-2 is eleven anchors, all inside the normalised box', () => {
    expect(FORMATION_442).toHaveLength(SQUAD_SIZE);

    for (const [nx, ny] of FORMATION_442) {
      expect(nx).toBeGreaterThanOrEqual(0);
      expect(nx).toBeLessThanOrEqual(1);
      expect(ny).toBeGreaterThanOrEqual(0);
      expect(ny).toBeLessThanOrEqual(1);
    }
  });

  it('[One] the keeper is the deepest of the eleven, and he is index zero', () => {
    const deepest = FORMATION_442.reduce((a, b) => (a[0] <= b[0] ? a : b));

    expect(FORMATION_442[0]).toBe(deepest);
  });

  const flat = { mode: 'defend' as const, lineHeight: 1, width: 1, presserId: -1 };

  it('[Right] a home anchor lands on the pitch, in the half the side defends', () => {
    const spot = homeSpot(3, flat, 1, { x: 45, y: 28 });

    expect(spot.x).toBeGreaterThanOrEqual(0);
    expect(spot.x).toBeLessThanOrEqual(PITCH.length);
    expect(spot.y).toBeGreaterThanOrEqual(0);
    expect(spot.y).toBeLessThanOrEqual(PITCH.width);
  });

  it('[Interface] the away side is the same shape rotated, never mirrored on one axis only', () => {
    const home = homeSpot(3, flat, 1, { x: 45, y: 28 });
    const away = homeSpot(3, flat, -1, { x: 45, y: 28 });

    expect(away.x).toBeCloseTo(PITCH.length - home.x, 6);
    expect(away.y).toBeCloseTo(PITCH.width - home.y, 6);
  });

  // ⚠️ THE FOUR MULTIPLIES THAT MAKE IT LOOK LIKE FOOTBALL. A shape that slides toward the ball is the
  //    whole difference between eleven statues and a team; it costs one lerp per agent and no branches.
  it('[Right] the shape slides toward the ball, but never all the way to it', () => {
    const still = homeSpot(5, flat, 1, { x: 45, y: 28 });
    const pulled = homeSpot(5, flat, 1, { x: 85, y: 28 });

    expect(pulled.x).toBeGreaterThan(still.x);
    expect(pulled.x).toBeLessThan(85);
  });

  it('[Right] a high line pushes the whole shape up the pitch', () => {
    const low = homeSpot(5, { ...flat, lineHeight: 0.6 }, 1, { x: 45, y: 28 });
    const high = homeSpot(5, { ...flat, lineHeight: 1.4 }, 1, { x: 45, y: 28 });

    expect(high.x).toBeGreaterThan(low.x);
  });
});

describe('ratings', () => {
  it('[Right] a quicker player is faster and turns harder - both, from one number', () => {
    const slow = capsFor({ ...AVERAGE, pace: 0.1 });
    const quick = capsFor({ ...AVERAGE, pace: 0.9 });

    expect(quick.maxSpeed).toBeGreaterThan(slow.maxSpeed);
    expect(quick.accel).toBeGreaterThan(slow.accel);
  });

  it('[Boundary] the extremes of a rating stay inside believable football speeds', () => {
    const worst = capsFor({ ...AVERAGE, pace: 0 });
    const best = capsFor({ ...AVERAGE, pace: 1 });

    expect(worst.maxSpeed).toBeGreaterThan(4);
    expect(best.maxSpeed).toBeLessThan(10);
  });

  it('[Right] a better passer has less error, and a perfect one has none', () => {
    expect(passErrorOf(0.9)).toBeLessThan(passErrorOf(0.3));
    expect(passErrorOf(1)).toBe(0);
  });

  it('[Interface] nothing about a rating branches - it is arithmetic all the way down', () => {
    const middle = capsFor(AVERAGE);

    expect(middle.maxSpeed).toBeCloseTo((capsFor({ ...AVERAGE, pace: 0 }).maxSpeed +
      capsFor({ ...AVERAGE, pace: 1 }).maxSpeed) / 2, 6);
  });
});
