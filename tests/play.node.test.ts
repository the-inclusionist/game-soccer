// SPDX-License-Identifier: AGPL-3.0-or-later
// ONE TICK OF A MATCH: the world moves, the referee reads it, and play is restarted.
//
// ========================= WHY THE RESTART HAPPENS ON THE SAME TICK =========================
// If the referee called a throw-in on tick N and the ball was only put back on tick N+1, there would be
// one tick in which the phase says `throwIn` while the ball is still lying outside the pitch. Every
// consumer that reads both - the declaration, the narration, the renderer - would be describing a world
// that is internally inconsistent, and the bug would show up as a flicker nobody can reproduce.
//
// ========================= AND WHY A RESTART IS NOT AUTOMATIC =========================
// The ball is PLACED immediately and play stays stopped until somebody takes it. That is football, and it
// is also the accessibility affordance: a child using switch scanning gets a dead ball and all the time
// in the world to decide, which is WCAG 2.2.1 met by the shape of the game rather than by a setting.
import { describe, expect, it } from 'vitest';
import { DT } from '../app/js/sim/ball.ts';
import { emptyFrame } from '../app/js/sim/command.ts';
import { createMatchState } from '../app/js/sim/state.ts';
import { playTick } from '../app/js/play.ts';
import { MATCH_PROFILE, PRACTICE_PROFILE } from '../app/js/rules/profile.ts';
import { AWAY, HOME, SQUAD_SIZE } from '../app/js/sim/ids.ts';
import { NOBODY } from '../app/js/sim/possession.ts';
import { CONTROLLED_BY_SEAT } from '../app/js/sim/command.ts';
import { AVERAGE } from '../app/js/ai/ratings.ts';
import { PITCH } from '../app/js/sim/units.ts';
import { PHASES } from '../app/js/rules/phase.ts';

function live() {
  const s = createMatchState();
  s.phase = 'live';
  // Park everybody out of the way, so a test about the ball is a test about the ball.
  for (const p of s.players) p.p = { x: 45, y: 28 };
  return s;
}

describe('a tick of a live match', () => {
  // The ball is speed-clamped at `BALL.maxSpeed`, so the numbers below are chosen to cross a line in ONE
  // tick at that clamp: 30 m/s is half a metre per tick, and the offsets are smaller than that.
  it('[Zero] a quiet tick changes nothing but the clock', () => {
    const s = live();
    s.ball.p = { x: 45, y: 10, z: 0 };

    const events = playTick(s, emptyFrame(0), DT, MATCH_PROFILE);

    expect(events).toEqual([]);
    expect(s.phase).toBe('live');
    expect(s.tick).toBe(1);
  });

  it('[Right] a ball rolling out is called AND put back, on the same tick', () => {
    const s = live();
    s.ball.p = { x: 30, y: 0.2, z: 0 };
    s.ball.v = { x: 0, y: -30, z: 0 };
    s.ball.grounded = true;

    const events = playTick(s, emptyFrame(0), DT, MATCH_PROFILE);

    expect(events.map((e) => e.kind)).toEqual(['crossedTouchline']);
    expect(s.phase).toBe('throwIn');
    expect(s.ball.p.y).toBe(0);
    expect(s.ball.v).toEqual({ x: 0, y: 0, z: 0 });
  });

  // A goal is not instantly a kickoff: the ball goes to the centre spot and the match sits in `goal`
  // until the side that conceded takes it. The gap is where a celebration, a replay and - the one that
  // matters here - the screen reader's announcement live, and skipping it would talk over itself.
  it('[Right] a goal scores and puts the ball on the centre spot, still stopped', () => {
    const s = live();
    s.ball.p = { x: PITCH.length - 0.2, y: PITCH.width / 2, z: 1 };
    s.ball.v = { x: 30, y: 0, z: 0 };
    s.ball.grounded = false;

    playTick(s, emptyFrame(0), DT, MATCH_PROFILE);

    expect(s.goals[HOME]).toBe(1);
    expect(s.phase).toBe('goal');
    expect(s.ball.p).toEqual({ x: PITCH.length / 2, y: PITCH.width / 2, z: 0 });
    expect(s.restartTaker).toBe(AWAY);
  });

  it('[Right] and the side that conceded kicks off, which puts the match back in play', () => {
    const s = live();
    s.ball.p = { x: PITCH.length - 0.2, y: PITCH.width / 2, z: 1 };
    s.ball.v = { x: 30, y: 0, z: 0 };
    s.ball.grounded = false;
    playTick(s, emptyFrame(0), DT, MATCH_PROFILE);

    s.players[SQUAD_SIZE + 9].p = { x: s.ball.p.x, y: s.ball.p.y };
    playTick(s, emptyFrame(1), DT, MATCH_PROFILE);

    expect(s.phase).toBe('kickoff');
  });

  it('[Zero] on a practice pitch the same ball simply keeps going', () => {
    const s = live();
    s.ball.p = { x: 30, y: 0.2, z: 0 };
    s.ball.v = { x: 0, y: -30, z: 0 };

    const events = playTick(s, emptyFrame(0), DT, PRACTICE_PROFILE);

    expect(events).toEqual([]);
    expect(s.phase).toBe('live');
  });
});

