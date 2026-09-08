// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ADJUSTMENTS THAT PAY WCAG 2.2.1, AND WHICH NOTHING COULD REACH.
//
// ========================= WHAT THIS FILE IS ABOUT =========================
// Three things existed, were gated, and were unreachable from the game:
//
//  · `ChargeMode` - `hold`, `latch-timed`, `latch-stepped`. `createSampler` takes it and the composition
//    root never passed one, so the stepped route - the only one with NO TIMING IN IT AT ALL - could not
//    be chosen. The README claimed it as done. That claim was true of the module and false of the game.
//  · The assisted driver's `tempo`, hard-coded at 0.5. "Real time with assistances" was one assistance,
//    fixed, with no way to ask for less or more.
//  · The length of a half, frozen at ten minutes, in a game whose whole 2.2.1 argument is that time is
//    adjustable.
//
// ⚠️ 2.2.1 IS PAID TWO WAYS AT ONCE and this file is where both are measured: ADJUSTABLE (every limit is
// an option) and REMOVABLE (the stepped charge has no clock, and a half can be switched off entirely). A
// criterion satisfied only by adjustment still fails the child who cannot judge how much to adjust by.
import { describe, expect, it } from 'vitest';
import { MATCH_PROFILE, PRACTICE_PROFILE, PERIOD_CHOICES, withPeriod } from '../app/js/rules/profile.ts';
import { chargeRouteFor, GRACE_CHOICES } from '../app/js/ui/assists-panel.ts';
import { TEMPO_CHOICES } from '../app/js/drivers/driver.ts';
import { CHARGE_MODES } from '../app/js/input/charge.ts';

describe('how long a half is', () => {
  it('[Interface] there is more than one answer, and one of them is none at all', () => {
    expect(PERIOD_CHOICES.length).toBeGreaterThanOrEqual(3);
    expect(PERIOD_CHOICES).toContain('none');
  });

  it('[Right] choosing a length changes the profile and nothing else about the rules', () => {
    const short = withPeriod(MATCH_PROFILE, 5);

    expect(short.periodTicks).toBe(5 * 60 * 60);
    expect(short.clock).toBe('count');
    expect(short.outOfPlay).toBe(MATCH_PROFILE.outOfPlay);
    expect(short.offside).toBe(MATCH_PROFILE.offside);
    expect(short.squads).toEqual(MATCH_PROFILE.squads);
    expect(short.playable).toEqual(MATCH_PROFILE.playable);
  });

  // ⚠️ "NO CLOCK" IS 2.2.1 SATISFIED BY REMOVAL, which is the stronger of the two ways and the one a child
  //    who cannot judge a time limit needs. A match with no clock has to STOP BEING COUNTED, not be given
  //    a very large number - a large number is still a limit, and it still runs out.
  it('[Right] no clock means the clock is not consulted at all', () => {
    const forever = withPeriod(MATCH_PROFILE, 'none');

    expect(forever.clock).toBe('none');
    expect(forever.periodTicks).toBe(0);
  });

  it('[Zero] it does not mutate the profile it was given, which three modules hold', () => {
    withPeriod(MATCH_PROFILE, 5);

    expect(MATCH_PROFILE.periodTicks).toBe(10 * 60 * 60);
    expect(MATCH_PROFILE.clock).toBe('count');
  });

  it('[Boundary] a practice pitch has no clock and asking for one does not give it one back', () => {
    // Practice is 2.2.1 by construction; a length chooser must not be able to put a limit on it.
    expect(withPeriod(PRACTICE_PROFILE, 5).clock).toBe('none');
  });

  it('[Interface] every offered length is one this function accepts', () => {
    for (const choice of PERIOD_CHOICES) {
      const profile = withPeriod(MATCH_PROFILE, choice);
      expect(profile.periodTicks, String(choice)).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(profile.periodTicks), String(choice)).toBe(true);
    }
  });
});

describe('the pace of an assisted match', () => {
  it('[Interface] there is more than one, and full speed is one of them', () => {
    expect(TEMPO_CHOICES.length).toBeGreaterThanOrEqual(3);
    expect(TEMPO_CHOICES).toContain(1);
  });

  // ⚠️ THE TEMPO SCALES WALL TIME, NEVER `DT` - the assisted driver's whole correctness argument, and the
  //    reason a slow match is the SAME match. Offering a tempo above 1 would be offering a different
  //    physics; every choice here has to be a slice of one second, not a stretch of it.
  it('[Boundary] no offered pace is faster than real time', () => {
    for (const tempo of TEMPO_CHOICES) {
      expect(tempo, String(tempo)).toBeGreaterThan(0);
      expect(tempo, String(tempo)).toBeLessThanOrEqual(1);
    }
  });
});

