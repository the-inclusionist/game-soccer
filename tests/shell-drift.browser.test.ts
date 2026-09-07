// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PAGE THE TESTS AUDIT IS THE PAGE THE CHILD OPENS.
//
// ========================= WHY THIS FILE EXISTS, AND WHAT IT ALREADY CAUGHT =========================
// The browser tests do not load `app/index.html`; each one installs a copy of the markup as a template
// literal, because a test that navigated to the page could not then call `bootar(document, window)` and
// hold the handle it asserts on. Three copies of one document is the arrangement, and copies drift.
//
// They had. The end-of-match panel was added to `index.html` and to `boot.browser.test.ts` and NOT to
// `a11y.browser.test.ts` - so the one panel a child reads at the end of every match had never once been
// through axe, and the accessibility gate reported ZERO violations while auditing a page that did not
// contain it. Nothing was red. A gate that audits the wrong document is worse than no gate, because it
// answers the question with the wrong page and the answer looks the same.
//
// ⚠️ IT COMPARES IDS AND NOT MARKUP, and the limit is deliberate rather than lazy. Ids are what the shells
// exist to provide - `createGame` looks for them by name, `bootar` queries them, and a missing one is the
// exact failure mode. Demanding identical markup would fail on every whitespace change and would be
// switched off within a month, which is how a strict gate becomes no gate.
import { describe, expect, it } from 'vitest';
// ⚠️ `?raw` AND NOT `fetch`. The browser project's document root is `app/`, so the test files themselves
// are not served over HTTP at all - and a `fetch` that 404s would make every comparison below vacuously
// empty, which is precisely the failure this file exists to catch. A raw import is resolved by the
// bundler at build time and either produces the text or fails the run.
import realHtml from '../app/index.html?raw';
import a11yShell from './a11y.browser.test.ts?raw';
import bootShell from './boot.browser.test.ts?raw';

/** Every `id="..."` in a document, in the order they appear. */
function idsIn(html: string): string[] {
  return [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
}


/**
 * The shells, read from the test files themselves.
 *
 * ⚠️ SLICED OUT OF THE SOURCE TEXT RATHER THAN EXPORTED FROM IT. They are module-private `const SHELL`
 * strings, and exporting them would be changing the code to suit the test - after which the next shell
 * somebody adds simply would not be exported, and the drift comes back with one extra step in front of
 * it. Reading the file is the only version of this that cannot be forgotten.
 */
const SHELLS: readonly (readonly [string, string])[] = [
  ['a11y.browser.test.ts', a11yShell],
  ['boot.browser.test.ts', bootShell],
];

function shellIds(src: string): string[] {
  const from = src.indexOf('const SHELL = `');
  expect(from, 'the file declares a SHELL').toBeGreaterThan(-1);
  const to = src.indexOf('`;', from);
  return idsIn(src.slice(from, to));
}

const real = idsIn(realHtml);

describe('the markup the browser tests stand in for', () => {
  it('[Interface] the real page has ids at all, so an empty comparison cannot pass', () => {
    // Without this, a page that parsed to nothing would make every assertion below vacuously true - which
    // is the failure this whole file is about, one level up: a comparison against an empty list passes.
    expect(real.length).toBeGreaterThan(10);
    expect(real).toContain('game-region');
  });

  for (const [name, src] of SHELLS) {
    it(`[Interface] ${name} stands in for the WHOLE page`, () => {
      const shell = shellIds(src);
      const missing = real.filter((id) => !shell.includes(id));

      expect(missing, 'ids in app/index.html that this shell does not have').toEqual([]);
    });
  }

  it('[Zero] and no shell invents an id the real page does not have', () => {
    for (const [name, src] of SHELLS) {
      const invented = shellIds(src).filter((id) => !real.includes(id));

      // An id only the tests have is a feature only the tests can see: the gate would be green and the
      // child would open a page without it.
      expect(invented, `ids in ${name} that app/index.html does not have`).toEqual([]);
    }
  });
});
