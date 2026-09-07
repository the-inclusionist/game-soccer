// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PHASES OF A MATCH, and the transitions between them.
//
// ========================= WHY THE TABLE IS DATA =========================
// A transition written as a `switch` can only be READ by running it. Written as a list of rows it can be
// walked: every phase reachable, every phase with a way out, no row naming a phase that does not exist.
// Those three properties are what stop a match from wedging in a state nobody can leave - which, in a
// game a child plays alone in a classroom, is indistinguishable from the program having crashed.
//
// ⚠️ AND THE PRACTICE PITCH IS THE SAME REFEREE. It is not a second game mode with its own rules: it is
// this table with the out-of-play rows switched off by a profile. One referee, two profiles.
import { describe, expect, it } from 'vitest';
import { MATCH_PROFILE, PRACTICE_PROFILE } from '../app/js/rules/profile.ts';
import { PHASES, TRANSITIONS, nextPhase, type MatchPhase } from '../app/js/rules/phase.ts';

describe('the transition table', () => {
  it('[Interface] every row names phases that exist', () => {
    for (const row of TRANSITIONS) {
      expect(PHASES).toContain(row.from);
      expect(PHASES).toContain(row.to);
    }
  });

  it('[Interface] every phase but the first can be reached', () => {
    const reachable = new Set(TRANSITIONS.map((r) => r.to));
    const unreachable = PHASES.filter((p) => p !== 'preMatch' && !reachable.has(p));

    expect(unreachable).toEqual([]);
  });

  it('[Interface] every phase but the last has a way out', () => {
    const hasExit = new Set(TRANSITIONS.map((r) => r.from));
    const dead = PHASES.filter((p) => p !== 'fullTime' && !hasExit.has(p));

    expect(dead).toEqual([]);
  });

  it('[Interface] no two rows leave the same phase on the same event', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const row of TRANSITIONS) {
      const key = `${row.from}/${row.on}`;
      if (seen.has(key)) duplicates.push(key);
      seen.add(key);
    }

    expect(duplicates).toEqual([]);
  });

  it('[Right] a match walks from the whistle to a goal and back to a kickoff', () => {
    let p: MatchPhase = 'preMatch';
    for (const e of ['start', 'ballMoved', 'goalScored', 'restartTaken'] as const) {
      p = nextPhase(p, e, MATCH_PROFILE) ?? p;
    }

    // A goal restarts the match from the centre spot, and the ball has not moved yet - so the phase is
    // kickoff and not live. The distinction is what stops a goal counting before the ball is in play.
    expect(p).toBe('kickoff');
    expect(nextPhase(p, 'ballMoved', MATCH_PROFILE)).toBe('live');
  });

  it('[Zero] an event a phase does not answer leaves the phase alone', () => {
    expect(nextPhase('live', 'start', MATCH_PROFILE)).toBeNull();
  });

  it('[Right] every restart returns to live, so a match cannot wedge in a dead ball', () => {
    for (const restart of ['throwIn', 'corner', 'goalKick', 'freeKick'] as const) {
      expect(nextPhase(restart, 'restartTaken', MATCH_PROFILE)).toBe('live');
    }
  });
});

describe('the practice profile', () => {
  it('[Zero] refuses every out-of-play transition, so play never stops', () => {
    for (const e of ['crossedTouchline', 'crossedGoalLineByAttacker', 'crossedGoalLineByDefender'] as const) {
      expect(nextPhase('live', e, PRACTICE_PROFILE)).toBeNull();
    }
  });

  it('[Right] still allows a goal, because scoring is the point of a practice pitch', () => {
    expect(nextPhase('live', 'goalScored', PRACTICE_PROFILE)).toBe('goal');
  });

  it('[Zero] has no clock, so time never expires', () => {
    expect(PRACTICE_PROFILE.clock).toBe('none');
    expect(nextPhase('live', 'periodExpired', PRACTICE_PROFILE)).toBeNull();
  });

  it('[Interface] the match profile answers every event the practice one refuses', () => {
    for (const e of ['crossedTouchline', 'periodExpired'] as const) {
      expect(nextPhase('live', e, MATCH_PROFILE)).not.toBeNull();
    }
  });
});
