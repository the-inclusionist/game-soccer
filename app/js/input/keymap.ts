// SPDX-License-Identifier: AGPL-3.0-or-later
// THE KEYBOARD, LIVE AND CHANGEABLE. One object, and the sampler and the remap panel both hold it.
//
// ========================= WHY THIS IS NOT `KEYBOARD_SOLO` =========================
// The engine exports two keyboard tables and they are not the same thing:
//
//  · `input/default-bindings.ts` -> `KEYBOARD_SOLO`, keyed by the FOURTEEN positions ADR-0085 declared.
//    Frozen, and imported by nothing inside the engine.
//  · `input/keyboard.ts` -> `kb`, the one that is persisted, remapped and read at runtime. Its schemes
//    carry the platformer's EIGHT positions and there is no row for a shoulder, a trigger or `select`.
//
// So this game read the declared table and got the right vocabulary with no way to change it, while the
// changeable table has no vocabulary for ten of the things this game does. Neither one is a live
// fourteen-position keyboard, so this module is one: it is BORN from the declared defaults and it is what
// the sampler asks on every tick.
//
// ⚠️ IT IS A HOLDING PATTERN AND IT SAYS SO. When the engine reconciles its two tables, this file becomes
// a wrapper around `kb` and then nothing - `tests/keymap.node.test.ts` is where the claim is measured, and
// `docs/ENGINE-AUDIT.md` is where the engine is told.

import { ACTIONS, type Action } from '@the-inclusionist/engine/core/actions.js';
import { KEYBOARD_SOLO } from '@the-inclusionist/engine/input/default-bindings.js';
import { kJogo } from '@the-inclusionist/engine/platform/storage.js';

/** Which physical key codes reach each position. An empty list is a position no key reaches. */
export type Keymap = Record<string, string[]>;

/**
 * A fresh map from the engine's declared defaults.
 *
 * ⚠️ DEEP COPIED, not referenced. `KEYBOARD_SOLO` is frozen at the top level but its arrays are the
 * engine's; a shared array would let one child's remap edit the defaults every later reset restores from.
 */
export function defaultKeymap(): Keymap {
  const map: Keymap = {};
  for (const action of ACTIONS) {
    const codes = (KEYBOARD_SOLO as Record<string, readonly string[] | null>)[action];
    map[action] = codes === null || codes === undefined ? [] : [...codes];
  }
  return map;
}

/**
 * Put `code` on `action`, and take it off whatever else had it.
 *
 * ⚠️ THE ORDER IS THE WHOLE FUNCTION. Removing first and assigning second reads better and is wrong for
 * exactly one input - rebinding a key to the position it already holds - where the two steps cancel and
 * the child is left with a position no key reaches. Assigning first makes that case a no-op, which is
 * what she meant.
 *
 * ⚠️ AND TAKING IT AWAY IS THE PART THE ENGINE'S PANEL SKIPS. `settings-controls` writes
 * `mapRef[action] = [code]` and asks only whether ANOTHER PLAYER owns the code, so in a one-player game
 * the question can never be answered yes. A child who moves `W` to sprint would keep moving up with it,
 * and both would fire - the intermittent double action `default-bindings` says its conformance check
 * exists to catch. The checker exists; the remap screen does not call it.
 *
 * Mutates and returns the same object, because the panel holds a reference to the scheme it is editing
 * and expects to see its own change (`capture.mapRef` is that reference).
 */
export function bind(map: Keymap, action: Action, code: string): Keymap {
  map[action] = [code];
  for (const other of ACTIONS) {
    if (other === action) continue;
    map[other] = (map[other] ?? []).filter((c) => c !== code);
  }
  return map;
}

/** Code to position. A code on no position is absent; a position with no code contributes nothing. */
export function indexOf(map: Keymap): ReadonlyMap<string, Action> {
  const byCode = new Map<string, Action>();
  for (const action of ACTIONS) {
    for (const code of map[action] ?? []) if (!byCode.has(code)) byCode.set(code, action);
  }
  return byCode;
}

/**
 * The positions no key reaches.
 *
 * ⚠️ REPORTED RATHER THAN PREVENTED. A child mid-remap can legitimately pass through a state where sprint
 * has no key; refusing the move would make the panel argue with her. What must never happen is the state
 * being SILENT - a position she cannot reach and cannot see she cannot reach.
 */
export function unbound(map: Keymap): Action[] {
  return ACTIONS.filter((a) => (map[a] ?? []).length === 0);
}

/** Codes that reach more than one position. Empty means conformant. */
export function duplicates(map: Keymap): string[] {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const action of ACTIONS) {
    for (const code of map[action] ?? []) {
      if (seen.has(code)) twice.add(code);
      seen.add(code);
    }
  }
  return [...twice];
}

