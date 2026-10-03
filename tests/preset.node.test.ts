// SPDX-License-Identifier: AGPL-3.0-or-later
// THE GAME'S WORDS FOR THE ENGINE'S POSITIONS.
//
// ========================= THE DIVISION OF LABOUR, AND WHY IT IS THIS WAY ROUND =========================
// The engine knows fourteen POSITIONS and no meanings; the game supplies the meanings. ADR-0074 exists
// because `jump` and `run` were platformer meaning living inside the engine, and ADR-0086 kept the rule
// while renaming four of them for the hand. An abstract name reaching a child is a defect: she reads
// "Passe curto", never `action3`.
//
// ========================= FOOTBALL SATURATES THE SET =========================
// Twelve world verbs plus two system ones - every position the engine has. That makes this game the first
// consumer to use all fourteen, and therefore the first that touch, with its nine slots, cannot carry.
// ADR-0079 section 3 says the engine must SAY so before a child starts. That sentence now exists in the
// engine's transport registry, and this preset is what it will be measured against.
//
// ========================= WHAT ENGINE 11.0 CHANGED HERE =========================
// An `ActionPreset` now holds KEYS (`labelKey`, `hintKey`) and the engine resolves them at every drawing.
// Two of these gates change character because of it, and both changes are recorded where they happen: the
// leak gate can finally measure the words a child reads instead of the keys, and the factory gate loses the
// requirement it existed for.
import { describe, expect, it } from 'vitest';
import { ACTIONS, presetActions, presetProblems } from '@the-inclusionist/engine/core/actions.js';
import { PRESET, SYSTEM_POSITIONS } from '../app/js/input/preset.ts';
import { en } from '../app/js/i18n/en.ts';

/** The preset's keys resolved through the REAL dictionary - what a child actually reads. */
const read = (key: string | undefined): string =>
  key === undefined ? '' : ((en as Record<string, string>)[key] ?? '');

describe('the football preset', () => {
  it('[Interface] it is well formed by the engine own checker', () => {
    expect(presetProblems(PRESET)).toEqual([]);
  });

  it('[Many] it names every world position - football uses all of them', () => {
    const named = presetActions(PRESET);
    const world = ACTIONS.filter((a: string) => !SYSTEM_POSITIONS.includes(a));

    expect([...named].sort()).toEqual([...world].sort());
  });

  // ⚠️ `start` AND `select` ARE DELIBERATELY UNNAMED. ADR-0085's criterion: an action earns a word when it
  //    is about the WORLD, and these are about the session. The child reads the hardware silkscreen first.
  it('[Zero] and it names neither system position', () => {
    const named = presetActions(PRESET);

    expect(named).not.toContain('start');
    expect(named).not.toContain('select');
  });

  // ⚠️ THE ENGINE CHECKS THE SHAPE AND NOT THE DICTIONARY. `presetProblems` asks that `labelKey` be a
  //    non-empty string; whether anything answers that key is ours to ask, and a key with no entry leaves
  //    the position unnamed on the remap screen with nothing anywhere reporting it.
  it('[Interface] every key the preset asks for exists in the dictionary', () => {
    const missing: string[] = [];

    for (const [action, keys] of Object.entries(PRESET)) {
      if (keys === undefined) continue;
      if (!(keys.labelKey in en)) missing.push(`${action}.labelKey=${keys.labelKey}`);
      if (keys.hintKey !== undefined && !(keys.hintKey in en)) missing.push(`${action}.hintKey=${keys.hintKey}`);
    }

    expect(missing, 'a position would reach a child unnamed').toEqual([]);
  });

  // ⚠️ ADR-0074's OWN CONFIRMATION CLAUSE, TURNED INTO A TEST - AND IT USED TO MEASURE THE WRONG STRING.
  //    The old version built the preset with `(key) => key`, so what it searched for `action\d` in was the
  //    KEY, never the word. The title says "a word a child reads" and the assertion read an identifier: a
  //    key called `act.strike` could have resolved to the text "action2" and this gate would have passed.
  //    With keys declared, the resolution is ours to do here, so the gate now reads what it claims to.
  it('[Interface] no engine position name ever leaks into a word a child reads', () => {
    const leaks: string[] = [];

    for (const [action, keys] of Object.entries(PRESET)) {
      const text = `${read(keys?.labelKey)} ${read(keys?.hintKey)}`;
      if (/action\d|leftShoulder|rightShoulder|leftTrigger|rightTrigger/.test(text)) leaks.push(action);
    }

    expect(leaks, 'an engine position name reached a word').toEqual([]);
  });

  // ⚠️ SPRINT IS ON TWO POSITIONS AND THAT IS AN ACCOMMODATION, NOT A DEFECT. `bindingProblems` catches one
  //    KEY on two actions; two actions carrying one verb is a second reach for a hand that finds the
  //    trigger easier than the diamond. The hint names the alias, so a screen-reader child is not left
  //    with two identical rows on the remap screen.
  it('[Right] sprint is offered twice, and the second one says so', () => {
    expect(PRESET.action1?.labelKey).toBe(PRESET.leftTrigger?.labelKey);
    expect(PRESET.leftTrigger?.hintKey).not.toBe(PRESET.action1?.hintKey);
  });

  // Resolved through the REAL dictionary: what is being asserted is that the sentence a child reads names
  // both jobs of a contextual button.
  it('[Right] a contextual verb names both of its jobs, because the child owns both', () => {
    expect(read(PRESET.action2?.hintKey)).toContain('tackle');
    expect(read(PRESET.action4?.hintKey)).toContain('slide');
  });

  // ⚠️ THE GATE THAT WAS HERE IS GONE, AND SAYING WHY IS THE POINT. It was «it is a FACTORY, so changing
  //    language changes the words», and it built the preset twice with two different `t`s to prove the words
  //    followed. In 11.0 there is no `t` and no resolved text to follow: the preset declares keys and the
  //    engine resolves them at every drawing (ADR-0232 D3 erratum), so the staleness that gate guarded
  //    against is now structurally impossible rather than tested for.
  //
  //    ⚠️ AND IT IS NOT REPLACED BY A DECORATION. The obvious substitute - "every value looks like a key" -
  //    is already covered: resolved text in a `labelKey` is text that is not a key in `en`, and the
  //    dictionary gate above fails on it by name. A second assertion of the same fact would report coverage
  //    twice and add none. A requirement that moved to another layer is removed, not re-asserted weakly.
  //
  //    📌 This note had a replacement gate under it for one draft - `Object.isFrozen` plus "every key
  //    resolves to something other than itself" - and it was deleted for contradicting the paragraph above
  //    it: the second half is the dictionary gate again, and the first half guards mutation rather than the
  //    staleness that was lost. The note is the deliverable here, not an assertion.
});
