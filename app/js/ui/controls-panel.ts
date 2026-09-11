// SPDX-License-Identifier: AGPL-3.0-or-later
// THE REMAP SCREEN. The engine draws it; this file tells it what this game's keyboard IS.
//
// ========================= WHAT "FREE FROM THE ENGINE" ACTUALLY COST =========================
// `ui/settings-controls` is real and it is built for injection - its own header says the panel must not
// index the key map, because every per-position read goes through the injected `kbFor`. That discipline
// is what makes this file possible: the panel it draws by default edits `input/keyboard.ts`'s `kb`, whose
// schemes carry the platformer's EIGHT positions, and this game has fourteen. Handed our map, our store
// and our words instead, the same panel edits the keyboard the sampler actually reads.
//
// ⚠️ THIS HEADER SAID "TWO REPAIRS ARE MADE HERE, AND BOTH ARE THE ENGINE'S TO FIX PROPERLY". Both have
// since been fixed properly, and both repairs are gone - so what is listed below is what this file still
// does, and the two closures are kept as history because a reader needs to know they stopped mattering.
//
//  1. THE ACCESSIBLE NAME - CLOSED, and the repair is gone. It said the panel builds every `aria-label`
//     from `ACT_LABEL`, the platformer's eight words, so six of this game's positions reached the
//     attribute as `t(undefined)`: a sighted child read "Conter" and a blind one heard "Change the
//     undefined key". Engine 8.0 closed it (audit finding 7) and this repair outlived it by a version.
//     📏 Measured 2026-09-11 by deleting the line: the label is byte-identical with it and without it.
//  2. THE DOUBLED KEY - CLOSED, and that repair went earlier. The panel asked only whether ANOTHER
//     PLAYER owned the code, which a one-player game can never answer yes, so one key could hold two
//     positions and both fire. Engine 8.0 refuses the duplicate at entry instead (audit finding 8), which
//     is a better answer than the one that lived here - see the note beside `setKB`.
//
// What this file still repairs, and none of it is an engine defect: the click PROMPT, which the engine
// writes as a Portuguese literal; the KEY NAMES, which its `keyName` returns raw so two shoulders read
// `Digit7` and `Digit8`; and the PLAYER SENTENCE, which it hard-codes in Portuguese about a count this
// game answers itself.
//
// ⚠️ THE REPAIR RUNS AFTER EVERY RENDER, AND THE THREE RENDER PATHS ARE ENUMERATED BELOW rather than
// hooked generically. A `MutationObserver` would be more robust and is not usable: its callback is a
// microtask, so a child's key would be announced correctly one turn of the event loop after she pressed
// it - and every synchronous assertion about the panel would read the unrepaired attribute.

import { initSettingsControls } from '@the-inclusionist/engine/ui/settings-controls.js';
import { focaveisNoDom, initFocusTrap } from '@the-inclusionist/engine/ui/focus-trap.js';
import type { Action, ActionPreset } from '@the-inclusionist/engine/core/actions.js';
import { defaultKeymapFor, prettyKey, type Keymap, type Seating } from '../input/keymap.ts';

/**
 * The positions this screen offers.
 *
 * ⚠️ TWELVE AND NOT FOURTEEN. `start` and `select` are SESSION functions - pause, and the accessibility
 * bar - which ADR-0085 section 2 keeps out of a game's vocabulary because they must keep working when the
 * game does not. A screen that let a child rename the way out of a stuck match would be offering her the
 * rope.
 */
export const WORLD_POSITIONS: readonly Action[] = Object.freeze([
  'up',
  'down',
  'left',
  'right',
  'action1',
  'action2',
  'action3',
  'action4',
  'leftShoulder',
  'leftTrigger',
  'rightShoulder',
  'rightTrigger',
]);

export interface ControlsPanelPorts {
  readonly doc: Document;
  /**
   * The LIVE maps, one per seat, asked fresh.
   *
   * ⚠️ A FUNCTION AND NOT AN ARRAY, because the seating changes while this screen exists: the pair a
   * child edits when a friend is playing is not the map she uses alone, and a list captured at
   * construction would go on editing the keyboard nobody is using.
   */
  readonly maps: () => readonly Keymap[];
  /** How many children are playing. Decides whether this screen offers a choice of keyboard at all. */
  readonly seats: () => number;
  /** This game's words, rebuilt at the point of use so a language switch reaches them. */
  readonly words: () => ActionPreset;
  readonly t: (key: string, params?: Record<string, string | number>) => string;
  readonly srSay: (msg: string) => void;
  readonly srAlert: (msg: string) => void;
  /** Persist one seat's map. Called after every change a child makes, and after a reset. */
  readonly persist: (map: Keymap, seat: number) => void;
}

