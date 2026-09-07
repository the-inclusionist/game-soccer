// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PHASES OF A MATCH, and the transitions as DATA.
//
// Written as rows rather than as a `switch` so the table can be WALKED: every phase reachable, every
// phase with a way out, no duplicate answer to the same event. A `switch` can only be read by running it,
// and the property that matters - "a match cannot wedge in a state nobody can leave" - is not a property
// of any single branch.

import type { RulesProfile } from './profile.ts';

export const PHASES = [
  'preMatch',
  'kickoff',
  'live',
  'throwIn',
  'corner',
  'goalKick',
  'freeKick',
  'goal',
  'halfTime',
  'fullTime',
] as const;

export type MatchPhase = (typeof PHASES)[number];

export const EVENTS = [
  'start',
  'ballMoved',
  'crossedTouchline',
  'crossedGoalLineByAttacker',
  'crossedGoalLineByDefender',
  'offsideGiven',
  'goalScored',
  'restartTaken',
  'periodExpired',
  'secondPeriodExpired',
] as const;

export type PhaseEvent = (typeof EVENTS)[number];

/** Which profile switch a row depends on. `null` means the row is always in force. */
type Gate = 'outOfPlay' | 'offside' | 'clock' | null;

export interface Transition {
  readonly from: MatchPhase;
  readonly on: PhaseEvent;
  readonly to: MatchPhase;
  readonly needs: Gate;
}

export const TRANSITIONS: readonly Transition[] = Object.freeze([
  { from: 'preMatch', on: 'start', to: 'kickoff', needs: null },
  { from: 'kickoff', on: 'ballMoved', to: 'live', needs: null },

  { from: 'live', on: 'crossedTouchline', to: 'throwIn', needs: 'outOfPlay' },
  { from: 'live', on: 'crossedGoalLineByAttacker', to: 'goalKick', needs: 'outOfPlay' },
  { from: 'live', on: 'crossedGoalLineByDefender', to: 'corner', needs: 'outOfPlay' },
  { from: 'live', on: 'offsideGiven', to: 'freeKick', needs: 'offside' },
  { from: 'live', on: 'goalScored', to: 'goal', needs: null },
  { from: 'live', on: 'periodExpired', to: 'halfTime', needs: 'clock' },
  { from: 'live', on: 'secondPeriodExpired', to: 'fullTime', needs: 'clock' },

  { from: 'throwIn', on: 'restartTaken', to: 'live', needs: null },
  { from: 'corner', on: 'restartTaken', to: 'live', needs: null },
  { from: 'goalKick', on: 'restartTaken', to: 'live', needs: null },
  { from: 'freeKick', on: 'restartTaken', to: 'live', needs: null },

  { from: 'goal', on: 'restartTaken', to: 'kickoff', needs: null },
  { from: 'halfTime', on: 'restartTaken', to: 'kickoff', needs: null },
]);

function allowed(needs: Gate, profile: RulesProfile): boolean {
  if (needs === null) return true;
  if (needs === 'clock') return profile.clock === 'count';
  return profile[needs];
}

/**
 * The phase this event moves us to, or `null` for "this phase does not answer that event".
 *
 * ⚠️ `null` IS AN ANSWER AND NOT A FAILURE. A ball crossing the touchline on a practice pitch is not an
 * error to report; it is a thing that happens and that this profile has nothing to say about. Throwing
 * here would make the practice mode a stream of exceptions.
 */
export function nextPhase(
  from: MatchPhase,
  on: PhaseEvent,
  profile: RulesProfile,
): MatchPhase | null {
  for (const row of TRANSITIONS) {
    if (row.from !== from || row.on !== on) continue;
    return allowed(row.needs, profile) ? row.to : null;
  }
  return null;
}
