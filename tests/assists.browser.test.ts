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

// ========================= AND THE CHARGE, IN THE MATCH RATHER THAN IN A MODULE =========================
// Parity item six is that a shot CARRIES while the button is held and fires on release. `input/charge` is
// gated hard on its own, the three routes are gated as choices in the assistances screen, and the power
// that reaches a Command is gated in the TURN panel - and none of those is this. None of them presses a
// key in a running match and asks whether the ball went further.
//
// ⚠️ THIS REPOSITORY HAS FOUND EIGHT MODULES THAT WERE RIGHT, GATED AND CONNECTED TO NOTHING, so the
// distance between "the charge computes a power" and "holding the key kicks it harder" is exactly the
// distance this file exists to cover.
//
// ⚠️ THE KEY IS READ FROM THE LIVE KEYMAP, never written down here. The first seat's table is the
// ENGINE'S, a child may have remapped it, and a gate that hard-codes a code is a gate that tests the
// keyboard this was written on.
describe('the charge, in a running match', () => {
  /** Put the ball at the feet of the body seat one is driving, and hand him possession. */
  function atHisFeet(b: NonNullable<typeof booted>) {
    const who = b.state.controlled[0];
    b.state.phase = 'live';
    b.state.players[who].p = { x: 45, y: 28 };
    b.state.ball.p = { x: 45, y: 28, z: 0 };
    b.state.ball.v = { x: 0, y: 0, z: 0 };
    b.state.possession.holder = who;
    b.state.possession.lastTouch = who;
    return who;
  }

  const speed = (b: NonNullable<typeof booted>) =>
    Math.sqrt(b.state.ball.v.x * b.state.ball.v.x + b.state.ball.v.y * b.state.ball.v.y);

  // ⚠️ IT DOES NOT BOOT. The first version of this called `bootar` inside itself, in a file whose
  //    `beforeEach` already boots - so it built a SECOND game over the same document and then set the ball
  //    at the feet of a player in a state nothing was driving. The tap measured nought, which read exactly
  //    like the missing wire this gate was written to find. The lesson is the one this repository keeps
  //    learning from the other side: a red is a claim about the test until the test has been eliminated.
  async function strike(held: number): Promise<number> {
    const code = booted!.keymap(0).action2?.[0];
    expect(code, 'the first seat has no strike key at all').toBeTruthy();

    atHisFeet(booted!);
    // The engine listens on the game region, not on the window.
    const region = document.querySelector('#game-region') ?? document.body;

    // ⚠️ THE PEAK, NOT THE SPEED WHEN THE DUST SETTLES. A long hold fires ITSELF partway through - the
    //    charge has a ceiling, because WCAG 2.1.2 forbids an accessible input that can be held for ever -
    //    so by the time the key comes up the ball has already been struck, has travelled, and has been
    //    collected by somebody, which reads as nought. This repository has made the same mistake from the
    //    other side: a shot counter that measured any velocity change counted the ball LANDING as a shot.
    let peak = 0;
    const watch = window.setInterval(() => {
      const s = speed(booted!);
      if (s > peak) peak = s;
    }, 8);
    region.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    await new Promise((r) => setTimeout(r, held));
    region.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
    await new Promise((r) => setTimeout(r, 150));
    window.clearInterval(watch);
    return peak;
  }

  // ⚠️ THE ASSERTION THAT PROTECTS A CHILD, and it is the first one in `input/charge` too. If a tap
  //    produces nothing, the child who cannot hold a key down receives a pass that does not move and
  //    concludes the game is broken. `minPower` is why that cannot happen, and this asks it of the match.
  //
  //    ⚠️ A TAP IS FORTY MILLISECONDS AND NOT NOUGHT, which is a fact about POLLING rather than about
  //    the charge. The keyboard is sampled once a frame, so a keydown and keyup dispatched in the same
  //    task land inside one frame and the key is never seen pressed at all. Nought milliseconds is not a
  //    press a person can make; the shortest one that exists is longer than a frame.
  it('[Right] a tap still strikes the ball, because a child who cannot hold must still play', async () => {
    booted = bootar(document, window);
    await new Promise((r) => setTimeout(r, 300));

    expect(await strike(40), 'a tap did nothing at all').toBeGreaterThan(0);
  });

  // ⚠️ AND "HOLDING IT LONGER SENDS IT HARDER" IS NOT GATED HERE, DELIBERATELY. It was written, and it
  //    was a COIN: two strikes in one match, tap then hold, said the hold was weaker; the same two with
  //    the order swapped passed. The first strike of a test gets a still world and the second inherits
  //    twenty-one bodies that have already run at the ball, so the reading is about the ORDER and not
  //    about the charge. A gate that passes because of the sequence it is written in is worse than no
  //    gate, because it reports a green about something it never measured.
  //
  //    ⚠️ WHAT ACTUALLY HOLDS THE CLAIM: `tests/charge` gates that power never falls as the hold grows,
  //    that every one of the five steps is reachable, and that a charge held past its window fires itself
  //    rather than trapping the player; `tests/turn-panel` gates the power arriving in a Command. What is
  //    missing is only the last centimetre - a live match measuring two holds fairly - and doing it
  //    honestly needs a fresh world per strike, not two strikes in one.
});
