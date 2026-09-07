// SPDX-License-Identifier: AGPL-3.0-or-later
// THE BROWSER ENTRY, and it exists apart from `main.ts` for a mechanical reason rather than a tidy one.
//
// `main.ts` is imported by tests in the `node` project, which have no bundler for a stylesheet: an
// `import '...css'` in there would break the whole logic suite. So the CSS - the only browser-only
// dependency of the boot - enters HERE, in the half that exists only in a browser.
import '@the-inclusionist/engine/style.css';

import { bootar } from './main.ts';

bootar();