export interface ControlsPanel {
  readonly open: () => void;
  readonly close: () => void;
  readonly isOpen: () => boolean;
  /** True when the event was a key being captured, and the game must not also act on it. */
  readonly handleKeydown: (e: KeyboardEvent) => boolean;
  /**
   * Take the focus trap off the document.
   *
   * ⚠️ NOT SYMMETRY - A LEAK. The trap listens on the document in capture phase, so one left installed
   * after its panel is gone still answers Tab, for a dialog that is no longer in the tree. A page that
   * boots the game twice - the engine's own demo host swaps games without reloading - would then have two
   * traps arguing over the focus. The engine's `detach` exists for this and says so in its own header,
   * where it records that it was born from a test that failed for exactly this reason. It failed here too.
   */
  readonly destroy: () => void;
  /**
   * Redraw, because something outside this screen changed what it is showing.
   *
   * ⚠️ THE CLAMP IS NOT ENOUGH ON ITS OWN. Re-checking which seat is being edited at the next render is
   * right and late: the engine captures the map a Change button will write to at the moment the button is
   * CLICKED, from whatever the last render produced. So a friend leaving while the screen is open must
   * push a redraw, not wait for one.
   */
  readonly refresh: () => void;
}

/**
 * Wire the engine's remap screen to this game's keyboard.
 *
 * Returns `null` when the shell has no panel to fill - the same posture as `createGame`'s `problems`: a
 * screen wired into elements that are not there is worse than one that says it is not here.
 */
/**
 * Where the screen's word differs from the preset's.
 *
 * ⚠️ A REMAP SCREEN LABELS SLOTS, NOT VERBS, and this is where the difference bites. ADR-0079 lets one
 * verb sit in two slots, and sprint does: `action1` and `leftTrigger`, so a hand that reaches one can use
 * it. The preset gives both the same label and tells them apart in the HINT - which is right everywhere
 * the hint is shown, and this screen shows no hints. A sighted child met two rows reading "Correr:" with
 * nothing to choose between them.
 */
const SLOT_LABEL: Readonly<Record<string, string>> = Object.freeze({ leftTrigger: 'act.sprintAlias' });

