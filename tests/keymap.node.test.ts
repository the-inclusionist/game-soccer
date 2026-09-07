// SPDX-License-Identifier: AGPL-3.0-or-later
// THE KEYBOARD A CHILD CAN CHANGE.
//
// ========================= WHY THIS EXISTS AT ALL, WHICH IS NOT OBVIOUS =========================
// The engine exports `KEYBOARD_SOLO` and this game read it directly, which looked like the disciplined
// thing to do - one table, never copied. It is a FROZEN DEFAULT. The engine's remappable keyboard is a
// different object in a different module (`input/keyboard.ts`'s `kb`), whose schemes carry the
// platformer's EIGHT positions; the fourteen that ADR-0085 declared live only in the frozen table, which
// nothing inside the engine imports.
//
// So "the engine gives remapping for free" was true of a game with eight actions and false of this one,
// and reading the frozen table meant a child could not move a single key. This module is the live map:
// it starts as the engine's declared defaults, it is what the sampler asks, and it is what the remap
// panel edits.
//
// ⚠️ AND IT TAKES A KEY AWAY FROM WHOEVER HELD IT, which the engine's panel does not. `settings-controls`
// writes `mapRef[action] = [code]` and checks only whether ANOTHER PLAYER owns the code - so in a
// one-player game the check can never fire, and a child who binds `W` to sprint keeps `W` on "move up"
// as well. Both then fire together, which is the intermittent double action the engine's own
// `default-bindings` header says a conformance check exists to catch. That checker exists. The remap
// screen does not call it.
import { describe, expect, it } from 'vitest';
import { ACTIONS } from '@the-inclusionist/engine/core/actions.js';
import {
  bind,
  defaultKeymap,
  defaultKeymapFor,
  duplicates,
  indexOf,
  loadKeymap,
  prettyKey,
  saveKeymap,
  unbound,
} from '../app/js/input/keymap.ts';
import { heldFrom } from '../app/js/input/sampler.ts';

describe('the map a child starts with', () => {
  it('[Interface] every one of the fourteen positions has a key, because a position with none is unreachable', () => {
    const map = defaultKeymap();

    for (const action of ACTIONS) {
      expect(map[action], action).toBeDefined();
      expect(map[action].length, action).toBeGreaterThan(0);
    }
  });

  it('[Zero] and no key does two jobs - a doubled binding is two acts from one press', () => {
    expect(duplicates(defaultKeymap())).toEqual([]);
  });

  it('[Interface] it is a COPY, so editing it cannot reach back into the engine defaults', () => {
    const a = defaultKeymap();
    const b = defaultKeymap();

    bind(a, 'action1', 'KeyZ');

    expect(b.action1).not.toContain('KeyZ');
  });
});

describe('binding a key', () => {
  it('[Right] the code reaches the action it was bound to', () => {
    const map = bind(defaultKeymap(), 'leftShoulder', 'KeyZ');

    expect(indexOf(map).get('KeyZ')).toBe('leftShoulder');
  });

  // ⚠️ THE ASSERTION THE ENGINE'S PANEL WOULD FAIL. `KeyW` is "move up" out of the box; a child who puts
  //    it on sprint has to STOP moving up with it, or every sprint is also a run at her own goal.
  it('[Right] and it stops reaching the action that had it', () => {
    const before = defaultKeymap();
    expect(before.up).toContain('KeyW');

    const map = bind(defaultKeymap(), 'action1', 'KeyW');

    expect(map.up).not.toContain('KeyW');
    expect(indexOf(map).get('KeyW')).toBe('action1');
  });

  it('[Zero] the action being bound keeps only the new key, so a remap replaces rather than piles up', () => {
    const map = bind(defaultKeymap(), 'up', 'KeyZ');

    expect(map.up).toEqual(['KeyZ']);
  });

  // ⚠️ THE ONE THAT LOOKS LIKE A NO-OP AND IS NOT. Taking the code away first and then assigning it would
  //    work for every case except this one, where the two steps cancel and the action is left with no key
  //    at all - a child rebinding a key to the action it was already on would silently lose it.
  it('[Boundary] rebinding a key to the action that already had it leaves it bound', () => {
    const map = bind(defaultKeymap(), 'up', 'KeyW');

    expect(map.up).toEqual(['KeyW']);
    expect(unbound(map)).toEqual([]);
  });

  it('[Zero] an action whose last key was taken is REPORTED, not left quietly unreachable', () => {
    // `KeyU` is the only key on `action1`. Moving it to `select` empties `action1`.
    const map = bind(defaultKeymap(), 'select', 'KeyU');

    expect(unbound(map)).toContain('action1');
  });

  it('[Interface] a map with a hole is still a map - nothing throws, it just answers honestly', () => {
    const map = bind(defaultKeymap(), 'select', 'KeyU');

    expect(() => indexOf(map)).not.toThrow();
    expect(duplicates(map)).toEqual([]);
  });
});

