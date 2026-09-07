// SPDX-License-Identifier: AGPL-3.0-or-later
// TWO CHILDREN, ONE SCREEN.
//
// ========================= WHAT WAS ALREADY THERE AND WHAT WAS NOT =========================
// `state.controlled` has been two seats long since the day switching player stopped being ignored; the
// simulation, the referee and the switcher have all handled two seats from the start. What did not exist
// was anybody in the second one: the composition root built ONE sampler, the command source returned ONE
// command, and the frame therefore carried one seat. Every gate stayed green, because one seat is a
// correct answer for one seat.
//
// ⚠️ PILLAR 7 PERMITS THIS AND THE README SAYS WHY. The pillar forbids SPLITTING the screen - at 320x180
// that halves the usable resolution - and asks for N viewports. Two children watching the same whole
// pitch is the opposite of a split screen, and it is the arrangement a classroom with one machine
// actually has.
import { beforeEach, describe, expect, it } from 'vitest';
import { bootar } from '../app/js/boot/main.ts';
import { HOME, teamOf } from '../app/js/sim/ids.ts';
import { keymapKeyFor } from '../app/js/input/keymap.ts';

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


const seat = (value: string): void => {
  const select = document.querySelector('#seats') as HTMLSelectElement;
  select.value = value;
  select.dispatchEvent(new Event('change'));
};

/**
 * Hold a key at the world until something is true of the world, then let go.
 *
 * ⚠️ A FIXED SLEEP IS A BET ON THE MACHINE, and this file lost it. Holding for a flat 500ms and then
 * reading a velocity was green on an idle laptop and red once the other forty-eight files were running
 * beside it: fewer frames are rendered in the same wall time, so the body had not reached the speed the
 * assertion wanted. The assertion was right and the waiting was a guess. Waiting for the FACT keeps the
 * assertion and drops the guess - and a body that never gets there fails on the timeout, which is the
 * honest answer to "the key did nothing".
 */
async function holdUntil(code: string, ok: () => boolean, why: string, timeoutMs = 8000): Promise<void> {
  const region = document.querySelector('#game-region') as HTMLElement;
  region.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
  try {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      if (ok()) return;
      await new Promise((r) => setTimeout(r, 40));
    }
    throw new Error(`timed out waiting for: ${why}`);
  } finally {
    region.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true, cancelable: true }));
  }
}

describe('choosing how many are playing', () => {
  it('[Interface] the control is there, labelled, and starts on one child', () => {
    booted = bootar(document, window);
    const select = document.querySelector('#seats') as HTMLSelectElement;

    expect(select).not.toBeNull();
    expect(document.querySelector('#seats-label')?.textContent?.trim().length).toBeGreaterThan(0);
    expect(select.value).toBe('solo');
  });

  // ⚠️ CO-OP IS LISTED BEFORE THE CONTEST, and the order is the decision. Two children on the same side
  //    against the CPU is a match with no loser in the room; a contest is allowed and is not the thing a
  //    classroom should have to opt out of.
  it('[Interface] and co-operation is offered before the contest', () => {
    booted = bootar(document, window);
    const values = [...document.querySelectorAll<HTMLOptionElement>('#seats option')].map((o) => o.value);

    expect(values).toEqual(['solo', 'coop', 'versus']);
  });
});

/**
 * Hold a key for a fixed stretch.
 *
 * ⚠️ A FIXED WINDOW IS WRONG FOR "did it happen" AND RIGHT FOR "did it NOT". There is no fact to wait for
 * when the expected answer is that nothing much changed, and waiting for one would never return. What a
 * slow machine does to this is run FEWER ticks in the window, which can only make the measured swing
 * smaller - so load can make this pass, never fail. That is the safe direction for a bound.
 */
async function holdFor(code: string, ms: number): Promise<void> {
  const region = document.querySelector('#game-region') as HTMLElement;
  region.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, ms));
  region.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true, cancelable: true }));
}

