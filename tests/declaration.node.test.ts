// SPDX-License-Identifier: AGPL-3.0-or-later
// THE EIGHT FIELDS - and this file is the most valuable one in the repository.
//
// ========================= WHAT THE DECLARATION BUYS =========================
// Answering eight questions gets this game a screen reader, spatial sonar, high contrast by semantic
// role, switch scanning and Libras without writing a line of any of them. That is ADR-0030's claim, and
// football is where it is hardest to believe: a quiz is a list, a 2048 board is a grid, and this is
// twenty-two bodies moving continuously.
//
// ========================= WHAT IT PAYS BACK =========================
// `continuous` is the engine's THIRD topology preset ever - `hotspots` came from the quiz, `grid` from
// the 2048. A preset only stops being a hypothesis when a consumer exercises it, so the value of this
// file is as much to the engine as to the game.
//
// WARNING: THE DECLARATION OBSERVES AND OWNS NOTHING. Every field is a function because the answer
// changes each tick, and holding a copy of the world here would create the second version of the truth
// that diverges on the first restart.
import { describe, expect, it } from 'vitest';
import { conformanceProblems, distance } from '@the-inclusionist/engine/core/contract.js';
import { createDeclaration, type Observed } from '../app/js/declaration.ts';
import { createMatchState } from '../app/js/sim/state.ts';
import { MATCH_PROFILE, PRACTICE_PROFILE } from '../app/js/rules/profile.ts';
import { HOME, SQUAD_SIZE } from '../app/js/sim/ids.ts';
import { PACE_M, PITCH } from '../app/js/sim/units.ts';
import { NOBODY } from '../app/js/sim/possession.ts';
import type { MatchPhase } from '../app/js/rules/phase.ts';

/** A `t` that RETURNS ITS KEY, so a test can measure which key was asked for and catch a raw literal. */
const keyEcho = (key: string) => 't:' + key;

function observing(overrides: Partial<Observed> = {}) {
  const state = createMatchState();
  state.phase = 'live';
  const o: Observed = {
    state: () => state,
    profile: () => MATCH_PROFILE,
    ourTeam: () => HOME,
    controlledBy: (seat: number) => (seat === 0 ? 9 : 10),
    t: keyEcho,
    ...overrides,
  };
  return { o, state, d: createDeclaration(o) };
}

describe('conformance', () => {
  it('[Interface] the declaration is well formed in EVERY phase of a match', () => {
    const phases: MatchPhase[] = [
      'preMatch',
      'kickoff',
      'live',
      'throwIn',
      'corner',
      'goalKick',
      'freeKick',
      'goal',
      'halfTime',
      'fullTime',
    ];

    for (const phase of phases) {
      const { state, d } = observing();
      state.phase = phase;
      expect(conformanceProblems(d), phase).toEqual([]);
    }
  });
});

describe('field 1 - topology', () => {
  it('[Right] the pitch is declared in METRES, and one unit is one PACE', () => {
    const { d } = observing();

    expect(d.topology()).toEqual({
      kind: 'continuous',
      size: [PITCH.length, PITCH.width],
      unit: PACE_M,
      move: 'free',
      frame: 'compass',
    });
  });

  it('[Right] so the engine distance comes back in PACES, which is what a blind child counts', () => {
    const { d } = observing();
    const t = d.topology();

    // Twelve metres apart is eight paces, and the screen reader adds no arithmetic of its own.
    expect(distance(t, { x: 10, y: 20 }, { x: 22, y: 20 })).toBeCloseTo(8, 10);
  });

  // WARNING: THE ADR-0084 GATE. `topology` became a function because a cached one goes stale in silence;
  // the practice pitch is half a pitch, chosen at runtime, so this game is a consumer that would break.
  it('[Right] the practice pitch is a DIFFERENT topology from the same declaration', () => {
    let profile = MATCH_PROFILE;
    const { d } = observing({ profile: () => profile });

    const match = d.topology();
    profile = PRACTICE_PROFILE;
    const practice = d.topology();

    // Narrowed by `kind` rather than cast: a cast would compile against a `hotspots` topology too, and
    // the day this game declared one by mistake the test would still be green.
    expect(practice).not.toEqual(match);
    if (match.kind !== 'continuous' || practice.kind !== 'continuous') {
      throw new Error('a pitch is a continuous space');
    }
    expect(practice.size[0]).toBeLessThan(match.size[0]);
  });
});