describe('how a charge is made', () => {
  it('[Interface] all three routes are offered, not only the one that needs a steady hand', () => {
    expect([...CHARGE_MODES].sort()).toEqual(['hold', 'latch-stepped', 'latch-timed']);
  });

  // ⚠️ `latch-timed` ALONE IS NOT ENOUGH, and the plan says so in as many words: it takes away the HOLDING
  //    and keeps the TIMING, which is half the barrier. `latch-stepped` is the honest answer - each press
  //    advances one step and a pause fires - and its presence in this list is the whole of what makes the
  //    2.2.1 claim about removal true rather than aspirational.
  it('[Right] and one of them has no clock in it at all', () => {
    expect(CHARGE_MODES).toContain('latch-stepped');
  });
});

// ========================= THE ROUTE A ONE-SWITCH CHILD GETS WITHOUT ASKING =========================
// The plan says it outright: `latch-stepped` "e o padrao sempre que `oneButton` ou varredura estiver
// ligado", and it says why in the same breath - `latch-timed` takes away the HOLDING and keeps the
// TIMING, which is half the barrier. Stepped has no clock in it at all.
//
// ⚠️ AND IT WAS NOT WIRED. Nothing in the composition root read the engine's one-button setting, so a
// child in one-switch mode was handed `hold` - a route whose whole mechanic is keeping a key down, which
// is exactly what one-switch mode means she cannot do. The three routes were built, gated, and
// selectable; what was missing is that the right one arrives without an adult knowing to pick it.
//
// ⚠️ IT IS A DEFAULT AND NOT A LOCK. An adult who chooses a route keeps it: an accommodation that
// refuses to be overridden is a second barrier wearing the first one's clothes.
describe('the charge route a one-switch child is handed', () => {
  it('[Zero] with one-switch off, nothing changes', () => {
    expect(chargeRouteFor(false, null)).toBe('hold');
  });

  it('[Right] with one-switch on, the route with no clock in it', () => {
    expect(chargeRouteFor(true, null)).toBe('latch-stepped');
  });

  it('[Right] and a chosen route wins, because an accommodation that cannot be overridden is a barrier', () => {
    expect(chargeRouteFor(true, 'hold')).toBe('hold');
    expect(chargeRouteFor(false, 'latch-stepped')).toBe('latch-stepped');
  });
});

// ========================= AND THE CHORD'S TOLERANCE IS A LIMIT LIKE ANY OTHER =========================
// The plan sets `CHORD_GRACE` at three ticks and says it is "por jogador, ajustavel de 0 a 12. Em 0 a
// reinterpretacao some: R2 primeiro sempre troca, R1 primeiro sempre faz acorde."
//
// ⚠️ IT IS A TIME LIMIT, AND WCAG 2.2.1 GOVERNS IT. Those fifty milliseconds decide whether pressing R2
// switches player or waits to see whether R1 follows - which is a window a child has to hit, and a window
// a child has to hit is exactly what 2.2.1 says must be adjustable or removable. The charge routes and the
// half length are both offered for the same reason; this one was the constant nobody offered.
//
// ⚠️ AND `createChord` HAS TAKEN `grace` SINCE IT WAS WRITTEN. The module was right, gated, and handed a
// constant by the one caller - the tenth time this repository has found that shape.
describe('the chord tolerance a grown-up can choose', () => {
  it('[Interface] the ladder runs from nothing to a fifth of a second', () => {
    expect(GRACE_CHOICES[0]).toBe(0);
    expect(Math.max(...GRACE_CHOICES)).toBe(12);
    expect(GRACE_CHOICES).toContain(3);
  });

  // ⚠️ ZERO IS THE POINT OF THE LADDER, not its bottom rung. At nought the reinterpretation is gone:
  //    R2 first always switches and R1 first always makes the chord, so nothing depends on how fast she
  //    is. That is 2.2.1 satisfied by REMOVAL, which is the stronger half of the criterion.
  it('[Boundary] and nought is on it, because a limit that can be removed is the stronger answer', () => {
    expect(GRACE_CHOICES).toContain(0);
  });

  it('[Interface] every choice is a whole number of ticks a person could count', () => {
    for (const g of GRACE_CHOICES) {
      expect(Number.isInteger(g)).toBe(true);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(12);
    }
  });
});
