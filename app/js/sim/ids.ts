// SPDX-License-Identifier: AGPL-3.0-or-later
// WHO IS WHO. Indices, not objects, and the reason is determinism.
//
// ========================= EVERY "NEAREST" IS TIE-BROKEN BY INDEX =========================
// Two team-mates exactly equidistant from the ball is not a rare case: it is the kickoff, and it is every
// symmetric restart. If the winner of that tie depends on array order, on a Set's iteration or on which
// one a sort happened to keep, the same match replays differently on a different engine. So a player IS
// its index, the squads are one flat array, and ties are broken by the smaller index everywhere.

export type TeamId = 0 | 1;

export const HOME: TeamId = 0;
export const AWAY: TeamId = 1;

/** Eleven a side. The keeper is the FIRST of each squad, so `isKeeper` is a comparison and not a flag. */
export const SQUAD_SIZE = 11;

/** Index 0..10 is home, 11..21 is away. */
export type PlayerId = number;

export function teamOf(id: PlayerId): TeamId {
  return id < SQUAD_SIZE ? HOME : AWAY;
}

/** 1..11 within the squad - what the child reads on the shirt, not what the array uses. */
export function shirtOf(id: PlayerId): number {
  return (id % SQUAD_SIZE) + 1;
}

export function isKeeper(id: PlayerId): boolean {
  return id % SQUAD_SIZE === 0;
}

/** The first index of a squad. */
export function firstOf(team: TeamId): PlayerId {
  return team * SQUAD_SIZE;
}
