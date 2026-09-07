// SPDX-License-Identifier: AGPL-3.0-or-later
// WHICH WAY A SIDE IS ATTACKING, IN ONE PLACE.
//
// ========================= FIVE COPIES OF THE MOST DANGEROUS FACT IN THE GAME =========================
// The ends swap at half time. That single sentence decides where the offside line is, where the AI plays
// the ball, which way the screen reader sends a child who cannot see, and where a contained defender
// stands - and it was written FIVE separate times: `ai/brain`, `narration`, `rules/offside`,
// `sim/contain` and `declaration`, three of them spelled differently.
//
// ⚠️ THEY ALL AGREED, WHICH IS THE POINT AND NOT THE DEFENCE. Nothing made them agree; they agreed
// because one person wrote them within a few weeks of each other. The failure this prevents is the sixth
// copy, or the day somebody fixes a second-half bug in one of the five - and the symptom would be a blind
// child sent the wrong way for forty-five minutes with nothing on the screen looking wrong.
import { describe, expect, it } from 'vitest';
import { attackDirOf } from '../app/js/sim/ends.ts';
import { AWAY, HOME } from '../app/js/sim/ids.ts';

describe('the end a side is attacking', () => {
  it('[Right] the home side attacks increasing x in the first period', () => {
    expect(attackDirOf(HOME, 1)).toBe(1);
  });

  it('[Right] and the away side attacks the other way in the same period', () => {
    expect(attackDirOf(AWAY, 1)).toBe(-1);
  });

  // ⚠️ THE WHOLE REASON THIS IS A FUNCTION OF THE PERIOD. A fixed direction read off the team id gives
  //    every second-half decision to the wrong side.
  it('[Boundary] and both of them turn round at half time', () => {
    expect(attackDirOf(HOME, 2)).toBe(-1);
    expect(attackDirOf(AWAY, 2)).toBe(1);
  });

  it('[Zero] the two sides never attack the same end', () => {
    for (const period of [1, 2]) expect(attackDirOf(HOME, period)).toBe(-attackDirOf(AWAY, period));
  });
});