describe('the sampler reads the LIVE map', () => {
  // ⚠️ THE GATE THAT PROVES REMAPPING DOES ANYTHING AT ALL. Until this existed the sampler built its
  //    code table ONCE at module load, from a frozen constant: the panel could be perfect and every key a
  //    child chose would be ignored, with nothing anywhere reporting it.
  it('[Right] a key moved to another action holds that action instead', () => {
    const map = bind(defaultKeymap(), 'leftShoulder', 'KeyW');

    const held = heldFrom(new Set(['KeyW']), map);

    expect(held.leftShoulder).toBe(true);
    expect(held.up).toBe(false);
  });

  it('[Interface] and with no map given it still answers with the defaults', () => {
    const held = heldFrom(new Set(['KeyW']));

    expect(held.up).toBe(true);
  });

  it('[Zero] a key nobody bound holds nothing, which is not an error', () => {
    const held = heldFrom(new Set(['KeyQ']));

    for (const action of ACTIONS) expect(held[action], action).toBe(false);
  });
});

// ========================= A STORED MAP IS UNTRUSTED INPUT =========================
// It survives a browser update, an engine update and a vocabulary change, and it is the one thing in this
// game that outlives the session (ADR-0037 permits it: a key map is about the DEVICE, not about a child).
// A map written by an older build can be missing a position that exists now - and a missing position is
// not a cosmetic gap, it is a control the child cannot reach and cannot see she cannot reach.
describe('reading a map back', () => {
  const store = (value: unknown) => ({
    getJSON: <T>(_k: string, fallback: T | null = null): T | null => (value === undefined ? fallback : (value as T)),
    setJSON: () => {},
    remove: () => {},
  });

  it('[Right] what was saved is what comes back', () => {
    const saved: Record<string, string[]> = {};
    let written: unknown = null;
    const map = bind(defaultKeymap(), 'leftShoulder', 'KeyZ');
    saveKeymap({ getJSON: () => null, setJSON: (_k, o) => { written = o; }, remove: () => {} }, map);
    Object.assign(saved, written as Record<string, string[]>);

    expect(loadKeymap(store(saved)).leftShoulder).toEqual(['KeyZ']);
  });

  it('[Zero] nothing stored is the engine defaults, not an empty keyboard', () => {
    expect(loadKeymap(store(undefined))).toEqual(defaultKeymap());
  });

  // ⚠️ THE ONE A SCHOOL WOULD HIT. A map saved before a position existed comes back without it, and a
  //    child on that machine simply cannot contain, sprint on the trigger or open the sonar - with the
  //    panel showing an empty row and nothing explaining why.
  it('[Interface] a map missing a position gets that position back from the defaults', () => {
    const stale = defaultKeymap();
    delete stale.rightTrigger;

    const map = loadKeymap(store(stale));

    expect(map.rightTrigger).toEqual(defaultKeymap().rightTrigger);
    expect(unbound(map)).toEqual([]);
  });

  it('[Zero] and a position stored EMPTY is left empty, because that is a choice she made', () => {
    const chosen = defaultKeymap();
    chosen.select = [];

    expect(loadKeymap(store(chosen)).select).toEqual([]);
  });

  it('[Zero] rubbish in storage is the defaults rather than a crash', () => {
    for (const junk of ['nonsense', 42, [], null, { up: 'KeyW' }, { up: [7] }]) {
      expect(() => loadKeymap(store(junk)), JSON.stringify(junk)).not.toThrow();
      expect(loadKeymap(store(junk)).up, JSON.stringify(junk)).toEqual(defaultKeymap().up);
    }
  });

  it('[Zero] a position the engine no longer has is dropped rather than carried forever', () => {
    const old = { ...defaultKeymap(), especial: ['KeyP'] };

    expect(loadKeymap(store(old)).especial).toBeUndefined();
  });
});

