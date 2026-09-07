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
import { RED } from '../rules/cards.ts';

/**
 * Is this body playing?
 *
 * ⚠️ TWO TERMS NOW, AND THE SECOND ONE ARRIVED WITH RED CARDS. The count answers "how big is the squad
 * in this session", which is a PREFIX - a practice squad of three is ids 0, 1 and 2. A sending-off is not
 * a prefix: decrementing the count to send off number seven removes number TEN, who is still standing
 * there, and leaves number seven playing.
 *
 * The card is read HERE rather than beside each caller, because the header above this one says an absent
 * body must be absent everywhere and that there is one answer to this question. Adding a second place to
 * ask it would have made that sentence false on the day it mattered most.
 */
export function onPitch(state: MatchState, id: PlayerId): boolean {
  const team = id < SQUAD_SIZE ? 0 : 1;
  if ((state.cards[id] ?? 0) >= RED) return false;
  return id - firstOf(team as TeamId) < state.onPitch[team];
}

/** The ids of the players a side actually has out there, in index order. */
export function squadIds(state: MatchState, team: TeamId): PlayerId[] {
  const first = firstOf(team);
  const out: PlayerId[] = [];
  // Asked through `onPitch` rather than recomputed, so a sent-off player disappears from every list that
  // is built from this one - the AI's, the offside line's, the switcher's - without any of them knowing
  // that cards exist.
  for (let k = 0; k < state.onPitch[team]; k++) {
    const id = first + k;
    if (onPitch(state, id)) out.push(id);
  }
  return out;
}
