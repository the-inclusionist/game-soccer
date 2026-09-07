// SPDX-License-Identifier: AGPL-3.0-or-later
// HOW THE MATCH ENDED, told from the side the child is playing.
//
// ⚠️ "2-1" IS A FACT ABOUT THE MATCH; "YOU WON" IS THE FACT SHE NEEDS. Reading the score and hard-coding
// which column is hers would be right until somebody sat in the away seat.

import type { TeamId } from '../sim/ids.ts';

export type Outcome = 'win' | 'draw' | 'loss';

export function outcomeFor(goals: readonly [number, number], us: TeamId): Outcome {
  const ours = goals[us];
  const theirs = goals[1 - us];
  if (ours > theirs) return 'win';
  if (ours < theirs) return 'loss';
  return 'draw';
}

/**
 * The dictionary key for one outcome.
 *
 * ⚠️ A DRAW HAS ITS OWN SENTENCE, and it is not a softened loss. ADR-0049 says the only celebration is
 * growth; a game that treated a level score as a failure to win would be teaching the opposite of that in
 * the one moment a child is certainly reading the screen.
 */
export function outcomeKey(outcome: Outcome): string {
  return `end.${outcome}`;
}
