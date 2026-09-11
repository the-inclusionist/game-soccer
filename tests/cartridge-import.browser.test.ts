// SPDX-License-Identifier: AGPL-3.0-or-later
// IMPORTING THE COMPOSITION ROOT DOES NOTHING. The one cartridge gate that is not a grep.
//
// ========================= WHAT THIS ASSERTS, AND WHY IT IS ITS OWN FILE =========================
// `ADR-0139`'s first confirmation gate, in its own words: «a cartridge that is imported and never
// instantiated must do nothing observable - no DOM, no listener, no registration. A test that imports
// and asserts an untouched document.»
//
// `boot/main.ts` already satisfies it, and its header says so in the first three lines: there is no
// `bootar()` at the bottom of the file, because the 2048 measured a double boot from exactly that line -
// two canvases stacked pixel for pixel, two keyboard listeners, every move played twice. That reads as
// "the controls feel wrong" and not as a bug, and neither a logic test nor a screenshot can see it.
//
// ⚠️ BUT UNTIL THIS FILE, THAT PROPERTY WAS ONLY ASSERTED IN A COMMENT. `tests/boot.browser` imports
// `bootar` and calls it, which measures the opposite thing. A header is not a gate, and the line that
// would break this is one line long and looks like a convenience.
//
// ⚠️ AND IT HAS TO BE A SEPARATE FILE, WHICH IS THE MECHANICAL HALF. Any other module in the same file
// importing the app would warm the module registry, and the import under test would be a cache hit that
// runs nothing - a gate that passes because it measured nothing. Nothing here imports the game except
// the dynamic import inside the test.
import { describe, expect, it } from 'vitest';

/**
 * The markup the boot needs, so that a boot WOULD do something.
 *
 * ⚠️ THE SHELL IS LOAD-BEARING RATHER THAN DECORATIVE. `bootar` returns `null` immediately when there is
 * no `#pitch`, so on an empty page an import that DID boot would also be invisible - the gate would pass
 * for the wrong reason and no mutation could ever kill it. With the shell present, a boot makes a canvas.
 */
const SHELL = `
  <p id="sr-status" role="status" aria-live="polite"></p>
  <p id="sr-alert" role="alert" aria-live="assertive"></p>
  <main>
    <div id="stage-wrap"><div id="stage">
      <section id="game-region" tabindex="-1" aria-label="Futebol">
        <div id="pitch"></div>
        <p id="caption" aria-hidden="true"></p>
        <div id="mirror">
          <p id="m-fixture">-</p>
          <p><b id="m-score">0 - 0</b> <span id="m-clock">00:00</span></p>
          <p id="m-phase">-</p>
          <p id="m-ball">-</p>
          <p id="m-you">-</p>
          <p id="m-hint"></p>
          <ul id="m-options"></ul>
          <p id="m-charge"></p>
          <p id="m-lagging"></p>
        </div>
      </section>
    </div></div>
    <div class="tools"><div id="a11y-bar"></div></div>
  </main>
`;

describe('a module that is imported and never called', () => {
  it('[Zero] leaves the document exactly as it found it', async () => {
    document.body.innerHTML = SHELL;
    const before = document.body.innerHTML;

    const mod = await import('../app/js/boot/main.ts');

    // ⚠️ THE MODULE REALLY LOADED, which is the half that stops this passing vacuously. A failed import
    //    would reject and a wrong path would give an object with no `bootar` - and either way an
    //    untouched document would be true and meaningless.
    expect(typeof mod.bootar, 'the module under test did not load').toBe('function');

    expect(document.querySelectorAll('canvas').length, 'importing the boot created a canvas').toBe(0);
    expect(document.querySelector('#pitch')?.childElementCount, 'the pitch was filled on import').toBe(0);
    expect(document.body.innerHTML, 'importing the boot changed the document').toBe(before);
  });
});
