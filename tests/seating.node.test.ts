// SPDX-License-Identifier: AGPL-3.0-or-later
// TWO CHILDREN, ONE KEYBOARD, AND THE COLLISION NOBODY WOULD SEE COMING.
//
// ========================= WHY THE SOLO MAP CANNOT SIMPLY BE REUSED =========================
// The engine's solo defaults give ONE child both `WASD` and the arrow keys, which is generous and right
// for one child. It is also the whole problem: the arrows are the only movement block a second child can
// reach without leaning across the first, so a second seat built on top of the solo map would have both
// children moving with the same four keys - and the failure looks like "the game is possessed" rather
// than like a binding clash.
//
// So two seats get their OWN pair of defaults, exactly as the engine's own `KB_DEFAULTS` has `solo` and
// `p2`. Seat one keeps the letters, seat two gets the arrows, and neither can reach the other's.
//
// ⚠️ AND NO NUMPAD, WHICH IS THE ENGINE'S OWN SECOND-PLAYER SCHEME AND IS UNUSABLE HERE. `KB_DEFAULTS.p2[1]`
// binds `Numpad8/5/9/6` - a Chromebook has no numpad, and a Chromebook is the hardware pillar 1 names.
// It is finding 3 of `docs/ENGINE-AUDIT.md`, and this is where it would have arrived in this game.
import { describe, expect, it } from 'vitest';
import {
  defaultKeymapFor,
  duplicates,
  indexOf,
  keymapKeyFor,
  loadKeymap,
} from '../app/js/input/keymap.ts';
import { WORLD_POSITIONS } from '../app/js/ui/controls-panel.ts';

const both = [defaultKeymapFor(0, 2), defaultKeymapFor(1, 2)];

describe('one child', () => {
  it('[Right] still gets the arrows as well as the letters, because nobody is competing for them', () => {
    const solo = defaultKeymapFor(0, 1);

    expect(solo.up).toContain('KeyW');
    expect(solo.up).toContain('ArrowUp');
  });
});

describe('two children', () => {
  // ⚠️ THE GATE. Anything shared is a key that moves both children at once, and it would be found by a
  //    teacher in a classroom rather than by anyone here.
  it('[Interface] the two seats share not one single key', () => {
    const mine = new Set(Object.values(both[0]).flat());
    const theirs = Object.values(both[1]).flat();

    for (const code of theirs) expect(mine.has(code), `${code} is on both keyboards`).toBe(false);
  });

  it('[Interface] each seat can reach every world position', () => {
    for (const [seat, map] of both.entries()) {
      for (const action of WORLD_POSITIONS) {
        expect(map[action]?.length, `seat ${seat} / ${action}`).toBeGreaterThan(0);
      }
    }
  });

  it('[Zero] and neither seat has a key doing two jobs', () => {
    for (const [seat, map] of both.entries()) expect(duplicates(map), `seat ${seat}`).toEqual([]);
  });

  // The first seat gives the arrows up so the second child has a movement block she can reach without
  // leaning across her. It keeps `WASD`, which is the one it was always going to keep.
  it('[Right] the first seat keeps the letters and lets go of the arrows', () => {
    expect(both[0].up).toContain('KeyW');
    expect(both[0].up).not.toContain('ArrowUp');
  });

  it('[Right] and the second seat is the arrows, which is what a child finds without being told', () => {
    expect(both[1].up).toContain('ArrowUp');
    expect(both[1].left).toContain('ArrowLeft');
  });

  // ⚠️ THE NUMPAD, BY THE DEV'S DECISION OF 2026-09-06, and this file used to hold the opposite gate -
  //    "no key on either keyboard is on a numpad" - written on pillar 1 grounds, because a Chromebook has
  //    no numpad. The gate is gone and the reasoning is not: it is finding 3 of `docs/ENGINE-AUDIT.md`,
  //    and it still stands as written ABOUT THE ENGINE'S DEFAULT.
  //
  //    What separates the two is what now exists between them. The engine ships that layout as a default a
  //    child cannot escape; here the remap screen reaches both keyboards, so a machine with no numpad is a
  //    rebind and not a wall. The gate below is what keeps that sentence true.
  it('[Interface] every world position of the second seat can be reached from the remap screen', () => {
    // If a position the second child needs were not offered there, "she can rebind" would be false for it
    // - and the numpad decision rests entirely on that sentence being true.
    for (const action of WORLD_POSITIONS) expect(both[1][action]?.length, action).toBeGreaterThan(0);
    expect(WORLD_POSITIONS.length).toBe(12);
  });

  // ⚠️ AN EARLIER DRAFT GAVE THE SECOND SEAT NO PAUSE, reasoning that pause belongs to the room. The Dev's
  //    scheme gives it one, and the reason is better: a child who cannot stop the game is a child who has
  //    to ask somebody else to stop it.
  it('[Right] the second seat has its own pause and its own accessibility key', () => {
    expect(both[1].start).toEqual(['Numpad1']);
    expect(both[1].select).toEqual(['Numpad0']);
  });

  // ⚠️ AND THE FIRST SEAT'S STILL WORK, which is what makes the session keys survivable on a machine where
  //    the second seat's do not exist. They are the SESSION's, not seat one's, so `H` and `F` remain the
  //    way out for the room whoever presses them.
  it('[Interface] and the first seat keeps the session keys as well, on letters every keyboard has', () => {
    expect(both[0].start).toContain('KeyH');
    expect(both[0].select).toEqual(['KeyF']);
    for (const code of [...both[0].start, ...both[0].select]) {
      expect(code.startsWith('Numpad'), code).toBe(false);
    }
  });

  it('[Right] a key answers for exactly one seat', () => {
    expect(indexOf(both[0]).get('ArrowUp')).toBeUndefined();
    expect(indexOf(both[1]).get('KeyW')).toBeUndefined();
    expect(indexOf(both[1]).get('ArrowUp')).toBe('up');
  });
});

// ========================= ONE CHILD'S KEYBOARD IS NOT THE OTHER PAIR'S =========================
// The solo map and the two-seat pair are DIFFERENT defaults, so they cannot share a place to be stored:
// a child who remapped her solo keyboard and then let a friend sit down would come back alone to a
// keyboard she never chose, with no way to tell what happened.
describe('where each keyboard is kept', () => {
  it('[Zero] the three maps are three separate keys', () => {
    const keys = [keymapKeyFor(0, 1), keymapKeyFor(0, 2), keymapKeyFor(1, 2)];

    expect(new Set(keys).size, keys.join(' ')).toBe(3);
  });

  it('[Interface] and every one of them is namespaced to this game', () => {
    for (const key of [keymapKeyFor(0, 1), keymapKeyFor(0, 2), keymapKeyFor(1, 2)]) {
      expect(key, key).toContain('soccer');
    }
  });

  it('[Right] a two-seat map is read back against the two-seat defaults, not the solo ones', () => {
    const store = {
      getJSON: <T>(_k: string, fallback: T | null = null): T | null => fallback,
      setJSON: () => {},
      remove: () => {},
    };

    // Nothing stored: the second seat must come back as the arrows, never as the solo letters.
    expect(loadKeymap(store, 1, 2).up).toEqual(['ArrowUp']);
    expect(loadKeymap(store, 0, 2).up).not.toContain('ArrowUp');
    expect(loadKeymap(store, 0, 1).up).toContain('ArrowUp');
  });
});
