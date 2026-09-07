// SPDX-License-Identifier: AGPL-3.0-or-later
// OFFSIDE, as a snapshot taken at the moment of the pass.
//
// The result is a bit per team-mate: bit `i` set means "if this player takes the first touch, it is
// offside". The flag is RAISED elsewhere, by the touch - which is what stops a striker loitering behind
// the defence from being penalised while the ball is at the other end.

import { attackDirOf } from '../sim/ends.ts';
import { SQUAD_SIZE, firstOf, teamOf, type PlayerId } from '../sim/ids.ts';
import { onPitch } from '../sim/squads.ts';
import type { MatchState } from '../sim/state.ts';
import { PITCH } from '../sim/units.ts';
import type { RuleEvent } from './events.ts';
import type { RulesProfile } from './profile.ts';

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

// ========================= AND THE TWO HALVES THAT REACH THE MATCH =========================
// Everything above is arithmetic on numbers and was gated as such for months, while nothing in the game
// ever called it. These two functions are the wire, and they live here rather than in `play.ts` because
// they are offside knowledge: the seam should know that a ball was played and that a ball was touched,
// and nothing else about the law.

/**
 * The moment the ball is played: freeze who was offside.
 *
 * Called for every kick and not only for a pass, which is the law rather than a simplification - a shot
 * that rebounds to a team-mate who was behind the defence is offside exactly as a pass to him would be.
 */
export function markOffside(state: MatchState, passer: PlayerId, profile: RulesProfile): void {
  if (!profile.offside) return;

  const team = teamOf(passer);
  const first = firstOf(team);
  const dir = attackDirOf(team, state.period);
  // ⚠️ AN ABSENT ATTACKER STANDS ON HIS OWN GOAL LINE, and the sentinel is chosen rather than convenient.
  //    `offsideMask` skips anybody in his own half, so this is a position that can never be flagged - and
  //    a hole in the list, or a `NaN`, would be flagged by EVERY comparison, because every comparison
  //    against `NaN` is false and the function reaches the bit unconditionally.
  const ownLine = dir === 1 ? 0 : PITCH.length;

  const attackers: number[] = [];
  const defenders: number[] = [];
  for (let k = 0; k < SQUAD_SIZE; k++) {
    // ⚠️ A BODY THAT IS NOT PLAYING IS NOT A DEFENDER, and a sent-off man left in the array would hold an
    //    offside line from the touchline where nobody can see him. `sim/squads` opens by saying an absent
    //    body must be absent EVERYWHERE, and this is one of the places that has to mean it.
    //
    //    The attacker list keeps its INDEX, though: bit `k` has to mean squad index `k` when the flag is
    //    read back, so an absent attacker keeps his slot and is given a position that is never offside.
    attackers.push(onPitch(state, first + k) ? state.players[first + k].p.x : ownLine);
    const foe = firstOf(team === 0 ? 1 : 0) + k;
    if (onPitch(state, foe)) defenders.push(state.players[foe].p.x);
  }

  state.offsidePasser = passer;
  state.offsideMask = offsideMask({
    attackers,
    defenders,
    ball: state.ball.p.x,
    passer: passer - first,
    dir,
    halfwayX: PITCH.length / 2,
  });
}

/**
 * The moment the ball is touched: raise the flag, or put it away.
 *
 * ⚠️ THE SNAPSHOT DIES ON THE FIRST TOUCH WHOEVER MAKES IT, and that is not tidiness. A flag left armed
 * goes up at some unrelated moment later in the match - a striker who was offside two passes ago jogging
 * back onto a loose ball - and an offence nobody can connect to anything is worse than no offence at all.
 */
export function judgeOffside(state: MatchState, profile: RulesProfile): RuleEvent | null {
  const passer = state.offsidePasser;
  if (!profile.offside || passer === -1) return null;

  const who = state.possession.lastTouch;
  // Nobody else has touched it: the ball is still travelling and there is nothing to judge yet.
  if (who === -1 || who === passer) return null;

  const team = teamOf(passer);
  const mask = state.offsideMask;
  state.offsidePasser = -1;
  state.offsideMask = 0;

  // ⚠️ NO TEST CAN KILL THIS LINE, AND IT STAYS. Removing it leaves every gate in
  //    `tests/offside-in-play` green - measured, by mutation - because an opponent's index shifted into
  //    an eleven-bit mask can never land on a set bit while both squads have eleven players. That is an
  //    arithmetic coincidence between the squad size and the width of a machine word, not a fact about
  //    football, and the day a profile plays seven-a-side it stops being true. The question the code has
  //    to ask is "was the toucher on the passer's side", so the code asks it.
  if (teamOf(who) !== team) return null;
  if ((mask & (1 << (who - firstOf(team)))) === 0) return null;

  return { kind: 'offsideGiven', team, at: { x: state.players[who].p.x, y: state.players[who].p.y } };
}
