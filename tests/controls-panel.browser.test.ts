// SPDX-License-Identifier: AGPL-3.0-or-later
// THE REMAP SCREEN, WHICH THE ENGINE HAS AND THIS GAME HAD NEVER OPENED.
//
// ========================= "IT COMES FREE FROM THE ENGINE" WAS HALF TRUE =========================
// `ui/settings-controls` is real, it is built for injection, and it says so in its own header. What it is
// wired to by default is `input/keyboard.ts`'s `kb`, whose schemes carry the platformer's EIGHT positions
// - so a game with fourteen gets a screen that can reach four of the things it does, editing a table its
// own sampler does not read. Every port that matters is injectable, so this game supplies its own map,
// its own store and its own words, and the screen edits the keyboard the game actually uses.
//
// Two things this file exists to hold down, and neither is visible from inside the engine:
//
//  1. THE ACCESSIBLE NAME OF EVERY "CHANGE" BUTTON. The engine builds it from `ACT_LABEL`, a table of the
//     platformer's eight words - `act.run`, `act.jump`. Six of this game's positions are not in it at
//     all, and `t(undefined)` is not a word. The VISIBLE label was fixed by issue #106 and the aria-label
//     was not, and an aria-label OVERRIDES the visible text: a blind child hears "act.run" or nothing,
//     while a sighted one reads "Sprint". That is worse than having no aria-label at all.
//  2. THAT REMAPPING CHANGES THE GAME. The screen can be perfect and the key can go nowhere.
import { beforeEach, describe, expect, it } from 'vitest';
import { bootar } from '../app/js/boot/main.ts';
import { keymapKeyFor } from '../app/js/input/keymap.ts';

const SHELL_SRC = await import('./boot.browser.test.ts?raw');

/** The same markup the other browser tests stand in for - sliced out rather than copied a third time. */
const SHELL = (() => {
  const src = SHELL_SRC.default;
  const from = src.indexOf('const SHELL = `') + 'const SHELL = `'.length;
  return src.slice(from, src.indexOf('`;', from));
})();

let booted: ReturnType<typeof bootar> = null;

beforeEach(() => {
  booted?.stop();
  booted = null;
  forgetKeyboards();
  document.body.innerHTML = SHELL;
});

/**
 * Forget every stored keyboard before each test.
 *
 * ⚠️ THE PERSISTENCE IS REAL, AND IT MADE THESE TESTS TALK TO EACH OTHER. One case remapped the second
 * seat's jockey to `N`; the next case, in a fresh boot, tried to put `N` on the FIRST seat and the
 * engine's guard correctly refused it - as a key the other child already owned. The failure appeared in
 * the reset case, three assertions away from the cause, and looked like the reset restoring the wrong
 * keyboard. A stored keyboard outlives a boot on purpose; it must not outlive a test.
 */
function forgetKeyboards(): void {
  for (const seats of [1, 2] as const) {
    for (const seat of [0, 1]) localStorage.removeItem(keymapKeyFor(seat, seats));
  }
}


const open = (): HTMLElement => {
  booted = bootar(document, window);
  (document.querySelector('#open-controls') as HTMLButtonElement).click();
  return document.querySelector('#controls-panel') as HTMLElement;
};

const rows = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('#ctrl-list .ctrl-row')];
const changeButtons = (): HTMLButtonElement[] =>
  [...document.querySelectorAll<HTMLButtonElement>('#ctrl-list button[data-act]')];

/** What a screen reader would announce for `el`: the aria-label wins over the text if there is one. */
const accessibleName = (el: HTMLElement): string => el.getAttribute('aria-label') ?? el.textContent ?? '';

describe('opening the screen', () => {
  it('[Interface] there is a way in, and it is a labelled control rather than a hidden key', () => {
    booted = bootar(document, window);
    const opener = document.querySelector('#open-controls') as HTMLButtonElement;

    expect(opener).not.toBeNull();
    expect(accessibleName(opener).trim().length).toBeGreaterThan(0);
    expect((document.querySelector('#controls-panel') as HTMLElement).hidden).toBe(true);
  });

  it('[Right] it opens, and it lists every world position this game has', () => {
    const panel = open();

    expect(panel.hidden).toBe(false);
    // Twelve verbs about the world. `start` and `select` are session functions ADR-0085 keeps out of a
    // game's vocabulary, so they are not this screen's to rename.
    expect(rows()).toHaveLength(12);
  });

  it('[Interface] and the way out takes focus, so nobody is trapped in a dialog they opened', () => {
    open();

    expect(document.activeElement).toBe(document.querySelector('#ctrl-close'));
  });

  it('[Right] closing gives focus back to the control that opened it', () => {
    open();

    (document.querySelector('#ctrl-close') as HTMLButtonElement).click();

    expect((document.querySelector('#controls-panel') as HTMLElement).hidden).toBe(true);
    expect(document.activeElement).toBe(document.querySelector('#open-controls'));
  });
});

