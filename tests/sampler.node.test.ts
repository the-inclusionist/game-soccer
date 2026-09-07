// SPDX-License-Identifier: AGPL-3.0-or-later
// KEYS INTO ACTIONS, AND ACTIONS INTO ONE COMMAND.
//
// ========================= THE SHIM THAT WAS PLANNED AND IS NOT NEEDED =========================
// The plan for this repository budgeted a compatibility layer: the engine's transports still spoke the
// platformer's eight verbs while `core/actions` declared fourteen, and issue #103 had not run. It ran.
// The engine's built package now carries `default-bindings`, a gamepad that reads the declared table, and
// a transport registry - so this file consumes the engine's own tables rather than restating them, and the
// shim is deleted before it was written.
//
// ⚠️ THE TABLE IS NEVER COPIED. `KEYBOARD_SOLO` is imported. A copy would be a second source for one fact,
// and it would drift the first time a child remapped anything.
import { describe, expect, it } from 'vitest';
import { ACTIONS } from '@the-inclusionist/engine/core/actions.js';
import { KEYBOARD_SOLO } from '@the-inclusionist/engine/input/default-bindings.js';
import { createSampler, heldFrom } from '../app/js/input/sampler.ts';
import { createMatchState } from '../app/js/sim/state.ts';
import { playTick } from '../app/js/play.ts';
import { MATCH_PROFILE } from '../app/js/rules/profile.ts';
import { CONTROLLED_BY_SEAT } from '../app/js/sim/command.ts';
import { DT } from '../app/js/sim/ball.ts';

const codesFor = (action: string): readonly string[] =>
  (KEYBOARD_SOLO as Record<string, readonly string[] | null>)[action] ?? [];

const pressing = (...actions: string[]): Set<string> => {
  const codes = new Set<string>();
  for (const a of actions) for (const c of codesFor(a)) codes.add(c);
  return codes;
};

describe('keys into actions', () => {
  it('[Zero] no key down is no action held', () => {
    const held = heldFrom(new Set<string>());

    expect(ACTIONS.filter((a: string) => held[a])).toEqual([]);
  });

  it('[One] a bound key holds exactly its own action', () => {
    const held = heldFrom(pressing('action3'));

    expect(ACTIONS.filter((a: string) => held[a])).toEqual(['action3']);
  });

  it('[Many] two keys hold two actions, which is what a chord needs to be possible at all', () => {
    const held = heldFrom(pressing('rightShoulder', 'rightTrigger'));

    expect(ACTIONS.filter((a: string) => held[a]).sort()).toEqual(
      ['rightShoulder', 'rightTrigger'].sort(),
    );
  });

  it('[Zero] a key nobody bound holds nothing, and is not an error', () => {
    expect(ACTIONS.filter((a: string) => heldFrom(new Set(['F13']))[a])).toEqual([]);
  });

  it('[Interface] every one of the fourteen is reachable from the keyboard', () => {
    const unreachable = ACTIONS.filter((a: string) => codesFor(a).length === 0);

    expect(unreachable).toEqual([]);
  });
});

