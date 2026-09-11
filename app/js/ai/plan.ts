// SPDX-License-Identifier: AGPL-3.0-or-later
// ONE PLAN PER SIDE, and the most important field in it is a single integer.
//
// ⚠️ `presserId` IS THE ANTI-SWARM RULE, and it is a plan-level fact rather than a decision each agent
// takes about itself. Eleven players each concluding "I am nearest, I should chase" is exactly how cheap
// football AI ends up as a rugby maul, and no amount of tuning fixes it because every one of those eleven
// conclusions is locally correct. Deciding it ONCE, for the side, is both cheaper and what real defending
// looks like: one player presses, the other ten hold their shape.

import { SQUAD_SIZE, firstOf, type TeamId } from '../sim/ids.ts';
import { NOBODY } from '../sim/possession.ts';
import type { MatchState } from '../sim/state.ts';
import { onPitch } from '../sim/squads.ts';
import { dist2 } from '../sim/vec.ts';
import type { TeamPlan } from './formation.ts';

/** How far up the pitch each mode pushes the shape. */
const LINE = Object.freeze({ attack: 1.35, transition: 1.0, defend: 0.8 });

/** How wide each mode spreads it. An attacking side stretches the pitch; a defending one squeezes. */
const WIDTH = Object.freeze({ attack: 1.15, transition: 1.0, defend: 0.75 });

/** Nearest of `team` to the ball, ties to the lower index. Index order, so a replay reproduces it. */
function nearestOfTeam(state: MatchState, team: TeamId): number {
  const first = firstOf(team);
  let best = -1;
  let bestD2 = Infinity;

  for (let k = 0; k < SQUAD_SIZE; k++) {
    const id = first + k;
    if (!onPitch(state, id)) continue;
    const d2 = dist2(state.players[id].p, state.ball.p);
    if (d2 < bestD2) {
      bestD2 = d2;
      best = k;
    }
  }

  return best;
}

/**
 * What this side is trying to do right now.
 *
 * Recomputed a few times a second, not every tick: a side does not change its mind about whether it is
 * attacking sixty times a second, and the steering that carries the shape runs every tick regardless.
 *
 * `presserId` is a SQUAD index (0..10), not a global player id, because a plan belongs to a squad and
 * mixing the two numbering schemes is the kind of mistake that produces a defender chasing for the other
 * team without any error anywhere.
 */
// ========================= WHAT A ROLE ASSIGNMENT HAS TO BEAT, MEASURED 2026-09-11 =========================
// The absorption plan's spine item replaces "everyone holds the shape" with a small set of off-ball JOBS
// assigned here, once per planning tick. Before building it the premise was re-measured, because this
// repository has just had to correct a different premise that had quietly gone stale - and this one has
// not. Twelve fixtures:
//
//                                    ball in the attacking box   team-mates in it   carrier wide and high
//     nobody playing                          25.8 ticks/match             0.00              86.6 ticks
//     a child playing                         15.8 ticks/match             0.32              83.3 ticks
//
// ⚠️ NOBODY IS EVER IN THE BOX. Not rarely - 0.00 with the empty chair, and in 0.0% of the ticks where
// the carrier is wide and high does a single team-mate stand in there. `ai/brain.crossFrom` is not
// waiting for an uncommon situation; it is waiting for a body that never comes.
//
// ========================= AND TWO CHEAP FIXES WERE TRIED AND BOTH FAILED =========================
// ⚠️ MAKING THE RUN A STANDING JOB DID NOT WORK. The cross branch used to wait for the carrier to be
// wide AND high, and that situation exists for about eighty-six ticks in a whole match - at seven metres
// a second, even thirty unbroken ticks carry a forward three and a half metres, so a player twenty-five
// metres out cannot arrive inside a window that short. Aiming the forwards at the box whenever the BALL
// reached the attacking third instead: occupancy went 0.32 to 0.10. Worse.
//
// ⚠️ AND THE OFFSIDE CAP WAS NOT THE CAUSE EITHER. The obvious next suspect: holding a forward onside
// pins him to the last defender's line, which is outside the box whenever the defence is not camped on
// its own goal. Removing the cap entirely - accepting a man permanently offside - left occupancy at 0.00
// and 0.51. Still essentially nobody.
//
// ⚠️ SO THE ANSWER IS THE ONE THE PLAN ALREADY WROTE, AND BOTH FAILURES ARE THE SAME MISTAKE: the job
// was left in the per-body cascade, where it is recomputed from the ball's momentary position every sixth
// tick. A forward is sent to the box and pulled back to his shape spot alternately, and his net travel is
// about nothing. A role has to be ASSIGNED HERE and HELD - which is what "a team-level plan on the
// existing staggered schedule" means, and what neither attempt did.

export function teamPlan(state: MatchState, team: TeamId): TeamPlan {
  const holder = state.possession.holder;

  if (holder === NOBODY) {
    return {
      mode: 'transition',
      lineHeight: LINE.transition,
      width: WIDTH.transition,
      presserId: nearestOfTeam(state, team),
    };
  }

  const ours = holder >= firstOf(team) && holder < firstOf(team) + SQUAD_SIZE;
  if (ours) {
    return { mode: 'attack', lineHeight: LINE.attack, width: WIDTH.attack, presserId: -1 };
  }

  return {
    mode: 'defend',
    lineHeight: LINE.defend,
    width: WIDTH.defend,
    presserId: nearestOfTeam(state, team),
  };
}