describe('a stopped match', () => {
  // ⚠️ EVERY PHASE, AND IT USED TO BE ONE. This asked the question of `throwIn` only, and `penalty` - the
  //    newest phase - was not in the seam's list of stopped phases at all. So a penalty was given, the
  //    ball was placed on the spot, and then the world went on RUNNING under no laws: twenty-two bodies
  //    chasing a ball that rolled to x = 95.9 on a ninety-metre pitch, with the referee silent because he
  //    only speaks while the phase is `live`. The match never ended.
  //
  //    A hand-picked representative can only ever gate the phase somebody remembered. The phases are a
  //    list; the question is asked of all of them.
  for (const phase of PHASES) {
    if (phase === 'live' || phase === 'preMatch' || phase === 'fullTime') continue;

    it(`[Zero] the ball does not move while play is stopped for ${phase}`, () => {
      const s = live();
      s.phase = phase;
      s.ball.p = { x: 30, y: 0, z: 0 };
      s.ball.v = { x: 5, y: 5, z: 0 };

      playTick(s, emptyFrame(0), DT, MATCH_PROFILE);

      expect(s.ball.p, `the world kept running in ${phase}`).toEqual({ x: 30, y: 0, z: 0 });
    });
  }

  it('[Right] the taker touching the ball resumes play', () => {
    const s = live();
    s.ball.p = { x: 30, y: 0.2, z: 0 };
    s.ball.v = { x: 0, y: -30, z: 0 };
    playTick(s, emptyFrame(0), DT, MATCH_PROFILE);
    expect(s.phase).toBe('throwIn');

    // The away side puts it out, so home takes it. Put a home body on the ball.
    s.players[3].p = { x: s.ball.p.x, y: s.ball.p.y };
    const events = playTick(s, emptyFrame(1), DT, MATCH_PROFILE);

    expect(events.map((e) => e.kind)).toContain('restartTaken');
    expect(s.phase).toBe('live');
  });

  it('[Zero] the WRONG side touching it does not resume play', () => {
    const s = live();
    s.ball.p = { x: 30, y: 0.2, z: 0 };
    s.ball.v = { x: 0, y: -30, z: 0 };
    playTick(s, emptyFrame(0), DT, MATCH_PROFILE);

    s.players[SQUAD_SIZE + 3].p = { x: s.ball.p.x, y: s.ball.p.y };
    playTick(s, emptyFrame(1), DT, MATCH_PROFILE);

    expect(s.phase).toBe('throwIn');
  });

  // ⚠️ AND AN OPPONENT STANDING OVER THE BALL MUST NOT VETO IT. The rule was "the globally nearest player
  //    has to be on the taking side", which lets any opponent who wanders back onto the spot hold the
  //    match up for ever. Measured across six fixtures: one of them ran out of ticks stopped at a
  //    throw-in, with the side owed it reduced to two men, and the whole remaining match never happened.
  //
  //    The rule football uses is the other one - a restart is taken when somebody FROM THE TAKING SIDE
  //    reaches the ball - and whoever else is standing there is not taking it.
  it('[Right] an opponent standing on the ball does not stop the taker taking it', () => {
    const s = live();
    s.ball.p = { x: 30, y: 0.2, z: 0 };
    s.ball.v = { x: 0, y: -30, z: 0 };
    s.possession.lastTouch = SQUAD_SIZE + 4; // an away player put it out, so home takes it
    playTick(s, emptyFrame(0), DT, MATCH_PROFILE);
    expect(s.restartTaker).toBe(HOME);

    // The away man is nearer the ball than the home man, and it is not his throw.
    s.players[SQUAD_SIZE + 6].p = { x: s.ball.p.x, y: s.ball.p.y };
    s.players[3].p = { x: s.ball.p.x + 0.5, y: s.ball.p.y };
    const events = playTick(s, emptyFrame(1), DT, MATCH_PROFILE);

    expect(events.map((e) => e.kind), 'an opponent held the match up').toContain('restartTaken');
    expect(s.phase).toBe('live');
  });

  it('[Right] a throw-in belongs to the side that did NOT put it out', () => {
    const s = live();
    s.ball.p = { x: 30, y: 0.2, z: 0 };
    s.ball.v = { x: 0, y: -30, z: 0 };
    s.possession.lastTouch = SQUAD_SIZE + 4; // an away player put it out

    playTick(s, emptyFrame(0), DT, MATCH_PROFILE);

    expect(s.restartTaker).toBe(HOME);
  });

  it('[Right] and the other way round', () => {
    const s = live();
    s.ball.p = { x: 30, y: 0.2, z: 0 };
    s.ball.v = { x: 0, y: -30, z: 0 };
    s.possession.lastTouch = 4; // a home player put it out

    playTick(s, emptyFrame(0), DT, MATCH_PROFILE);

    expect(s.restartTaker).toBe(AWAY);
  });

  it('[Zero] nobody owns a restart once play is live again', () => {
    const s = live();
    s.possession.holder = NOBODY;

    playTick(s, emptyFrame(0), DT, MATCH_PROFILE);

    expect(s.restartTaker).toBe(-1);
  });
});