describe('actions into a command', () => {
  const build = (codes: Set<string>, tick = 0) => createSampler({ seat: 0 }).sample(codes, tick);

  it('[Zero] nothing held is a command that asks for nothing', () => {
    const cmd = build(new Set<string>());

    expect(cmd.dx).toBe(0);
    expect(cmd.dy).toBe(0);
    expect(cmd.verb).toBe('none');
  });

  it('[Right] the direction keys steer, and the vector is what the simulation consumes', () => {
    expect(build(pressing('right')).dx).toBe(1);
    expect(build(pressing('left')).dx).toBe(-1);
    expect(build(pressing('up')).dy).toBe(-1);
    expect(build(pressing('down')).dy).toBe(1);
  });

  it('[Boundary] two opposite directions cancel rather than picking a winner', () => {
    expect(build(pressing('left', 'right')).dx).toBe(0);
  });

  it('[Boundary] a diagonal is not longer than a straight run', () => {
    const cmd = build(pressing('right', 'down'));

    expect(Math.sqrt(cmd.dx * cmd.dx + cmd.dy * cmd.dy)).toBeCloseTo(1, 6);
  });

  // ⚠️ L1 WAS IN THE PRESET, IN THE BINDING TABLE, AND IN NO COMMAND. The word existed on the remap screen
  //    and the key did nothing, which is worse than an unbound key: an unbound key is honest.
  it('[Right] contain arrives as its own flag, on its own bit', () => {
    expect(build(pressing('leftShoulder')).flags & 8).toBe(8);
    expect(build(pressing('action1')).flags & 8).toBe(0);
  });

  it('[Right] sprinting and containing can be held together without one erasing the other', () => {
    const flags = build(pressing('leftShoulder', 'action1')).flags;

    expect(flags & 1).toBe(1);
    expect(flags & 8).toBe(8);
  });

  it('[Right] sprint arrives as a flag, and it comes from EITHER of its two positions', () => {
    expect(build(pressing('action1')).flags & 1).toBe(1);
    expect(build(pressing('leftTrigger')).flags & 1).toBe(1);
    expect(build(new Set<string>()).flags & 1).toBe(0);
  });

  it('[Right] a verb fires on RELEASE, carrying the power it charged', () => {
    const sampler = createSampler({ seat: 0 });
    const down = pressing('action3');

    let last = sampler.sample(down, 0);
    expect(last.verb).toBe('none');
    for (let t = 1; t < 30; t++) last = sampler.sample(down, t);
    expect(last.verb).toBe('none');

    last = sampler.sample(new Set<string>(), 30);
    expect(last.verb).toBe('pass');
    expect(last.power).toBeGreaterThan(0);
  });

  // ⚠️ WHICH BUTTON WAS CHARGED IS REMEMBERED, because on release nothing is held. Reading the held state
  //    at that instant answers "none", and every shot would arrive as the default verb.
  it('[Right] the verb on release is the one that was CHARGED, not a default', () => {
    const sampler = createSampler({ seat: 0 });
    const shoot = pressing('action2');

    for (let t = 0; t < 30; t++) sampler.sample(shoot, t);

    expect(sampler.sample(new Set<string>(), 30).verb).toBe('shoot');
  });

  it('[Zero] two seats do not share a memory of what is being charged', () => {
    const a = createSampler({ seat: 0 });
    const b = createSampler({ seat: 1 });

    for (let t = 0; t < 30; t++) a.sample(pressing('action2'), t);
    for (let t = 0; t < 30; t++) b.sample(pressing('action3'), t);

    expect(a.sample(new Set<string>(), 30).verb).toBe('shoot');
    expect(b.sample(new Set<string>(), 30).verb).toBe('pass');
  });

  // ⚠️ THE CHORD, END TO END. R2 alone switches; R1 then R2 lofts and never switches.
  it('[Right] the chord reaches the simulation as one verb, not two', () => {
    const sampler = createSampler({ seat: 0 });
    const seen: string[] = [];
    const feed = (codes: Set<string>, tick: number) => {
      const cmd = sampler.sample(codes, tick);
      if (cmd.verb !== 'none') seen.push(cmd.verb);
    };

    feed(pressing('rightShoulder'), 0);
    feed(pressing('rightShoulder', 'rightTrigger'), 1);
    for (let t = 2; t < 12; t++) feed(new Set<string>(), t);

    expect(seen).toEqual(['lob']);
  });

  it('[Right] and R2 on its own does switch player', () => {
    const sampler = createSampler({ seat: 0 });
    const seen: string[] = [];

    seen.push(sampler.sample(pressing('rightTrigger'), 0).verb);
    for (let t = 1; t < 12; t++) seen.push(sampler.sample(new Set<string>(), t).verb);

    expect(seen.filter((v) => v !== 'none')).toEqual(['switch']);
  });

  it('[Interface] the command is a plain value that survives a round trip through JSON', () => {
    const cmd = build(pressing('right', 'action1'));

    expect(JSON.parse(JSON.stringify(cmd))).toEqual(cmd);
  });
});

