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

// ========================= AND THE SHIELD FOLLOWS THE MAN, NOT THE RADIUS =========================
// A dribbler knocks the ball ahead of himself; that is what a dribble IS. The touch puts it a shade
// outside his own control radius, and until this was fixed the shield stopped applying at exactly that
// moment - so any opponent a hand's breadth nearer took the ball off him without doing anything.
//
// ⚠️ THE NUMBERS ARE THE MECHANISM, NOT AN ILLUSTRATION. Measured over six five-minute matches, at the
// tick an opponent took the ball: the man who lost it was a median of 0.96 m from it and the man who took
// it 0.86 m - TEN CENTIMETRES apart - and the control radius is 0.90 m. Ninety-six against ninety is not
// a coincidence; it is the ball sitting just past the edge of his reach because he had just touched it.
// Only 9% of steals had the loser genuinely beaten, more than three metres away.
//
// The result was a match with 227 changes of possession, a median possession of SEVEN TICKS, and a ball
// that was under somebody's control 20.7% of the time and never left the middle two sixths of the pitch.
// Nothing was attacking; nobody could hold the ball long enough to try.
//
// ⚠️ AND THE FOOTBALL AND THE FIX ARE THE SAME SENTENCE: you take the ball off a man by TACKLING him,
// not by standing ten centimetres nearer to it. `sim/tackle` is the other half - a fair challenge knocks
// it loose - so defending still works, and it works by doing something.
describe('a dribbler keeps his own knocked-on ball', () => {
  function duel(carrierAt: number, rivalAt: number) {
    const s = createMatchState();
    s.phase = 'live';
    for (let k = 0; k < SQUAD_SIZE; k++) {
      s.players[firstOf(HOME) + k].p = { x: 5, y: 5 };
      s.players[firstOf(AWAY) + k].p = { x: 85, y: 50 };
    }
    const carrier = firstOf(HOME) + 7;
    const rival = firstOf(AWAY) + 4;
    s.ball.p = { x: 45, y: 28, z: 0 };
    s.ball.v = { x: 0, y: 0, z: 0 };
    s.players[carrier].p = { x: 45 - carrierAt, y: 28 };
    s.players[rival].p = { x: 45 + rivalAt, y: 28 };
    s.possession.holder = carrier;
    s.possession.lastTouch = carrier;
    return { s, carrier, rival };
  }

  // The ball has just been knocked to 0.96m - past the 0.90m radius - and the rival is at 0.86m. These
  // are the medians measured in a real match, so this is the case that was happening 1362 times.
  it('[Right] the ball he has just touched is still his, though it is past his reach', () => {
    const { s, carrier } = duel(0.96, 0.86);

    playTick(s, emptyFrame(0), DT, MATCH_PROFILE);

    expect(s.possession.holder, 'a rival ten centimetres nearer took it off him').toBe(carrier);
  });

  // ⚠️ AND IT IS A MARGIN, NOT A LOCK. A rival who is CLEARLY nearer has beaten him, and if that were
  //    not true the ball could never change hands at all - which is the failure this repository already
  //    measured from the other side, when a carrier who was never contested turned the game into a
  //    dribble in the middle third.
  it('[Boundary] but a rival who is clearly nearer has won it', () => {
    const { s, rival } = duel(1.2, 0.2);

    playTick(s, emptyFrame(0), DT, MATCH_PROFILE);

    expect(s.possession.holder).toBe(rival);
  });

  // ⚠️ AND A BALL HE HAS REALLY LOST IS REALLY LOST. The shield reaches a stride past his radius, not
  //    across the pitch: a ball three metres away belongs to whoever gets to it.
  it('[Zero] and a ball far past his reach is anybody\'s', () => {
    const { s, carrier } = duel(3.5, 0.4);

    playTick(s, emptyFrame(0), DT, MATCH_PROFILE);

    expect(s.possession.holder).not.toBe(carrier);
  });
});
