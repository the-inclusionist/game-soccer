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
import { describe, expect, it } from 'vitest';
import { ACTIONS, presetActions, presetProblems } from '@the-inclusionist/engine/core/actions.js';
import { SYSTEM_POSITIONS, buildPreset } from '../app/js/input/preset.ts';
import { en } from '../app/js/i18n/en.ts';

const keyEcho = (key: string) => 't:' + key;

describe('the football preset', () => {
  it('[Interface] it is well formed by the engine own checker', () => {
    expect(presetProblems(buildPreset(keyEcho))).toEqual([]);
  });

  it('[Many] it names every world position - football uses all of them', () => {
    const named = presetActions(buildPreset(keyEcho));
    const world = ACTIONS.filter((a: string) => !SYSTEM_POSITIONS.includes(a));

    expect([...named].sort()).toEqual([...world].sort());
  });

  // ⚠️ `start` AND `select` ARE DELIBERATELY UNNAMED. ADR-0085's criterion: an action earns a word when it
  //    is about the WORLD, and these are about the session. The child reads the hardware silkscreen first.
  it('[Zero] and it names neither system position', () => {
    const named = presetActions(buildPreset(keyEcho));

    expect(named).not.toContain('start');
    expect(named).not.toContain('select');
  });

  it('[Interface] every label and hint comes from the dictionary - no raw literal reaches a child', () => {
    const preset = buildPreset(keyEcho);

    for (const [action, word] of Object.entries(preset)) {
      expect(word?.label.startsWith('t:'), action).toBe(true);
      if (word?.hint !== undefined) expect(word.hint.startsWith('t:'), action).toBe(true);
    }
  });

  // ⚠️ ADR-0074's OWN CONFIRMATION CLAUSE, TURNED INTO A TEST. An abstract name reaching a person is the
  //    defect the record was written to prevent, so the preset must never leak one.
  it('[Interface] no engine position name ever leaks into a word a child reads', () => {
    const preset = buildPreset((key) => key);
    const leaks: string[] = [];

    for (const [action, word] of Object.entries(preset)) {
      const text = `${word?.label ?? ''} ${word?.hint ?? ''}`;
      if (/action\d|leftShoulder|rightShoulder|leftTrigger|rightTrigger/.test(text)) leaks.push(action);
    }

    expect(leaks).toEqual([]);
  });

  // ⚠️ SPRINT IS ON TWO POSITIONS AND THAT IS AN ACCOMMODATION, NOT A DEFECT. `bindingProblems` catches one
  //    KEY on two actions; two actions carrying one verb is a second reach for a hand that finds the
  //    trigger easier than the diamond. The hint names the alias, so a screen-reader child is not left
  //    with two identical rows on the remap screen.
  it('[Right] sprint is offered twice, and the second one says so', () => {
    const preset = buildPreset(keyEcho);

    expect(preset.action1?.label).toBe(preset.leftTrigger?.label);
    expect(preset.leftTrigger?.hint).not.toBe(preset.action1?.hint);
  });

  // Resolved through the REAL dictionary, not through a key echo: what is being asserted is that the
  // sentence a child reads names both jobs of a contextual button, and a key names nothing.
  it('[Right] a contextual verb names both of its jobs, because the child owns both', () => {
    const preset = buildPreset((k) => (en as Record<string, string>)[k] ?? k);

    expect(preset.action2?.hint).toContain('tackle');
    expect(preset.action4?.hint).toContain('slide');
  });

  it('[Interface] every key the preset asks for exists in the dictionary', () => {
    const missing: string[] = [];
    buildPreset((k) => {
      if (!(k in en)) missing.push(k);
      return k;
    });

    expect(missing).toEqual([]);
  });

  it('[Interface] it is a FACTORY, so changing language changes the words', () => {
    const english = buildPreset(() => 'Shoot');
    const other = buildPreset(() => 'Chutar');

    expect(english.action2?.label).not.toBe(other.action2?.label);
  });
});