describe('what a screen reader hears', () => {
  // ⚠️ THE DEFECT THIS GATE EXISTS FOR. `ACT_LABEL` inside the engine maps only the platformer's eight
  //    positions; `ACT_LABEL['leftShoulder']` is `undefined`, and `t(undefined)` is not a word. Without
  //    the repair, half these buttons announce nothing and the other half announce "act.run".
  it('[Right] every Change button says WHICH control it changes, in this game words', () => {
    open();
    const buttons = changeButtons();

    expect(buttons.length).toBe(12);
    for (const b of buttons) {
      const name = accessibleName(b);
      expect(name, b.dataset.act).not.toContain('undefined');
      // A raw dictionary key on the screen is `t()` falling back, which is the silent failure mode the
      // i18n gate exists for - here it would reach only the child who cannot see the visible label.
      expect(name, b.dataset.act).not.toMatch(/act\./);
      expect(name.trim().length, b.dataset.act).toBeGreaterThan(0);
    }
  });

  it('[Right] and it is the word for THAT position, not the same word twelve times', () => {
    open();
    const jockey = changeButtons().find((b) => b.dataset.act === 'leftShoulder') as HTMLButtonElement;
    const strike = changeButtons().find((b) => b.dataset.act === 'action2') as HTMLButtonElement;

    expect(accessibleName(jockey)).not.toBe(accessibleName(strike));
    expect(accessibleName(jockey)).toContain('Conter');
  });

  it('[Right] the visible row names the control in this game words too', () => {
    open();

    const listed = document.querySelector('#ctrl-list')?.textContent ?? '';

    expect(listed).toContain('Conter');
    expect(listed).toContain('Chutar');
    // A raw dictionary key on the screen means `t()` fell back, which is the silent failure the i18n gate
    // exists for - and it would arrive here through the engine's table rather than through our own dicts.
    expect(listed).not.toMatch(/act\./);
  });
});

describe('changing a key', () => {
  const remap = (act: string, code: string): void => {
    const button = changeButtons().find((b) => b.dataset.act === act) as HTMLButtonElement;
    button.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
  };

  it('[Right] the new key reaches the game, not only the screen', () => {
    open();

    remap('leftShoulder', 'KeyZ');

    expect(document.querySelector('#ctrl-list')?.textContent).toContain('Z');
    expect(booted!.keymap().leftShoulder).toEqual(['KeyZ']);
  });

  // ⚠️ THE ENGINE'S PANEL DOES NOT DO THIS. It writes `mapRef[action] = [code]` and asks only whether
  //    ANOTHER PLAYER owns the code - which in a one-player game can never be true. A child who moves `W`
  //    onto jockey would keep moving up with it, and hold both at once for the rest of the match.
  it('[Right] and the control that had that key loses it', () => {
    open();

    remap('leftShoulder', 'KeyW');

    expect(booted!.keymap().up).not.toContain('KeyW');
  });

  it('[Zero] pressing Escape mid-capture changes nothing', () => {
    open();
    const before = [...booted!.keymap().leftShoulder];

    remap('leftShoulder', 'Escape');

    expect(booted!.keymap().leftShoulder).toEqual(before);
  });

  it('[Right] restoring the defaults puts the keyboard back where it started', () => {
    open();
    remap('leftShoulder', 'KeyZ');

    (document.querySelector('#ctrl-reset') as HTMLButtonElement).click();

    expect(booted!.keymap().leftShoulder).not.toContain('KeyZ');
    expect(booted!.keymap().up).toContain('KeyW');
  });

  it('[Interface] and the rebuilt rows are still announced properly - the repair is not one-shot', () => {
    open();

    remap('action2', 'KeyZ');

    for (const b of changeButtons()) {
      expect(accessibleName(b), b.dataset.act).not.toContain('undefined');
      expect(accessibleName(b), b.dataset.act).not.toMatch(/act\./);
    }
  });
});