describe('field 2 - world', () => {
  it('[Interface] names the element that IS the pitch, and declares it rather than defaulting', () => {
    const { d } = observing();

    expect(d.world()).toEqual({ kind: 'element', selector: '#pitch' });
  });
});

describe('field 3 - tick', () => {
  it('[Right] a clock-run match belongs to the clock; a pitch with no clock belongs to the player', () => {
    expect(createDeclaration(observing().o).tick).toBe('clock');
    expect(createDeclaration(observing({ profile: () => PRACTICE_PROFILE }).o).tick).toBe('player');
  });
});

describe('field 4 - roleAt', () => {
  it('[Right] when we do NOT have the ball, the BALL is what the round asks for', () => {
    const { state, d } = observing();
    state.possession.holder = NOBODY;

    expect(d.roleAt({ x: state.ball.p.x, y: state.ball.p.y })).toBe('goal');
  });

  it('[Right] when we DO have it, the opponents goal mouth is what the round asks for', () => {
    const { state, d } = observing();
    state.possession.holder = 9;

    expect(d.roleAt({ x: PITCH.length, y: PITCH.width / 2 })).toBe('goal');
    expect(d.roleAt({ x: state.ball.p.x, y: state.ball.p.y })).not.toBe('goal');
  });

  // WARNING: THE ROW WORTH THE WHOLE FILE. High contrast paints by ROLE, so declaring the offside band as
  // a `gate` gives a low-vision child a visibly tinted offside zone - out of the contract, with no code in
  // this game and no code in the engine.
  it('[Right] the ground beyond the offside line is a GATE - barred until a condition holds', () => {
    const { state, d } = observing();
    state.possession.holder = 9;
    for (let i = SQUAD_SIZE; i < SQUAD_SIZE * 2; i++) state.players[i].p = { x: 60, y: 28 };

    expect(d.roleAt({ x: 75, y: 28 })).toBe('gate');
    expect(d.roleAt({ x: 50, y: 28 })).not.toBe('gate');
  });

  it('[Zero] open grass is free, and the ground off the pitch is structure', () => {
    const { state, d } = observing();
    state.possession.holder = 9;
    state.ball.p = { x: 20, y: 10, z: 0 };

    expect(d.roleAt({ x: 30, y: 40 })).toBe('free');
    expect(d.roleAt({ x: -5, y: 40 })).toBe('structure');
  });

  it('[Interface] it never claims a role this game has no such thing as', () => {
    const { d } = observing();
    const forbidden = ['water', 'climb', 'key'];
    const seen = new Set<string>();

    for (let x = 0; x <= PITCH.length; x += 3) {
      for (let y = 0; y <= PITCH.width; y += 3) seen.add(d.roleAt({ x, y }));
    }

    expect([...seen].filter((r) => forbidden.includes(r))).toEqual([]);
  });
});

describe('field 5 - nameAt', () => {
  it('[Right] the ball is feminine and the goal is masculine, so agreement is right in pt-BR', () => {
    const { state, d } = observing();
    const ball = d.nameAt({ x: state.ball.p.x, y: state.ball.p.y });
    const goal = d.nameAt({ x: PITCH.length, y: PITCH.width / 2 });

    expect(ball).toMatchObject({ gender: 'f' });
    expect(goal).toMatchObject({ gender: 'm' });
  });

  it('[Interface] every name goes through the dictionary - no raw literal reaches a child', () => {
    const { state, d } = observing();
    const spots = [
      { x: state.ball.p.x, y: state.ball.p.y },
      { x: PITCH.length, y: PITCH.width / 2 },
      { x: state.players[3].p.x, y: state.players[3].p.y },
    ];

    for (const at of spots) {
      const name = d.nameAt(at);
      expect(name).not.toBeNull();
      expect(name?.text.startsWith('t:')).toBe(true);
    }
  });

  it('[Zero] open grass has no name, and null is the honest answer', () => {
    const { state, d } = observing();
    state.ball.p = { x: 5, y: 5, z: 0 };

    expect(d.nameAt({ x: 45, y: 40 })).toBeNull();
  });
});