// ========================= WHAT A KEY IS CALLED ON THE SCREEN =========================
// The engine's `keyName` strips `Arrow` and `Key` and translates `Space`, and stops there. This game's
// defaults reach `Digit7` and `Digit8` - the two shoulder positions - so the remap screen showed a child
// the string `Digit7` where the key on her keyboard says `7`. It is decipherable and it is not a name.
/** The parts of a `KeyboardEvent.code` that are vocabulary for a browser and not for a child. */
const CODE_ONLY = [
  'Key',
  'Digit',
  'Numpad',
  'Arrow',
  'Slash',
  'Period',
  'Comma',
  'Semicolon',
  'Quote',
  'Bracket',
  'Backslash',
  'Minus',
  'Equal',
  'Backquote',
];

describe('naming a key for a child to read', () => {
  it('[Right] a letter is the letter, and a digit is the digit', () => {
    expect(prettyKey('KeyW')).toBe('W');
    expect(prettyKey('Digit7')).toBe('7');
  });

  it('[Right] an arrow is an arrow, not the word for one', () => {
    expect(prettyKey('ArrowUp')).toBe('↑');
    expect(prettyKey('ArrowLeft')).toBe('←');
  });

  it('[Right] a numpad key says so, because the 8 up there is not the 8 on the top row', () => {
    expect(prettyKey('Numpad8')).toContain('8');
    expect(prettyKey('Numpad8')).not.toBe('8');
  });

  // ⚠️ THE SECOND SEAT IS ALL PUNCTUATION, so this is not an edge case for it - it is every one of its
  //    action keys. Read on the screen before the names existed: "Correr: Slash", "Chutar: Period". A
  //    child has to know that `Slash` is the key printed `/`, which is the thing the screen is for.
  it('[Right] a punctuation key is the character printed on it', () => {
    const printed: Record<string, string> = {
      Slash: '/',
      Period: '.',
      Comma: ',',
      Semicolon: ';',
      Quote: String.fromCharCode(39),
      BracketLeft: '[',
      BracketRight: ']',
      Backslash: String.fromCharCode(92),
      Minus: '-',
      Equal: '=',
    };

    for (const [code, glyph] of Object.entries(printed)) expect(prettyKey(code), code).toBe(glyph);
  });

  // ⚠️ THE GATE THAT WOULD HAVE CAUGHT BOTH ROUNDS OF THIS. `Digit7` shipped raw, was fixed, and then the
  //    second seat arrived with ten more codes the naming did not know. Asking the DEFAULTS rather than a
  //    list somebody remembers to update means a new binding cannot be added without a name for it.
  it('[Interface] every key in every default keyboard has a name a child can read', () => {
    for (const seats of [1, 2] as const) {
      for (const seat of [0, 1]) {
        const map = defaultKeymapFor(seat, seats);
        for (const codes of Object.values(map)) {
          for (const code of codes) {
            const name = prettyKey(code);
            expect(name.trim().length, code).toBeGreaterThan(0);
            // ⚠️ "NOT EQUAL TO THE CODE" IS THE WRONG TEST, and it was the first one written here: `Enter`
            //    and `Tab` ARE the words printed on those keys, so it failed on a correct answer. What
            //    must not reach the screen is the part of a code that is POSITIONAL vocabulary - the
            //    prefixes and the spelled-out punctuation names that exist for the browser, not for a
            //    child looking at her keyboard.
            for (const token of CODE_ONLY) {
              expect(name, `${code} is shown as "${name}"`).not.toContain(token);
            }
          }
        }
      }
    }
  });

  it('[Zero] a code with no short name is returned whole rather than mangled into nothing', () => {
    expect(prettyKey('IntlBackslash')).toBe('IntlBackslash');
  });

  it('[Boundary] and nothing it returns is empty, because an empty key is an unlabelled row', () => {
    for (const code of ['KeyW', 'Digit7', 'ArrowDown', 'Numpad5', 'Space', 'Enter', 'Escape', 'Tab']) {
      expect(prettyKey(code).trim().length, code).toBeGreaterThan(0);
    }
  });

  it('[Interface] every key in the defaults gets a name', () => {
    const map = defaultKeymap();
    for (const action of Object.keys(map)) {
      for (const code of map[action]) expect(prettyKey(code).trim().length, code).toBeGreaterThan(0);
    }
  });
});