// ========================= THE CHROME THE ENGINE WRITES IN ONE LANGUAGE =========================
// `settings-controls` builds two pieces of visible text from Portuguese literals inside the engine: the
// "press a key" prompt on the button being changed, and a sentence in `#ctrl-players` about which
// player's controls are being edited. Pillar 3 has no exception for the screen a child opens BECAUSE she
// cannot use the default controls - it is the one place a language she does not read is most expensive.
describe('the chrome around the rows', () => {
  it('[Right] the prompt while a key is being captured comes from the dictionary', () => {
    open();
    const button = changeButtons().find((b) => b.dataset.act === 'action2') as HTMLButtonElement;

    button.click();

    // The engine writes its own literal into this element first; the last writer is what a child reads.
    expect(button.textContent).toBe('Aperte uma tecla...');
  });

  it('[Zero] and the untranslated sentence about players is not on the screen at all', () => {
    open();
    const tabs = document.querySelector('#ctrl-players') as HTMLElement;

    expect(tabs.hidden).toBe(true);
    expect(tabs.textContent).toBe('');
  });
});

// ========================= TWO THINGS THE SCREEN GOT WRONG WHEN IT FIRST OPENED =========================
// Both were found by looking at it rather than by reasoning about it, which is why step 5 of the plan puts
// the ugly renderer in front of a human before the AI is written.
describe('reading the rows', () => {
  const rowText = (act: string): string => {
    const button = changeButtons().find((b) => b.dataset.act === act) as HTMLButtonElement;
    return button.closest('.ctrl-row')?.textContent ?? '';
  };

  // ⚠️ THE ENGINE'S `keyName` STRIPS `Arrow` AND `Key` AND STOPS. This game's two shoulders default to
  //    `Digit7` and `Digit8`, so the screen offered a child the string "Digit7" for the key that says 7.
  it('[Right] a key is called what it says on the keyboard', () => {
    open();

    expect(rowText('leftShoulder')).toContain('7');
    expect(rowText('leftShoulder')).not.toContain('Digit');
    expect(document.querySelector('#ctrl-list')?.textContent).not.toContain('Digit');
  });

  it('[Right] and the four arrows are four different arrows, not the same sideways one', () => {
    open();
    const listed = document.querySelector('#ctrl-list')?.textContent ?? '';

    // The engine writes all four as the horizontal double arrow, on the screen whose entire job is saying
    // which key goes which way.
    for (const glyph of ['↑', '↓', '←', '→']) expect(listed, glyph).toContain(glyph);
  });

  // ⚠️ SPRINT HAS TWO SLOTS BY DESIGN (ADR-0079), and the preset gives them the same word with different
  //    HINTS - which this screen does not render. So a sighted child met two rows both reading "Correr:"
  //    with no way to tell which was which. A screen labels SLOTS, not verbs.
  it('[Zero] no two rows carry the same name', () => {
    open();
    const names = changeButtons().map((b) => b.closest('.ctrl-row')?.querySelector('.ctrl-nome')?.textContent ?? '');

    expect(new Set(names).size, names.join(' | ')).toBe(names.length);
  });
});