describe('field 6 - focusOf', () => {
  it('[Right] the focus is the body this seat drives, where it is, facing where it faces', () => {
    const { state, d } = observing();
    state.players[9].p = { x: 33, y: 21 };
    state.players[9].facing = { x: 1, y: 0 };

    expect(d.focusOf(0)).toEqual({ id: 'p9', at: { x: 33, y: 21 }, heading: 'e' });
  });

  it('[Zero] before the match starts nobody has the focus', () => {
    const { state, d } = observing();
    state.phase = 'preMatch';

    expect(d.focusOf(0)).toBeNull();
  });
});

describe('field 7 - objectiveOf', () => {
  it('[Right] the round asks for one more goal than the opponent has', () => {
    const { state, d } = observing();
    state.goals = [1, 2];

    expect(d.objectiveOf(0)).toMatchObject({ have: 1, need: 3 });
  });

  it('[Boundary] while ahead, the objective is already met rather than a moving target', () => {
    const { state, d } = observing();
    state.goals = [3, 1];

    expect(d.objectiveOf(0)).toMatchObject({ have: 3, need: 3 });
  });
});

describe('field 8 - targetsOf', () => {
  it('[Right] without the ball, the one target is the ball', () => {
    const { state, d } = observing();
    state.possession.holder = NOBODY;

    expect(d.targetsOf(0)).toEqual([{ x: state.ball.p.x, y: state.ball.p.y }]);
  });

  // WARNING: A SONAR THAT BEEPS TEN TIMES SAYS NOTHING. The quiz recorded a sonar that was "correct and
  // useless"; ten team-mates would be the same failure wearing a different shape.
  it('[Boundary] carrying the ball, never more than four targets', () => {
    const { state, d } = observing();
    state.possession.holder = 9;

    expect(d.targetsOf(0).length).toBeLessThanOrEqual(4);
  });

  // WARNING: THE DEFENDERS ARE PARKED OFF THE PASSING LINE ON PURPOSE, and it took a surviving mutation
  // to find out why it matters. With them standing between carrier and receiver, the pass was already
  // being rejected for a blocked lane - so deleting the offside filter changed nothing and the test still
  // passed. A test that is green for the wrong reason is worse than a missing one: it reports coverage it
  // does not have. Moved wide, the lane is clear and the ONLY thing that can exclude him is offside.
  it('[Right] an OFFSIDE team-mate is never offered as a pass, even down a clear lane', () => {
    const { state, d } = observing();
    state.possession.holder = 9;
    state.ball.p = { x: 50, y: 28, z: 0 };
    // Scatter FIRST, then place the two bodies that matter: the loop would otherwise walk over the
    // carrier it was set before, and the test would be measuring a pass from the wrong place.
    for (let i = 0; i < SQUAD_SIZE; i++) state.players[i].p = { x: 5, y: 5 };
    for (let i = SQUAD_SIZE; i < SQUAD_SIZE * 2; i++) state.players[i].p = { x: 55, y: 52 };
    state.players[9].p = { x: 50, y: 28 };
    state.players[5].p = { x: 80, y: 30 };

    const targets = d.targetsOf(0);

    expect(targets).not.toContainEqual({ x: 80, y: 30 });
  });

  it('[Right] and an ONSIDE team-mate down that same clear lane IS offered', () => {
    const { state, d } = observing();
    state.possession.holder = 9;
    state.ball.p = { x: 50, y: 28, z: 0 };
    for (let i = 0; i < SQUAD_SIZE; i++) state.players[i].p = { x: 5, y: 5 };
    for (let i = SQUAD_SIZE; i < SQUAD_SIZE * 2; i++) state.players[i].p = { x: 85, y: 52 };
    state.players[9].p = { x: 50, y: 28 };
    state.players[5].p = { x: 80, y: 30 };

    expect(d.targetsOf(0)).toContainEqual({ x: 80, y: 30 });
  });

  it('[Zero] with the ball dead against us, the honest answer is nothing at all', () => {
    const { state, d } = observing();
    state.phase = 'throwIn';
    state.possession.lastTouch = 4; // one of ours put it out, so it is their throw

    expect(d.targetsOf(0)).toEqual([]);
  });
});
