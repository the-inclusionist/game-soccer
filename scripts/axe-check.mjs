// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ACCESSIBILITY GATE — axe-core against the BUILT game over HTTP, not against the source.
//
// ========================= WHY THE RUNNING GAME AND NOT THE SOURCE =========================
// Most of what this game does for accessibility exists only at run time. The club lists are built from
// twelve dictionary keys in the child's language; the remap screen's rows, its per-keyboard toggles and
// every accessible name on it are assembled from the declaration; the assistances screen fills three
// `<select>`s from three tables; the text mirror is written by the tick. A source analyser would see an
// empty `<select>` and an empty `<div>` and report nothing.
//
// ========================= ⚠️ IT WAITS FOR THE MATCH, NOT FOR THE PAGE =========================
// `networkidle` says the network stopped. It does not say the game booted. The wait is for `#m-phase` to
// stop reading its placeholder - the last artefact of the whole chain (locale registered -> dictionaries
// installed -> declaration built -> simulation running -> phase translated). Waiting for `#sr-status`,
// which is static markup, would let this analyse a page where nothing has started and hand back a green
// that looked at nothing.
//
// ⚠️ AND THIS FILE'S HEADER USED TO DESCRIBE A DIFFERENT GAME. It arrived from the 2048 talking about
// "the sixteen cells" and "the board", neither of which exists here, while the code below already waited
// on this game's phase line. The code was right and the reasoning was somebody else's - which is the kind
// of comment that survives precisely because nothing ever fails because of it.
//
// ========================= WHAT IS EXCLUDED, WHICH IS WORTH STATING =========================
// Nothing. The engine excludes the VLibras widget because it does not control third-party markup; this
// game does not load that widget, so there is not one exclusion here - and a gate with no exceptions is
// the only kind that does not have to be read with suspicion.
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const URL = process.env.AXE_URL || 'http://localhost:4173/';

const browser = await chromium.launch();
try {
  // Playwright's axe binding needs a page from an explicit context.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => {
      const phase = document.querySelector('#m-phase');
      return phase !== null && phase.textContent !== null && phase.textContent.trim() !== '-';
    },
    { timeout: 15_000 },
  );

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  if (results.violations.length) {
    console.error(JSON.stringify(results.violations, null, 2));
    console.error(`\n✗ axe: ${results.violations.length} WCAG A/AA violation(s).`);
    process.exit(1);
  }
  console.log('✓ axe: 0 WCAG A/AA violations — and not one exclusion.');
} finally {
  await browser.close();
}
