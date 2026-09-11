// SPDX-License-Identifier: AGPL-3.0-or-later
// THE DICTIONARIES AGREE, or a child gets a key instead of a word.
//
// ⚠️ A MISSING KEY IS SILENT. `t()` falls back to the key itself, so a Spanish child would read
// `name.ball` on the screen and nothing anywhere would report an error. This gate is the only thing
// between that and a release.
import { describe, expect, it } from 'vitest';
import { DICTS, installDicts } from '../app/js/i18n/index.ts';
import { availableLocales } from '@the-inclusionist/engine/core/i18n.js';
import { PHASES } from '../app/js/rules/phase.ts';

const codes = Object.keys(DICTS) as (keyof typeof DICTS)[];

describe('the three dictionaries', () => {
  // ⚠️ THE GATE THAT WAS MISSING, AND THE DEFECT IT WOULD HAVE CAUGHT. The dictionaries agreed with each
  //    OTHER and were registered under codes the engine never asks for, so `t()` fell back to the key and
  //    the screen read `club.campo`. Comparing against `availableLocales()` rather than against a copy of
  //    the list is the whole point: a copy would have drifted the same way.
  it('[Interface] the codes are EXACTLY the ones the engine asks for', () => {
    expect([...codes].sort()).toEqual([...availableLocales()].sort());
  });

  it('[Interface] the floor is three languages, and Portuguese is one of them', () => {
    expect(codes.length).toBeGreaterThanOrEqual(3);
    expect(codes).toContain('pt');
  });

  it('[Interface] every dictionary has exactly the same keys', () => {
    const reference = Object.keys(DICTS.en).sort();

    for (const code of codes) {
      expect(Object.keys(DICTS[code]).sort(), code).toEqual(reference);
    }
  });

  it('[Zero] no entry is empty, because an empty string is a silent missing word', () => {
    for (const code of codes) {
      for (const [key, value] of Object.entries(DICTS[code])) {
        expect(String(value).trim().length, `${code}/${key}`).toBeGreaterThan(0);
      }
    }
  });

  // ========================= ⚠️ AND AGREEING WITH EACH OTHER IS NOT ENOUGH =========================
  // The gate above is RELATIVE: it catches a key in one dictionary and not the others. A key missing from
  // ALL THREE is invisible to it, and that is not hypothetical - it is how `hud.phase.penalty` came to be
  // absent for as long as the penalty phase existed. Eleven phases, ten words. `boot/main.ts` renders the
  // phase as `t('hud.phase.' + state.phase)`, and `t()` falls back to the key, so a child at a penalty -
  // the single most dramatic stoppage in football - read the string `hud.phase.penalty` in the mirror,
  // and a child listening heard it.
  //
  // ⚠️ SO THE GATE IS AGAINST THE ENUMERATION AND NOT AGAINST A COPY OF IT. `PHASES` is the state
  // machine's own list; asking it directly is what makes a TWELFTH phase arrive with a word or not arrive
  // at all. A hand-written list of ten here would have been the same defect wearing a test.
  it('[Interface] every phase the match can be in has a word, in every language', () => {
    const missing: string[] = [];

    for (const phase of PHASES) {
      for (const code of codes) {
        const value = (DICTS[code] as Record<string, string>)[`hud.phase.${phase}`];
        if (value === undefined || value.trim().length === 0) missing.push(`${code}/hud.phase.${phase}`);
      }
    }

    expect(missing, 'a child would read the key instead of the word').toEqual([]);
  });

  it('[Right] every dictionary is handed to the engine, not just the first', () => {
    const seen: string[] = [];

    installDicts((code) => seen.push(code));

    expect(seen.sort()).toEqual([...codes].sort());
  });
});
