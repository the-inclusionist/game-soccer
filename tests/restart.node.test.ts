// SPDX-License-Identifier: AGPL-3.0-or-later
// WHERE PLAY RESUMES. The ball, and the twenty-two bodies around it.
//
// ========================= WHY THE KEEP-OUT DISTANCE IS A RULE AND NOT POLISH =========================
// A corner taken with a defender standing on the ball is not a corner; it is a turnover with extra steps.
// The nine-fifteen is what makes a restart a restart, and without it the AI converges on the ball and the
// game stops being football at every dead ball - which is most of a match.
//
// ⚠️ AND IT IS ALSO AN ACCESSIBILITY FACT. A child using the sonar hears "where can I put the ball": at a
// restart the answer has to be a spot she can actually reach, not one with an opponent already on it.
import { describe, expect, it } from 'vitest';
import { KEEP_OUT, applyRestart, restartSpot } from '../app/js/rules/restart.ts';
import { createMatchState } from '../app/js/sim/state.ts';
import { teamOf } from '../app/js/sim/ids.ts';
import { defenderOf } from '../app/js/rules/referee.ts';
import { PITCH } from '../app/js/sim/units.ts';
import { dist2 } from '../app/js/sim/vec.ts';

const MID = { x: PITCH.length / 2, y: PITCH.width / 2 };

describe('the restart spot', () => {
  it('[One] a throw-in is taken from exactly where the ball left', () => {
    const at = restartSpot({ kind: 'crossedTouchline', at: { x: 31.5, y: 0 } }, 1);

    expect(at).toEqual({ x: 31.5, y: 0 });
  });

  it('[Boundary] a throw-in level with the goal line is pulled inside the pitch, not taken off it', () => {
    const at = restartSpot({ kind: 'crossedTouchline', at: { x: PITCH.length + 3, y: 0 } }, 1);

    expect(at.x).toBeLessThanOrEqual(PITCH.length);
    expect(at.x).toBeGreaterThanOrEqual(0);
  });

  it('[Many] a corner is taken from a corner of the pitch - one of exactly four points', () => {
    const at = restartSpot({ kind: 'crossedGoalLineByDefender', at: { x: PITCH.length, y: 4 } }, 1);

    expect([0, PITCH.length]).toContain(at.x);
    expect([0, PITCH.width]).toContain(at.y);
  });

  it('[Right] the corner taken is the one on the side the ball actually went out', () => {
    const near = restartSpot({ kind: 'crossedGoalLineByDefender', at: { x: PITCH.length, y: 50 } }, 1);
    const far = restartSpot({ kind: 'crossedGoalLineByDefender', at: { x: PITCH.length, y: 4 } }, 1);

    expect(near.y).toBe(PITCH.width);
    expect(far.y).toBe(0);
  });

  it('[Right] a goal kick is taken inside the pitch, off the goal line, in front of the goal', () => {
    const at = restartSpot({ kind: 'crossedGoalLineByAttacker', at: { x: PITCH.length, y: 2 } }, 1);

    expect(at.x).toBeLessThan(PITCH.length);
    expect(at.x).toBeGreaterThan(PITCH.length - 12);
    expect(at.y).toBe(PITCH.width / 2);
  });

  it('[One] a kickoff is taken from the centre spot', () => {
    expect(restartSpot({ kind: 'goalScored', team: 0 }, 1)).toEqual(MID);
  });
});

