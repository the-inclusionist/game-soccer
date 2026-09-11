// SPDX-License-Identifier: AGPL-3.0-or-later
// WHEN A KEY EVENT ARRIVES WITHOUT A PHYSICAL CODE.
//
// ========================= WHAT THIS IS, AND WHAT IT IS NOT =========================
// `boot/main` reads `ev.code` and swallows only the keys the live map binds. `code` is the RIGHT thing to
// read - it is the physical key, independent of layout, and it is what both of the engine's keyboard
// tables are keyed by - so none of this is a retreat from it. What it is is a floor under the case where
// `code` arrives empty: the key is then neither recognised NOR swallowed, so the child cannot play and
// the page quietly keeps the keystroke.
//
// ⚠️ AND WHETHER REAL ASSISTIVE TECHNOLOGY HITS THIS IS UNMEASURED. This is hardening against a hazard
// that was reasoned about and observed exactly once, in a browser automation harness driving somebody
// else's game - which is not a child and not a switch. Most assistive technology injects at the operating
// system level and produces events with `code` filled in like any other. Calling this an accessibility
// fix would be the overclaim this repository has had to correct before; it is a floor, and the
// measurement that would turn it into a finding is to drive a real switch-access stack at the game and
// look.
//
// ⚠️ THE AMBIGUITY IS REFUSED RATHER THAN GUESSED, and that is the decision in here. `key` of "7" could be
// `Digit7` or `Numpad7`, and this game's two-seat scheme binds BOTH - the first child's shoulders are on
// the digits and the second child's are on the numpad. Guessing hands one child the other child's
// control, which is a defect that works: the key does something, just not for her. Refusing makes it do
// nothing, which is visible and can be reported.
import { describe, expect, it } from 'vitest';
import { codeFromKey } from '../app/js/input/keymap.ts';

/** A keyboard that binds exactly these codes. */
const binds = (...codes: readonly string[]) => (code: string): boolean => codes.includes(code);

describe('a key event with no code', () => {
  it('[Right] a letter finds its physical key', () => {
    expect(codeFromKey('w', binds('KeyW'))).toBe('KeyW');
    expect(codeFromKey('W', binds('KeyW'))).toBe('KeyW');
  });

  // ⚠️ THE ARROWS AND THE NAMED KEYS ARE ALREADY THEIR OWN CODE, which is why they need no table. `key`
  //    and `code` agree for `ArrowUp`, `Enter`, `Escape` and `Tab` - and the second seat's whole
  //    directional half is arrows, so this is the branch her movement goes through.
  it('[Right] an arrow is already the code it needs', () => {
    expect(codeFromKey('ArrowUp', binds('ArrowUp'))).toBe('ArrowUp');
  });

  it('[Right] and the space bar, which is the one key whose `key` is a character nobody can see', () => {
    expect(codeFromKey(' ', binds('Space'))).toBe('Space');
  });

  // ⚠️ [Boundary] THE ONE THAT MATTERS, AND IT REFUSES. Both digits are bound in the two-seat scheme, so
  //    "7" is genuinely two keys and nothing in the event says which. Handing back either one would give
  //    one child the other child's shoulder - a defect that WORKS, and therefore one nobody reports.
  it('[Boundary] a digit bound on both the main row and the numpad is refused, not guessed', () => {
    expect(codeFromKey('7', binds('Digit7', 'Numpad7'))).toBeNull();
  });

  it('[Right] but a digit bound on only one of them is not ambiguous at all', () => {
    expect(codeFromKey('7', binds('Digit7'))).toBe('Digit7');
    expect(codeFromKey('7', binds('Numpad7'))).toBe('Numpad7');
  });

  // ⚠️ [Zero] A KEY THIS GAME DOES NOT BIND COMES BACK AS NOTHING, and that is what stops the fallback
  //    from swallowing the whole keyboard. Tab is the example that matters: a child navigating the page
  //    with it must keep it, and `boot/main` only calls `preventDefault` on keys it recognises.
  it('[Zero] a key nothing is bound to is not claimed', () => {
    expect(codeFromKey('q', binds('KeyW'))).toBeNull();
    expect(codeFromKey('Tab', binds('KeyW', 'ArrowUp'))).toBeNull();
  });

  it('[Zero] and an empty key is not a key', () => {
    expect(codeFromKey('', binds('KeyW'))).toBeNull();
  });

  // ⚠️ AND THE PUNCTUATION THE SECOND SEAT LIVES ON. Her half of the keyboard is arrows plus the numpad,
  //    and the numpad's own symbols carry `key` values that collide with the main row's punctuation -
  //    `/` is both `Slash` and `Divide`. Same rule, same refusal when both are bound.
  it('[Right] a punctuation key resolves when only one of its two codes is bound', () => {
    expect(codeFromKey('/', binds('Divide'))).toBe('Divide');
    expect(codeFromKey('/', binds('Slash'))).toBe('Slash');
    expect(codeFromKey('/', binds('Slash', 'Divide'))).toBeNull();
  });
});
