// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT A SEAT ASKED FOR, ON ONE TICK. The only channel into the simulation.
//
// ========================= POWER IS A NUMBER, NOT A HELD BUTTON =========================
// This is the decision the whole design rests on. Real time integrates a hold into a number; the
// turn-based mode lets the child PICK the number; press-to-start/press-to-release integrates between two
// edges. The simulation sees one thing in all three cases, which is why three clock modes are one
// simulation rather than three.
//
// It also puts charging on the correct side of a line the engine itself drew (`input/latch.ts`): an
// adaptation crosses from OPERATION into RULE only when it changes the set of reachable states or the
// probability of reaching them. Press-to-release reaches exactly the same powers as holding, so charging
// is operation - it belongs to the input layer, and must not live in here.
//
// And it is what makes a recording small: a 45-tick hold is 45 duplicated bits on a wire; a released
// power is one 8-bit event.
//
// ========================= WHY EVERY FIELD IS A PLAIN NUMBER =========================
// A command must survive `JSON.parse(JSON.stringify(c))` unchanged. No functions, no references, no
// class instances - that is the entire requirement for a replay file and for a future packet, and it is
// cheaper to keep than to retrofit.

import type { PlayerId } from './ids.ts';

export type Verb = 'none' | 'pass' | 'through' | 'lob' | 'shoot' | 'tackle' | 'switch';

/** Bit flags, because a set of booleans on the wire is a byte and a set of fields is not. */
export const FLAG_SPRINT = 1;
export const FLAG_MODIFIER = 2;
export const FLAG_LATCHED = 4;
/** Contain: hold position between the ball and your own goal instead of diving in. */
export const FLAG_JOCKEY = 8;

export interface Command {
  readonly tick: number;
  readonly seat: number;
  /** -1..1. A keyboard yields the ends; a stick yields the middle. The transport decides, not the sim. */
  readonly dx: number;
  readonly dy: number;
  readonly verb: Verb;
  /** 0..255, ALREADY INTEGRATED by the input layer. See the header. */
  readonly power: number;
  readonly flags: number;
}

export interface TickFrame {
  readonly tick: number;
  /** Sorted by seat, always. Iteration order of the commands is part of the determinism promise. */
  readonly cmds: readonly Command[];
}

/**
 * Where the seats START.
 *
 * ⚠️ THIS USED TO BE THE ANSWER AND IS NOW ONLY THE INITIAL VALUE. Switching player is a verb that travels
 * as a command, because a replay has to replay it - so where the seats are pointing became `state.controlled`
 * the day `switch` stopped being ignored. Both begin on home forwards, because the default two-seat mode is
 * co-operative.
 */
export const CONTROLLED_BY_SEAT: readonly PlayerId[] = Object.freeze([9, 10]);

export function emptyFrame(tick: number): TickFrame {
  return { tick, cmds: [] };
}

/** A seat asking only to move. The shape most tests need, and the one the sampler produces most often. */
export function moveCommand(tick: number, seat: number, dx: number, dy: number): Command {
  return { tick, seat, dx, dy, verb: 'none', power: 0, flags: 0 };
}
