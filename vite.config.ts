import { defineConfig } from 'vitest/config'; // not 'vite': vitest/config is what types the `test` field
import { playwright } from '@vitest/browser-playwright';

// ============================ THE ENGINE IS A LINKED DEPENDENCY ============================
// `file:../SP-the-inclusionist-tracer` makes npm symlink the engine into node_modules, so this repository
// reads the engine folder LIVE. `optimizeDeps.exclude` states that rather than relying on Vite happening
// not to pre-bundle a linked package: the engine is under active edit in another session, and pre-bundling
// it would serve a stale copy after every engine change.
export default defineConfig({
  root: 'app',
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022' },
  optimizeDeps: {
    exclude: ['@the-inclusionist/engine'],
    include: ['pixi.js'],
  },

  test: {
    projects: [
      {
        // PURE LOGIC, and it is most of this repository on purpose: the simulation, the referee, the AI,
        // the drivers and the seven-field declaration all run with no DOM and no PixiJS. That pressure is
        // what keeps the rules of football out of the renderer, and it is the half a school can audit
        // without a browser.
        test: {
          name: 'node',
          root: import.meta.dirname,
          environment: 'node',
          include: ['tests/**/*.node.test.{js,ts}'],
        },
      },
      {
        // Anything needing a real focus ring or a real canvas: the accessible text mirror, the turn panel,
        // the integer-pixel gate and the PixiJS surface underneath them.
        test: {
          name: 'browser',
          /**
           * ⚠️ THE DEFAULT KILLED GATES THAT WERE STILL WORKING. Measured 2026-09-11: inside the full
           * browser project the game runs at SIX ticks a second rather than sixty, so a gate that waits
           * for four seconds of football - `tests/boot`'s goalmouth shot asks for 240 ticks - legitimately
           * needs forty seconds of wall clock. Two such gates failed at about twenty seconds while the
           * world was still delivering frames, which is the test runner giving up on a healthy test.
           *
           * ⚠️ AND RAISING IT IS NOT THE SAME MOVE AS RAISING A SLEEP. A sleep asks the machine to be fast;
           * this asks the runner to be patient while `tests/helpers/ticks` watches the thing that actually
           * matters - whether the world advanced. The helper still fails a stopped loop, at a ceiling that
           * scales with the ticks requested, so nothing here waits for ever.
           */
          testTimeout: 120_000,
          root: import.meta.dirname,
          include: ['tests/**/*.browser.test.{js,ts}'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            // Wide enough for the game to choose a real integer scale. At a narrow viewport the boot picks
            // k=1 and a screenshot shows a 320x180 postage stamp, which is not what a classroom sees.
            viewport: { width: 1280, height: 800 },
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