/**
 * The slice of the engine's `platform/storage` this module needs.
 *
 * ⚠️ INJECTED SO THE STORED VALUE CAN BE DRIVEN. The engine's storage module is import-safe - every access
 * is inside a function and inside a try/catch, because `localStorage` THROWS on `file://` and in some
 * private modes - so importing it here would work. What it would not let a test do is answer with a map
 * from an older vocabulary, which is the case worth measuring; and a browser test reading a real
 * `localStorage` inherits whatever the previous test file wrote, which is flake with a very long fuse.
 */
export interface KeymapStore {
  getJSON: <T>(key: string, fallback?: T | null) => T | null;
  setJSON: (key: string, value: unknown) => void;
  remove: (key: string) => void;
}

/**
 * Where the map lives.
 *
 * ⚠️ NAMESPACED BY GAME, because two games in one browser profile share a `localStorage` and the engine's
 * own `kJogo` exists for exactly this - the record says an unnamespaced key had one game overwriting
 * another's settings with no error anywhere.
 *
 * ⚠️ AND PERSISTING THIS IS ALLOWED WHERE PERSISTING A SCORE IS NOT (ADR-0037). A key map is a fact about
 * the DEVICE and about a body; it is not a fact about a child, and forgetting it every session would make
 * the panel useless to the person who most needs it.
 */
export const KEYMAP_KEY = kJogo('soccer', 'keymap');

/** Is this a list of key codes? A stored value is untrusted input, and half a map is worse than none. */
function codeList(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  return v.every((c) => typeof c === 'string') ? [...(v as string[])] : null;
}

/**
 * The stored map, repaired against the vocabulary that exists NOW.
 *
 * The three cases, and each one is a decision:
 *  · a position that is stored -> hers, including stored EMPTY, which is a choice she made.
 *  · a position that is MISSING -> the default. A map written before the position existed would otherwise
 *    leave a control unreachable, with an empty row in the panel and nothing saying why.
 *  · a position the engine no longer declares -> dropped. Carrying it forward would keep a dead key alive
 *    in the panel for as long as the browser profile lasts.
 */
export function loadKeymap(store: KeymapStore, seat = 0, seats: Seating = 1): Keymap {
  const raw = store.getJSON<Record<string, unknown>>(keymapKeyFor(seat, seats), null);
  const map = defaultKeymapFor(seat, seats);
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return map;
  for (const action of ACTIONS) {
    const codes = codeList(raw[action]);
    if (codes !== null) map[action] = codes;
  }
  return map;
}

export function saveKeymap(store: KeymapStore, map: Keymap, seat = 0, seats: Seating = 1): void {
  store.setJSON(keymapKeyFor(seat, seats), map);
}

/**
 * Where one seat's map is kept, for one seating.
 *
 * ⚠️ THREE PLACES AND NOT ONE, because the solo map and the two-seat pair are different DEFAULTS. Sharing
 * a key would mean a child who remapped her solo keyboard and then let a friend sit down came back alone
 * to a keyboard she never chose - and with nothing on the screen able to say what happened to it.
 *
 * The solo key keeps its original name so a child who has already remapped does not lose it to this
 * change; only the pair is new.
 */
export function keymapKeyFor(seat: number, seats: Seating): string {
  return seats === 1 ? KEYMAP_KEY : kJogo('soccer', `keymap.duo${seat}`);
}

/** Forget the child's map. The caller is expected to replace what it holds with `defaultKeymap()`. */
export function forgetKeymap(store: KeymapStore): Keymap {
  store.remove(KEYMAP_KEY);
  return defaultKeymap();
}

/**
 * The physical keys a `key` value could have come from, in no particular order.
 *
 * ⚠️ ONLY THE COLLISIONS NEED A TABLE. A letter is `Key` plus itself and an arrow is already its own
 * code; what needs writing down is the handful of characters that TWO physical keys produce, because the
 * main row and the numpad both carry digits and both carry some punctuation. The list is the numpad's
 * own symbols and nothing else, so it cannot drift from a keyboard it does not describe.
 */
const TWO_KEYS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "/": Object.freeze(["Slash", "Divide"]),
  "*": Object.freeze(["Multiply"]),
  "+": Object.freeze(["Add"]),
  "-": Object.freeze(["Minus", "Subtract"]),
  ".": Object.freeze(["Period", "Decimal"]),
  "=": Object.freeze(["Equal"]),
  ",": Object.freeze(["Comma"]),
  ";": Object.freeze(["Semicolon"]),
  "[": Object.freeze(["BracketLeft"]),
  "]": Object.freeze(["BracketRight"]),
  "`": Object.freeze(["Backquote"]),
});

