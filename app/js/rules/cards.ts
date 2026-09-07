// SPDX-License-Identifier: AGPL-3.0-or-later
// CARDS, AND THE ONE WAY A PLAYER LEAVES THE PITCH.
//
// ========================= WHY A SENDING-OFF WAS NOT FREE =========================
// `state.onPitch` is a COUNT per side, and `sim/squads` answers "is this body playing" by asking whether
// the id falls inside that count. That worked because every absence until now was a PREFIX: a practice
// squad of three is ids 0, 1 and 2, and a count says so exactly.
//
// A red card is not a prefix. Sending off number seven by decrementing the count removes number TEN, who
// is still standing there, and leaves number seven playing. So presence needed a second term - and
// `sim/squads` opens by saying an absent body must be absent EVERYWHERE, with one answer to "is he
// playing" rather than each consumer keeping its own idea. The card goes THROUGH that function, not
// around it: `onPitch` now reads the card as well as the count, and every consumer inherits the answer
// without knowing cards exist.
//
// ========================= THE THREE VALUES ARE ORDERED, ON PURPOSE =========================
// `0 < YELLOW < RED`, so "has he been sent off" is `>= RED` and a card can only ever go UP. A pair of
// booleans would let a state exist that football does not have - sent off but not booked, booked after
// being sent off - and something downstream would eventually be asked to render it.

import type { PlayerId } from '../sim/ids.ts';
import type { MatchState } from '../sim/state.ts';
import type { Severity } from './foul.ts';

/** Booked. Two of these is a red, which is the rule every child in the room already knows. */
export const YELLOW = 1;

/** Sent off. `>= RED` is the whole test for "is he gone", so nothing compares against a magic number. */
export const RED = 2;

/**
 * What a challenge costs.
 *
 * ⚠️ A CARELESS FOUL COSTS NOTHING BUT THE KICK, and that is not leniency - it is what makes the other two
 * mean something. A game that booked every foul would teach a child that tackling is punished, which is
 * the opposite of the rule.
 */
export function cardFor(severity: Severity): number {
  if (severity === 'violent') return RED;
  if (severity === 'reckless') return YELLOW;
  return 0;
}

/**
 * Record a card against a player.
 *
 * ⚠️ IT NEVER GOES BACKWARDS. A second yellow becomes a red; a yellow after a red leaves him sent off. A
 * function that assigned rather than escalated would un-send-off a player the moment he was booked again,
 * and the symptom - a player reappearing on the pitch - would look like a rendering fault.
 */
export function book(state: MatchState, who: PlayerId, card: number): void {
  if (card <= 0) return;
  const had = state.cards[who] ?? 0;
  // A second yellow IS a red, and it is the SAME red - not a third state some other module must learn.
  const next = had >= YELLOW && card === YELLOW ? RED : card;
  state.cards[who] = next > had ? next : had;
}

/** Has this player been sent off? */
export function sentOff(state: MatchState, who: PlayerId): boolean {
  return (state.cards[who] ?? 0) >= RED;
}
