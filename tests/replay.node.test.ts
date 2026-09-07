// SPDX-License-Identifier: AGPL-3.0-or-later
// THE REPLAY HARNESS. A match is (version, setup, commands) and nothing else.
//
// ========================= WHY A RECORD CARRIES A VERSION =========================
// A recording is only meaningful against the simulation that produced it. Change a constant in `units.ts`
// and last week's record replays into a different match - not with an error, but with a wrong answer,
// which is worse. So a record states which simulation wrote it, and a mismatched record is REFUSED rather
// than run. A silent wrong replay would poison the golden-master gate that everything else leans on.
//
// ========================= AND WHY THE CHECKS ARE A TRAIL, NOT A TOTAL =========================
// One hash at the end says "something differs". A hash every second says WHEN it started to differ, which
// is the difference between a bug you can find and a bug you can only re-run.
import { describe, expect, it } from 'vitest';
import { CHECK_EVERY, SIM_VERSION, record, replay, ReplayVersionError } from '../app/js/sim/recorder.ts';
import { moveCommand } from '../app/js/sim/command.ts';

const stream = (t: number) => ({
  tick: t,
  cmds: [moveCommand(t, 0, ((t % 120) - 60) / 60, ((t % 77) - 38) / 38)],
});

describe('a recorded match', () => {
  it('[Right] replays to the same digest trail it was recorded with', () => {
    const rec = record(600, stream);

    expect(replay(rec)).toEqual(rec.checks);
  });

  it('[Many] takes one checkpoint per CHECK_EVERY ticks, and the first is the kickoff state', () => {
    const rec = record(600, stream);

    expect(rec.checks).toHaveLength(600 / CHECK_EVERY + 1);
    expect(rec.checks[0][0]).toBe(0);
  });

  it('[Exception] a record from another simulation version is REFUSED, not run', () => {
    const rec = record(120, stream);
    const stale = { ...rec, version: SIM_VERSION + 1 };

    expect(() => replay(stale)).toThrow(ReplayVersionError);
  });

  it('[Boundary] one command changed by one step makes the trail diverge, and says where', () => {
    const rec = record(600, stream);
    const tampered = {
      ...rec,
      frames: rec.frames.map((f) =>
        f.tick === 300 ? { tick: f.tick, cmds: [moveCommand(300, 0, 1, 1)] } : f,
      ),
    };

    const trail = replay(tampered);
    const firstDifference = trail.findIndex(([, h], i) => h !== rec.checks[i][1]);

    expect(firstDifference).toBeGreaterThan(0);
    expect(trail[firstDifference][0]).toBeGreaterThan(300);
  });

  it('[Interface] a record survives a round trip through JSON unchanged', () => {
    const rec = record(120, stream);

    expect(JSON.parse(JSON.stringify(rec))).toEqual(rec);
  });
});