/**
 * WHICH PHYSICAL KEY A `key` VALUE MEANT, when the event carried no `code` - or `null`.
 *
 * ⚠️ READING `code` IS RIGHT AND THIS IS NOT A RETREAT FROM IT. The physical key is layout-independent
 * and it is what both of the engine's keyboard tables are keyed by. This is a floor under the case where
 * it arrives EMPTY: `boot/main` recognises nothing, so it swallows nothing, and the child gets neither
 * her control nor an explanation.
 *
 * ⚠️ AND WHETHER REAL ASSISTIVE TECHNOLOGY HITS THIS IS UNMEASURED. It was reasoned about and seen
 * exactly once, in a browser automation harness driving somebody else's game, which is not a child and
 * not a switch. Most assistive technology injects at the operating system level and fills `code` in like
 * any other keyboard. Calling this an accessibility fix would be the overclaim this repository has had to
 * correct before - it is a floor, and the measurement that would make it a finding is to drive a real
 * switch-access stack at the game and look.
 *
 * ⚠️ THE LIVE KEYBOARD IS THE JUDGE, not a table in here. A candidate is accepted only if this child's
 * map actually binds it, which is what keeps the guess from claiming keys the game does not use.
 *
 * ⚠️ AND AMBIGUITY IS REFUSED RATHER THAN RESOLVED. "7" is `Digit7` or `Numpad7`, and the two-seat
 * scheme binds both - the first child's shoulders are digits, the second child's are numpad. Picking one
 * would hand a child the OTHER child's control: a defect that works, and therefore one nobody reports.
 * Refusing makes the key do nothing, which is visible and can be described out loud.
 */
export function codeFromKey(key: string, bound: (code: string) => boolean): string | null {
  if (key === "") return null;

  const candidates: string[] = [];
  if (key === " ") candidates.push("Space");
  else if (key.length === 1 && key >= "0" && key <= "9") candidates.push("Digit" + key, "Numpad" + key);
  else if (key.length === 1 && key.toLowerCase() !== key.toUpperCase()) candidates.push("Key" + key.toUpperCase());
  else if (key.length === 1) candidates.push(...(TWO_KEYS[key] ?? []));
  else candidates.push(key);

  const live = candidates.filter(bound);
  return live.length === 1 ? live[0] : null;
}

/**
 * The arrows, as glyphs.
 *
 * ⚠️ THE ENGINE WRITES ALL FOUR AS `↔`, which is the horizontal double arrow - so "move up" and "move
 * down" are shown with the same picture, pointing sideways, on a screen whose whole job is telling a
 * child which key does which direction.
 */
const ARROWS: Readonly<Record<string, string>> = Object.freeze({
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
});

/**
 * The keys whose name is the character printed on them.
 *
 * ⚠️ THIS ARRIVED TWICE, and the second time was the whole of the second seat. `Digit7` shipped raw and
 * was fixed; then the second child's keyboard turned out to be ten punctuation keys, every one of which
 * read `Slash`, `Period`, `Semicolon` on the screen. The gate now asks the DEFAULT KEYBOARDS rather than
 * a list somebody remembers to extend, so a binding cannot be added without a name for it.
 */
const PRINTED: Readonly<Record<string, string>> = Object.freeze({
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
  Backquote: '`',
});

/** The numpad keys whose name is a symbol rather than a digit. */
const NUMPAD_SYMBOL: Readonly<Record<string, string>> = Object.freeze({
  Divide: '/',
  Multiply: '*',
  Add: '+',
  Subtract: '-',
  Decimal: '.',
  Equal: '=',
});

const NAMED: Readonly<Record<string, string>> = Object.freeze({
  Space: 'Espaco',
  Enter: 'Enter',
  Escape: 'Esc',
  Tab: 'Tab',
  Backspace: 'Backspace',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
});

/**
 * What a key is CALLED, for a child reading the remap screen.
 *
 * ⚠️ THIS EXISTS BECAUSE THE ENGINE'S `keyName` STOPS AT FOUR CASES - it strips `Arrow` and `Key`, swaps
 * `Space` and `Shift`, and returns everything else raw. This game's defaults put the two shoulders on
 * `Digit7` and `Digit8`, so the screen offered a child the string `Digit7` where her keyboard says `7`;
 * the engine's own two-player scheme reaches `Numpad8`, which comes out as `Numpad8`.
 *
 * ⚠️ AND A NUMPAD KEY KEEPS ITS PREFIX ON PURPOSE. Shortening `Numpad8` to `8` would print the same name
 * for two different keys, which on a remap screen is not a cosmetic problem: it is the screen telling her
 * a lie about which key she just bound.
 *
 * ⚠️ UNKNOWN CODES COME BACK WHOLE. An unfamiliar name is readable; the alternative - stripping prefixes
 * off anything and hoping - turns `IntlBackslash` into something shorter and wronger, and can produce the
 * empty string, which is a row with a label and no key beside it.
 */
