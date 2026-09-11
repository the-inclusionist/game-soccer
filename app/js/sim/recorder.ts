// SPDX-License-Identifier: AGPL-3.0-or-later
// A MATCH, WRITTEN DOWN. And the refusal that keeps a recording honest.
//
// ⚠️ IN MEMORY AND IN TEST FIXTURES ONLY. ADR-0037 says there is no save and nothing about a child is
// stored. A recording holds no child data - it is positions and button presses - but it is still a
// written artefact, so it does not reach the disk of a school machine. It exists to be replayed inside a
// test and to be compared in a session.

import { DT } from './ball.ts';
import type { TickFrame } from './command.ts';
import { digest } from './digest.ts';
import { createMatchState } from './state.ts';
import { step } from './step.ts';

/**
 * Bumped whenever a change alters what the simulation computes: a tuning constant, the step order, the
 * integration. It is NOT a package version - it answers one question, "would an old recording still mean
 * what it said", and only this module's readers ask it.
 */
export const SIM_VERSION = 2;

/** One checkpoint per second of world time. See the test header for why a trail beats a total. */
export const CHECK_EVERY = 60;

/** `[tick, digest]`. A tuple rather than an object because a trail is long and its shape never varies. */
export type Checkpoint = readonly [tick: number, hash: number];

export interface MatchRecord {
  readonly version: number;
  readonly frames: readonly TickFrame[];
  readonly checks: readonly Checkpoint[];
}

export class ReplayVersionError extends Error {
  constructor(readonly found: number) {
    super(
      `this recording was written by simulation version ${found}, and this is version ${SIM_VERSION}. ` +
        'Replaying it would produce a different match without saying so, so it is refused.',
    );
    this.name = 'ReplayVersionError';
  }
}

/** Play `ticks` ticks of the given stream, keeping every frame and a checkpoint each second. */
export function record(ticks: number, frameFor: (tick: number) => TickFrame): MatchRecord {
  const state = createMatchState();
  const frames: TickFrame[] = [];
  const checks: Checkpoint[] = [[0, digest(state)]];

  for (let t = 0; t < ticks; t++) {
    const frame = frameFor(t);
    frames.push(frame);
    step(state, frame, DT);
    if (state.tick % CHECK_EVERY === 0) checks.push([state.tick, digest(state)]);
  }

  return { version: SIM_VERSION, frames, checks };
}

/**
 * Re-run a recording and return the trail it produces NOW.
 *
 * It deliberately returns the new trail rather than comparing it to the stored one: the caller decides
 * what a difference means, and a test that wants the tick of first divergence needs both trails.
 */
export function replay(rec: MatchRecord): Checkpoint[] {
  if (rec.version !== SIM_VERSION) throw new ReplayVersionError(rec.version);

  const state = createMatchState();
  const checks: Checkpoint[] = [[0, digest(state)]];

  for (const frame of rec.frames) {
    step(state, frame, DT);
    if (state.tick % CHECK_EVERY === 0) checks.push([state.tick, digest(state)]);
  }

  return checks;
}
