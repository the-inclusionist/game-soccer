// SPDX-License-Identifier: AGPL-3.0-or-later
// THE DICTIONARIES AGREE, or a child gets a key instead of a word.
//
// ⚠️ A MISSING KEY IS SILENT. `t()` falls back to the key itself, so a Spanish child would read
// `name.ball` on the screen and nothing anywhere would report an error. This gate is the only thing
// between that and a release.
import { describe, expect, it } from 'vitest';
import { DICTS, installDicts } from '../app/js/i18n/index.ts';
import { bodyOf, sourcesUnder } from './helpers/sources.ts';

import { availableLocales } from '@the-inclusionist/engine/core/i18n.js';
import { PHASES } from '../app/js/rules/phase.ts';

/** The same tree every absence gate in this repository reads. See `tests/helpers/sources`. */
const ROOT = 'app/js';

/**
 * The FIRST argument of `t()`, single- or back-quoted, with no interpolation in it.
 *
 * ⚠️ ONE COPY, AND THE REASON IS THE SECOND GATE BELOW. That gate exists to prove this pattern still
 * finds the keys, because a pattern matching nothing makes the orphan gate pass by finding no orphans.
 * Written out twice - which is how it was first committed - the two copies can drift, and then the
 * self-check certifies a regex the gate does not use: the same "action and assertion through different
 * tables" defect this project keeps meeting, in the one place whose whole job is to catch it.
 *
 * `[,)]` at the end so that `t('hud.ball.with', { club })` counts: a key with parameters is still a key.
 *
 * ⚠️ AND AN OPTIONAL `x.` PREFIX, BECAUSE THE KEYS MOVED AND THIS GATE'S SELF-CHECK CAUGHT IT. Engine
 * 11.0 removed the module-level `t`, so every call site became `motor.t('...')`; the pattern excluded a
 * leading dot on purpose (to pass over `lq.t()`), and the count fell from 43 to 5 in one refactor. The
 * second gate below is what said so - which is the whole reason it exists - and it reported a stopped scan
 * instead of letting the orphan gate above announce coverage of five keys as if it were coverage of all.
 * A member call with a QUOTED first argument is a translation; `lq.t()` has no argument and still cannot
 * match.
 * Safe to share between the two gates because both read it with `matchAll`, which takes its own copy
 * rather than carrying `lastIndex` from one call to the next.
 */
const ASKED_KEY = /(?:^|[^A-Za-z0-9_$.])(?:[A-Za-z_$][\w$]*\.)?t\(\s*(?:'([^'\n]+)'|`([^`\n$]+)`)\s*[,)]/g;

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
    const asked = ASKED_KEY;
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
  //    finding no orphans - the purest form of a gate that cannot fail. If a refactor moves the keys
  //    somewhere this pattern cannot see, this goes red and says so rather than letting the gate above
  //    report coverage it no longer has.
  //
  // ⚠️ THE FLOOR WAS 40 AGAINST 43 KEYS AND IS NOW 30 AGAINST 36, AND BOTH MOVES WERE EARNED. The engine
  //    11.0 migration moved every call to `motor.t(...)`, which this gate caught by falling to 5 - that is
  //    the catch it was written for. The pattern was widened to see a member call, and the count then
  //    settled at 36 rather than 43: `input/preset` used to ask `t('act.up')` for twenty-three words and
  //    now DECLARES `labelKey: 'act.up'` instead, so those keys are no longer `t()` call sites at all.
  //
  //    ⚠️ AND THAT IS NOT LOST COVERAGE, WHICH IS THE ONLY REASON THE FLOOR MAY DROP. Those twenty-three
  //    are gated harder than before, by `tests/preset`'s own dictionary gate, which reads `labelKey` and
  //    `hintKey` directly instead of inferring them from a call. A floor lowered because the population
  //    genuinely shrank is honest; a floor lowered to make a red gate green is how a gate stops meaning
  //    anything, so the number moved only after the keys were followed to where they went.
  it('[Zero] and the pattern still finds the keys, or the gate above proves nothing', () => {
    const asked = ASKED_KEY;
    const found = new Set<string>();

    for (const file of sourcesUnder(ROOT)) {
      for (const hit of bodyOf(file).matchAll(asked)) {
        const key = hit[1] ?? hit[2];
        if (key !== undefined) found.add(key);
      }
    }

    expect(found.size, 'the key scan stopped finding keys').toBeGreaterThanOrEqual(30);
  });

  it('[Right] every dictionary is handed to the engine, not just the first', () => {
    const seen: string[] = [];

    installDicts((code) => seen.push(code));

    expect(seen.sort()).toEqual([...codes].sort());
  });
});