export function prettyKey(code: string): string {
  const arrow = ARROWS[code];
  if (arrow !== undefined) return arrow;
  const printed = PRINTED[code];
  if (printed !== undefined) return printed;
  const named = NAMED[code];
  if (named !== undefined) return named;
  if (code.startsWith('Numpad') && code.length > 6) {
    // ⚠️ THE SYMBOL KEYS NEED THEIR SYMBOL. Stripping the prefix alone turns `NumpadDivide` into
    //    "Num Divide", which is the identifier with a space in it - and those four keys are half of the
    //    second seat's shoulders and triggers.
    const rest = code.slice(6);
    return `Num ${NUMPAD_SYMBOL[rest] ?? rest}`;
  }
  if (code.startsWith('Key') && code.length === 4) return code.slice(3);
  if (code.startsWith('Digit') && code.length === 6) return code.slice(5);
  return code;
}

/**
 * The second child's keyboard, as the Dev specified it on 2026-09-06.
 *
 * Arrows to move, and the NUMPAD for everything else: `8 5 6 9` for the diamond, `/ 7 * +` for the
 * shoulders and triggers, `1` and `0` for start and select.
 *
 * ⚠️ IT IS THE NUMPAD, AND THAT IS THE BINDING `docs/ENGINE-AUDIT.md` FINDING 3 CRITICISES IN THE ENGINE.
 * The engine's own `KB_DEFAULTS.p2[1]` uses `Numpad8/5/9/6`, and this repository recorded that as unusable
 * on a Chromebook - which is the hardware pillar 1 names. The finding stands as written about the engine's
 * DEFAULT; here it is a decision taken with the consequence known, and it is written down rather than
 * quietly inherited.
 *
 * What makes the two different is what now exists between them: the remap screen reaches both keyboards
 * (`ui/controls-panel.ts`), so a child on a machine with no numpad can bind the second seat to keys she
 * has - which was not true of the engine's default and is why that one is a defect and this one is a
 * choice. On a machine that HAS a numpad it is the better layout by a distance: it is a physical block
 * under one hand, laid out like a pad, and it takes nothing away from the first child.
 */
const SECOND_SEAT: Readonly<Record<string, readonly string[]>> = Object.freeze({
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  action1: ['Numpad8'],
  action2: ['Numpad5'],
  action3: ['Numpad6'],
  action4: ['Numpad9'],
  leftShoulder: ['NumpadDivide'],
  leftTrigger: ['Numpad7'],
  rightShoulder: ['NumpadMultiply'],
  rightTrigger: ['NumpadAdd'],
  // ⚠️ THE SECOND SEAT HAS ITS OWN PAUSE AND ITS OWN ACCESSIBILITY KEY. An earlier draft here gave it
  //    neither, reasoning that pause belongs to the room; the Dev's scheme gives it both, and the reason
  //    is better: a child who cannot stop the game is a child who has to ask somebody else to stop it.
  start: ['Numpad1'],
  select: ['Numpad0'],
});

/** How many children are playing on this one keyboard. */
export type Seating = 1 | 2;

/**
 * The default keyboard for one seat, given how many seats there are.
 *
 * ⚠️ TWO SEATS IS ITS OWN PAIR OF TABLES, NOT THE SOLO TABLE SPLIT. The engine's solo defaults hand ONE
 * child both `WASD` and the arrows, which is right for one child and is exactly what makes a second seat
 * impossible on top of it: the arrows are the only movement block the second child can reach, so both
 * would move together. The first seat gives the arrows up when somebody else needs them - which is what
 * the engine's own `KB_DEFAULTS` does with `solo` and `p2`, arrived at here for the same reason.
 */
export function defaultKeymapFor(seat: number, seats: Seating): Keymap {
  if (seats === 1) return defaultKeymap();
  if (seat === 0) {
    const mine = defaultKeymap();
    for (const action of ACTIONS) {
      mine[action] = (mine[action] ?? []).filter((code) => !code.startsWith('Arrow'));
    }
    return mine;
  }
  const map: Keymap = {};
  for (const action of ACTIONS) map[action] = [...(SECOND_SEAT[action] ?? [])];
  return map;
}