// ========================= THE SECOND SEAT IS THE NUMPAD (Dev, 2026-09-06) =========================
// Arrows to move, `8 5 6 9` for the diamond, `/ 7 * +` for the shoulders and triggers, `1` and `0` for
// start and select. It is a physical block under one hand, laid out like a pad, and it takes nothing at
// all from the first child.
//
// ⚠️ IT IS ALSO THE BINDING FINDING 3 OF THE AUDIT CRITICISES IN THE ENGINE, and the difference is not
// special pleading: the engine ships it as a DEFAULT a child cannot escape, while here the remap screen
// reaches both keyboards, so a machine with no numpad is a rebind rather than a wall. Recorded in
// `app/js/input/keymap.ts` and in `docs/ENGINE-AUDIT.md` rather than left to be discovered.
describe('the scheme the Dev specified', () => {
  const p2 = defaultKeymapFor(1, 2);
  const p1 = defaultKeymapFor(0, 2);

  it('[Right] player one is the letters, exactly as specified', () => {
    expect(p1.up).toContain('KeyW');
    expect(p1.action1).toEqual(['KeyU']);
    expect(p1.action3).toEqual(['KeyK']);
    expect(p1.leftShoulder).toEqual(['Digit7']);
    expect(p1.leftTrigger).toEqual(['KeyY']);
    expect(p1.rightShoulder).toEqual(['Digit8']);
    expect(p1.rightTrigger).toEqual(['KeyO']);
    expect(p1.start).toContain('KeyH');
    expect(p1.select).toEqual(['KeyF']);
  });

  it('[Right] player two is the arrows and the numpad, exactly as specified', () => {
    expect(p2.up).toEqual(['ArrowUp']);
    expect(p2.action1).toEqual(['Numpad8']);
    expect(p2.action2).toEqual(['Numpad5']);
    expect(p2.action3).toEqual(['Numpad6']);
    expect(p2.action4).toEqual(['Numpad9']);
    expect(p2.leftShoulder).toEqual(['NumpadDivide']);
    expect(p2.leftTrigger).toEqual(['Numpad7']);
    expect(p2.rightShoulder).toEqual(['NumpadMultiply']);
    expect(p2.rightTrigger).toEqual(['NumpadAdd']);
    expect(p2.start).toEqual(['Numpad1']);
    expect(p2.select).toEqual(['Numpad0']);
  });

  // ⚠️ AN EARLIER DRAFT GAVE THE SECOND SEAT NEITHER, reasoning that pause belongs to the room. The Dev's
  //    scheme gives it both, and the reason is better: a child who cannot stop the game is a child who has
  //    to ask somebody else to stop it.
  it('[Interface] and she has her own way to pause and her own accessibility key', () => {
    expect(p2.start.length).toBeGreaterThan(0);
    expect(p2.select.length).toBeGreaterThan(0);
  });

  it('[Right] a numpad symbol key is named by its symbol, not by its identifier', () => {
    expect(prettyKey('NumpadDivide')).toBe('Num /');
    expect(prettyKey('NumpadMultiply')).toBe('Num *');
    expect(prettyKey('NumpadAdd')).toBe('Num +');
    expect(prettyKey('Numpad8')).toBe('Num 8');
  });
});