describe('a key, all the way to the pitch', () => {
  // ⚠️ THE END TO END, AND IT IS IN THE NODE PROJECT ON PURPOSE. A browser can show that a listener fired;
  //    only this can show that the key became a command, the command became an intent, and the intent moved
  //    a body - asserted on a position rather than inferred from a clock that advances anyway.
  it('[Right] holding the right key moves the seat player up the pitch', () => {
    const state = createMatchState(MATCH_PROFILE);
    state.phase = 'live';
    const who = CONTROLLED_BY_SEAT[0];
    const startX = state.players[who].p.x;
    const sampler = createSampler({ seat: 0 });
    const codes = pressing('right');

    for (let t = 0; t < 120; t++) {
      playTick(state, { tick: t, cmds: [sampler.sample(codes, t)] }, DT, MATCH_PROFILE);
    }

    expect(state.players[who].p.x).toBeGreaterThan(startX + 2);
  });

  it('[Zero] and with no key held she stays where the AI left her, not where a stray command sent her', () => {
    const state = createMatchState(MATCH_PROFILE);
    state.phase = 'live';
    const who = CONTROLLED_BY_SEAT[0];
    const startX = state.players[who].p.x;
    const sampler = createSampler({ seat: 0 });

    for (let t = 0; t < 120; t++) {
      playTick(state, { tick: t, cmds: [sampler.sample(new Set<string>(), t)] }, DT, MATCH_PROFILE);
    }

    expect(state.players[who].p.x).toBe(startX);
  });

  it('[Right] and the shot key, charged and released, actually strikes the ball', () => {
    const state = createMatchState(MATCH_PROFILE);
    state.phase = 'live';
    const who = CONTROLLED_BY_SEAT[0];
    state.ball.p = { x: state.players[who].p.x, y: state.players[who].p.y, z: 0 };
    const sampler = createSampler({ seat: 0 });
    const shoot = pressing('action2');

    for (let t = 0; t < 30; t++) {
      playTick(state, { tick: t, cmds: [sampler.sample(shoot, t)] }, DT, MATCH_PROFILE);
    }
    playTick(state, { tick: 30, cmds: [sampler.sample(new Set<string>(), 30)] }, DT, MATCH_PROFILE);

    expect(Math.abs(state.ball.v.x) + Math.abs(state.ball.v.y)).toBeGreaterThan(5);
    expect(state.possession.lastTouch).toBe(who);
  });
});

describe('a pad and a keyboard together', () => {
  // ⚠️ THE PAD RECORD COMES FROM THE ENGINE, already mapped through the declared table, the child's own
  //    remap and the mapping wizard. Reading `navigator.getGamepads()` here instead would bypass all
  //    three - and the one-button mode, and the per-player assignment. It would not be a shortcut to the
  //    same place; it would be a second input layer with none of the accessibility in it.
  it('[Right] a button held on the pad holds the action, with no key pressed at all', () => {
    const sampler = createSampler({ seat: 0 });

    const cmd = sampler.sample(new Set<string>(), 0, { right: true });

    expect(cmd.dx).toBe(1);
  });

  it('[Right] a key and a button reach the same action without cancelling each other', () => {
    const a = createSampler({ seat: 0 }).sample(pressing('right'), 0, { right: true });
    const b = createSampler({ seat: 0 }).sample(pressing('right'), 0, null);

    expect(a.dx).toBe(b.dx);
  });

  it('[Right] one hand can steer while the other acts, across the two devices', () => {
    const sampler = createSampler({ seat: 0 });

    const cmd = sampler.sample(pressing('right'), 0, { action1: true });

    expect(cmd.dx).toBe(1);
    expect(cmd.flags & 1).toBe(1);
  });

  it('[Zero] no pad at all changes nothing, which is what most machines will be', () => {
    const withNone = createSampler({ seat: 0 }).sample(pressing('left'), 0);
    const withNull = createSampler({ seat: 0 }).sample(pressing('left'), 0, null);

    expect(withNone).toEqual(withNull);
  });

  it('[Boundary] a pad reporting an action the game does not use is ignored, not an error', () => {
    const cmd = createSampler({ seat: 0 }).sample(new Set<string>(), 0, { select: true });

    expect(cmd.verb).toBe('none');
    expect(cmd.dx).toBe(0);
  });
});
