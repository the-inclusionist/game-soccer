// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CONTROLS THAT EXISTED ON PAPER AND DID NOTHING.
//
// ========================= WHY THIS FILE IS AN INDICTMENT =========================
// Four of the nine inputs in the scheme were produced by the input layer, carried in the command, and
// then dropped: `switch` returned `null` from the strike resolver, and `flags` was read by no module in
// the simulation at all. Every test passed. A command that nothing consumes is a command that does not
// exist, and the only thing that catches it is a test that asserts on the WORLD rather than on the
// command - which is why these live here and not beside the sampler.
import { describe, expect, it } from 'vitest';
import { createMatchState } from '../app/js/sim/state.ts';
import { playTick } from '../app/js/play.ts';
import { MATCH_PROFILE } from '../app/js/rules/profile.ts';
import { HOME, SQUAD_SIZE, teamOf } from '../app/js/sim/ids.ts';
import { FLAG_JOCKEY, FLAG_SPRINT, type Command } from '../app/js/sim/command.ts';
import { DT } from '../app/js/sim/ball.ts';
import { dist2 } from '../app/js/sim/vec.ts';

const cmd = (over: Partial<Command> = {}): Command => ({
  tick: 0,
  seat: 0,
  dx: 0,
  dy: 0,
  verb: 'none',
  power: 0,
  flags: 0,
  ...over,
});

function live() {
  const s = createMatchState(MATCH_PROFILE);
  s.phase = 'live';
  return s;
}

describe('switching player', () => {
  it('[Interface] a state knows which body each seat drives, and it starts on the forwards', () => {
    const s = live();

    expect(s.controlled).toHaveLength(2);
    for (const id of s.controlled) expect(teamOf(id)).toBe(HOME);
  });

  // ⚠️ THE VERB THAT DID NOTHING. It was produced by the chord, carried in the command, and dropped by
  //    the resolver with `return null`.
  it('[Right] the switch verb moves the seat onto the team-mate nearest the ball', () => {
    const s = live();
    s.ball.p = { x: 20, y: 40, z: 0 };
    s.players[3].p = { x: 20, y: 40 };
    const before = s.controlled[0];

    playTick(s, { tick: 0, cmds: [cmd({ verb: 'switch' })] }, DT, MATCH_PROFILE);

    expect(s.controlled[0]).not.toBe(before);
    expect(s.controlled[0]).toBe(3);
  });

  it('[Zero] it never hands a seat the keeper, who is not a body a child drives', () => {
    const s = live();
    s.ball.p = { x: 1, y: 28, z: 0 };
    s.players[0].p = { x: 1, y: 28 };

    playTick(s, { tick: 0, cmds: [cmd({ verb: 'switch' })] }, DT, MATCH_PROFILE);

    expect(s.controlled[0]).not.toBe(0);
  });

  it('[Zero] and it never hands a seat an opponent', () => {
    const s = live();
    s.ball.p = { x: 80, y: 28, z: 0 };
    s.players[SQUAD_SIZE + 3].p = { x: 80, y: 28 };

    playTick(s, { tick: 0, cmds: [cmd({ verb: 'switch' })] }, DT, MATCH_PROFILE);

    expect(teamOf(s.controlled[0])).toBe(HOME);
  });

  it('[Zero] nor the body the OTHER seat is already driving', () => {
    const s = live();
    const other = s.controlled[1];
    s.ball.p = { x: s.players[other].p.x, y: s.players[other].p.y, z: 0 };

    playTick(s, { tick: 0, cmds: [cmd({ verb: 'switch' })] }, DT, MATCH_PROFILE);

    expect(s.controlled[0]).not.toBe(other);
  });

  it('[Right] the seat it moves is the one that asked, not seat zero every time', () => {
    const s = live();
    const before = s.controlled[0];
    s.ball.p = { x: 20, y: 40, z: 0 };
    s.players[3].p = { x: 20, y: 40 };

    playTick(s, { tick: 0, cmds: [cmd({ seat: 1, verb: 'switch' })] }, DT, MATCH_PROFILE);

    expect(s.controlled[0]).toBe(before);
    expect(s.controlled[1]).toBe(3);
  });
});

