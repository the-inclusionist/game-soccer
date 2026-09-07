// SPDX-License-Identifier: AGPL-3.0-or-later
//
// THE ENGINE'S FONTS, COPIED INTO THIS GAME'S `public/`.
//
// ⚠️ WHY THIS EXISTS, AND WHY IT IS A COPY RATHER THAN AN IMPORT: `vendor/fonts.css` addresses its 36
// faces by RELATIVE URL (`url('fonts/atkinson-400.woff2')`). A stylesheet resolves a relative URL against
// its own position, so the file and the `fonts/` folder travel TOGETHER or neither of them works.
// Importing it through the bundler would have Vite rewrite those URLs into hashed `assets/` paths - which
// works, and destroys the reason `_headers` and the service worker treat a font as immutable.
//
// The engine exports `./assets/*`, so the source path is DECLARED and not guessed (`package.json`,
// `exports` field). If it ever moves, this breaks LOUDLY at build time instead of serving 404s in silence.
import { cp, mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
// Resolved through the package's `exports` rather than by reaching into `node_modules/...` by hand: the
// path is the one the engine PROMISES, not the one it happens to have today.
const fontsCss = require.resolve('@the-inclusionist/engine/assets/vendor/fonts.css');
const from = dirname(fontsCss);
const to = join(import.meta.dirname, '..', 'app', 'public', 'vendor');

await rm(to, { recursive: true, force: true });
await mkdir(to, { recursive: true });
await cp(from, to, { recursive: true });
console.log(`engine fonts copied: ${from} -> ${to}`);