// ========================= `aria-modal` IS A PROMISE, AND IT HAS TO BE KEPT =========================
// The screen declares `role="dialog" aria-modal="true"`, which tells a screen reader that everything
// behind it is unavailable. If Tab still walks out into the pitch and the clock selector, the promise is
// a lie in the direction that hurts: the reader hides the page it can still be taken to.
describe('the focus trap', () => {
  // ⚠️ THE FIRST VERSION OF THESE THREE PASSED WITH NO TRAP AT ALL, and the reason is worth keeping: a
  //    synthetic `KeyboardEvent` does NOT move focus - the browser's own tabbing is a default action that
  //    only a real key press produces. So "focus is still inside the dialog" was true because focus had
  //    not moved anywhere, and the assertion measured nothing. What a trap actually DOES is swallow the
  //    event and put focus somewhere specific, and that is what these ask.
  const tab = (shift = false): boolean => {
    const e = new KeyboardEvent('keydown', {
      key: 'Tab',
      code: 'Tab',
      shiftKey: shift,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(e);
    return e.defaultPrevented;
  };

  const focusables = (): HTMLElement[] =>
    [...document.querySelectorAll<HTMLElement>('#controls-panel button')];

  it('[Right] Tab from the last control inside is taken, and lands on the first', () => {
    open();
    const inside = focusables();
    inside[inside.length - 1].focus();

    const swallowed = tab();

    expect(swallowed, 'the trap consumed the Tab').toBe(true);
    expect(document.activeElement).toBe(inside[0]);
  });

  it('[Right] and Shift+Tab from the first lands on the last', () => {
    open();
    const inside = focusables();
    inside[0].focus();

    const swallowed = tab(true);

    expect(swallowed, 'the trap consumed the Tab').toBe(true);
    expect(document.activeElement).toBe(inside[inside.length - 1]);
  });

  it('[Boundary] Tab in the MIDDLE is left alone, so the browser walks the rows normally', () => {
    open();
    focusables()[1].focus();

    expect(tab()).toBe(false);
  });

  it('[Zero] with the screen closed, Tab belongs to the page again', () => {
    booted = bootar(document, window);
    (document.querySelector('#open-controls') as HTMLButtonElement).focus();

    expect(tab()).toBe(false);
  });
});

// ⚠️ THE LEAK, WITH ITS OWN GATE, because it is invisible until a second boot happens and then it is a
// dialog nobody can see holding the Tab key. It was found by three tests passing alone and one of them
// failing in the file - the trap from the previous test was still on the document, answering for a panel
// that had been replaced by `document.body.innerHTML`.
describe('stopping the game', () => {
  // ⚠️ ASSERTED ON `removeEventListener` BECAUSE THERE IS NO OTHER OBSERVABLE, and the first version of
  //    this test proved the point by being useless: it dispatched a Tab after `stop()` and checked that
  //    nothing swallowed it - which stayed green with the detach deleted, because `destroy()` also drops
  //    an `open` flag the trap reads first. It measured the flag and reported on the leak.
  //
  //    The leak is real and was met: three focus-trap tests passed alone and one failed inside the file,
  //    because the trap from the previous test was still on the document answering for a panel that
  //    `document.body.innerHTML` had already replaced. Deregistration IS the behaviour here, so the call
  //    is the thing to assert.
  it('[Zero] takes both of its document listeners off with it', () => {
    const removed: boolean[] = [];
    const real = document.removeEventListener.bind(document);
    document.removeEventListener = ((type: string, fn: EventListener, opts?: boolean) => {
      if (type === 'keydown') removed.push(opts === true);
      real(type, fn, opts);
    }) as typeof document.removeEventListener;

    try {
      booted = bootar(document, window);
      (document.querySelector('#open-controls') as HTMLButtonElement).click();

      booted!.stop();
      booted = null;

      // The focus trap and the key router: both on the document, both in capture, both taken off.
      expect(removed.filter((capture) => capture).length).toBeGreaterThanOrEqual(2);
    } finally {
      document.removeEventListener = real as typeof document.removeEventListener;
    }
  });
});

// ========================= THE SCREEN HAS TO REACH BOTH KEYBOARDS =========================
// The second seat shipped with a keyboard of its own and no way to change it, which is the wrong half to
// leave out: the child most likely to need a remap is the one who was handed the keys that were left
// over. The engine's panel already takes a player index everywhere - `render(selPlayer)` and
// `kbFor(playerIndex)` - so what was missing was this game telling it there is more than one.
//
// ⚠️ AND IT MAKES THE ENGINE'S OWN GUARD WORK FOR THE FIRST TIME. `keyUsedByOther` excludes the scheme
// being edited by reference and compares against the others; with one seat there ARE no others, so it
// could never fire (finding 8). With two, a key the other child owns is refused by the engine itself.
describe('two keyboards on one screen', () => {
  const seats = (value: string): void => {
    const select = document.querySelector('#seats') as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('change'));
  };
  const tabs = (): HTMLButtonElement[] =>
    [...document.querySelectorAll<HTMLButtonElement>('#ctrl-players button[data-seat]')];
  const remapHere = (act: string, code: string): void => {
    const button = changeButtons().find((b) => b.dataset.act === act) as HTMLButtonElement;
    button.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
  };

  it('[Zero] with one child there is nothing to choose between, so no chooser', () => {
    open();

    expect(tabs()).toHaveLength(0);
    expect((document.querySelector('#ctrl-players') as HTMLElement).hidden).toBe(true);
  });

  it('[Interface] with two there are two, and each says whose keyboard it is', () => {
    booted = bootar(document, window);
    seats('coop');
    (document.querySelector('#open-controls') as HTMLButtonElement).click();

    expect(tabs()).toHaveLength(2);
    for (const tab of tabs()) expect(accessibleName(tab).trim().length).toBeGreaterThan(0);
    expect(accessibleName(tabs()[0])).not.toBe(accessibleName(tabs()[1]));
  });

  it('[Interface] and which one is being edited is announced, not only coloured', () => {
    booted = bootar(document, window);
    seats('coop');
    (document.querySelector('#open-controls') as HTMLButtonElement).click();

    expect(tabs()[0].getAttribute('aria-pressed')).toBe('true');
    expect(tabs()[1].getAttribute('aria-pressed')).toBe('false');
  });

  // ⚠️ WHAT THIS MEASURES IS WHAT SHE READS. The visible key names are rewritten by this game after the
  //    engine renders - `keyName` leaves `Digit7` raw and draws all four arrows as one sideways glyph -
  //    so this stays green even if the engine were handed the wrong map. That the WRITE lands on her
  //    keyboard rather than his is the next case, and it is the one that falls over when the seat index
  //    is dropped.
  it('[Right] choosing the second child shows the second keyboard', () => {
    booted = bootar(document, window);
    seats('coop');
    (document.querySelector('#open-controls') as HTMLButtonElement).click();

    tabs()[1].click();

    const listed = document.querySelector('#ctrl-list')?.textContent ?? '';
    // The second seat moves with the arrows and the first one does not, which is the whole difference.
    expect(listed).toContain('↑');
    expect(listed).not.toContain('W');
    expect(tabs()[1].getAttribute('aria-pressed')).toBe('true');
  });

  it('[Right] and a key changed there changes HER keyboard, not his', () => {
    booted = bootar(document, window);
    seats('coop');
    (document.querySelector('#open-controls') as HTMLButtonElement).click();
    tabs()[1].click();
    const hisJockey = [...booted!.keymap(0).leftShoulder];

    remapHere('leftShoulder', 'KeyN');

    expect(booted!.keymap(1).leftShoulder).toEqual(['KeyN']);
    expect(booted!.keymap(0).leftShoulder).toEqual(hisJockey);
  });

  // ⚠️ FINDING 8 OF THE AUDIT, WORKING AT LAST. With one seat the engine's guard had nothing to compare
  //    against; with two it refuses a key the other child owns - and the refusal has to LEAVE THE OLD KEY
  //    ALONE rather than half-applying, because a child who is told "taken" and loses her key anyway has
  //    been punished for asking.
  it('[Zero] a key the other child owns is refused, and hers is left as it was', () => {
    booted = bootar(document, window);
    seats('coop');
    (document.querySelector('#open-controls') as HTMLButtonElement).click();
    tabs()[1].click();
    const before = [...booted!.keymap(1).leftShoulder];

    remapHere('leftShoulder', 'KeyW'); // `W` is the first child's "move up".

    expect(booted!.keymap(1).leftShoulder).toEqual(before);
    expect(booted!.keymap(0).up).toContain('KeyW');
  });

  it('[Zero] and if the friend leaves while the screen is open, it falls back to the first keyboard', () => {
    booted = bootar(document, window);
    seats('coop');
    (document.querySelector('#open-controls') as HTMLButtonElement).click();
    tabs()[1].click();

    seats('solo');
    // Anything that redraws: a child changing a key is the ordinary way this happens.
    remapHere('leftShoulder', 'KeyN');

    expect(booted!.keymap(0).leftShoulder, 'she was still editing a keyboard nobody uses').toEqual(['KeyN']);
    expect(tabs()).toHaveLength(0);
  });

  it('[Right] restoring the defaults restores only the keyboard being edited', () => {
    booted = bootar(document, window);
    seats('coop');
    (document.querySelector('#open-controls') as HTMLButtonElement).click();
    remapHere('leftShoulder', 'KeyN');
    tabs()[1].click();
    remapHere('leftShoulder', 'KeyM');

    (document.querySelector('#ctrl-reset') as HTMLButtonElement).click();

    expect(booted!.keymap(1).leftShoulder, 'hers was not restored').not.toEqual(['KeyM']);
    expect(booted!.keymap(0).leftShoulder, 'his was restored as well').toEqual(['KeyN']);
  });
});