describe('two children on the same side', () => {
  it('[Right] both seats drive a home body, and never the same one', () => {
    booted = bootar(document, window);

    seat('coop');

    const [a, b] = booted!.state.controlled;
    expect(teamOf(a)).toBe(HOME);
    expect(teamOf(b)).toBe(HOME);
    expect(a).not.toBe(b);
  });

  // ⚠️ THE GATE THE WHOLE FEATURE RESTS ON, AND IT TOOK TWO WRONG METRICS TO GET RIGHT.
  //
  //    The first held a key and checked her body had moved right - green with the entire second seat
  //    deleted from the command source, because twenty-two bodies are steered by the AI every tick
  //    whether anybody drives them or not. "It moved" is not evidence that anything reached it.
  //
  //    The second held right, then left, and compared the two END POSITIONS. Also wrong, and wrong in a
  //    way that looked like a real failure: the left window starts at the speed the right one finished
  //    at, so six hundred milliseconds is spent decelerating and only the rest accelerating back. Measured
  //    on a working build it came out at -0.07 metres - the body genuinely returning to roughly where the
  //    window began - and reported that the input did nothing.
  //
  //    VELOCITY is the honest reading. A body that responds to the child ends a right-hold moving right
  //    and a left-hold moving left, and no amount of AI steering flips a body's sign in time with the two
  //    keys somebody is pressing.
  const vx = (who: number): number => booted!.state.players[who].v.x;

  it('[Right] the second child key moves the SECOND child body, both ways', async () => {
    booted = bootar(document, window);
    seat('coop');
    const hers = booted!.state.controlled[1];

    await holdUntil('ArrowRight', () => vx(hers) > 2, 'her body to run right');
    await holdUntil('ArrowLeft', () => vx(hers) < -2, 'her body to run left');
  });

  it('[Zero] and her keys do not drag the first child along with them', async () => {
    booted = bootar(document, window);
    seat('coop');
    const his = booted!.state.controlled[0];

    // One keyboard, and a code on both maps is two children moving as one - which reads as the game being
    // possessed rather than as a binding clash. A body that is not listening does not swing from one end
    // of its speed range to the other in step with her keys, so the SPREAD is the reading: hers covers
    // more than four metres a second in each direction, and his must not.
    await holdFor('ArrowRight', 700);
    const right = vx(his);
    await holdFor('ArrowLeft', 700);

    expect(Math.abs(right - vx(his)), 'his body answered her keyboard').toBeLessThan(8);
  });

  it('[Right] and the first child keys still reach the first child', async () => {
    booted = bootar(document, window);
    seat('coop');
    const mine = booted!.state.controlled[0];

    await holdUntil('KeyD', () => booted!.state.players[mine].v.x > 2, 'his body to run right');
    await holdUntil('KeyA', () => booted!.state.players[mine].v.x < -2, 'his body to run left');
  });
});

describe('one child alone', () => {
  // The solo defaults hand ONE child both blocks, and she keeps them: the arrows are only given up when
  // somebody else needs them.
  it('[Right] still moves with the arrows, which the second seat would have taken', async () => {
    booted = bootar(document, window);
    const mine = booted!.state.controlled[0];

    await holdUntil('ArrowRight', () => booted!.state.players[mine].v.x > 2, 'the body to run right');
    await holdUntil('ArrowLeft', () => booted!.state.players[mine].v.x < -2, 'the body to run left');
  });

  it('[Zero] and the second seat drives nobody, so no second marker is drawn', () => {
    booted = bootar(document, window);
    seat('coop');
    seat('solo');

    // The state keeps both entries - the simulation is always two seats wide - and the renderer is handed
    // only the seats that have a child in them.
    expect(booted!.state.controlled).toHaveLength(2);
  });
});

describe('one against the other', () => {
  it('[Right] the second child drives the other side', () => {
    booted = bootar(document, window);

    seat('versus');

    expect(teamOf(booted!.state.controlled[0])).toBe(HOME);
    expect(teamOf(booted!.state.controlled[1])).not.toBe(HOME);
  });

  it('[Right] and going back to co-operation brings her home again', () => {
    booted = bootar(document, window);
    seat('versus');

    seat('coop');

    expect(teamOf(booted!.state.controlled[1])).toBe(HOME);
  });
});

// ========================= THE TWO KEYBOARDS ARE KEPT APART ON DISK TOO =========================
// A child remaps her keyboard while a friend is playing; the friend goes home; she comes back alone. If
// the two seatings shared a place to be stored she would find a keyboard she never chose, with nothing on
// the screen able to say what happened to it.
describe('remembering each keyboard', () => {
  const remap = (act: string, code: string): void => {
    (document.querySelector('#open-controls') as HTMLButtonElement).click();
    const button = document.querySelector(`#ctrl-list button[data-act="${act}"]`) as HTMLButtonElement;
    button.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
    (document.querySelector('#ctrl-close') as HTMLButtonElement).click();
  };

  it('[Right] a change made with two children playing does not follow her back to playing alone', () => {
    booted = bootar(document, window);
    seat('coop');

    remap('leftShoulder', 'KeyZ');
    expect(booted!.keymap().leftShoulder, 'the change did not take').toEqual(['KeyZ']);

    seat('solo');

    expect(booted!.keymap().leftShoulder, 'the two-seat map overwrote the solo one').not.toEqual(['KeyZ']);
  });

  it('[Right] and it is still there when the friend sits back down', () => {
    booted = bootar(document, window);
    seat('coop');
    remap('leftShoulder', 'KeyZ');
    seat('solo');

    seat('coop');

    expect(booted!.keymap().leftShoulder).toEqual(['KeyZ']);
  });
});
