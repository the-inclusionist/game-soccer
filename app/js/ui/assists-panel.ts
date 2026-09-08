// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ADJUSTMENTS, AS A SCREEN. Three limits on time, and every one of them was already implemented.
//
// ========================= WHAT WAS ACTUALLY MISSING =========================
// None of the three things this panel offers is new. `ChargeMode` had three routes, gated, and
// `createSampler` took the mode; the assisted driver took a `tempo`; `RulesProfile` carried a period
// length and a `'none'` clock. What did not exist was any way for a child to reach them: the composition
// root passed no charge mode at all, hard-coded the tempo at 0.5, and used a frozen ten-minute half.
//
// So the README's claim - "charge-on-hold with a stepped route that needs no timing at all" - was true of
// the module and false of the game. That is the most expensive kind of untruth in this repository,
// because everything else about it was right: the code, the tests, the reasoning, the record. Only the
// wire was missing, and only a person opening the game would ever have found out.
//
// ⚠️ WCAG 2.2.1 IS PAID TWICE HERE, and both halves are needed. ADJUSTABLE: every limit is an option.
// REMOVABLE: the stepped charge has no clock in it, and a half can be switched off. A criterion satisfied
// only by adjustment still fails the child who cannot judge what to adjust it to.

import { CHARGE_MODES, type ChargeMode } from '../input/charge.ts';
import { TEMPO_CHOICES } from '../drivers/driver.ts';
import { CHORD_GRACE } from '../input/chord.ts';
import { PERIOD_CHOICES } from '../rules/profile.ts';
import { createDialog, type Dialog } from './dialog.ts';

/** What a child has chosen. Every field is something that was already implemented and unreachable. */
export interface Assists {
  readonly charge: ChargeMode;
  readonly tempo: number;
  readonly period: number | 'none';
  /** Ticks of tolerance on the R1+R2 chord. `0` removes the reinterpretation entirely. */
  readonly grace: number;
}

/**
 * Ticks of tolerance a grown-up may give the R1+R2 chord, and `0` is on it on purpose.
 *
 * ⚠️ IT IS A TIME LIMIT AND WCAG 2.2.1 GOVERNS IT. Those ticks decide whether pressing R2 switches
 * player at once or waits to see whether R1 follows - a window a child has to hit, which is exactly what
 * the criterion says must be adjustable or removable. The charge routes and the half length are both
 * offered for that reason; this was the constant nobody offered, though `createChord` has taken `grace`
 * since the day it was written.
 *
 * ⚠️ AND NOUGHT IS THE POINT OF THE LADDER RATHER THAN ITS BOTTOM RUNG. At nought the reinterpretation
 * is gone: R2 first always switches and R1 first always makes the chord, so nothing at all depends on how
 * fast she is. That is 2.2.1 satisfied by REMOVAL, which is the stronger half of the criterion - the same
 * shape as `'none'` on the period ladder.
 */
export const GRACE_CHOICES: readonly number[] = Object.freeze([0, 3, 6, 12]);

export const DEFAULT_ASSISTS: Assists = Object.freeze({
  charge: 'hold',
  grace: CHORD_GRACE,
  tempo: 0.5,
  // ⚠️ TWO AND A HALF: a five-minute match, the middle of the three International Superstar Soccer
  //    offered and the length the Dev settled this game on. The chooser carries that ladder and `'none'`
  //    and nothing else - the lengths modern football games compete at were here and were taken out,
  //    because pairing with them is pairing with a different game. The WCAG 2.2.1 accommodation is
  //    untouched: what satisfies it is that one option removes the limit altogether, not a long list.
  period: 2.5,
});

/**
 * Which charge route a child is handed, given the engine's one-switch setting and whatever she has chosen.
 *
 * ⚠️ `latch-stepped` IS THE ONE WITH NO CLOCK IN IT, and the plan says it is the default whenever
 * one-switch or scanning is on. The reason is in the same sentence: `latch-timed` takes away the HOLDING
 * and keeps the TIMING, which is half the barrier. Stepped asks for presses and a pause, and nothing else.
 *
 * ⚠️ IT WAS NOT WIRED UNTIL 2026-09-07. Nothing in the composition root read the setting, so a child in
 * one-switch mode was handed `hold` - a route whose whole mechanic is keeping a key down, which is
 * exactly what one-switch mode means she cannot do. The three routes were built, gated hard and
 * selectable; what was missing is the right one arriving WITHOUT an adult knowing to pick it.
 *
 * ⚠️ AND IT IS A DEFAULT, NEVER A LOCK. A chosen route wins: an accommodation that refuses to be
 * overridden is a second barrier wearing the first one's clothes.
 */
