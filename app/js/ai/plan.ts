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
