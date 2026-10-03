// SPDX-License-Identifier: AGPL-3.0-or-later
// LIBRAS: THE MODE IS THE CHILD'S CHOICE, AND THE WIDGET IS ONE POSSIBLE TRANSLATOR.
//
// ========================= WHAT I GOT WRONG BEFORE WRITING THIS =========================
// I listed Libras as blocked, and one of my three reasons was that "VLibras does not do what the Dev
// asked for". That sentence is a note in the engine module's own header, about a requirement I never
// heard him state, and I repeated it as a finding of my own to refuse work. He said the widget works.
//
// Reading the module rather than its header settles the design: `toggleLibras` flips OUR state, persists
// it, and then makes a BEST-EFFORT attempt to wake the widget - with its own comment saying that failing
// there must not stop the mode turning on, because *the state is the person's choice and the widget is
// only one possible translator for her*.
//
// So everything below is testable with no network at all, which is the whole reason it can be gated. The
// costs that remain are real and are the Dev's to weigh, not mine to refuse with: a cross-origin widget
// does not survive the service worker, and the axe gate stops being "not one exclusion".
import { beforeEach, describe, expect, it } from 'vitest';
import { bootar } from '../app/js/boot/main.ts';
import { msToTicks, ticks } from './helpers/ticks.ts';

const SHELL_SRC = await import('./boot.browser.test.ts?raw');
const SHELL = (() => {
  const src = SHELL_SRC.default;
  const from = src.indexOf('const SHELL = `') + 'const SHELL = `'.length;
  return src.slice(from, src.indexOf('`;', from));
})();

let booted: ReturnType<typeof bootar> = null;

beforeEach(() => {
  booted?.stop();
  booted = null;
  // ⚠️ NORMALISED THROUGH THE TOGGLE, NOT THROUGH STORAGE, and the first version of this used storage and
  //    leaked state between cases. The engine's `librasOpen` is a module-level `let` read ONCE at import
  //    (`store.getBool('incl_libras', false)`), so clearing the key afterwards changes what a future
  //    import would see and nothing about the module that is already loaded. The only handle on it is the
  //    toggle itself.
  if (booted?.motor.deafMode.isOn()) booted.motor.deafMode.toggle();
  document.body.innerHTML = SHELL;
});

const toggle = (): HTMLButtonElement => document.querySelector('#open-libras') as HTMLButtonElement;

async function waitFor(what: () => boolean, why: string, timeoutMs = 6000): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (what()) return;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error(`timed out waiting for: ${why}`);
}

describe('turning the mode on', () => {
  it('[Interface] there is a labelled control for it, and it says whether it is on', () => {
    booted = bootar(document, window);

    expect(toggle()).not.toBeNull();
    expect(toggle().textContent?.trim().length).toBeGreaterThan(0);
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
  });

  // ⚠️ `aria-pressed` AND NOT A COLOUR, for the same reason the keyboard chooser needed it: whether the
  //    mode is on is the single fact this control carries, and a child who cannot see a highlight would
  //    otherwise have to guess.
  it('[Right] pressing it turns the mode on, and the control says so', () => {
    booted = bootar(document, window);

    toggle().click();

    expect(booted!.motor.deafMode.isOn()).toBe(true);
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
  });

  it('[Right] and pressing it again turns it off - it is a real toggle', () => {
    booted = bootar(document, window);

    toggle().click();
    toggle().click();

    expect(booted!.motor.deafMode.isOn()).toBe(false);
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
  });

  // ⚠️ THE MODE IS THE PERSON'S CHOICE AND NOT AN INFERENCE ABOUT A WIDGET. The engine's own module header
  //    records that reading it from the widget's GEOMETRY answered "open" for ever once the widget moved
  //    itself out of the game's markup - so the layout reserved 380px for an interpreter that was not
  //    there, and the toggle could not turn it off. There is no widget in this test at all, and the mode
  //    still works.
  it('[Zero] with no widget present at all, the mode still turns on', () => {
    booted = bootar(document, window);
    expect(document.querySelector('[vw]')).toBeNull();

    toggle().click();

    expect(booted!.motor.deafMode.isOn()).toBe(true);
  });

  it('[Right] the choice survives a reboot, because it is about a body and not a session', () => {
    booted = bootar(document, window);
    toggle().click();

    booted!.stop();
    document.body.innerHTML = SHELL;
    booted = bootar(document, window);

    expect(toggle().getAttribute('aria-pressed')).toBe('true');
  });
});

describe('what it is given to translate', () => {
  const scoreAGoal = (): void => {
    booted!.state.phase = 'live';
    booted!.state.ball.p = { x: 91, y: 28, z: 0 };
  };

  // The engine's `vlibrasSay` queues one sentence and drops it when the mode is off, so what this can
  // honestly assert is that the game OFFERS it - the same sentence the screen reader and the caption get.
  // ⚠️ THE ALERT REGION IS CAPTURED AS IT HAPPENS, NOT READ AFTERWARDS. `srAlert` clears `#sr-alert` again
  //    a moment later - it has to, or the same sentence twice would be announced once - so comparing the
  //    signed sentence against whatever the DOM says by the time the assertion runs is a race, and it lost
  //    it: the sentence was offered correctly and the region already read empty.
  it('[Right] the narration is offered to the interpreter, not only to the reader', async () => {
    booted = bootar(document, window);
    toggle().click();
    const said: string[] = [];
    const alerts: string[] = [];
    booted!.onSigned((text) => said.push(text));
    new MutationObserver(() => {
      const now = document.querySelector('#sr-alert')?.textContent ?? '';
      if (now !== '') alerts.push(now);
    }).observe(document.querySelector('#sr-alert') as HTMLElement, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    scoreAGoal();
    await waitFor(() => said.length > 0 && alerts.length > 0, 'the goal to reach both channels');

    // ONE sentence, three channels: the reader, the caption line, and the interpreter.
    expect(said[0]).toBe(alerts[0]);
    expect(said[0].length).toBeGreaterThan(0);
    expect(said[0]).not.toMatch(/^say\./);
  });

  it('[Zero] and nothing is offered while the mode is off', async () => {
    booted = bootar(document, window);
    const said: string[] = [];
    booted!.onSigned((text) => said.push(text));

    scoreAGoal();
    await waitFor(() => (document.querySelector('#sr-alert')?.textContent ?? '') !== '', 'the goal');
    await ticks(booted, msToTicks(200));

    expect(said).toEqual([]);
  });

  it('[Right] the control names the mode in the child language', () => {
    booted = bootar(document, window);

    expect(toggle().textContent).toBe(booted!.motor.t('libras.open'));
  });
});
