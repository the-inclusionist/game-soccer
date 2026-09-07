// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT A SCHOOL DOWNLOADS ONCE SO THE GAME WORKS WITH NO NETWORK.
//
// ========================= THE NUMBER THAT DECIDED THIS DESIGN =========================
// The built bundle is 16 MB. Thirteen point nine of them are ONE file: the ONNX runtime that Piper's
// text-to-speech needs, which arrives because `createGame` imports `createTts` unconditionally - this
// game never calls it.
//
// A service worker written the obvious way precaches "the build", and a classroom of thirty tablets then
// pulls 16 MB each over a school connection, for a voice this game does not use.
//
// So the plan was MEASURED rather than reasoned. Loading the page and reading the network log says it
// fetches SIX things: the document, one script, one stylesheet, the font stylesheet and two font faces.
// The wasm is never requested; nor are the other thirty font faces, which load only if a child picks a
// different typeface. Everything else is on demand, and on demand belongs in a runtime cache and not in a
// precache.
//
// ⚠️ AND THE RULES ARE HERE, PURE, RATHER THAN INSIDE THE BUILD SCRIPT. "Is the fourteen-megabyte file
// excluded" is the one question this feature has to get right, and a rule that lives in a script only
// runs when somebody builds - by which time the answer is a directory listing nobody reads.
import { describe, expect, it } from 'vitest';
import { PRECACHE_BUDGET_BYTES, precachePlan, type BuiltFile } from '../app/js/pwa/precache.ts';

/** The build as it actually is, measured from `dist/` - hashes and all. */
const BUILD: readonly BuiltFile[] = Object.freeze([
  { path: 'index.html', bytes: 7784 },
  { path: 'assets/index-B_dwxGIB.js', bytes: 607213 },
  { path: 'assets/index-Q3SaOKqV.css', bytes: 34104 },
  { path: 'vendor/fonts.css', bytes: 8163 },
  { path: 'vendor/fonts/atkinson-400.woff2', bytes: 17208 },
  { path: 'vendor/fonts/atkinson-700.woff2', bytes: 17524 },
  { path: 'assets/en-B1S0TRxH.js', bytes: 25792 },
  { path: 'assets/es-C0UhiWX0.js', bytes: 27641 },
  { path: 'assets/ort-wasm-simd-threaded-DDx2apAW.wasm', bytes: 13961845 },
  { path: 'assets/ort.wasm.bundle.min-qHKafjX_.js', bytes: 70563 },
  { path: 'assets/piper-o91UDS6e-DVY5PGyk.js', bytes: 87992 },
  { path: 'assets/piper-tts-web-qvxJbWq7.js', bytes: 9000 },
  { path: 'vendor/fonts/andika-400-ext.woff2', bytes: 81416 },
  { path: 'vendor/fonts/lato-400.woff2', bytes: 23580 },
]);

const plan = precachePlan(BUILD);

describe('what is downloaded before the network goes away', () => {
  it('[Right] the document, the script and the stylesheet - the game itself', () => {
    expect(plan.precache).toContain('index.html');
    expect(plan.precache).toContain('assets/index-B_dwxGIB.js');
    expect(plan.precache).toContain('assets/index-Q3SaOKqV.css');
  });

  // ⚠️ THE FONT STYLESHEET AND ITS FACES TRAVEL TOGETHER OR NEITHER WORKS. `fonts.css` addresses its faces
  //    by RELATIVE url, so a cached stylesheet whose faces are missing is a stylesheet that renders in the
  //    fallback - which for this project means a child who needs Atkinson does not get it, offline, with
  //    nothing on the screen saying why.
  it('[Right] the font stylesheet and the two faces the page actually loads', () => {
    expect(plan.precache).toContain('vendor/fonts.css');
    expect(plan.precache).toContain('vendor/fonts/atkinson-400.woff2');
    expect(plan.precache).toContain('vendor/fonts/atkinson-700.woff2');
  });

  // ⚠️ PILLAR 3 HAS TO SURVIVE THE NETWORK GOING AWAY. The engine loads its own dictionaries as separate
  //    chunks, so a child switching to Spanish offline would get a screen of raw keys - which is exactly
  //    the silent failure the i18n gate exists for, arriving through a different door. Fifty-three
  //    kilobytes buys all three languages.
  it('[Right] and every language, because a language that needs the network is not offered', () => {
    expect(plan.precache).toContain('assets/en-B1S0TRxH.js');
    expect(plan.precache).toContain('assets/es-C0UhiWX0.js');
  });
});