describe('sprinting', () => {
  const run = (flags: number) => {
    const s = live();
    const who = s.controlled[0];
    const from = s.players[who].p.x;
    for (let t = 0; t < 120; t++) {
      playTick(s, { tick: t, cmds: [cmd({ tick: t, dx: 1, flags })] }, DT, MATCH_PROFILE);
    }
    return s.players[who].p.x - from;
  };

  // ⚠️ THE FLAG NO MODULE READ. It travelled from the keyboard into the command and stopped there.
  it('[Right] sprinting covers more ground than running', () => {
    expect(run(FLAG_SPRINT)).toBeGreaterThan(run(0) + 1);
  });

  it('[Boundary] and it is a difference of degree, not a different game', () => {
    expect(run(FLAG_SPRINT)).toBeLessThan(run(0) * 1.5);
  });

  // ⚠️ MEASURED WHERE THE CAP CAN ACTUALLY BIND, and the first version could not. It started both bodies
  //    from rest, and a body accelerating at 22 m/s^2 needs about twenty ticks to reach even the carrying
  //    cap - by which time the dribbling touch had let the ball get away. Both runs came back identical to
  //    fifteen decimal places: a difference that never had the chance to happen. Starting at speed is the
  //    only honest way to ask whether a ceiling exists.
  it('[Right] carrying the ball lowers the ceiling a sprinter can hold', () => {
    const s = live();
    const who = s.controlled[0];
    s.players[who].v = { x: 8.1, y: 0 };
    s.ball.p = { x: s.players[who].p.x, y: s.players[who].p.y, z: 0 };

    for (let t = 0; t < 10; t++) {
      playTick(s, { tick: t, cmds: [cmd({ tick: t, dx: 1, flags: FLAG_SPRINT })] }, DT, MATCH_PROFILE);
    }

    const free = live();
    free.ball.p = { x: 5, y: 5, z: 0 };
    free.players[free.controlled[0]].v = { x: 8.1, y: 0 };
    for (let t = 0; t < 10; t++) {
      playTick(free, { tick: t, cmds: [cmd({ tick: t, dx: 1, flags: FLAG_SPRINT })] }, DT, MATCH_PROFILE);
    }

    expect(s.players[who].v.x).toBeLessThan(free.players[free.controlled[0]].v.x);
  });
});

describe('jockeying', () => {
  // ⚠️ HOLDING L1 IS A POSITION, NOT AN ACT. It keeps the body between the ball and its own goal instead of
  //    diving in - which is what "contain" means, and what a child who cannot time a tackle needs.
  //
  // ⚠️ AND THE ASSERTION IS "MOVES GOAL-SIDE", NOT "ENDS BEHIND THE BALL". The literal version failed for a
  //    reason that is the mechanic working: the body reaches the containing spot, takes the loose ball,
  //    and the ball rolls on past it from the last touch. Demanding a final ordering of two moving things
  //    measures the last frame rather than the behaviour.
  it('[Right] a jockeying body moves toward its own goal, which is what containing is', () => {
    const s = live();
    const who = s.controlled[0];
    s.ball.p = { x: 30, y: 28, z: 0 };
    s.players[who].p = { x: 34, y: 28 };
    const startX = s.players[who].p.x;

    for (let t = 0; t < 120; t++) {
      playTick(s, { tick: t, cmds: [cmd({ tick: t, flags: FLAG_JOCKEY })] }, DT, MATCH_PROFILE);
    }

    // Home defends x = 0 in the first period, so containing takes the body down the x axis.
    expect(s.players[who].p.x).toBeLessThan(startX - 5);
  });

  it('[Zero] and holding it with the ball at your OWN feet does nothing at all', () => {
    const s = live();
    const who = s.controlled[0];
    s.ball.p = { x: s.players[who].p.x, y: s.players[who].p.y, z: 0 };
    playTick(s, { tick: 0, cmds: [cmd()] }, DT, MATCH_PROFILE);
    const startX = s.players[who].p.x;

    for (let t = 1; t < 60; t++) {
      playTick(s, { tick: t, cmds: [cmd({ tick: t, flags: FLAG_JOCKEY })] }, DT, MATCH_PROFILE);
    }

    // It must not walk her own ball back toward her own keeper, which is what containing your own side is.
    expect(s.players[who].p.x).toBeGreaterThan(startX - 3);
  });

  it('[Right] and it closes on the ball rather than standing still', () => {
    const s = live();
    const who = s.controlled[0];
    s.ball.p = { x: 30, y: 28, z: 0 };
    s.players[who].p = { x: 60, y: 40 };
    const before = dist2(s.players[who].p, s.ball.p);

    for (let t = 0; t < 120; t++) {
      playTick(s, { tick: t, cmds: [cmd({ tick: t, flags: FLAG_JOCKEY })] }, DT, MATCH_PROFILE);
    }

    expect(dist2(s.players[who].p, s.ball.p)).toBeLessThan(before);
  });
});