export function createControlsPanel(ports: ControlsPanelPorts): ControlsPanel | null {
  const { doc } = ports;
  /**
   * Whose keyboard is on the screen.
   *
   * ⚠️ IT IS THE SCREEN'S STATE AND NOT THE GAME'S. Which child is editing has no effect on the match,
   * and putting it in the world would make it a thing a replay had to carry.
   */
  let editing = 0;
  const mapOf = (seat: number): Keymap => ports.maps()[seat] ?? ports.maps()[0];
  const panel = doc.querySelector<HTMLElement>('#controls-panel');
  const opener = doc.querySelector<HTMLButtonElement>('#open-controls');
  const closeBtn = doc.querySelector<HTMLButtonElement>('#ctrl-close');
  const resetBtn = doc.querySelector<HTMLButtonElement>('#ctrl-reset');
  if (panel === null || opener === null || closeBtn === null || resetBtn === null) return null;

  const labelOf = (action: Action): string => {
    const override = SLOT_LABEL[action];
    if (override !== undefined) return ports.t(override);
    return ports.words()[action]?.label ?? action;
  };

  /**
   * Put this game's word into every button's accessible name.
   *
   * ⚠️ THE SAME SENTENCE THE ENGINE USES, with the word swapped - `ctrl.changeKeyAria` is translated in
   * the engine's own three dictionaries, and rebuilding the phrase here would make this the one control
   * on the screen that only speaks one language.
   */
  let refresh = (): void => {};

  const nameTheButtons = (): void => {
    for (const b of doc.querySelectorAll<HTMLButtonElement>('#ctrl-list button[data-act]')) {
      const action = b.dataset.act as Action | undefined;
      if (action === undefined) continue;
      // ⚠️ THE `aria-label` USED TO BE WRITTEN HERE AND THE ENGINE WRITES IT NOW. Finding 7 of
      //    `docs/ENGINE-AUDIT.md` closed in engine 8.0 - the remap screen announces the GAME's word - and
      //    this repair outlived it by a version. 📏 Measured 2026-09-11 by deleting the line: the label
      //    read "Alterar tecla de Conter do Jogador 1" both with it and without it, byte for byte.
      //    Dead code that used to be load-bearing is the worst kind to leave behind, because the next
      //    reader cannot tell it stopped mattering - the same sentence this file already wrote when
      //    `snapshot` and `undouble` went.
      // ⚠️ AND THE PROMPT, WHICH THE ENGINE WRITES AS A PORTUGUESE LITERAL. `settings-controls` sets
      //    `b.textContent = 'Pressione…'` in the click handler it registers during `render` - so a child
      //    playing in English or Spanish meets one Portuguese word at the exact moment she is being asked
      //    to do something. This listener is registered AFTER the engine's on the same element, and
      //    listener order on one element is registration order, so it writes last.
      b.addEventListener('click', () => {
        b.textContent = ports.t('keys.press');
      });
    }

    // ⚠️ AND THE KEYS ARE RENAMED, because the engine's `keyName` strips `Arrow` and `Key` and returns
    //    everything else raw - so this game's two shoulders showed as `Digit7` and `Digit8`, and all four
    //    arrows showed as the same horizontal double arrow on the screen whose job is saying which key
    //    goes which way. The rows are in `WORLD_POSITIONS` order because `acoesDoJogo()` built them in it.
    const listed = doc.querySelectorAll<HTMLElement>('#ctrl-list .ctrl-row');
    for (let i = 0; i < listed.length && i < WORLD_POSITIONS.length; i++) {
      const codes = mapOf(editing)[WORLD_POSITIONS[i]] ?? [];
      const keys = listed[i].querySelectorAll<HTMLElement>('kbd');
      for (let k = 0; k < keys.length && k < codes.length; k++) keys[k].textContent = prettyKey(codes[k]);
    }

    // ⚠️ THE ENGINE'S SENTENCE IS REPLACED, NOT KEPT. It fills `#ctrl-players` with a hard-coded
    //    Portuguese sentence about which player is being edited - untranslated, and about a player count
    //    it gets from a port this game answers itself. With one seat there is nothing to choose between,
    //    so the element is emptied and hidden; with two, this game writes its own chooser into it.
    const host = doc.querySelector<HTMLElement>('#ctrl-players');
    if (host !== null) {
      host.replaceChildren();
      host.hidden = ports.seats() < 2;
      if (!host.hidden) {
        for (let seat = 0; seat < ports.seats(); seat++) {
          const tab = doc.createElement('button');
          tab.type = 'button';
          tab.className = 'mode-btn';
          tab.dataset.seat = String(seat);
          tab.textContent = ports.t('keys.seat', { n: seat + 1 });
          // ⚠️ `aria-pressed` AND NOT COLOUR. Which keyboard is on the screen is the single fact this
          //    control carries, and a child who cannot see the highlight would otherwise be editing a
          //    keyboard chosen for her without being told which.
          tab.setAttribute('aria-pressed', seat === editing ? 'true' : 'false');
          tab.addEventListener('click', () => {
            if (seat === editing) return;
            editing = seat;
            refresh();
            ports.srSay(ports.t('keys.seat', { n: seat + 1 }));
          });
          host.append(tab);
        }
      }
    }
  };

  // ⚠️ A FUNCTION THIS PANEL NO LONGER NEEDS, AND THE ENGINE IS WHY. Until 8.0 the engine's capture
  //    wrote `mapRef[action] = [code]` and asked only whether ANOTHER PLAYER owned the code - which in a
  //    one-player game can never be true - so this file stripped the old owner itself, finding it by
  //    diffing the map before and after the write rather than by guessing which position was doubled.
  //
  // ⚠️ 8.0 REFUSES THE DUPLICATE INSTEAD (engine issue #126), and its answer is better than the one
  //    that used to live here: moving a key leaves the old position with an EMPTY list, which the engine's
  //    own `bindingProblems` calls a defect and which a child would meet mid-match as an action that
  //    silently stopped existing. Refusing costs her two deliberate steps and loses nothing on the way -
  //    and it announces WHICH action already holds the key, by the word our `ActionPreset` supplies.
  //
  //    So `snapshot` and `undouble` are gone rather than kept "in case": a duplicate can no longer arrive
  //    through the capture path at all, and dead code that used to be load-bearing is the worst kind to
  //    leave behind, because the next reader cannot tell it stopped mattering. The gate that proved it was
  //    rewritten in the same change, and it now asserts the refusal.

  const api = initSettingsControls({
    $: (<T extends Element>(sel: string) => doc.querySelector(sel) as T | null) as never,
    acoesDoJogo: () => WORLD_POSITIONS.map((acao) => ({ acao, rotulo: labelOf(acao) })),
    srSay: ports.srSay,
    srAlert: ports.srAlert,
    store: {
      // ⚠️ THE ARGUMENT IS IGNORED ON PURPOSE, and it is not sloppiness. The panel keeps its OWN reference
      //    to the map and hands it back here; after a reset that reference is the fresh object the reset
      //    produced, while the live map - the one the sampler reads and the one the remap just mutated -
      //    is ours. Saving what we were handed would persist a keyboard the child is not playing with.
      saveKB: () => ports.persist(mapOf(editing), editing),
      // ⚠️ ONLY THE KEYBOARD ON THE SCREEN. The engine's reset button restores "the controls", which with
      //    one seat meant all of them; with two, resetting the child who did NOT ask would be taking her
      //    keys away for somebody else's mistake.
      resetKB: () => {
        const map = mapOf(editing);
        Object.assign(map, defaultKeymapFor(editing, ports.seats() as Seating));
        ports.persist(map, editing);
        return map as never;
      },
    },
    kb: mapOf(0) as never,
    // The panel reassigns its local reference on reset; the live map must not be replaced, only refilled,
    // because the sampler and this closure both hold it.
    setKB: (next: unknown) => {
      Object.assign(mapOf(editing), next as Keymap);
    },
    // ⚠️ THE INDEX IS HONOURED NOW, AND THAT IS WHAT MAKES THE ENGINE'S OWN GUARD WORK. `keyUsedByOther`
    //    excludes the scheme being edited BY REFERENCE and compares against the rest; with one seat there
    //    was no rest, so it could never fire (finding 8 of the audit). With two, a key the other child
    //    owns is refused by the engine itself, and refused WITHOUT taking the old one away.
    kbFor: (i: number) => mapOf(i) as never,
    // ⚠️ THE FACTORY SCHEME, AND IT IS NOT `store.resetKB`. Engine 8.0 asks for this separately and its
    //    own header says why: `resetKB` removes the persisted map BEFORE returning the factory copy, so
    //    using it as a reader would wipe the child's remapping on every render and the damage would only
    //    surface at the next boot. This is the same per-seat rule `kbFor` uses, one step back in time -
    //    injected rather than duplicated inside the engine, because "how many seats maps to which bucket"
    //    is the consumer's rule and a second copy of it would diverge the day either one changed.
    kbPadraoFor: (i: number) => defaultKeymapFor(i, ports.seats() as Seating) as never,
    getNumPlayers: () => ports.seats(),
    // The engine calls this after a write; the un-doubling is driven from our own diff instead, because
    // this port is handed nothing and the answer needs to know what the map looked like BEFORE.
    applyControls: () => {},
    assignControls: () => {},
  });

  // PATH 3 of the three render paths: the engine's own reset listener re-renders. Registered AFTER it, so
  // this runs second - listener order on one element is registration order, and that is the whole reason
  // `initSettingsControls` is called above this line rather than below it.
  resetBtn.addEventListener('click', () => nameTheButtons());

  refresh = (): void => {
    // ⚠️ CLAMPED, because the seating can change while this screen is open - the chooser is outside the
    //    world and nothing stops a teacher using it. Left alone, a child would go on editing a keyboard
    //    that no longer belongs to anybody, and see her changes have no effect on the game.
    if (editing >= ports.seats()) editing = 0;
    api.render(editing);
    nameTheButtons();
  };

  let open = false;

  /**
   * `aria-modal="true"` IS A PROMISE, AND THIS IS WHERE IT IS KEPT.
   *
   * ⚠️ The attribute tells a screen reader that everything behind the dialog is unavailable. Without a
   * trap, Tab still walks out into the pitch and the clock selector - so the reader hides a page it can
   * still be taken to, and a child who tabs out is somewhere her reader says does not exist. Declaring
   * modality and not enforcing it is worse than declaring neither.
   *
   * ⚠️ THE ENGINE'S TRAP, WITH OUR OWN `overlayDeCima`. Its default answer is `topVisibleOverlay()`, which
   * scans `#game-region .overlay` - and this screen is deliberately outside the world, so that its 44px
   * targets are not multiplied by the integer scale. The port exists for exactly this.
   */
  const trap = initFocusTrap({
    overlayDeCima: () => (open ? panel : null),
    focoAtual: () => doc.activeElement,
    focaveisDe: focaveisNoDom,
    win: doc,
  });
  trap.attach();

  const close = (): void => {
    open = false;
    // A capture left running would swallow the next key the child pressed AT THE GAME.
    api.cancelCapture();
    panel.hidden = true;
    opener.focus();
  };

  opener.addEventListener('click', () => {
    open = true;
    // Always the first keyboard: a screen that reopened on whichever seat was last edited would show a
    // child somebody else's keys with nothing saying so.
    editing = 0;
    refresh(); // PATH 1.
    panel.hidden = false;
    closeBtn.focus();
  });
  closeBtn.addEventListener('click', close);

  return {
    isOpen: () => open,
    open: () => opener.click(),
    close,
    refresh: () => {
      if (open) refresh();
    },
    destroy: () => {
      open = false;
      trap.detach();
    },
    handleKeydown: (e: KeyboardEvent): boolean => {
      if (!open) return false;
      if (!api.isCapturing()) {
        // Escape with nothing being captured closes the screen, which is what every dialog in the engine
        // does and the first thing a child will try.
        if (e.code !== 'Escape') return false;
        e.preventDefault();
        close();
        return true;
      }
      const consumed = api.handleCaptureKeydown(e);
      if (consumed) refresh(); // PATH 2.
      return consumed;
    },
  };
}
