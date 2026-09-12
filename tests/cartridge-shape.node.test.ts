// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SHAPE A CARTRIDGE HAS TO BE IN, GATED WHILE IT IS STILL TRUE.
//
// ========================= WHY THIS FILE EXISTS BEFORE THE CONVERSION DOES =========================
// The platform is one origin: one PWA, one service worker, one install, and the accessibility stack -
// the bar, the pause card, the colour-vision filters, the TTS, the sonar, the settings panel, the
// keyboard runtime - mounted ONCE by the platform before any game's code runs. A game becomes a
// cartridge: a factory the platform instantiates, tears down and instantiates again.
//
// ⚠️ AND THIS REPOSITORY ALREADY SATISFIES MOST OF IT, WHICH IS THE WHOLE PROBLEM. Measured on
// 2026-09-11 against the requirements of `the-inclusionist-site/docs/cartridge-brief.md`, nine are
// already paid here - and every one of them is an ABSENCE. No module-level `let`. No shared-RNG import.
// No read of the address bar. A second frame loop that does not exist.
//
// An absence is lost without a single test going red. A refactor hoists one `let`; a tidy-up reaches for
// `shuffle` because it is right there; a new panel reads `?seed=`. Nothing fails, and the conversion
// that has not started yet gets more expensive in silence.
//
// ⚠️ SO THESE ARE GATES ON WHAT IS NOT HERE, WRITTEN WHILE IT IS NOT HERE. A gate on an absence that
// nobody writes while the absence holds is a gate nobody ever writes - it only becomes obvious on the
// day it would already have failed.
//
// ========================= AND THE CONVERSION IS NOT STARTED, DELIBERATELY =========================
// ADR-0068 §6 sends one game end to end before the others begin, and the brief names it: whackwhack,
// the smallest build of the collection, already on engine 8. Its own words are that anyone who is not
// whackwhack waits for the contract to come back with its holes filled. So nothing here converts
// anything. These gates hold the ground; the conversion is a later item with its own plan.
//
// The rules are `ADR-0139` (a cartridge supplies half of `CreateGameOptions` and never calls
// `createGame`), `ADR-0140` (standalone PWA and cartridge from one source) and `ADR-0141` (a cartridge
// owns its random stream), in `the-inclusionist-docs/docs/2-Architecture/adr/`.
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { bodyOf, sourcesUnder } from './helpers/sources.ts';
import { DICTS, installDicts } from '../app/js/i18n/index.ts';

const ROOT = 'app/js';

const SOURCES = sourcesUnder(ROOT);

