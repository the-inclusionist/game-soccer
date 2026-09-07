// SPDX-License-Identifier: AGPL-3.0-or-later
// WHO IS ACTUALLY ON THE PITCH.
//
// ⚠️ AN ABSENT BODY MUST BE ABSENT EVERYWHERE, or it is worse than present. A body the renderer hides but
// possession still considers is an invisible player who can take the ball; one the AI skips but the
// offside line still counts is a defender nobody can see holding a line. So there is ONE answer to "is he
// playing", asked by every consumer, rather than each of them keeping its own idea.
//
// ⚠️ AND THE IDS DO NOT MOVE. A practice squad of three is ids 0, 1 and 2 - the same ids they would have
// in a match - so nothing downstream has to renumber, and a recording of a practice session means the
// same thing as a recording of a match.

import { SQUAD_SIZE, firstOf, type PlayerId, type TeamId } from './ids.ts';
import type { MatchState } from './state.ts';

/** Is this body playing? */
export function onPitch(state: MatchState, id: PlayerId): boolean {
  const team = id < SQUAD_SIZE ? 0 : 1;
  return id - firstOf(team as TeamId) < state.onPitch[team];
}

/** The ids of the players a side actually has out there, in index order. */
export function squadIds(state: MatchState, team: TeamId): PlayerId[] {
  const first = firstOf(team);
  const out: PlayerId[] = [];
  for (let k = 0; k < state.onPitch[team]; k++) out.push(first + k);
  return out;
}
