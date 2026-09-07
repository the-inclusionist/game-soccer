// SPDX-License-Identifier: AGPL-3.0-or-later
// PICKING WHO PLAYS.
//
// ========================= WHY THIS IS NOT A COSMETIC FEATURE =========================
// The fixture was `makeFixture(1)` - one hard-coded seed, the same two clubs for every child in every
// classroom, for ever. The reference game ships forty-eight national sides and lets you choose; the
// equivalent here is not the number of clubs, it is that the choice EXISTS. A child playing as a club she
// picked is playing; a child watching two clubs somebody else picked is watching.
//
// ⚠️ AND THE CHOICE IS WHERE THE ONE RULE THAT IS NOT TASTE COULD HAVE BEEN LOST. A seeded generator
// retried until the two kits cleared the luma gap. A child does not retry - she picks the two she likes.
// The 132 pairings are gated in the node project; what is gated HERE is that the pitch actually changes
// and that she can never be shown a club playing itself.
import { beforeEach, describe, expect, it } from 'vitest';
import { bootar } from '../app/js/boot/main.ts';
import { CLUBS } from '../app/js/teams/roster.ts';

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

const pick = (which: 'home' | 'away', index: number): void => {
  const select = document.querySelector(`#${which}-club`) as HTMLSelectElement;
  select.value = String(index);
  select.dispatchEvent(new Event('change'));
};

const fixtureLine = (): string => document.querySelector('#m-fixture')?.textContent ?? '';

describe('the two choosers', () => {
  it('[Interface] both are there, labelled, and list every club', () => {
    booted = bootar(document, window);

    for (const which of ['home', 'away'] as const) {
      const select = document.querySelector(`#${which}-club`) as HTMLSelectElement;
      expect(select, which).not.toBeNull();
      expect(document.querySelector(`#${which}-club-label`)?.textContent?.trim().length, which).toBeGreaterThan(0);
      expect(select.options.length, which).toBe(CLUBS.length);
    }
  });

  it('[Right] the options carry the club words, not their dictionary keys', () => {
    booted = bootar(document, window);
    const names = [...document.querySelectorAll<HTMLOptionElement>('#home-club option')].map((o) => o.textContent);

    for (const name of names) expect(name).not.toMatch(/^club\./);
    expect(new Set(names).size, 'two clubs read the same').toBe(CLUBS.length);
  });

  it('[Right] they do not start on the same club', () => {
    booted = bootar(document, window);

    expect((document.querySelector('#home-club') as HTMLSelectElement).value).not.toBe(
      (document.querySelector('#away-club') as HTMLSelectElement).value,
    );
  });
});

describe('choosing', () => {
  it('[Right] the screen says who is playing, and it changes when she picks', () => {
    booted = bootar(document, window);
    const before = fixtureLine();

    pick('home', 4);

    expect(fixtureLine()).not.toBe(before);
    expect(fixtureLine().length).toBeGreaterThan(0);
  });

  // ⚠️ THE OPPONENT'S OWN ENTRY IS DISABLED RATHER THAN SILENTLY SWAPPED. `fixtureOf` throws on a club
  //    playing itself, deliberately - a fixture that substituted an opponent would leave the screen saying
  //    one thing and the pitch showing another. So the impossible choice must not be offerable, and a
  //    disabled option is announced as disabled instead of simply not being there, which is the difference
  //    between "you cannot pick this" and "this club has vanished".
  it('[Zero] a club cannot be picked on both sides', () => {
    booted = bootar(document, window);

    pick('home', 4);

    const taken = document.querySelector('#away-club option[value="4"]') as HTMLOptionElement;
    expect(taken.disabled).toBe(true);
    expect([...document.querySelectorAll<HTMLOptionElement>('#away-club option')].filter((o) => o.disabled)).toHaveLength(1);
  });

  it('[Zero] and picking the club the other side already has never happens, even driven directly', () => {
    booted = bootar(document, window);
    pick('home', 4);

    // A select can be given any value by script; the guard must live in the game, not in the markup.
    expect(() => pick('away', 4)).not.toThrow();
    expect((document.querySelector('#away-club') as HTMLSelectElement).value).not.toBe('4');
  });

  it('[Right] choosing restarts the match rather than changing shirts mid-play', () => {
    booted = bootar(document, window);
    booted!.state.goals = [2, 1];
    booted!.state.tick = 4000;

    pick('away', 7);

    expect(booted!.state.goals).toEqual([0, 0]);
    expect(booted!.state.tick).toBe(0);
  });
});