describe('the cartridge shape', () => {
  it('[Zero] the walk found the whole tree, or every gate below proves nothing', () => {
    expect(SOURCES.length).toBeGreaterThan(50);
    // ⚠️ THE ROOT FILES BY NAME, because their absence is the exact failure the walk replaces a glob to
    //    avoid, and a count alone would not notice four missing out of ninety.
    for (const name of ['declaration.ts', 'narration.ts', 'play.ts', 'project.ts']) {
      expect(SOURCES, `${name} is not being looked at`).toContain(join(ROOT, name));
    }
  });

  // ⚠️ SPEC D14, AND THE ENGINE'S OWN USER STORY: «I want the engine to carry no game state, so that two
  //    games on one page do not collide». A cartridge is instantiated by a factory, so state at module
  //    scope survives `teardown()` and leaks into the NEXT game on the same page. This repository's
  //    `boot/main.ts` has eleven `let`s and every one of them is inside `bootar`, which is correct and is
  //    exactly the kind of correctness a refactor undoes for free.
  it('[Interface] nothing mutable lives at module scope', () => {
    const offences: string[] = [];

    for (const file of SOURCES) {
      const lines = bodyOf(file).split('\n');
      for (const [i, line] of lines.entries()) {
        // Column zero is module scope in this codebase's style: everything inside a function is indented.
        if (/^(let|var)[\s(]/.test(line)) offences.push(`${file}:${i + 1} ${line.trim()}`);
      }
    }

    expect(offences, 'module-level state leaks into the next game on the page').toEqual([]);
  });

  // ⚠️ ADR-0141, AND THE RULE IS NEGATIVE BECAUSE A POSITIVE ONE WOULD NOT WORK. The engine's `core/rng`
  //    exports an independent-stream factory AND four helpers bound to one module-level stream. A
  //    cartridge using `ctx.rng` for everything and reaching for the imported `shuffle` ONCE has the full
  //    defect: the shared stream advances and another cartridge's draws move. There is no partial
  //    version, so the forbidden list IS the rule.
  //
  // ⚠️ AND IT IS INVISIBLE WHERE THE TESTS RUN, which is why it needs a gate rather than a convention: a
  //    standalone build has one stream and passes either way.
  it('[Interface] no source draws from the engine\'s shared random stream', () => {
    const offences: string[] = [];

    for (const file of SOURCES) {
      const body = bodyOf(file);
      if (!body.includes('core/rng')) continue;
      for (const name of ['rnd', 'randInt', 'shuffle', 'reseed']) {
        // The import CLAUSE only: `createRng` is the permitted export and contains none of these words as
        // a standalone identifier, while `rng.rnd()` on an own stream is exactly what is allowed.
        const clause = new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"][^'"]*core/rng`);
        if (clause.test(body)) offences.push(`${file}: ${name}`);
      }
    }

    expect(offences, 'two cartridges on one page would move each other\'s draws').toEqual([]);
  });

  // ⚠️ IN THE PLATFORM THERE IS ONE ADDRESS FOR EVERY CARTRIDGE, so a game reading `location.search`
  //    reads another game's parameters, or the platform's. The shell decides what this cartridge may see
  //    and hands it over. This repository reads nothing today, and the gate is here so the first panel
  //    that wants a query parameter has to go through a shell instead of reaching for the address bar.
  it('[Interface] nothing reads the address bar', () => {
    const offences: string[] = [];

    for (const file of SOURCES) {
      const body = bodyOf(file);
      if (body.includes('location.search') || body.includes('URLSearchParams')) offences.push(file);
    }

    expect(offences, 'a cartridge would read another game\'s parameters').toEqual([]);
  });

  // ⚠️ ADR-0139 §2 IS THE CLAUSE THE OTHERS HANG FROM. `createGame` mounts the whole accessibility stack;
  //    N calls means N accessibility bars, N TTS instances and N keyboard runtimes competing for one
  //    document - worse than shipping the engine twice, because it appears as broken behaviour rather
  //    than as weight. And §3: six cartridges each opening their own frame callback is six loops fighting
  //    over one frame.
  //
  // ⚠️ ONE CALL SITE EACH IS THE GATE, NOT ZERO. Both are legitimately called today, by the composition
  //    root, because this repository is still an application. What must not happen is a SECOND caller
  //    appearing, because the conversion then has two places to move instead of one - and the second one
  //    is the one nobody remembers.
  it('[Interface] the engine is composed and the loop is started in exactly one place each', () => {
    const sites: Record<string, string[]> = { createGame: [], startLoop: [] };

    for (const file of SOURCES) {
      const body = bodyOf(file);
      for (const name of ['createGame', 'startLoop'] as const) {
        // A CALL, not a mention: the identifier followed by an open bracket. An import naming it is not a
        // call site, and a type annotation is not either.
        const calls = body.match(new RegExp(`\\b${name}\\s*\\(`, 'g'));
        if (calls !== null) for (let k = 0; k < calls.length; k++) sites[name].push(file);
      }
    }

    expect(sites.createGame, 'the accessibility stack is mounted in more than one place').toEqual([
      join(ROOT, 'boot', 'main.ts'),
    ]);
    expect(sites.startLoop, 'more than one frame loop').toEqual([join(ROOT, 'boot', 'main.ts')]);
  });

  // ⚠️ EITHER SHELL REGISTERS THE DICTIONARIES, so they have to be reachable as DATA and not only as a
  //    side effect. `DICTS` is already exported; what this asks is that `installDicts` and `DICTS` cannot
  //    drift - a dictionary added to one and not the other is a language that exists and is never
  //    consulted, which is the exact failure `i18n/index.ts` records in its own header about locale codes.
  it('[Interface] the dictionaries are data, and the installer registers exactly them', () => {
    const registered: string[] = [];
    installDicts((code2) => {
      registered.push(code2);
    });

    expect(registered.sort()).toEqual(Object.keys(DICTS).sort());
    expect(registered.length).toBeGreaterThanOrEqual(3);
  });
});
