// SPDX-License-Identifier: AGPL-3.0-or-later
// THE DECISION, AS BUTTONS. What makes this game playable with no pixels at all.
//
// ========================= WHY THIS IS NOT A FALLBACK =========================
// A screen-reader child and a switch-access child play THROUGH this panel, not despite it. Every act the
// simulation accepts is a focusable control with a real name; the power is a stepper rather than a bar,
// because "three of five" is something a child can hear and a filled rectangle is not. With it, the whole
// game is operable without a single pixel being seen - and that is the strongest claim in the repository.
//
// ⚠️ IT DECIDES NOTHING. `turn-options` says what may be chosen and this file draws it, so the choice can
// be tested with no browser and the drawing can be tested with no rules.

import type { Command, Verb } from '../sim/command.ts';
import type { MatchState } from '../sim/state.ts';
import type { PlayerId } from '../sim/ids.ts';
import { turnOptionsFor, type DirectionOption } from './turn-options.ts';

export interface TurnPanelCtx {
  readonly host: HTMLElement;
  readonly doc: Document;
  readonly t: (key: string, params?: Record<string, string | number>) => string;
  /** Called with the command the child committed. */
  readonly onCommit: (cmd: Command) => void;
}

export interface TurnPanel {
  /** Redraw for this state. Hidden when there is nothing to decide. */
  render(state: MatchState, seat: number, who: PlayerId | undefined): void;
  readonly chosen: { power: number; direction: DirectionOption };
}

const DEFAULT_DIRECTION: DirectionOption = { labelKey: 'dir.e', dx: 1, dy: 0 };

export function createTurnPanel(ctx: TurnPanelCtx): TurnPanel {
  const { doc } = ctx;
  let power = 3;
  let direction = DEFAULT_DIRECTION;
  let tick = 0;
  let seatNow = 0;

  const root = doc.createElement('div');
  root.className = 'turn-panel';
  root.hidden = true;
  // A group rather than a dialog: it does not trap focus, because the child must be able to leave it for
  // the accessibility quick bar without committing anything.
  root.setAttribute('role', 'group');
  ctx.host.appendChild(root);

  const button = (label: string, onPress: () => void): HTMLButtonElement => {
    const b = doc.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', onPress);
    return b;
  };

  const commit = (verb: Verb) => {
    ctx.onCommit({
      tick,
      seat: seatNow,
      dx: direction.dx,
      dy: direction.dy,
      verb,
      // The stepper's 1..5 becomes the same 0..1 a hold produces, so both routes reach one simulation.
      power: (power - 1) / 4,
      flags: 0,
    });
  };

  return {
    get chosen() {
      return { power, direction };
    },

    render(state: MatchState, seat: number, who: PlayerId | undefined): void {
      tick = state.tick;
      seatNow = seat;
      const options = turnOptionsFor(state, who);

      root.replaceChildren();
      if (options.verbs.length === 0) {
        root.hidden = true;
        return;
      }
      root.hidden = false;

      const aim = doc.createElement('fieldset');
      const aimLegend = doc.createElement('legend');
      aimLegend.textContent = ctx.t('turn.aim');
      aim.appendChild(aimLegend);
      for (const d of options.directions) {
        const b = button(ctx.t(d.labelKey), () => {
          direction = d;
          b.setAttribute('aria-pressed', 'true');
        });
        b.setAttribute('aria-pressed', String(d.labelKey === direction.labelKey));
        aim.appendChild(b);
      }
      root.appendChild(aim);

      const strength = doc.createElement('fieldset');
      const strengthLegend = doc.createElement('legend');
      // ⚠️ COUNTABLE, NOT A BAR. "Three of five" is something a child who cannot see the screen can use;
      //    a filled rectangle is not, and neither is a percentage nobody said out loud.
      strengthLegend.textContent = ctx.t('turn.power', { have: power, need: options.powerSteps.length });
      strength.appendChild(strengthLegend);
      for (const step of options.powerSteps) {
        const b = button(String(step), () => {
          power = step;
          strengthLegend.textContent = ctx.t('turn.power', {
            have: power,
            need: options.powerSteps.length,
          });
        });
        b.setAttribute('aria-pressed', String(step === power));
        strength.appendChild(b);
      }
      root.appendChild(strength);

      const acts = doc.createElement('fieldset');
      const actsLegend = doc.createElement('legend');
      actsLegend.textContent = ctx.t('turn.act');
      acts.appendChild(actsLegend);
      for (const option of options.verbs) {
        acts.appendChild(button(ctx.t(option.labelKey), () => commit(option.verb)));
      }
      root.appendChild(acts);
    },
  };
}