describe('a seat that plays', () => {
  // ⚠️ THE ORDER MATTERS AND IS TESTED. The AI decides a clearance on the same tick a child may be
  //    shooting; if the AI struck first the child's shot would vanish on exactly the ticks she cares about.
  it('[Right] a shot from the seat strikes the ball, and the AI does not overrule it', () => {
    const s = live();
    s.ball.p = { x: 60, y: 28, z: 0 };
    s.players[CONTROLLED_BY_SEAT[0]].p = { x: 60, y: 28 };
    s.possession.holder = CONTROLLED_BY_SEAT[0];

    playTick(
      s,
      { tick: 0, cmds: [{ tick: 0, seat: 0, dx: 0, dy: 0, verb: 'shoot', power: 1, flags: 0 }] },
      DT,
      MATCH_PROFILE,
      { 0: AVERAGE, 1: AVERAGE },
    );

    expect(s.ball.v.x).toBeGreaterThan(10);
    expect(s.possession.lastTouch).toBe(CONTROLLED_BY_SEAT[0]);
  });

  it('[Zero] and a verb from a seat whose player has not got the ball changes nothing', () => {
    const s = live();
    s.ball.p = { x: 10, y: 10, z: 0 };
    s.possession.holder = NOBODY;

    playTick(
      s,
      { tick: 0, cmds: [{ tick: 0, seat: 0, dx: 0, dy: 0, verb: 'shoot', power: 1, flags: 0 }] },
      DT,
      MATCH_PROFILE,
    );

    expect(s.ball.v).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('after the final whistle', () => {
  // ⚠️ THE MATCH HAS TO STOP, and it did not. `evaluate` falls silent once the phase leaves `live`, so at
  //    full time the referee stopped speaking while twenty-two bodies went on chasing a ball under no laws
  //    at all - clock counting, AI deciding, nothing able to happen. A match that does not stop is not a
  //    match with a quiet ending; it is a match with no ending.
  it('[Zero] nothing moves once the phase is fullTime', () => {
    const s = live();
    s.phase = 'fullTime';
    s.ball.v = { x: 10, y: 0, z: 0 };
    const ball = { ...s.ball.p };
    const body = { ...s.players[4].p };

    for (let t = 0; t < 300; t++) playTick(s, emptyFrame(t), DT, MATCH_PROFILE, { 0: AVERAGE, 1: AVERAGE });

    expect(s.ball.p).toEqual(ball);
    expect(s.players[4].p).toEqual(body);
    expect(s.tick).toBe(0);
  });

  it('[Zero] and the same before the first whistle', () => {
    const s = live();
    s.phase = 'preMatch';
    const body = { ...s.players[4].p };

    for (let t = 0; t < 300; t++) playTick(s, emptyFrame(t), DT, MATCH_PROFILE, { 0: AVERAGE, 1: AVERAGE });

    expect(s.players[4].p).toEqual(body);
  });
});