describe('what is deliberately left out', () => {
  // ⚠️ THE ONE THAT CANNOT BE GOT WRONG. Thirteen point nine megabytes, per tablet, for a voice this game
  //    does not use - and it is never even requested by the running page.
  it('[Zero] the speech runtime, which is 87% of the build and is never fetched', () => {
    for (const path of plan.precache) expect(path, path).not.toMatch(/\.wasm$/);
    expect(plan.skipped).toContain('assets/ort-wasm-simd-threaded-DDx2apAW.wasm');
  });

  it('[Zero] and everything that arrives with it', () => {
    for (const path of plan.precache) {
      expect(path, path).not.toMatch(/piper/);
      expect(path, path).not.toMatch(/ort\./);
    }
  });

  // Thirty-four faces the page does not load unless a child picks that typeface. They are a runtime cache,
  // not a download every machine pays for once.
  it('[Zero] and the font faces nobody asked for yet', () => {
    expect(plan.precache).not.toContain('vendor/fonts/andika-400-ext.woff2');
    expect(plan.precache).not.toContain('vendor/fonts/lato-400.woff2');
  });

  // ⚠️ NOTHING IS SILENTLY DROPPED. Every file in the build is either precached or listed as skipped, so
  //    "why is this not offline" has an answer that can be read rather than guessed at.
  it('[Interface] every file in the build is accounted for, one way or the other', () => {
    expect([...plan.precache, ...plan.skipped].sort()).toEqual(BUILD.map((f) => f.path).sort());
  });
});

describe('the budget', () => {
  it('[Right] the real build fits, and the figure is the sum of what it precaches', () => {
    expect(plan.overBudget).toBe(false);
    expect(plan.bytes).toBe(
      BUILD.filter((f) => plan.precache.includes(f.path)).reduce((n, f) => n + f.bytes, 0),
    );
  });

  // ⚠️ A BUDGET NOTHING CAN BREACH IS NOT A BUDGET. If the wasm ever slipped back into the plan - a rule
  //    loosened, a chunk renamed - this is the number that would say so, and it has to be small enough to
  //    say it.
  it('[Boundary] and it BITES: adding the speech runtime blows it', () => {
    expect(PRECACHE_BUDGET_BYTES).toBeLessThan(13961845);
    expect(plan.bytes + 13961845).toBeGreaterThan(PRECACHE_BUDGET_BYTES);
  });

  it('[Boundary] over budget is REPORTED, not thrown - the caller decides what to do about it', () => {
    const fat = precachePlan([{ path: 'index.html', bytes: PRECACHE_BUDGET_BYTES + 1 }]);

    expect(fat.overBudget).toBe(true);
  });

  it('[Interface] there is real headroom, so an ordinary change does not have to move the number', () => {
    expect(plan.bytes).toBeLessThan(PRECACHE_BUDGET_BYTES * 0.85);
  });
});

describe('a plan that looked at nothing', () => {
  // ⚠️ THE FAILURE MODE OF EVERY GATE IN THIS REPOSITORY. A build that produced no document would give an
  //    empty plan, well under budget, and a service worker that caches nothing and reports success - a
  //    green that looked at nothing. It has to be a failure with a name.
  it('[Zero] a build with no entry document is a defect, not an empty success', () => {
    const empty = precachePlan([{ path: 'assets/index-abc.js', bytes: 10 }]);

    expect(empty.problems).not.toEqual([]);
    expect(empty.problems.join(' ')).toMatch(/index\.html/);
  });

  it('[Zero] and so is one with no script at all', () => {
    const noScript = precachePlan([{ path: 'index.html', bytes: 10 }]);

    expect(noScript.problems).not.toEqual([]);
  });

  it('[Right] the real build has no problems', () => {
    expect(plan.problems).toEqual([]);
  });
});
