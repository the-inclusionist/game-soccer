// SPDX-License-Identifier: AGPL-3.0-or-later
// WHICH BUILT FILES A SCHOOL DOWNLOADS ONCE, SO THE GAME WORKS WITH NO NETWORK (pillar 8).
//
// ========================= THE PLAN WAS MEASURED, NOT REASONED =========================
// The built bundle is 16 MB and 13.9 of them are ONE file - the ONNX runtime Piper's speech needs, which
// is in the bundle because `createGame` imports `createTts` unconditionally and not because this game
// speaks. A service worker written the obvious way precaches "the build", and thirty tablets then pull
// 16 MB each over a school connection for a voice nobody uses.
//
// Loading the page and reading the network log says what a match actually needs: the document, one
// script, one stylesheet, the font stylesheet and TWO font faces. The wasm is never requested. Nor are the
// other thirty-four faces, which load only if a child picks that typeface.
//
// So: precache what the page fetches, plus the three dictionaries, and let everything else be a runtime
// cache. Seven hundred and twenty-eight kilobytes instead of sixteen megabytes.
//
// ⚠️ AND THESE RULES ARE PURE, NOT INSIDE THE BUILD SCRIPT. "Is the fourteen-megabyte file excluded" is the
// question this feature has to get right, and a rule that lives in a script only runs when somebody builds
// - by which time the answer is a directory listing nobody reads.

export interface BuiltFile {
  /** Path relative to the built root, forward slashes, no leading slash. */
  readonly path: string;
  readonly bytes: number;
}

export interface PrecachePlan {
  /** Fetched and stored at install. Ordered as given, so the plan is diffable between builds. */
  readonly precache: readonly string[];
  /** Everything else. Listed rather than dropped, so "why is this not offline" has a readable answer. */
  readonly skipped: readonly string[];
  readonly bytes: number;
  readonly overBudget: boolean;
  /** Reasons this plan should not be shipped. Empty means it may be. */
  readonly problems: readonly string[];
}

/**
 * What the precache may weigh.
 *
 * ⚠️ IT HAS TO BE SMALL ENOUGH TO BITE. A budget nothing can breach is not a budget; this one is set below
 * the size of the single file the plan exists to exclude, so if the wasm ever slipped back in - a rule
 * loosened, a chunk renamed - the build says so instead of a classroom finding out.
 *
 * One megabyte against a measured 728 KB: real headroom for an ordinary change, and no room at all for
 * fourteen megabytes.
 */
export const PRECACHE_BUDGET_BYTES = 1024 * 1024;

/**
 * The two font faces the page loads before a child has chosen anything.
 *
 * ⚠️ THE STYLESHEET AND ITS FACES TRAVEL TOGETHER OR NEITHER WORKS - `fonts.css` addresses them by
 * RELATIVE url, so a cached stylesheet with missing faces renders in the fallback, and a child who needs
 * Atkinson silently does not get it.
 */
const DEFAULT_FACES = /^vendor\/fonts\/atkinson-(400|700)\.woff2$/;

/** Never precached, and each pattern is a decision rather than a filter. */
const EXCLUDED: readonly { readonly test: RegExp; readonly why: string }[] = Object.freeze([
  // 13.9 MB, 87% of the build, for speech this game does not use and the page never requests.
  // Belt and braces, and the braces are named: today this file is `ort-wasm-...` and the rule below
  // would also catch it, but a wasm that arrives under any other name still must not be stored.
  { test: /\.wasm$/, why: 'speech runtime, never fetched' },
  { test: /(^|\/)(ort|piper)[.-]/, why: 'speech runtime loader, loaded on demand' },
  // Thirty-four faces a child sees only if she picks that typeface. A runtime cache, not a download every
  // machine pays for once.
  { test: /^vendor\/fonts\/.*\.woff2$/, why: 'typeface loaded on demand' },
]);

function excludedReason(path: string): string | null {
  if (DEFAULT_FACES.test(path)) return null;
  for (const rule of EXCLUDED) if (rule.test.test(path)) return rule.why;
  return null;
}

/**
 * Split a build into what is stored at install and what is not.
 *
 * ⚠️ IT REPORTS PROBLEMS RATHER THAN THROWING. A build that produced no document would give an empty plan,
 * comfortably under budget, and a service worker that caches nothing and reports success - a green that
 * looked at nothing, which is the failure mode every gate in this repository has had to be defended
 * against. Naming it lets the caller decide whether that is fatal; leaving it out would let it ship.
 */
export function precachePlan(files: readonly BuiltFile[]): PrecachePlan {
  const precache: string[] = [];
  const skipped: string[] = [];
  let bytes = 0;

  for (const file of files) {
    if (excludedReason(file.path) === null) {
      precache.push(file.path);
      bytes += file.bytes;
    } else {
      skipped.push(file.path);
    }
  }

  const problems: string[] = [];
  if (!precache.includes('index.html')) problems.push('no index.html in the build: nothing to serve offline');
  if (!precache.some((p) => p.endsWith('.js'))) problems.push('no script in the build: the game cannot start');

  return { precache, skipped, bytes, overBudget: bytes > PRECACHE_BUDGET_BYTES, problems };
}
