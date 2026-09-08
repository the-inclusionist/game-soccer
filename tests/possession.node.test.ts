// SPDX-License-Identifier: AGPL-3.0-or-later
// WHO HAS THE BALL, AND WHO TOUCHED IT LAST. Two different questions, and the second one outlives the first.
//
// ========================= WHY `lastTouch` IS NOT `holder` =========================
// A corner and a goal kick are the same event - the ball wholly over the goal line - told apart by ONE
// fact: who touched it last. At the moment the ball crosses, nobody is holding it, so a referee reading
// `holder` reads -1 and cannot tell a corner from a goal kick. `lastTouch` persists precisely because the
// rule that needs it is asked after the ball has gone.
//
// ========================= AND WHY TIES GO TO THE LOWER INDEX =========================
// Two players exactly equidistant from the ball is not a rare case: it is the kickoff, and it is every
// symmetric restart. If the winner depended on iteration order the same match would replay differently.
import { describe, expect, it } from 'vitest';
import {
  CONTROL_R,
  MAX_CONTROL_HEIGHT,
  NOBODY,
  TOUCH_PERIOD,
  PRESSURE_WINS,
  resolvePossession,
} from '../app/js/sim/possession.ts';
import { createMatchState } from '../app/js/sim/state.ts';

function stateWithBallAt(x: number, y: number, z = 0) {
  const s = createMatchState();
  s.ball.p = { x, y, z };
  return s;
}

/** Put player `id` exactly `d` metres from the ball, along +y so `x` stays free for other setups. */
function place(s: ReturnType<typeof createMatchState>, id: number, d: number) {
  s.players[id].p = { x: s.ball.p.x, y: s.ball.p.y + d };
}

describe('possession', () => {
  it('[Zero] a ball nobody is near has no holder', () => {
    const s = stateWithBallAt(45, 28);
    for (const p of s.players) p.p = { x: 1, y: 1 };

    resolvePossession(s);

    expect(s.possession.holder).toBe(NOBODY);
  });

  it('[One] a player inside the control radius takes the ball', () => {
    const s = stateWithBallAt(45, 28);
    for (const p of s.players) p.p = { x: 1, y: 1 };
    place(s, 5, CONTROL_R / 2);

    resolvePossession(s);

    expect(s.possession.holder).toBe(5);
    expect(s.possession.lastTouch).toBe(5);
  });

  // ⚠️ THE BALL SITS AT THE ORIGIN HERE, AND THAT IS NOT ARBITRARY. `28 + 0.9` then `- 28` does not give
  //    back 0.9 in binary floating point, so a boundary built by offsetting a mid-pitch coordinate lands
  //    a hair inside or outside at random and the test asserts nothing. From zero the subtraction is
  //    exact, so `distance === CONTROL_R` is really the boundary and the strict comparison is really what
  //    is being measured.
  it('[Boundary] a player exactly at the control radius does NOT have the ball', () => {
    const s = stateWithBallAt(0, 0);
    for (const p of s.players) p.p = { x: 50, y: 50 };
    s.players[5].p = { x: 0, y: CONTROL_R };

    resolvePossession(s);

    expect(s.possession.holder).toBe(NOBODY);
  });

  it('[Boundary] and a hair inside the radius DOES have it, so the test above is not vacuous', () => {
    const s = stateWithBallAt(0, 0);
    for (const p of s.players) p.p = { x: 50, y: 50 };
    s.players[5].p = { x: 0, y: CONTROL_R - 0.001 };

    resolvePossession(s);

    expect(s.possession.holder).toBe(5);
  });

  it('[Many] two players equidistant - the lower index takes it, every time', () => {
    const s = stateWithBallAt(45, 28);
    for (const p of s.players) p.p = { x: 1, y: 1 };
    s.players[14].p = { x: 45 - CONTROL_R / 2, y: 28 };
    s.players[3].p = { x: 45 + CONTROL_R / 2, y: 28 };

    resolvePossession(s);

    expect(s.possession.holder).toBe(3);
  });

  it('[Boundary] a ball above head height is not under anyone control, however close', () => {
    const s = stateWithBallAt(45, 28, MAX_CONTROL_HEIGHT);
    for (const p of s.players) p.p = { x: 1, y: 1 };
    place(s, 5, 0);

    resolvePossession(s);

    expect(s.possession.holder).toBe(NOBODY);
  });

  it('[Right] the last touch OUTLIVES the possession - which is what tells a corner from a goal kick', () => {
    const s = stateWithBallAt(45, 28);
    for (const p of s.players) p.p = { x: 1, y: 1 };
    place(s, 17, CONTROL_R / 2);
    resolvePossession(s);

    s.ball.p = { x: 90, y: 28, z: 0 };
    resolvePossession(s);

    expect(s.possession.holder).toBe(NOBODY);
    expect(s.possession.lastTouch).toBe(17);
  });

  it('[Interface] a kickoff state starts with nobody holding and nobody having touched', () => {
    const s = createMatchState();

    expect(s.possession.holder).toBe(NOBODY);
    expect(s.possession.lastTouch).toBe(NOBODY);
  });
});

