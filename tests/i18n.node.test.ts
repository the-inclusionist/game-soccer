// SPDX-License-Identifier: AGPL-3.0-or-later
// THE DICTIONARIES AGREE, or a child gets a key instead of a word.
//
// ⚠️ A MISSING KEY IS SILENT. `t()` falls back to the key itself, so a Spanish child would read
// `name.ball` on the screen and nothing anywhere would report an error. This gate is the only thing
// between that and a release.
import { describe, expect, it } from 'vitest';
import { DICTS, installDicts } from '../app/js/i18n/index.ts';
import { bodyOf, sourcesUnder } from './helpers/sources.ts';

/** The same tree every absence gate in this repository reads. See `tests/helpers/sources`. */
const ROOT = 'app/js';
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

  // ⚠️ THE PENALTY WORD WAS A MISSING KEY AND THE FIX GATED ITS FAMILY, NOT ITS CLASS. `hud.phase.penalty`
  //    did not exist; `t()` falls back to the key, so a blind child at a penalty heard the string
  //    "hud.phase.penalty" read out and nothing anywhere was red. The gate written that day walks `PHASES`
  //    - which is right, and covers the ONE key family that is built by concatenation. Every other key in
  //    this game is a plain literal at a call site, and a typo in any of them fails exactly the same way
  //    and is caught by nothing.
  //
  // ⚠️ MEASURED 2026-09-11: forty-three literal keys across the tree, all forty-three present. So this
  //    gate is born green on the code and red on the fault - which is the only way round that is useful
  //    for an absence gate, and the reason to write it while the absence is true.
  //
  // ⚠️ WHAT IT DOES NOT COVER, SAID PLAINLY. A key assembled at run time - `t(`hud.phase.${state.phase}`)`,
  //    `t(`seats.${option.value}`)`, `t(club.nameKey)` - cannot be read from the source, and claiming
  //    otherwise would be the "correct and useless" failure this project keeps naming. Those are covered by
  //    the phase gate above, by the seating gates, and by the club fixtures. This one closes the literals.
  it('[Many] every literal key a call site asks for exists in the dictionaries', () => {
    // The FIRST argument of `t()`, single- or back-quoted, with no interpolation in it. `[,)]` at the end
    // so that `t('hud.ball.with', { club })` counts: a key with parameters is still a key.
    const asked = /(?:^|[^A-Za-z0-9_$.])t\(\s*(?:'([^'\n]+)'|`([^`\n$]+)`)\s*[,)]/g;
    const known = new Set(Object.keys(DICTS.en));
    const orphans: string[] = [];

    for (const file of sourcesUnder(ROOT)) {
      const body = bodyOf(file);
      for (const hit of body.matchAll(asked)) {
        const key = hit[1] ?? hit[2];
        if (key !== undefined && !known.has(key)) orphans.push(`${key} (in ${file})`);
      }
    }

    expect(orphans, 'a call site asks for a word no dictionary has').toEqual([]);
  });

  // ⚠️ AND THE REGEX IS ITSELF GATED, because a pattern that matches nothing makes the gate above pass by
  //    finding no orphans - the purest form of a gate that cannot fail. Forty-three is the measured count;
  //    if a refactor moves the keys somewhere this pattern cannot see, this goes red and says so rather
  //    than letting the gate above report coverage it no longer has.
  it('[Zero] and the pattern still finds the keys, or the gate above proves nothing', () => {
    const asked = /(?:^|[^A-Za-z0-9_$.])t\(\s*(?:'([^'\n]+)'|`([^`\n$]+)`)\s*[,)]/g;
    const found = new Set<string>();

    for (const file of sourcesUnder(ROOT)) {
      for (const hit of bodyOf(file).matchAll(asked)) {
        const key = hit[1] ?? hit[2];
        if (key !== undefined) found.add(key);
      }
    }

    expect(found.size, 'the key scan stopped finding keys').toBeGreaterThanOrEqual(40);
  });

  it('[Right] every dictionary is handed to the engine, not just the first', () => {
    const seen: string[] = [];

    installDicts((code) => seen.push(code));

    expect(seen.sort()).toEqual([...codes].sort());
  });
});
