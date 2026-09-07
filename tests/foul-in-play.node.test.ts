// SPDX-License-Identifier: AGPL-3.0-or-later
// THE FOUL REACHING THE MATCH.
//
// ========================= WHY THIS IS NOT IN THE REFEREE =========================
// `evaluate(state, profile)` reads the WORLD: the ball is out, somebody is offside, the clock expired.
// A foul is not a fact about the world - it is a fact about an ACT. The same two bodies in the same two
// places are a foul if she lunged and nothing at all if she did not, and the world cannot tell them
// apart a tick later.
//
// So it is judged where the tackle is attempted, in the seam, and enters the referee's list as an event
// like any other - which is what keeps the phase machine, the narration, the sound and the screen reader
// all reading from ONE list rather than each learning about fouls separately.
//
// ⚠️ AND IT IS EXACTLY THE BRANCH THAT USED TO DO NOTHING. `strikeFor` returns `null` for a tackle out of
// reach of the ball, and `play` did `continue`. The lunge cost the child nothing.
import { describe, expect, it } from 'vitest';
import { createMatchState } from '../app/js/sim/state.ts';
import { playTick } from '../app/js/play.ts';
import { MATCH_PROFILE, PRACTICE_PROFILE } from '../app/js/rules/profile.ts';
import { AWAY, HOME, SQUAD_SIZE, firstOf } from '../app/js/sim/ids.ts';
import { DT } from '../app/js/sim/ball.ts';
import { BOX, PENALTY_SPOT, PITCH } from '../app/js/sim/units.ts';
import { RED, YELLOW } from '../app/js/rules/cards.ts';
import { onPitch } from '../app/js/sim/squads.ts';
import type { Command } from '../app/js/sim/command.ts';

const cmd = (over: Partial<Command> = {}): Command => ({
  tick: 0, seat: 0, dx: 0, dy: 0, verb: 'none', power: 0, flags: 0, ...over,
});

/** A seat-driven home player lunging at an away player, ball far away. */
function setUp(speed: number, at = { x: 45, y: 28 }) {
  const s = createMatchState(MATCH_PROFILE);
  s.phase = 'live';
  const by = s.controlled[0];
  const on = firstOf(AWAY) + 5;
  for (let k = 0; k < SQUAD_SIZE; k++) s.players[firstOf(AWAY) + k].p = { x: 80, y: 50 };
  s.players[by].p = { x: at.x, y: at.y };
  s.players[by].v = { x: speed, y: 0 };
  s.players[on].p = { x: at.x + 0.4, y: at.y };
  s.players[on].v = { x: 0, y: 0 };
  s.ball.p = { x: 5, y: 5, z: 0 };
  s.ball.v = { x: 0, y: 0, z: 0 };
  return { s, by, on };
}

const tackle = (s: ReturnType<typeof setUp>['s'], profile = MATCH_PROFILE) =>
  playTick(s, { tick: 0, cmds: [cmd({ verb: 'tackle' })] }, DT, profile);

describe('a lunge in a real match', () => {
  it('[Right] raises a foul, and the match stops for it', () => {
    const { s } = setUp(2);

    const events = tackle(s);

    expect(events.map((e) => e.kind)).toContain('foulGiven');
    expect(s.phase).toBe('freeKick');
  });

  // ⚠️ THE EVENT IS ABOUT THE SIDE THAT WAS FOULED, which is the convention `rules/events` states and
  //    which decides who takes the kick. About the offender, the restart would go to the wrong side.
  it('[Right] and the kick belongs to the side that was fouled', () => {
    const { s } = setUp(2);

    const foul = tackle(s).find((e) => e.kind === 'foulGiven');

    expect(foul?.team).toBe(AWAY);
    expect(s.restartTaker).toBe(AWAY);
  });

  it('[Zero] a tackle that wins the ball is not a foul and does not stop the game', () => {
    const { s, by } = setUp(2);
    s.ball.p = { x: s.players[by].p.x + 0.3, y: s.players[by].p.y, z: 0 };

    const events = tackle(s);

    expect(events.map((e) => e.kind)).not.toContain('foulGiven');
    expect(s.phase).toBe('live');
  });

  it('[Zero] and a practice pitch has no referee, so nothing is given', () => {
    const { s } = setUp(9);
    s.phase = 'live';

    const events = playTick(s, { tick: 0, cmds: [cmd({ verb: 'tackle' })] }, DT, PRACTICE_PROFILE);

    expect(events.map((e) => e.kind)).not.toContain('foulGiven');
    expect(s.phase).toBe('live');
  });
});

describe('the card that comes with it', () => {
  it('[Zero] a careless challenge is a free kick and no card', () => {
    const { s, by } = setUp(1);

    tackle(s);

    expect(s.cards[by]).toBe(0);
  });

  it('[Right] a reckless one is a booking, and he plays on', () => {
    const { s, by } = setUp(7);

    tackle(s);

    expect(s.cards[by]).toBe(YELLOW);
    expect(onPitch(s, by)).toBe(true);
  });

  // ⚠️ THE WHOLE POINT OF THE FEATURE. A red has to take the player OFF, and the side has to be a man
  //    down for the rest of the match - otherwise a card is a colour on a screen.
  it('[Right] and a violent one sends him off, leaving his side a man down', () => {
    const { s, by } = setUp(12);

    tackle(s);

    expect(s.cards[by]).toBe(RED);
    expect(onPitch(s, by)).toBe(false);
    let playing = 0;
    for (let k = 0; k < SQUAD_SIZE; k++) if (onPitch(s, firstOf(HOME) + k)) playing += 1;
    expect(playing).toBe(SQUAD_SIZE - 1);
  });

  it('[Right] a second booking in the same match is a red', () => {
    const { s, by } = setUp(7);
    tackle(s);
    s.phase = 'live';

    const again = setUp(7);
    again.s.cards[by] = YELLOW;
    tackle(again.s);

    expect(again.s.cards[again.by]).toBe(RED);
  });
});

describe('a foul in the box', () => {
  it('[Right] gives a penalty rather than a free kick', () => {
    // Home defends x = 0 in the first period, so a home foul near x = 0 is in its own area.
    const { s } = setUp(2, { x: BOX.depth - 3, y: PITCH.width / 2 });

    const events = tackle(s);

    expect(events.map((e) => e.kind)).toContain('penaltyGiven');
    expect(s.phase).toBe('penalty');
  });

  // ⚠️ AND THE END IS THE ONE THE OFFENDER DEFENDS, which is where I got this wrong writing it. Home
  //    fouled inside its OWN area near x = 0, so the penalty belongs to away and is taken at the goal HOME
  //    is defending - x = 9.5, not the far end. The assertion said "past halfway" and the code was right.
  it('[Right] and the ball goes on the spot, not where the foul was', () => {
    const { s } = setUp(2, { x: BOX.depth - 3, y: PITCH.width / 2 });
    const where = s.players[s.controlled[0]].p.x;

    tackle(s);

    expect(s.ball.p.x).toBeCloseTo(PENALTY_SPOT, 6);
    expect(s.ball.p.x).not.toBeCloseTo(where, 1);
    expect(s.ball.p.y).toBeCloseTo(PITCH.width / 2, 6);
  });

  it('[Zero] the same challenge outside the area is only a free kick', () => {
    const { s } = setUp(2, { x: BOX.depth + 2, y: PITCH.width / 2 });

    expect(tackle(s).map((e) => e.kind)).toContain('foulGiven');
    expect(s.phase).toBe('freeKick');
  });
});