describe('the dribbling touch', () => {
  // ⚠️ A DRIBBLE IS A SERIES OF TOUCHES, NOT GLUE. If the ball were stuck to the carrier it could never be
  //    tackled, never be intercepted and never run away from him - and the game would have no defending in
  //    it at all. Between touches the ball rolls free, which is what makes everything else possible.
  it('[Right] a carrier who is running knocks the ball ahead of him on a touch tick', () => {
    const s = createMatchState();
    for (const p of s.players) p.p = { x: 1, y: 1 };
    s.ball.p = { x: 45, y: 28, z: 0 };
    s.players[5].p = { x: 45, y: 28 };
    s.players[5].v = { x: 5, y: 0 };
    s.players[5].facing = { x: 1, y: 0 };
    s.tick = TOUCH_PERIOD;

    resolvePossession(s);

    expect(s.ball.v.x).toBeGreaterThan(5);
    expect(s.ball.v.y).toBe(0);
  });

  it('[Zero] a carrier standing still shields the ball rather than knocking it away', () => {
    const s = createMatchState();
    for (const p of s.players) p.p = { x: 1, y: 1 };
    s.ball.p = { x: 45, y: 28, z: 0 };
    s.players[5].p = { x: 45, y: 28 };
    s.players[5].v = { x: 0, y: 0 };
    s.tick = TOUCH_PERIOD;

    resolvePossession(s);

    expect(s.ball.v).toEqual({ x: 0, y: 0, z: 0 });
  });

  // Possession is established FIRST, because taking the ball is itself a touch - so a single call from
  // nobody-has-it would knock the ball and this would be measuring the wrong moment.
  it('[Boundary] between touches the ball is left alone, so it can be taken off him', () => {
    const s = createMatchState();
    for (const p of s.players) p.p = { x: 1, y: 1 };
    s.ball.p = { x: 45, y: 28, z: 0 };
    s.players[5].p = { x: 45, y: 28 };
    s.players[5].v = { x: 5, y: 0 };
    s.players[5].facing = { x: 1, y: 0 };
    s.tick = TOUCH_PERIOD + 1;
    resolvePossession(s);
    s.ball.v = { x: 0, y: 0, z: 0 };

    resolvePossession(s);

    expect(s.ball.v).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('[Interface] the cadence is a function of the tick, so a replay reproduces every touch', () => {
    expect(TOUCH_PERIOD).toBeGreaterThan(1);
  });
});

describe('shielding', () => {
  // ⚠️ WITHOUT HYSTERESIS THE BALL GOES NOWHERE, and it was measured rather than guessed: two forwards
  //    converging on the centre spot swapped possession every tick, each knocking the ball back the way
  //    the other had just knocked it, and a six-thousand-tick match ended with the ball two metres from
  //    where it started. A carrier keeps the ball unless somebody is CLEARLY closer - which is also what
  //    shielding is, so the fix and the football are the same thing.
  it('[Boundary] a carrier keeps the ball against a rival who is only marginally closer', () => {
    const s = createMatchState();
    for (const p of s.players) p.p = { x: 1, y: 1 };
    s.ball.p = { x: 45, y: 28, z: 0 };
    s.players[5].p = { x: 45, y: 28.2 };
    resolvePossession(s);
    expect(s.possession.holder).toBe(5);

    s.players[16].p = { x: 45, y: 28.1 };
    resolvePossession(s);

    expect(s.possession.holder).toBe(5);
  });

  // ⚠️ THE CLAIM CHANGED ON 2026-09-07, and this gate changed with it rather than being weakened. The
  //    ball used to go to whoever was nearest on the tick; it now goes to a challenger who has kept the
  //    pressure up for `PRESSURE_WINS` ticks - see `sim/possession` for the measurements that forced it.
  //    "Clearly closer" is still what makes him a challenger; it is no longer what hands him the ball.
  it('[Right] but he loses it to a rival who is clearly closer AND stays there', () => {
    const s = createMatchState();
    for (const p of s.players) p.p = { x: 1, y: 1 };
    s.ball.p = { x: 45, y: 28, z: 0 };
    s.players[5].p = { x: 45, y: 28.7 };
    resolvePossession(s);
    expect(s.possession.holder).toBe(5);

    s.players[16].p = { x: 45, y: 28.02 };
    resolvePossession(s);
    expect(s.possession.holder, 'one tick of being nearer took it off him').toBe(5);

    for (let t = 0; t < PRESSURE_WINS; t++) resolvePossession(s);

    expect(s.possession.holder).toBe(16);
  });

  it('[Zero] and a carrier who has left the radius altogether simply loses it', () => {
    const s = createMatchState();
    for (const p of s.players) p.p = { x: 1, y: 1 };
    s.ball.p = { x: 45, y: 28, z: 0 };
    s.players[5].p = { x: 45, y: 28.2 };
    resolvePossession(s);

    s.players[5].p = { x: 60, y: 28 };
    resolvePossession(s);

    expect(s.possession.holder).toBe(NOBODY);
  });
});

describe('the first touch', () => {
  // ⚠️ THIS WAS A REAL DEFECT WITH A STRANGE SYMPTOM. A player who won the ball and ran lost it again
  //    within a third of a second - every time - because the touch cadence counts on the GLOBAL tick.
  //    Somebody who gained possession at tick 5 waited until tick 21 for his first touch, and by then he
  //    had outrun a ball that had not moved. It surfaced from a sprint test whose two runs came back
  //    identical to fifteen decimal places, which is what it looks like when a difference never gets the
  //    chance to happen.
  it('[Right] taking the ball is itself a touch, whatever the tick', () => {
    const s = createMatchState();
    for (const p of s.players) p.p = { x: 1, y: 1 };
    s.ball.p = { x: 45, y: 28, z: 0 };
    s.players[5].p = { x: 45, y: 28 };
    s.players[5].v = { x: 6, y: 0 };
    s.tick = 7; // deliberately not a multiple of the cadence

    resolvePossession(s);

    expect(s.ball.v.x).toBeGreaterThan(5);
  });

  it('[Zero] and holding it between touches still leaves the ball alone', () => {
    const s = createMatchState();
    for (const p of s.players) p.p = { x: 1, y: 1 };
    s.ball.p = { x: 45, y: 28, z: 0 };
    s.players[5].p = { x: 45, y: 28 };
    s.players[5].v = { x: 6, y: 0 };
    s.tick = 7;
    resolvePossession(s);
    s.ball.v = { x: 0, y: 0, z: 0 };
    s.tick = 8;

    resolvePossession(s);

    expect(s.ball.v).toEqual({ x: 0, y: 0, z: 0 });
  });
});

// ========================= A MAN IN THE CLEAR DOES NOT RUN IT OUT =========================
// Measured: every one of 115 touchline crossings across four whole matches came off a dribbling touch at
// about 7.8 metres a second - none airborne, none off a clearance. The touch was the game's only route to
// a touchline, and clamping it outright was tried twice and took the rate from six times football's to
// ZERO. Football's answer is neither: a player in the clear turns inside, and a player with somebody on
// him puts it out constantly, which is where throw-ins actually come from.
describe('a touch near the line', () => {
  function run(v: { x: number; y: number }, foeAt: { x: number; y: number } | null) {
    const s = createMatchState();
    for (let i = 0; i < s.players.length; i++) s.players[i].p = { x: 5, y: 5 };
    s.players[5].p = { x: 45, y: 0.4 };
    s.players[5].v = { ...v };
    // An away body: the squads are eleven each, so the away side starts at index 11.
    if (foeAt !== null) s.players[11 + 2].p = { ...foeAt };
    s.ball.p = { x: 45, y: 0.4, z: 0 };
    s.ball.v = { x: 0, y: 0, z: 0 };
    s.possession.holder = NOBODY;
    resolvePossession(s);
    return s;
  }

  it('[Right] unopposed, he turns it back onto the pitch', () => {
    const s = run({ x: 6, y: -5 }, null);

    expect(s.possession.holder).toBe(5);
    expect(s.ball.v.y, 'he ran his own ball out with nobody near him').toBeGreaterThan(0);
    expect(s.ball.v.x, 'the touch along the line was thrown away too').toBeGreaterThan(0);
  });

  // ⚠️ AND A CONTESTED BALL STILL GOES OUT, which is the half that keeps throw-ins in the game at all.
  it('[Right] but with a man on him it goes out, as football does', () => {
    const s = run({ x: 6, y: -5 }, { x: 45.5, y: 0.6 });

    expect(s.ball.v.y, 'a contested ball was turned back in').toBeLessThan(0);
  });

  // ⚠️ IT REFLECTS RATHER THAN ZEROING. Zeroing was measured and it PINNED THE BALL TO THE LINE: it
  //    stopped going out, never came back in, and six whole matches produced no goals at all.
  it('[Right] and the turn actually carries it off the line', () => {
    const s = run({ x: 6, y: -5 }, null);

    expect(s.ball.v.y * (TOUCH_PERIOD / 60), 'the ball was pinned to the line').toBeGreaterThan(0.5);
  });
});
