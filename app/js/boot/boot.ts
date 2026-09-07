// SPDX-License-Identifier: AGPL-3.0-or-later
// THE BROWSER ENTRY, and it exists apart from `main.ts` for a mechanical reason rather than a tidy one.
//
// `main.ts` is imported by tests in the `node` project, which have no bundler for a stylesheet: an
// `import '...css'` in there would break the whole logic suite. So the CSS - the only browser-only
// dependency of the boot - enters HERE, in the half that exists only in a browser.
import '@the-inclusionist/engine/style.css';

import { bootar } from './main.ts';

bootar();

/**
 * PILLAR 8: the school gets the game once and then does not need the network.
 *
 * ⚠️ REGISTERED HERE AND NOT IN `main.ts`, for the same mechanical reason the stylesheet is: `main.ts` is
 * imported by the `node` project, and a service-worker registration in there would reach for a
 * `navigator` that is not present. This half exists only in a browser.
 *
 * ⚠️ AND ONLY IN A BUILD. `sw.js` is written by `scripts/build-sw.mjs` AFTER the bundler has hashed
 * everything, so it does not exist while developing - registering it there would log a 404 on every
 * reload and teach whoever is working to ignore the console.
 *
 * ⚠️ A FAILURE IS SWALLOWED ON PURPOSE, and this is the one place in this repository where that is right:
 * a browser with service workers disabled, a page served from `file://`, a locked-down school profile.
 * None of them is an error the child can act on, and all of them still play the game - offline is the
 * thing that is lost, not the match.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
