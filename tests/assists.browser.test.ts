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
  // ⚠️ AND IT EMPTIES THE PITCH AROUND HIM, which is what makes two strikes comparable at all. The
  //    first version left the other twenty-one where they were, so the first strike of a test got a still
  //    world and the second inherited bodies that had already run at the ball: tap-then-hold said the hold
  //    was WEAKER and hold-then-tap passed, on the same code. The reading was about the order.
  //
  //    Parking them at the far corner is not pretending the match is empty - it is removing the one thing
  //    that differs between the two measurements, so that what is left is the charge.
  function atHisFeet(b: NonNullable<typeof booted>) {
    const who = b.state.controlled[0];
    b.state.phase = 'live';
    for (let i = 0; i < b.state.players.length; i++) {
      if (i === who) continue;
      b.state.players[i].p = { x: 2, y: 2 };
      b.state.players[i].v = { x: 0, y: 0 };
    }
    b.state.players[who].p = { x: 45, y: 28 };
    b.state.players[who].v = { x: 0, y: 0 };
    b.state.ball.p = { x: 45, y: 28, z: 0 };
    b.state.ball.v = { x: 0, y: 0, z: 0 };
    b.state.possession.holder = who;
    b.state.possession.lastTouch = who;
    return who;
  }

  /** Wait until the match loop has actually run a tick, rather than for a fixed number of milliseconds. */
  async function settled(): Promise<void> {
    const until = Date.now() + 3000;
    while (Date.now() < until) {
      if ((booted?.state.tick ?? 0) > 2) return;
      await new Promise((r) => setTimeout(r, 16));
    }
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
    // ⚠️ AND THE HOLD ITSELF IS COUNTED IN TICKS, which is the half this file had not fixed. The note
    //    below already records that a fixed sleep AFTER the key comes up failed inside the whole suite;
    //    the hold in front of it was the same bet with the same odds, and it is the one that decides the
    //    POWER. A charge accumulates once a frame, so holding for a number of milliseconds asks for a
    //    number of frames the machine may not deliver: measured, a 350 ms window contains 22 ticks alone
    //    and 6 under the browser project. That is what the 15.04-against-15.33 flake recorded here was.
    await ticks(booted, msToTicks(held));
    region.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));

    // ⚠️ IT WAITS FOR THE BALL, NOT FOR THE CLOCK. A fixed sleep after the key comes up passed alone and
    //    FAILED inside the whole suite, where the browser project runs under load and a hundred and fifty
    //    milliseconds is not reliably a frame. A gate that turns on how busy the machine is reports a red
    //    about the machine, so this waits until the ball has actually been struck, with a deadline.
    const until = Date.now() + 2000;
    while (peak === 0 && Date.now() < until) await new Promise((r) => setTimeout(r, 16));
    await new Promise((r) => setTimeout(r, 120));
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
    await settled();

    expect(await strike(40), 'a tap did nothing at all').toBeGreaterThan(0);
  });


  // ⚠️ AND SHE IS TOLD HOW FAR IT IS CHARGED WHILE SHE HOLDS IT. The plan asks for a countable power -
  //    "three of five" - with a tone per step, because a bar does not serve a child who cannot see one.
  //    The step existed, was gated hard and offered in three routes, and appeared on screen in exactly
  //    ONE place: the turn panel, which is the mode where she is not holding a key down at all.
  //
  //    ⚠️ SO THE MODE THAT NEEDED THE FEEDBACK WAS THE ONE WITHOUT IT, and this drives a real key in a
  //    real match rather than asking `chargeLine` what it returns - `tests/mirror` does that.
  it('[Right] the page counts the power up while the key is held', async () => {
    booted = bootar(document, window);
    await settled();

    const code = booted!.keymap(0).action2?.[0];
    atHisFeet(booted!);
    const region = document.querySelector('#game-region') ?? document.body;
    region.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));

    const until = Date.now() + 2000;
    let said = '';
    while (Date.now() < until && said === '') {
      await new Promise((r) => setTimeout(r, 16));
      said = document.querySelector('#m-charge')?.textContent ?? '';
    }
    region.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));

    expect(said, 'she held the key and the page said nothing').not.toBe('');
    expect(said, `no count in "${said}"`).toMatch(/\d/);
  });

  // ⚠️ THE HALF THAT WAS A COIN UNTIL THE PITCH WAS EMPTIED. Written first with the other twenty-one
  //    left where they stood, this said a hold was WEAKER than a tap - and passed when the two were
  //    swapped round, on identical code. A gate that turns on the order it is written in reports a green
  //    about something it never measured, which is worse than having no gate at all.
  //
  //    ⚠️ SO IT IS ASKED IN BOTH ORDERS, and that is the part that cannot be faked. If the world still
  //    leaked between the two strikes, one of these two would fail.
  it('[Right] and holding it longer sends the ball harder, whichever is measured first', async () => {
    booted = bootar(document, window);
    await settled();

    const tapFirst = await strike(40);
    const heldSecond = await strike(400);
    const heldFirst = await strike(400);
    const tapSecond = await strike(40);

    expect(heldSecond, `hold ${heldSecond} was no harder than the tap ${tapFirst} before it`).toBeGreaterThan(
      tapFirst,
    );
    expect(heldFirst, `hold ${heldFirst} was no harder than the tap ${tapSecond} after it`).toBeGreaterThan(
      tapSecond,
    );
  });
});
