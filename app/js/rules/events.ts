// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT HAPPENED, AS DATA. One list, four consumers.
//
// The phase machine advances on it, the narration turns it into a sentence, the sound layer picks an
// earcon, and the engine's announcement channel hands it to the screen reader. Four consumers of ONE list
// is why the referee returns events instead of acting on them: a referee that changed the phase itself
// would leave the other three to re-derive what happened, and re-derivations drift.

import type { TeamId } from '../sim/ids.ts';
import type { PhaseEvent } from './phase.ts';

export interface RuleEvent {
  readonly kind: PhaseEvent;
  /** The team the event is ABOUT: who scored, who gets the throw-in. Absent when it is about neither. */
  readonly team?: TeamId;
  /** Where play restarts, in metres. Absent for events that do not move the ball. */
  readonly at?: { readonly x: number; readonly y: number };
}

/**
 * How loudly an event reaches a child who cannot see the screen.
 *
 * ⚠️ NOT EVERYTHING IS URGENT, and that is the accessibility decision rather than a formatting one. An
 * assertive live region interrupts whatever is being read; a throw-in interrupting the score would make
 * the screen reader unusable in exactly the moments it matters. A goal earns the interruption. A throw-in
 * does not.
 */
export const URGENT: ReadonlySet<PhaseEvent> = new Set<PhaseEvent>([
  'goalScored',
  'offsideGiven',
  'periodExpired',
  'secondPeriodExpired',
]);