export function chargeRouteFor(oneButton: boolean, chosen: ChargeMode | null): ChargeMode {
  if (chosen !== null) return chosen;
  return oneButton ? 'latch-stepped' : DEFAULT_ASSISTS.charge;
}

export interface AssistsPanelPorts {
  readonly doc: Document;
  readonly t: (key: string, params?: Record<string, string | number>) => string;
  readonly current: () => Assists;
  /** Applied immediately, because an adjustment a child has to confirm is an adjustment she may not find. */
  readonly onChange: (next: Assists) => void;
}

export interface AssistsPanel extends Dialog {
  readonly handleKeydown: (e: KeyboardEvent) => boolean;
}

/** One `<select>`, built from a list of values and a key that names each one. */
function fill(
  select: HTMLSelectElement,
  doc: Document,
  values: readonly (string | number)[],
  label: (value: string | number) => string,
  chosen: string | number,
): void {
  select.replaceChildren();
  for (const value of values) {
    const option = doc.createElement('option');
    option.value = String(value);
    option.textContent = label(value);
    select.append(option);
  }
  select.value = String(chosen);
}

export function createAssistsPanel(ports: AssistsPanelPorts): AssistsPanel | null {
  const { doc } = ports;
  const panel = doc.querySelector<HTMLElement>('#assist-panel');
  const opener = doc.querySelector<HTMLButtonElement>('#open-assists');
  const closeBtn = doc.querySelector<HTMLButtonElement>('#assist-close');
  const charge = doc.querySelector<HTMLSelectElement>('#assist-charge');
  const tempo = doc.querySelector<HTMLSelectElement>('#assist-tempo');
  const period = doc.querySelector<HTMLSelectElement>('#assist-period');
  const grace = doc.querySelector<HTMLSelectElement>('#assist-grace');
  if (panel === null || opener === null || closeBtn === null) return null;
  if (charge === null || tempo === null || period === null || grace === null) return null;

  const paint = (): void => {
    const now = ports.current();
    // ⚠️ THE OPTION TEXT IS RESOLVED HERE AND NOT WRITTEN INTO THE MARKUP, for the reason the engine's own
    //    `input/devices` states in its header: a table of `const` text freezes the language at boot, and
    //    the engine's dictionary is a `let` that `setLocale` reassigns.
    fill(charge, doc, CHARGE_MODES, (v) => ports.t(`assist.charge.${v}`), now.charge);
    fill(tempo, doc, TEMPO_CHOICES, (v) => ports.t('assist.tempo.value', { pct: Math.round(Number(v) * 100) }), now.tempo);
    fill(
      period,
      doc,
      PERIOD_CHOICES,
      (v) => (v === 'none' ? ports.t('assist.period.none') : ports.t('assist.period.minutes', { n: Number(v) })),
      now.period,
    );

    // ⚠️ NOUGHT IS NAMED, NOT NUMBERED. "0 ticks" is arithmetic; "no waiting" is what it does, and it
    //    is the option that removes the limit rather than shortening it - the same shape as `'none'` on
    //    the period ladder, and the stronger half of WCAG 2.2.1.
    fill(
      grace,
      doc,
      GRACE_CHOICES,
      (v) => (Number(v) === 0 ? ports.t('assist.grace.none') : ports.t('assist.grace.ticks', { n: Number(v) })),
      now.grace,
    );

    // ⚠️ THE EXPLANATION OF THE STEPPED ROUTE IS ON THE SCREEN, not in a tooltip. "Each press adds one
    //    step" is the whole reason that option exists, and a child choosing between three words she has
    //    never seen is not making a choice.
    const hint = doc.querySelector<HTMLElement>('#assist-charge-hint');
    if (hint !== null) hint.textContent = ports.t(`assist.charge.${now.charge}.hint`);
  };

  const dialog = createDialog({ doc, panel, opener, closeBtn, onOpen: paint });

  const read = (): Assists => ({
    charge: charge.value as ChargeMode,
    tempo: Number(tempo.value),
    period: period.value === 'none' ? 'none' : Number(period.value),
    grace: Number(grace.value),
  });

  for (const select of [charge, tempo, period, grace]) {
    select.addEventListener('change', () => {
      ports.onChange(read());
      paint();
    });
  }

  return {
    ...dialog,
    handleKeydown: (e: KeyboardEvent): boolean => dialog.handleEscape(e),
  };
}
