// SPDX-License-Identifier: AGPL-3.0-or-later
// CONTROL REACHING THE PITCH.
//
// ========================= THE PROMISE THIS KEEPS =========================
// `sim/possession` has said it since the day the constant was written: *"IT WILL BECOME A FUNCTION OF THE
// `control` RATING, and the constant is the rating at 0.5. Ratings apply at the POINT OF ACTION rather
// than by branching the logic, so this becomes `0.7 + 0.4 * control` and nothing else in this file
// changes."* `controlRadiusOf` was then written, gated, and imported by no module at all.
//
// That is the eighth time here: a module right, a gate right, and no wire. `tests/club-ratings` even says
// "a better dribbler keeps the ball closer" - by calling `controlRadiusOf` and comparing the two numbers
// it returns, which would stay green with every caller deleted, and there were none.
//
// ⚠️ SO THIS ASKS THE MATCH. A ball at ninety-five centimetres is a ball a good dribbler still has and a
// poor one has lost, and which of the two is true is something a child can see: he keeps running with it,
// or it rolls away from him.
import { describe, expect, it } from 'vitest';
import { createMatchState } from '../app/js/sim/state.ts';
import { playTick } from '../app/js/play.ts';
import { MATCH_PROFILE } from '../app/js/rules/profile.ts';
import { AWAY, HOME, SQUAD_SIZE, firstOf } from '../app/js/sim/ids.ts';
import { DT } from '../app/js/sim/ball.ts';
import { emptyFrame } from '../app/js/sim/command.ts';
import { CONTROL_R, NOBODY } from '../app/js/sim/possession.ts';
import { AVERAGE, controlRadiusOf } from '../app/js/ai/ratings.ts';

const deft = { ...AVERAGE, control: 1 };
const clumsy = { ...AVERAGE, control: 0 };

/**
 * One home player with the ball `gap` metres from his feet, and nobody else within thirty metres.
 *
 * Everybody is stationary so that the tick under test is about the reach and nothing else: a moving body
 * would change the distance before possession is resolved, and a moving ball would too.
 */
function loose(gap: number, home = AVERAGE) {
  const s = createMatchState(MATCH_PROFILE);
  s.phase = 'live';
  for (let k = 0; k < SQUAD_SIZE; k++) {
    s.players[firstOf(HOME) + k].p = { x: 10, y: 50 };
    s.players[firstOf(AWAY) + k].p = { x: 80, y: 50 };
  }
  const who = firstOf(HOME) + 9;
  s.players[who].p = { x: 45, y: 28 };
  s.ball.p = { x: 45 + gap, y: 28, z: 0 };
  s.ball.v = { x: 0, y: 0, z: 0 };
  s.ball.grounded = true;
  s.possession.holder = NOBODY;

  playTick(s, emptyFrame(0), DT, MATCH_PROFILE, { 0: home, 1: AVERAGE });
  return { s, who };
}

describe('a ball at arm-and-a-half length', () => {
  // ⚠️ TWO GAPS, AND ONE WOULD NOT HAVE DONE. Both are chosen to straddle the AVERAGE radius as well as
  //    each other, because the mutation worth catching is "every club reaches 0.9" - and at a single gap
  //    of 0.95 the clumsy club and the constant both lose the ball, so half the pair would have survived
  //    it. Measured: with `controlRadius` pinned at 0.9, FAR loses the deft gate and NEAR loses the clumsy
  //    one, which is the whole claim from both directions.
  //
  //    FAR is out of an average club's reach and inside a deft one's; NEAR is inside an average club's
  //    and outside a clumsy one's.
  const FAR = 0.95;
  const NEAR = 0.8;

  it('[Interface] the scale really does straddle both gaps this gate uses', () => {
    expect(controlRadiusOf(1)).toBeGreaterThan(FAR);
    expect(controlRadiusOf(0.5)).toBeLessThan(FAR);
    expect(controlRadiusOf(0.5)).toBeGreaterThan(NEAR);
    expect(controlRadiusOf(0)).toBeLessThan(NEAR);
  });

  it('[Right] a deft club still has a ball an average one would have lost', () => {
    const { s, who } = loose(FAR, deft);

    expect(s.possession.holder, 'a good dribbler lost a ball at his feet').toBe(who);
    expect(loose(FAR).s.possession.holder, 'the gap is not out of an average reach after all').toBe(NOBODY);
  });

  it('[Right] and a clumsy one has lost a ball an average one would still have', () => {
    const { s, who } = loose(NEAR, clumsy);

    expect(s.possession.holder, 'a hopeless dribbler kept a ball out of his reach').toBe(NOBODY);
    expect(loose(NEAR).s.possession.holder, 'the gap is not inside an average reach after all').toBe(who);
  });

  // ⚠️ AND AN AVERAGE CLUB IS EXACTLY WHERE IT WAS. `controlRadiusOf(0.5)` is 0.9, which is the constant
  //    this replaces - so every gate that drives the simulation with no clubs at all describes the same
  //    world the game does. A rating wired in a way that moved the default would have quietly invalidated
  //    every golden replay in the repository.
  it('[Boundary] an average club reaches exactly as far as the old constant did', () => {
    expect(controlRadiusOf(0.5)).toBeCloseTo(CONTROL_R, 10);
    expect(loose(0.85).s.possession.holder).not.toBe(NOBODY);
    expect(loose(0.95).s.possession.holder).toBe(NOBODY);
  });
});
