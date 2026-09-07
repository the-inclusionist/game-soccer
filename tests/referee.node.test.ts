// SPDX-License-Identifier: AGPL-3.0-or-later
// THE REFEREE. The only place a rule is decided, and it decides by READING the world, never by touching it.
//
// ========================= ONE LIST, FOUR CONSUMERS =========================
// `evaluate` returns events. The phase machine consumes them, the narration turns them into a sentence,
// the sound layer picks an earcon, and the contract's announcement field passes them to the screen
// reader. Four consumers of ONE list is why the referee returns data instead of mutating: a referee that
// changed the phase itself would leave the other three to re-derive what happened, and they would drift.
//
// ⚠️ AND IT IS PURE. `evaluate(state, profile)` reads and returns; `applyEvents` is the only thing that
// writes. Keeping the decision separate from the consequence is what lets a test assert "this position
// IS a corner" without also asserting where twenty-two bodies then go.
import { describe, expect, it } from 'vitest';
import { MATCH_PROFILE, PRACTICE_PROFILE } from '../app/js/rules/profile.ts';
import { applyEvents, evaluate } from '../app/js/rules/referee.ts';
import { createMatchState } from '../app/js/sim/state.ts';
import { AWAY, HOME } from '../app/js/sim/ids.ts';
import { BALL, PITCH } from '../app/js/sim/units.ts';

const MID_Y = PITCH.width / 2;

function live() {
  const s = createMatchState();
  s.phase = 'live';
  return s;
}

const kinds = (s: ReturnType<typeof live>, profile = MATCH_PROFILE) =>
  evaluate(s, profile).map((e) => e.kind);

describe('the referee reading a live ball', () => {
  it('[Zero] says nothing about a ball in the middle of the pitch', () => {
    expect(kinds(live())).toEqual([]);
  });

  it('[One] calls a throw-in when the ball is wholly over the touchline', () => {
    const s = live();
    s.ball.p = { x: 30, y: -BALL.radius - 0.01, z: 0 };

    expect(kinds(s)).toEqual(['crossedTouchline']);
  });

  it('[Right] a defender putting it behind is a corner; an attacker is a goal kick', () => {
    const corner = live();
    corner.ball.p = { x: PITCH.length + 1, y: 5, z: 0 };
    corner.possession.lastTouch = 15; // an away player, defending the end at x = PITCH.length

    const goalKick = live();
    goalKick.ball.p = { x: PITCH.length + 1, y: 5, z: 0 };
    goalKick.possession.lastTouch = 4; // a home player, attacking that end

    expect(kinds(corner)).toEqual(['crossedGoalLineByDefender']);
    expect(kinds(goalKick)).toEqual(['crossedGoalLineByAttacker']);
  });

  it('[One] a ball in the net is a goal, and it names who scored', () => {
    const s = live();
    s.ball.p = { x: PITCH.length + 1, y: MID_Y, z: 1 };

    const events = evaluate(s, MATCH_PROFILE);

    expect(events.map((e) => e.kind)).toEqual(['goalScored']);
    expect(events[0]).toMatchObject({ kind: 'goalScored', team: HOME });
  });

  it('[Right] applying a goal moves the phase and the score together', () => {
    const s = live();
    s.ball.p = { x: PITCH.length + 1, y: MID_Y, z: 1 };

    applyEvents(s, evaluate(s, MATCH_PROFILE), MATCH_PROFILE);

    expect(s.phase).toBe('goal');
    expect(s.goals[HOME]).toBe(1);
    expect(s.goals[AWAY]).toBe(0);
  });

  it('[Zero] the referee never speaks when the ball is not live', () => {
    const s = createMatchState(); // still in preMatch
    s.ball.p = { x: PITCH.length + 1, y: MID_Y, z: 1 };

    expect(kinds(s)).toEqual([]);
  });

  it('[Zero] on a practice pitch the ball may leave and nothing is called', () => {
    const s = live();
    s.ball.p = { x: 30, y: -5, z: 0 };

    expect(kinds(s, PRACTICE_PROFILE)).toEqual([]);
  });

  it('[Right] but a goal on a practice pitch is still a goal', () => {
    const s = live();
    s.ball.p = { x: PITCH.length + 1, y: MID_Y, z: 1 };

    expect(kinds(s, PRACTICE_PROFILE)).toEqual(['goalScored']);
  });
});

describe('the referee reading the clock', () => {
  it('[Boundary] the first period ends only when the period is over AND the ball is dead', () => {
    const running = live();
    running.tick = MATCH_PROFILE.periodTicks;
    running.possession.holder = 3;

    const dead = live();
    dead.tick = MATCH_PROFILE.periodTicks;

    expect(kinds(running)).toEqual([]);
    expect(kinds(dead)).toEqual(['periodExpired']);
  });

  it('[Right] the second period ends the match rather than the half', () => {
    const s = live();
    s.period = 2;
    s.tick = MATCH_PROFILE.periodTicks * 2;

    expect(kinds(s)).toEqual(['secondPeriodExpired']);
  });

  it('[Zero] a practice pitch has no clock, so time never expires', () => {
    const s = live();
    s.tick = 10_000_000;

    expect(kinds(s, PRACTICE_PROFILE)).toEqual([]);
  });

  it('[Right] half time swaps the ends, so a compass is never a lie', () => {
    const s = live();
    s.period = 1;
    s.tick = MATCH_PROFILE.periodTicks;

    applyEvents(s, evaluate(s, MATCH_PROFILE), MATCH_PROFILE);

    expect(s.phase).toBe('halfTime');
    expect(s.period).toBe(2);
  });
});
