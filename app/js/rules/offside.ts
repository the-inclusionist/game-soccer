// SPDX-License-Identifier: AGPL-3.0-or-later
// OFFSIDE, as a snapshot taken at the moment of the pass.
//
// The result is a bit per team-mate: bit `i` set means "if this player takes the first touch, it is
// offside". The flag is RAISED elsewhere, by the touch - which is what stops a striker loitering behind
// the defence from being penalised while the ball is at the other end.

export interface OffsideQuery {
  /** Attacker positions along the pitch. Only `x` matters: offside is about a LINE. */
  readonly attackers: readonly number[];
  readonly defenders: readonly number[];
  readonly ball: number;
  /** Index into `attackers` of the player making the pass. Never flagged. */
  readonly passer: number;
  /** +1 if this side attacks increasing `x`, -1 otherwise. Ends swap at half time, so it is a parameter. */
  readonly dir: 1 | -1;
  readonly halfwayX: number;
}

/**
 * The second-last opponent's position, measured along the attack.
 *
 * ⚠️ ONE PASS, NO SORT, AND THE TIE IS NOT BROKEN. A sort would be O(n log n) for eleven numbers and,
 * worse, would need a comparator whose tie-breaking becomes part of the simulation's determinism. Two
 * running extremes have neither problem: equal values simply both survive, which is what "level" means.
 */
function secondLastOpponent(defenders: readonly number[], dir: number): number {
  let last = -Infinity;
  let second = -Infinity;

  for (const d of defenders) {
    const along = d * dir;
    if (along > last) {
      second = last;
      last = along;
    } else if (along > second) {
      second = along;
    }
  }

  return second;
}

/** The bitmask of team-mates who would be offside if they took the first touch. */
export function offsideMask(q: OffsideQuery): number {
  const second = secondLastOpponent(q.defenders, q.dir);
  const ballAlong = q.ball * q.dir;
  const halfwayAlong = q.halfwayX * q.dir;

  let mask = 0;
  for (let i = 0; i < q.attackers.length; i++) {
    if (i === q.passer) continue;

    const along = q.attackers[i] * q.dir;

    // ⚠️ EVERY COMPARISON IS STRICT, AND THAT IS THE LAW RATHER THAN A CHOICE. "Nearer to the opponents'
    //    goal line than" is what the text says; level is not nearer. Turning any one of these into `>=`
    //    disallows a legal goal about once a match, and nothing on screen would say why. The halfway test
    //    is strict for the same reason: a player ON the halfway line is in his own half.
    if (along <= halfwayAlong) continue;
    if (along <= ballAlong) continue;
    if (along <= second) continue;

    mask |= 1 << i;
  }

  return mask;
}
