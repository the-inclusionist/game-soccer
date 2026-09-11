// SPDX-License-Identifier: AGPL-3.0-or-later
// THE BALL IS WON BY SUSTAINED CONTACT, NOT BY BEING TEN CENTIMETRES NEARER.
//
// ========================= WHY THE OLD MODEL COULD NOT WORK =========================
// Possession was decided fresh every tick by proximity, with a shield margin for the man who had it. That
// made the ball a coin tossed sixty times a second, and the measurements say so:
//
//   at the tick an opponent took it, the loser was a median of 0.96 m from the ball and the taker 0.86 m
//   88.7% of all changes of possession went to the other side
//   possession changed hands 140 to 227 times a match, with a median spell of SEVEN TICKS
//   the ball was under somebody's control 20.7% of the time and never left the middle two sixths
//
// ⚠️ AND IT IS WHY `passing` DOES NOTHING. Over sixty matches the completion rate is flat at about 31%
// from rating 0.1 to 0.9, because how straight the ball was hit cannot matter when what decides the
// outcome is which body happens to be nearest when it lands. A rating can only bite on a mechanism that
// is listening to it.
//
// ⚠️ AND IT IS WHY CONTAINING WAS REVERTED THREE TIMES. A defender who holds his ground was never beaten,
// because holding ground IS how the old model won the ball. There was nothing for containing to add.
//
// So the ball goes to a challenger who has kept the pressure ON for a while - which is football, is what
// the reference game does ("stay touch-tight - sustained contact wins the ball"), and leaves the DELIBERATE
// route where it belongs: `sim/tackle` is a challenge somebody makes, and this is what standing on him does.
import { describe, expect, it } from 'vitest';
import { resolvePossession, PRESSURE_WINS, NOBODY } from '../app/js/sim/possession.ts';
import { createMatchState } from '../app/js/sim/state.ts';
import { AWAY, HOME, SQUAD_SIZE, firstOf } from '../app/js/sim/ids.ts';

/**
 * A home carrier on the ball with one away defender standing at `gap` metres from it.
 *
 * ⚠️ THE CARRIER IS 0.8 m OFF IT AND THE RIVAL IS CLEARLY NEARER, which is deliberate and was wrong in
 * the first draft. With the two of them inside `SHIELD_MARGIN` of each other the carrier keeps the ball
 * for a reason that has nothing to do with pressure - the shield does it - and every gate below would
 * have passed without a line of this feature existing. The gap has to be one the OLD model would have
 * transferred on instantly.
 */
function duel(gap: number) {
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
  s.players[carrier].p = { x: 45.8, y: 28 };
  s.players[rival].p = { x: 45 + gap, y: 28 };
  s.possession.holder = carrier;
  s.possession.lastTouch = carrier;
  return { s, carrier, rival };
}

describe('winning the ball by standing on him', () => {
  it('[Zero] being nearer for one tick wins nothing', () => {
    const { s, carrier } = duel(0.1);

    resolvePossession(s);

    expect(s.possession.holder, 'he took it off him in a single tick').toBe(carrier);
  });

  // ⚠️ THE WHOLE CLAIM. He has to keep it up, and `PRESSURE_WINS` is how long - at the base rate.
  //
  // ⚠️ AND THIS FIXTURE IS THE SLOW CASE, WHICH IT DID NOT USED TO BE. The carrier stands at 45.8
  //    facing the way his side attacks and the rival is at 45.1, which is DIRECTLY BEHIND him - and
  //    since `pressureFactorOf` landed, behind accrues at half rate. The gate used to run
  //    `PRESSURE_WINS + 1` ticks and pass; it now needs twice that, and the change of number is the
  //    feature rather than a tolerance being loosened.
  it('[Right] but keeping it up wins it, even from directly behind', () => {
    const { s, rival } = duel(0.1);

    for (let t = 0; t < PRESSURE_WINS * 2 + 1; t++) resolvePossession(s);

    expect(s.possession.holder, 'a defender glued to his back never wins it at all').toBe(rival);
  });

  // ========================= AND AN ALONGSIDE-VERSUS-BEHIND GATE IS NOT CONSTRUCTIBLE HERE =========================
  // ⚠️ THE TWO MECHANISMS OVERLAP, WHICH TRYING TO WRITE IT IS WHAT FOUND. The shield above only yields
  //    when the challenger is CLEARLY nearer the ball than the carrier - `|carrier to ball| - |his to
  //    ball| >= margin` - and a man standing alongside the carrier is, almost by definition, about as far
  //    from the ball as the carrier is. So every fixture that puts him beside the carrier is a fixture the
  //    shield refuses, and every fixture the shield allows has already put him in front.
  //
  // ⚠️ THE FIRST TWO ATTEMPTS BOTH REPORTED FACTS ABOUT THE FIXTURE AND NOT ABOUT THE GAME. One had him
  //    0.6 m from the carrier and therefore 1.0 m from the ball, outside the control radius, so the duel
  //    never started and it read "alongside never wins". The second moved the carrier closer to the ball
  //    and put him INSIDE the shield margin, so the carrier kept it for ever and both sides read 999.
  //
  //    The ordering is gated where it can be asked cleanly, on `pressureFactorOf` in
  //    `tests/positional-duel`; what is gated here is the half that a real duel can express, which is that
  //    a man behind still wins it and takes twice as long about it.

  // ⚠️ AND IT IS NOT A COUNTDOWN THAT SURVIVES HIM WALKING AWAY. Pressure that persisted after the
  //    defender left would be a ball won by somebody standing in the centre circle a second later.
  it('[Zero] and backing off loses what he had built', () => {
    const { s, carrier, rival } = duel(0.1);
    for (let t = 0; t < PRESSURE_WINS - 1; t++) resolvePossession(s);

    s.players[rival].p = { x: 60, y: 28 };
    resolvePossession(s);
    s.players[rival].p = { x: 45.1, y: 28 };
    resolvePossession(s);

    expect(s.possession.holder, 'he kept the pressure he had walked away from').toBe(carrier);
  });

  it('[Zero] a defender who is not close builds nothing at all', () => {
    const { s, carrier } = duel(6);

    for (let t = 0; t < PRESSURE_WINS * 3; t++) resolvePossession(s);

    expect(s.possession.holder).toBe(carrier);
  });

  // ⚠️ IT LIVES IN THE STATE, which is not a detail. A value outside the state is one no digest can see
  //    and no replay can reproduce - this repository has the rule written in `input/sampler` for exactly
  //    the same reason, and a half-built pressure is as much of the world as a ball in the air.
  it('[Interface] the pressure is part of the world, so a replay can reproduce it', () => {
    const { s } = duel(0.1);

    resolvePossession(s);
    resolvePossession(s);

    expect(s.pressure, 'nothing was recorded, so a replay would start it from nought').toBeGreaterThan(0);
    expect(s.pressedBy).not.toBe(NOBODY);
  });

  it('[Zero] and it is empty when nobody is being pressed', () => {
    const { s } = duel(6);

    resolvePossession(s);

    expect(s.pressure).toBe(0);
    expect(s.pressedBy).toBe(NOBODY);
  });
});
