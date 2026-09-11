// SPDX-License-Identifier: AGPL-3.0-or-later
// WHERE A CHALLENGER STANDS DECIDES HOW FAST HE WINS THE BALL.
//
// ========================= WHAT IT WAS BEFORE =========================
// `sim/possession` accumulates unbroken pressure while a challenger is in contact and hands him the ball
// at `PRESSURE_WINS`, scaled by his side's `defending`. What it never asked is WHERE he is. Measured on
// 2026-09-08: a chaser reaches 0.00 metres from the ball and wins it in about twenty-three ticks from any
// starting gap and at any pace - because he walks straight THROUGH the carrier, and because standing
// behind a man costs him nothing.
//
// ⚠️ SO SHIELDING WAS NOT A SKILL, IT WAS A WORD. A child who turns her back on a defender is doing the
// one thing football gives her to protect the ball, and the simulation charged the defender nothing for
// being on the wrong side of her. This is the half of the duel that makes the turn mean something.
//
// ⚠️ AND IT IS A DOT PRODUCT AND NOT AN ANGLE. `Math.atan2` is what "which side is he on" would obviously
// be written with, and it is on this repository's forbidden list because it is not exactly rounded -
// two machines replaying one match could disagree about who won the ball. An alignment between two unit
// vectors is a multiply and an add, and `Math.sqrt` that normalises them is exactly rounded by IEEE-754.
import { describe, expect, it } from 'vitest';
import { AHEAD_BONUS, pressureFactorOf } from '../app/js/sim/possession.ts';

describe('where the challenger is', () => {
  // ⚠️ THE THREE REGIMES THE PLAN NAMES, in one assertion so their ORDER is the claim rather than three
  //    separate numbers that could drift apart.
  it('[Right] in front beats alongside beats behind', () => {
    const front = pressureFactorOf(1);
    const side = pressureFactorOf(0);
    const behind = pressureFactorOf(-1);

    expect(front).toBeGreaterThan(side);
    expect(side).toBeGreaterThan(behind);
  });

  // ⚠️ [Zero] AND BEHIND IS SLOW, NOT IMPOSSIBLE. A defender glued to a carrier's back must still win the
  //    ball eventually - football does not let a man keep it for ever by turning round, and a factor of
  //    zero would be exactly that. It is the shield-forever exploit arriving through the other door.
  it('[Zero] behind is slow but never nothing', () => {
    expect(pressureFactorOf(-1), 'a defender behind can never win the ball at all').toBeGreaterThan(0);
  });

  // ⚠️ [Boundary] THE SCALE IS BOUNDED AT BOTH ENDS, because the alignment it reads is a dot product of
  //    unit vectors and cannot leave [-1, 1] - but a caller with an unnormalised vector would push it out,
  //    and a pressure rate of four would win the ball in six ticks from across the pitch.
  it('[Boundary] nothing outside the range can make it run away', () => {
    expect(pressureFactorOf(99)).toBe(pressureFactorOf(1));
    expect(pressureFactorOf(-99)).toBe(pressureFactorOf(-1));
  });

  // ⚠️ AND THE SPREAD IS BIG ENOUGH TO PLAY AGAINST. If front and behind differed by a tenth, a child
  //    turning her back would be paying nothing for a skill the game claims to have - which is the defect
  //    this whole item exists to close, surviving as a number too small to feel.
  it('[Right] and the difference between the ends is worth turning your back for', () => {
    expect(pressureFactorOf(1) / pressureFactorOf(-1), 'shielding barely helps').toBeGreaterThanOrEqual(2);
  });

  it('[Interface] the bonus is what the two ends are built from, and it is declared', () => {
    expect(AHEAD_BONUS).toBeGreaterThan(0);
  });
});
