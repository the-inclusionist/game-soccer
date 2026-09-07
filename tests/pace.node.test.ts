// SPDX-License-Identifier: AGPL-3.0-or-later
// PACE REACHING THE PITCH.
//
// ========================= WHY `tests/club-ratings` COULD NOT ASK THIS =========================
// That file already says "a quicker club really is quicker" - and it says it by calling `capsFor` and
// comparing the two numbers it returns. The function is correct, and the assertion would stay green with
// every caller in the repository deleted, because there were none: `capsFor` was imported by no module at
// all. It is the same shape as `passing` before the pass existed and `shooting` before the shot could
// miss, and it is the seventh time here.
//
// So this gate does not ask what `capsFor` returns. It runs two bodies from two clubs down the pitch under
// the SAME command and asks which one gets further, which is the only question a child can see the answer
// to.
//
// ========================= AND SPRINT HAD TO STOP THROWING THE RATING AWAY =========================
// ⚠️ `step` built every body's caps from `DEFAULT_CAPS` and sprint OVERWROTE them: `DEFAULT_CAPS.maxSpeed *
// gain`. Wiring pace without touching that line would have produced a game in which clubs differ while
// walking and are identical the moment anybody sprints - which is most of a match, and which would have
// read as the rating not working at all rather than as one multiplication against the wrong base.
import { describe, expect, it } from 'vitest';
import { createMatchState } from '../app/js/sim/state.ts';
import { playTick } from '../app/js/play.ts';
import { MATCH_PROFILE } from '../app/js/rules/profile.ts';
import { AWAY, HOME, SQUAD_SIZE, firstOf } from '../app/js/sim/ids.ts';
import { DT } from '../app/js/sim/ball.ts';
import { AVERAGE } from '../app/js/ai/ratings.ts';
import { FLAG_SPRINT, type Command } from '../app/js/sim/command.ts';

const quick = { ...AVERAGE, pace: 1 };
const slow = { ...AVERAGE, pace: 0 };

const run = (seat: number, flags = 0): Command => ({
  tick: 0, seat, dx: 1, dy: 0, verb: 'none', power: 0, flags,
});

/**
 * One body from each side, driven by a seat, running the same way from the same line.
 *
 * The ball is parked in a corner and everybody else on the far touchline, so nothing in the cascade has
 * anything to do and the only thing moving is the two runners. Ratings are the ONLY difference between
 * them: same command, same tick, same code.
 */
function race(home: typeof AVERAGE, away: typeof AVERAGE, flags = 0, ticks = 180) {
  const s = createMatchState(MATCH_PROFILE);
  s.phase = 'live';
  for (let k = 0; k < SQUAD_SIZE; k++) {
    s.players[firstOf(HOME) + k].p = { x: 10, y: 54 };
    s.players[firstOf(AWAY) + k].p = { x: 10, y: 2 };
  }

  const one = firstOf(HOME) + 9;
  const two = firstOf(AWAY) + 9;
  s.controlled = [one, two];
  s.players[one].p = { x: 20, y: 20 };
  s.players[two].p = { x: 20, y: 36 };
  // Out of everybody's way, and out of shooting range of either goal.
  s.ball.p = { x: 45, y: 0.5, z: 0 };
  s.ball.v = { x: 0, y: 0, z: 0 };

  for (let t = 0; t < ticks; t++) {
    playTick(s, { tick: t, cmds: [run(0, flags), run(1, flags)] }, DT, MATCH_PROFILE, {
      0: home,
      1: away,
    });
  }

  return { one: s.players[one].p.x - 20, two: s.players[two].p.x - 20 };
}

describe('a quicker club on the pitch', () => {
  it('[Right] gets further down the same three seconds than a slower one', () => {
    const { one, two } = race(quick, slow);

    expect(one, 'the fast club did not outrun the slow one').toBeGreaterThan(two + 1);
  });

  it('[Right] and it is the rating and not the side of the pitch', () => {
    const { one, two } = race(slow, quick);

    expect(two, 'the same two ratings swapped gave the same winner').toBeGreaterThan(one + 1);
  });

  // ⚠️ THE GATE THAT CATCHES SPRINT THROWING THE RATING AWAY. Sprint multiplies a cap, and which cap it
  //    multiplies is the whole question: against `DEFAULT_CAPS` every club sprints at exactly the same
  //    speed, and since a match is mostly spent sprinting, pace would have been a rating a child could
  //    never see.
  it('[Right] and it is still quicker when both of them sprint', () => {
    const { one, two } = race(quick, slow, FLAG_SPRINT);

    expect(one, 'sprinting made the two clubs identical').toBeGreaterThan(two + 1);
  });

  it('[Zero] two clubs with the same pace finish level, whatever else differs', () => {
    const { one, two } = race({ ...AVERAGE, pace: 0.5, passing: 1 }, { ...AVERAGE, pace: 0.5, passing: 0 });

    expect(one).toBeCloseTo(two, 6);
  });

  // ⚠️ SPRINTING IS STILL A CHOICE. A rating that made a slow club's sprint pointless would take the
  //    control away from the child holding the button, and the button is half of how a chase feels.
  it('[Right] and even the slowest club gains something by sprinting', () => {
    const walked = race(slow, slow).one;
    const sprinted = race(slow, slow, FLAG_SPRINT).one;

    expect(sprinted, 'sprint did nothing for a slow club').toBeGreaterThan(walked);
  });
});
