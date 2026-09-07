// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT A CHILD MAY CHOOSE WHILE THE MATCH WAITS FOR HER.
//
// ========================= THE TURN MODE IS THE SAME GAME, OR IT IS NOTHING =========================
// A turn-based clock satisfies WCAG 2.2.1 by construction - there is no time limit, so there is nothing
// to adjust. That argument only holds if the child can reach the SAME acts a real-time player reaches;
// otherwise the accommodation is a weaker game wearing the same name. So what is offered here is exactly
// what the simulation accepts, filtered only by what the world makes possible.
//
// ⚠️ AND POWER IS PICKED, NOT TIMED. `Command.power` arrives already integrated precisely so that this
// mode can hand it a number the child chose from the same five steps a hold reaches.
//
// ⚠️ NO DOM HERE. This module decides; `turn-panel` draws. That is what lets the decision be tested
// without a browser, and it is the same cut as `declaration` observing rather than owning.

import { STEPS } from '../input/charge.ts';
import type { Verb } from '../sim/command.ts';
import { teamOf, type PlayerId } from '../sim/ids.ts';
import { NOBODY } from '../sim/possession.ts';
import type { MatchState } from '../sim/state.ts';
import { dist2 } from '../sim/vec.ts';

/** Metres. The same reach the simulation uses to decide a tackle can happen at all. */
const TACKLE_REACH = 1.4;

export interface VerbOption {
  readonly verb: Verb;
  /** A dictionary KEY. The panel resolves it, so this module stays free of a language. */
  readonly labelKey: string;
}

export interface DirectionOption {
  readonly labelKey: string;
  readonly dx: number;
  readonly dy: number;
}

export interface TurnOptions {
  readonly verbs: readonly VerbOption[];
  readonly powerSteps: readonly number[];
  readonly directions: readonly DirectionOption[];
}

const D = Math.SQRT1_2;

/** Eight ways to go. Four would tell a child she may only move four ways, which is not the game. */
const DIRECTIONS: readonly DirectionOption[] = Object.freeze([
  { labelKey: 'dir.n', dx: 0, dy: -1 },
  { labelKey: 'dir.ne', dx: D, dy: -D },
  { labelKey: 'dir.e', dx: 1, dy: 0 },
  { labelKey: 'dir.se', dx: D, dy: D },
  { labelKey: 'dir.s', dx: 0, dy: 1 },
  { labelKey: 'dir.sw', dx: -D, dy: D },
  { labelKey: 'dir.w', dx: -1, dy: 0 },
  { labelKey: 'dir.nw', dx: -D, dy: -D },
]);

const POWER_STEPS: readonly number[] = Object.freeze(
  Array.from({ length: STEPS }, (_, i) => i + 1),
);

const ON_THE_BALL: readonly VerbOption[] = Object.freeze([
  { verb: 'pass', labelKey: 'act.shortPass' },
  { verb: 'through', labelKey: 'act.throughBall' },
  { verb: 'lob', labelKey: 'act.longBall' },
  { verb: 'shoot', labelKey: 'act.strike' },
]);

export function turnOptionsFor(state: MatchState, who: PlayerId | undefined): TurnOptions {
  const empty: TurnOptions = { verbs: [], powerSteps: POWER_STEPS, directions: DIRECTIONS };
  if (who === undefined || state.players[who] === undefined) return empty;

  const holder = state.possession.holder;

  if (holder === who) {
    return { verbs: ON_THE_BALL, powerSteps: POWER_STEPS, directions: DIRECTIONS };
  }

  const verbs: VerbOption[] = [];

  // Tackling is offered only when it could actually happen, because an option that does nothing when
  // pressed teaches a child that the game ignores her.
  const theirs = holder !== NOBODY && teamOf(holder) !== teamOf(who);
  const close = dist2(state.players[who].p, state.ball.p) <= TACKLE_REACH * TACKLE_REACH;
  if (theirs && close) verbs.push({ verb: 'tackle', labelKey: 'act.strike' });

  verbs.push({ verb: 'switch', labelKey: 'act.switchPlayer' });

  return { verbs, powerSteps: POWER_STEPS, directions: DIRECTIONS };
}
