// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ADJUSTMENTS REACHING THE GAME, WHICH IS THE HALF THAT WAS MISSING.
//
// ========================= THE SHAPE OF THIS DEFECT, THREE TIMES OVER =========================
// The charge routes, the assisted pace and the length of a half were all implemented, all gated, and all
// unreachable: `createSampler` took a mode nobody passed, `createAssistedDriver` took a tempo hard-coded
// at 0.5, and the profile carried a period frozen at ten minutes. Every unit test was green and the
// README listed the stepped charge - the only route with no timing in it - as done.
//
// It is the same failure this repository has now met four times: a module that is right, a test that is
// right, and no wire between them. What catches it is a gate that asserts on the RUNNING GAME rather than
// on the module, which is why these live here.
import { beforeEach, describe, expect, it } from 'vitest';
import { bootar } from '../app/js/boot/main.ts';

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
  document.body.innerHTML = SHELL;
});

const open = (): HTMLElement => {
  booted = bootar(document, window);
  (document.querySelector('#open-assists') as HTMLButtonElement).click();
  return document.querySelector('#assist-panel') as HTMLElement;
};

const choose = (id: string, value: string): void => {
  const select = document.querySelector(`#${id}`) as HTMLSelectElement;
  select.value = value;
  select.dispatchEvent(new Event('change'));
};

async function waitFor(what: () => boolean, why: string, timeoutMs = 6000): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (what()) return;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error(`timed out waiting for: ${why}`);
}

describe('the screen', () => {
  it('[Interface] opens from a labelled control and offers all three adjustments', () => {
    const panel = open();

    expect(panel.hidden).toBe(false);
    for (const id of ['assist-charge', 'assist-tempo', 'assist-period']) {
      const select = document.querySelector(`#${id}`) as HTMLSelectElement;
      expect(select, id).not.toBeNull();
      expect(select.options.length, id).toBeGreaterThan(1);
    }
  });

  it('[Right] every option is a word, not a key and not a bare number', () => {
    open();

    for (const id of ['assist-charge', 'assist-tempo', 'assist-period']) {
      for (const option of document.querySelectorAll<HTMLOptionElement>(`#${id} option`)) {
        expect(option.textContent, `${id}/${option.value}`).not.toMatch(/^assist\./);
        expect(option.textContent?.trim().length, `${id}/${option.value}`).toBeGreaterThan(1);
      }
    }
  });

  // ⚠️ THE THREE WORDS ARE NOT A CHOICE ON THEIR OWN. "Hold it", "press twice", "one press one step" name
  //    routes a child has never met; the sentence under them is what makes picking one possible.
  it('[Interface] and the chosen route is explained on the screen, not in a tooltip', () => {
    open();
    const hint = document.querySelector('#assist-charge-hint') as HTMLElement;
    const before = hint.textContent ?? '';

    choose('assist-charge', 'latch-stepped');

    expect(before.length).toBeGreaterThan(20);
    expect(hint.textContent).not.toBe(before);
    expect(hint.textContent?.length).toBeGreaterThan(20);
  });

  it('[Interface] the way out takes focus, and closing gives it back', () => {
    open();
    expect(document.activeElement).toBe(document.querySelector('#assist-close'));

    (document.querySelector('#assist-close') as HTMLButtonElement).click();

    expect((document.querySelector('#assist-panel') as HTMLElement).hidden).toBe(true);
    expect(document.activeElement).toBe(document.querySelector('#open-assists'));
  });

  it('[Right] Escape closes it, which is the first thing a child tries', () => {
    open();

    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true, cancelable: true }));

    expect((document.querySelector('#assist-panel') as HTMLElement).hidden).toBe(true);
  });
});

describe('a choice reaching the game', () => {
  it('[Right] the length of a half is what she chose, not ten minutes for ever', async () => {
    open();
    booted!.state.goals = [3, 0];

    choose('assist-period', '5');

    // The rules changed, so the match starts again under them rather than the running one having its
    // finish line moved - which would be the timing behaviour 2.2.1 forbids, arriving through the menu
    // that exists to satisfy it.
    expect(booted!.state.goals).toEqual([0, 0]);
    await waitFor(() => booted!.state.tick > 0, 'the match to be running again');
  });

  // ⚠️ THE FIRST VERSION OF THE NEXT TWO WAS VACUOUS, and it is the same trap as before. It let the match
  //    run for sixty ticks and checked half time had not arrived - which is true of a ten-minute half too,
  //    so it stayed green with the whole period wiring deleted. Sixty ticks is one second; a half is
  //    eighteen thousand.
  //
  //    Driving the clock TO THE BOUNDARY is what makes the two answers different: with a five-minute half
  //    the whistle goes, and with no clock it never does however far the tick is pushed.
  const FIVE_MINUTES = 5 * 60 * 60;

  it('[Right] a five-minute half actually ends after five minutes', async () => {
    open();
    choose('assist-period', '5');
    booted!.state.phase = 'live';
    booted!.state.tick = FIVE_MINUTES - 2;

    await waitFor(() => booted!.state.phase === 'halfTime', 'the half-time whistle');

    expect(booted!.state.phase).toBe('halfTime');
  });

  // ⚠️ NO CLOCK IS 2.2.1 BY REMOVAL, and it is a different thing from a very long half: a large number is
  //    still a limit and still runs out, on the child least able to judge how long she needs.
  it('[Right] and "no clock" never ends, however far the clock is pushed', async () => {
    open();
    choose('assist-period', 'none');
    booted!.state.phase = 'live';
    booted!.state.tick = FIVE_MINUTES * 4;

    await waitFor(() => booted!.state.tick > FIVE_MINUTES * 4 + 30, 'the match to run on past every half');

    expect(booted!.state.phase).not.toBe('halfTime');
    expect(booted!.state.phase).not.toBe('fullTime');
  });

  it('[Zero] and choosing an adjustment does not close the screen out from under her', () => {
    open();

    choose('assist-tempo', '1');

    expect((document.querySelector('#assist-panel') as HTMLElement).hidden).toBe(false);
    expect((document.querySelector('#assist-tempo') as HTMLSelectElement).value).toBe('1');
  });

  // ⚠️ REBUILDING THE SEATS REBUILDS THE SAMPLERS, and a rebuild that forgot the route would put a child
  //    who cannot time anything back on the route that is entirely timing - silently, when a friend sat
  //    down beside her.
  it('[Right] the charge route survives a friend sitting down', () => {
    open();
    choose('assist-charge', 'latch-stepped');

    const seats = document.querySelector('#seats') as HTMLSelectElement;
    seats.value = 'coop';
    seats.dispatchEvent(new Event('change'));
    (document.querySelector('#open-assists') as HTMLButtonElement).click();

    expect((document.querySelector('#assist-charge') as HTMLSelectElement).value).toBe('latch-stepped');
  });
});
