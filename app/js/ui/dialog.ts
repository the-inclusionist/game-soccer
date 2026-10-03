// SPDX-License-Identifier: AGPL-3.0-or-later
// A PANEL THAT OPENS, TRAPS THE FOCUS, AND GIVES IT BACK.
//
// ========================= WHY THIS IS ONE MODULE AND NOT TWO COPIES =========================
// The remap screen got its focus trap, its Escape, its focus return and its trap DEREGISTRATION one at a
// time, and each of the four arrived because something was wrong: `aria-modal="true"` claiming a modality
// nothing enforced, a dialog a child could tab out of, a way in with no way back, and a trap that
// outlived its panel and answered Tab for a dialog that was no longer in the tree.
//
// The second panel would have got the same four again, in some other order, and would have got three of
// them. Written once, it gets four.
//
// ⚠️ AND THE TRAP MUST COME OFF. The engine's `detach` says in its own header that it was born from a test
// that failed because a trap outlived its dialog. It failed here too, for the same reason, in a test file
// where three cases passed alone and one failed in company.

import { focusablesInDom, initFocusTrap } from '@the-inclusionist/engine/ui/focus-trap.js';

export interface DialogPorts {
  readonly doc: Document;
  readonly panel: HTMLElement;
  /** The control that opens it, and the one focus goes back to when it closes. */
  readonly opener: HTMLElement;
  /** The control focus lands on when it opens - a way OUT, so nobody is dropped inside with no exit. */
  readonly closeBtn: HTMLElement;
  /** Run just before it is shown, for a panel that has to be rebuilt each time it opens. */
  readonly onOpen?: () => void;
}

export interface Dialog {
  readonly open: () => void;
  readonly close: () => void;
  readonly isOpen: () => boolean;
  /** True when this dialog consumed the key. Only Escape, and only while it is open. */
  readonly handleEscape: (e: KeyboardEvent) => boolean;
  readonly destroy: () => void;
}

export function createDialog(ports: DialogPorts): Dialog {
  const { doc, panel, opener, closeBtn } = ports;
  let open = false;

  /**
   * `aria-modal="true"` IS A PROMISE, AND THIS IS WHERE IT IS KEPT.
   *
   * ⚠️ Without a trap, Tab walks out into the pitch while the screen reader is being told everything
   * behind the dialog is unavailable. Declaring modality and not enforcing it is worse than declaring
   * neither: the reader hides a page it can still be taken to.
   *
   * ⚠️ AND `overlayDeCima` IS OURS. The engine's own answer scans `#game-region .overlay`, and these
   * panels sit deliberately OUTSIDE the world so their 44px targets are not multiplied by the integer
   * scale. The port exists for exactly this.
   */
  const trap = initFocusTrap({
    topOverlay: () => (open ? panel : null),
    currentFocus: () => doc.activeElement,
    focusablesIn: focusablesInDom,
    win: doc,
  });
  trap.attach();

  const close = (): void => {
    if (!open) return;
    open = false;
    panel.hidden = true;
    opener.focus();
  };

  const show = (): void => {
    open = true;
    ports.onOpen?.();
    panel.hidden = false;
    closeBtn.focus();
  };

  opener.addEventListener('click', show);
  closeBtn.addEventListener('click', close);

  return {
    isOpen: () => open,
    open: show,
    close,
    handleEscape: (e: KeyboardEvent): boolean => {
      // Escape closes, which is what every dialog in the engine does and the first thing a child tries.
      if (!open || e.code !== 'Escape') return false;
      e.preventDefault();
      close();
      return true;
    },
    destroy: () => {
      open = false;
      trap.detach();
    },
  };
}
