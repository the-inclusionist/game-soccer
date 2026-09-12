// SPDX-License-Identifier: AGPL-3.0-or-later
// WAIT FOR THE WORLD TO MOVE, NOT FOR THE CLOCK TO.
//
// ========================= WHY THE BROWSER SUITE WAS FLAKY, MEASURED =========================
// Every browser gate that needs the game to have RUN waited on a wall-clock sleep - forty-six of them,
// `await new Promise((r) => setTimeout(r, 350))` and its relatives. That is a bet that a given number of
// milliseconds contains a given number of frames, and under a full suite it does not.
//
// 📏 Measured 2026-09-11 by booting the game and counting `state.tick` across a 350 ms sleep:
//
//     run                              ticks in the sleep   wall clock it took   effective rate
//     the one file, alone                              22               366 ms     60.1 a second
//     the whole browser project                         6               992 ms      6.0 a second
//
// ⚠️ SO THE SLEEP IS WRONG TWICE OVER. The world advances at a TENTH of its nominal rate under load, and
// the sleep itself overshoots by nearly three times - the event loop is starved, so even the duration a
// test asked for is not the duration it gets. A gate that wanted twenty-one ticks of football got six.
//
// That is the whole of the flakiness this repository has been recording all day: `assists.browser` once,
// `boot.browser` on three different assertions, `stands.browser` once - every one of them green in
// isolation and green on a re-run, which is exactly the signature of a race against the machine's mood.
//
// ⚠️ AND A LONGER SLEEP IS NOT THE FIX. It makes the suite slower for everybody and moves the failure
// rather than removing it: the next contended run is slower still. The quantity these gates actually mean
// is TICKS - the world having moved - and that is a thing the game can be asked about rather than
// guessed at.
import { expect } from 'vitest';
import type { Booted } from '../../app/js/boot/main.ts';

/**
 * Resolve once the match has advanced `n` ticks from where it is now.
 *
 * ⚠️ THE TIMEOUT IS GENEROUS ON PURPOSE, and it is a wall-clock number for one reason only: a test that
 * waits for ever is worse than a test that fails. Sixty ticks a second is the nominal rate and six a
 * second is the measured floor under load, so ten seconds covers a full second of football with a factor
 * of ten in hand. A gate that trips this has not lost a race - the loop has stopped.
 */
export async function ticks(booted: Booted | null, n: number): Promise<void> {
  const from = booted?.state.tick ?? 0;
  await expect
    .poll(() => (booted?.state.tick ?? 0) - from, {
      timeout: ceilingFor(n),
      interval: 10,
    })
    .toBeGreaterThanOrEqual(n);
}

/**
 * The wall-clock ceiling for a wait of `n` ticks.
 *
 * ⚠️ IT WAS A FLAT TEN SECONDS AND THAT REBUILT THE BUG THIS FILE EXISTS TO REMOVE. The measurement above
 * says the world runs at SIX ticks a second under the full project, so ten seconds buys about sixty ticks -
 * and `tests/boot`'s goalmouth shot asks for `msToTicks(4000)`, which is 240. Forty seconds of wall clock
 * against a ten-second ceiling: not a race it could lose, a race it could not win. Exactly the arithmetic
 * this file diagnosed in `tests/stands` an hour earlier, reintroduced by its own fix.
 *
 * ⚠️ SO THE CEILING SCALES WITH THE REQUEST, at a floor of THREE ticks a second - half the measured rate,
 * so a machine twice as contended as the one measured still finishes. It is a backstop against a stopped
 * loop and nothing else, which is why being generous costs nothing: a healthy run never reaches it.
 */
const ceilingFor = (n: number): number => Math.max(10_000, (n / 3) * 1000);

/**
 * The same wait, expressed in the unit the gates were written in.
 *
 * ⚠️ IT EXISTS SO THE CONVERSION KEEPS EACH GATE'S OWN INTENT VISIBLE. A gate that slept 350 ms meant
 * "about a fifth of a second of football"; rewriting that as `ticks(booted, 21)` hides the number the
 * author chose. `ms(350)` reads the same as before and no longer depends on the machine's mood.
 */
export const msToTicks = (ms: number): number => Math.max(1, Math.round((ms / 1000) * 60));

/**
 * Wait in WALL CLOCK, because the claim is that nothing happens.
 *
 * ⚠️ THE DISTINCTION IS THE WHOLE POINT OF THIS FILE HAVING TWO FUNCTIONS. A gate that waits for the world
 * to move must wait on the world, or it races the machine's mood. A gate that waits to show the world does
 * NOT move cannot wait on the world - `ticks()` there would hang until its timeout and then fail, which is
 * the assertion inverted.
 *
 * ⚠️ AND THIS ONE IS NOT FLAKY, WHICH IS WHY IT MAY STAY A SLEEP. A contended machine gives it MORE wall
 * clock and more chances for the thing to happen, so load pushes it towards failing rather than towards
 * passing. That is the safe direction: the failure it can produce is a true one.
 *
 * The three places this is needed are all the same shape - the turn mode, in which no time passes without
 * a commit, and the stopped loop after it has been made to throw.
 */
export const quiet = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Wait for a CONDITION, with the patience measured in ticks rather than in seconds.
 *
 * ⚠️ A WALL-CLOCK DEADLINE ON A CONDITION THE WORLD HAS TO PRODUCE IS THE SAME BET AS A SLEEP, one step
 * removed. `tests/captions` gave its own `waitFor` six seconds: measured under the full browser project
 * that is about thirty-six ticks of football, and a goal that has to be judged, narrated and then written
 * to the caption line does not reliably fit in it. It passed alone and failed in the suite, which is the
 * signature this file exists to remove - and `tests/stands` had already met it and fixed it locally by
 * refusing to judge a reading taken while the page was starved.
 *
 * So patience here is TICKS: it gives up when the world has advanced `patienceTicks` without the condition
 * coming true, which means the machine delivered the frames and the thing genuinely did not happen. The
 * wall-clock ceiling stays, generous, for the one thing it is good for - a loop that never returns is
 * worse than one that fails - and it is deliberately far too long to be the thing that fires first.
 */
export async function until(
  booted: Booted | null,
  what: () => boolean,
  why: string,
  patienceTicks = 240,
): Promise<void> {
  const from = booted?.state.tick ?? 0;
  const wall = Date.now() + 120_000;
  while (Date.now() < wall) {
    if (what()) return;
    const ran = (booted?.state.tick ?? 0) - from;
    if (ran >= patienceTicks) {
      throw new Error(`timed out waiting for: ${why} (after ${String(ran)} ticks of football)`);
    }
    await new Promise((r) => setTimeout(r, 16));
  }
  throw new Error(`timed out waiting for: ${why} (the loop stopped producing ticks)`);
}
