// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT EVERY BROWSER TEST GETS BEFORE IT ASKS.
//
// ⚠️ THE ENGINE'S STYLESHEET, so a gate can measure what a child reads. The engine 11.0 checks the CSS
// variable `--incl-engine-stylesheet` on the root; without it, `motor.problems` carries the warning that
// the page did not link the stylesheet, and every test that asks `problems === []` is red for an
// infrastructure reason rather than a defect. In the running game `app/js/boot/boot.ts` has this import;
// in tests we boot via `bootar` from `main.ts`, which does not — so this file is the test's `boot.ts`.
import '@the-inclusionist/engine/style.css';
