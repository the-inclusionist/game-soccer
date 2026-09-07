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
// ========================= WHAT IS EXCLUDED, AND WHY THAT CHANGED =========================
// ONE subtree: `[vw]`, the VLibras interpreter. This file used to say "nothing", and that was true while
// the game did not carry the widget.
//
// It carries it now, and the cost was MEASURED rather than predicted: axe reports a CRITICAL `image-alt`
// inside it - an `<img>` with no text alternative, in markup this repository does not write and cannot
// fix without fighting a third party's own re-renders on every frame.
//
// ⚠️ AND THE EXCLUSION DOES NOT FIX IT FOR ANYBODY. It stops the gate reporting a defect nobody here can
// repair; the image is still in the page a child opens. It is narrow - one attribute selector, not a rule
// switched off - it is the same exclusion the engine makes for the same widget, and the README and
// `docs/ENGINE-AUDIT.md` say so rather than claiming a clean sheet this page no longer has.
//
// The rest of the page is still audited with no exceptions at all, which is where the value was.
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
    // The interpreter widget, and nothing else. See the header.
    //
    // ⚠️ TWO SELECTORS, AND THE SECOND ONE IS THE ONE THAT WORKS. `[vw]` is the div this page writes; the
    //    widget does not stay in it - it attaches `#vlibras-access-wrapper` straight onto `<body>`, which
    //    the engine's `ui/vlibras` header records as the change that broke three things at once when it
    //    happened. Excluding only our own div excluded nothing at all, and the gate stayed red pointing at
    //    two images in a subtree nobody here writes.
    .exclude('[vw]')
    .exclude('#vlibras-access-wrapper')
    .analyze();

  if (results.violations.length) {
    console.error(JSON.stringify(results.violations, null, 2));
    console.error(`\n✗ axe: ${results.violations.length} WCAG A/AA violation(s).`);
    process.exit(1);
  }
  console.log('✓ axe: 0 WCAG A/AA violations — one exclusion, the VLibras widget.');
} finally {
  await browser.close();
}