describe('applying a restart', () => {
  it('[Zero] leaves the ball dead on the spot - no velocity, no height', () => {
    const s = createMatchState();
    s.ball.v = { x: 9, y: -4, z: 3 };
    s.ball.p.z = 2;

    applyRestart(s, { kind: 'crossedTouchline', at: { x: 20, y: 0 } });

    expect(s.ball.v).toEqual({ x: 0, y: 0, z: 0 });
    expect(s.ball.p).toEqual({ x: 20, y: 0, z: 0 });
    expect(s.ball.grounded).toBe(true);
  });

  it('[Many] pushes every opponent of the taker out to the keep-out distance', () => {
    const s = createMatchState();
    const event = { kind: 'crossedGoalLineByDefender' as const, at: { x: PITCH.length, y: 4 } };
    const defending = defenderOf(1, s.period);
    for (const p of s.players) p.p = { x: PITCH.length, y: 0 };

    applyRestart(s, event);

    for (let i = 0; i < s.players.length; i++) {
      if (teamOf(i) !== defending) continue;
      expect(dist2(s.players[i].p, s.ball.p)).toBeGreaterThanOrEqual(KEEP_OUT * KEEP_OUT - 1e-6);
    }
  });

  it('[Boundary] a pushed body still lands on the pitch, never outside it', () => {
    const s = createMatchState();
    for (const p of s.players) p.p = { x: PITCH.length, y: 0 };

    applyRestart(s, { kind: 'crossedGoalLineByDefender', at: { x: PITCH.length, y: 4 } });

    for (const p of s.players) {
      expect(p.p.x).toBeGreaterThanOrEqual(0);
      expect(p.p.x).toBeLessThanOrEqual(PITCH.length);
      expect(p.p.y).toBeGreaterThanOrEqual(0);
      expect(p.p.y).toBeLessThanOrEqual(PITCH.width);
    }
  });

  it('[Right] the taker side is NOT pushed away - somebody has to take it', () => {
    const s = createMatchState();
    const taking = 1 - defenderOf(1, s.period);
    for (const p of s.players) p.p = { x: PITCH.length, y: 0 };

    applyRestart(s, { kind: 'crossedGoalLineByDefender', at: { x: PITCH.length, y: 4 } });

    const nearest = s.players
      .map((p, i) => ({ d2: dist2(p.p, s.ball.p), team: teamOf(i) }))
      .filter((r) => r.team === taking)
      .reduce((a, b) => (a.d2 < b.d2 ? a : b));

    expect(nearest.d2).toBeLessThan(KEEP_OUT * KEEP_OUT);
  });

  // ⚠️ FROM THE REAL FORMATION, not from a pile. The pile case exercises the zero-vector fallback; this
  //    one exercises the reflection, because a corner spot is on the touchline and half the circle around
  //    it is off the pitch. If the code clamped instead of reflecting, bodies would look moved and still
  //    be inside the ten yards - the guarantee false exactly where it matters.
  it('[Many] from a real kickoff shape, every opponent ends up on the pitch AND outside the ten yards', () => {
    const s = createMatchState();
    const defending = defenderOf(1, s.period);

    applyRestart(s, { kind: 'crossedGoalLineByDefender', at: { x: PITCH.length, y: 4 } });

    for (let i = 0; i < s.players.length; i++) {
      const p = s.players[i].p;
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(PITCH.length);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(PITCH.width);
      if (teamOf(i) !== defending) continue;
      expect(dist2(p, s.ball.p)).toBeGreaterThanOrEqual(KEEP_OUT * KEEP_OUT - 1e-6);
    }
  });

  // ⚠️ THE CASE THAT ACTUALLY EXERCISES THE REFLECTION, and it took a surviving mutation to find it. At a
  //    corner every push happens to point back into the pitch, so clamping and reflecting agree and the
  //    guarantee is never tested. A GOAL KICK is taken five and a half metres off the goal line: an
  //    opponent standing between the spot and that line has to be pushed the other way, or he is clamped
  //    onto the line still inside the ten yards - moved, and still illegal.
  it('[Boundary] an opponent behind the goal-kick spot is reflected forward, not clamped onto the line', () => {
    const s = createMatchState();
    const spot = restartSpot({ kind: 'crossedGoalLineByAttacker', at: { x: PITCH.length, y: 2 } }, s.period);
    const defending = defenderOf(1, s.period);
    const opponent = s.players.findIndex((_, i) => teamOf(i) !== defending);
    s.players[opponent].p = { x: spot.x + 2, y: spot.y };

    applyRestart(s, { kind: 'crossedGoalLineByAttacker', at: { x: PITCH.length, y: 2 } });

    const p = s.players[opponent].p;
    expect(p.x).toBeLessThanOrEqual(PITCH.length);
    expect(dist2(p, s.ball.p)).toBeGreaterThanOrEqual(KEEP_OUT * KEEP_OUT - 1e-6);
  });

  // ⚠️ THE KEEP-OUT PUSHES, IT DOES NOT TELEPORT. The first version set every non-taker to EXACTLY the
  //    keep-out distance, so a body sixty metres from the spot was dragged to a ring around it - a
  //    goalkeeper hauled to the far touchline by a throw-in. It surfaced two files away, as "the keeper
  //    does not stay near his goal", which is why the assertion here is on the body that was ALREADY far.
  it('[Zero] a body already outside the ten yards is not moved at all', () => {
    const s = createMatchState();
    const far = { x: 3, y: 28 };
    s.players[0].p = { ...far };

    applyRestart(s, { kind: 'crossedTouchline', at: { x: 80, y: 0 } });

    expect(s.players[0].p).toEqual(far);
  });

  it('[Zero] nobody is left standing exactly on the ball', () => {
    const s = createMatchState();
    for (const p of s.players) p.p = { x: PITCH.length, y: 0 };

    applyRestart(s, { kind: 'crossedGoalLineByDefender', at: { x: PITCH.length, y: 4 } });

    for (const p of s.players) expect(dist2(p.p, s.ball.p)).toBeGreaterThan(0);
  });
});
