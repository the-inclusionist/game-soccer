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
import { PERIOD_CHOICES } from '../rules/profile.ts';
import { createDialog, type Dialog } from './dialog.ts';

/** What a child has chosen. Every field is something that was already implemented and unreachable. */
export interface Assists {
  readonly charge: ChargeMode;
  readonly tempo: number;
  readonly period: number | 'none';
}

export const DEFAULT_ASSISTS: Assists = Object.freeze({
  charge: 'hold',
  tempo: 0.5,
  period: 10,
});

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
  if (panel === null || opener === null || closeBtn === null) return null;
  if (charge === null || tempo === null || period === null) return null;

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
  });

  for (const select of [charge, tempo, period]) {
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
