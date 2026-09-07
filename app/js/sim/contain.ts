// SPDX-License-Identifier: AGPL-3.0-or-later
// CONTAINING: standing between the ball and your own goal instead of diving in.
//
// ⚠️ IT IS A POSITION, NOT AN ACT, and that is what makes it the defensive move a child who cannot time a
// tackle can still play. Holding it never wins the ball; it stops the carrier going past, which buys the
// time a tackle needs. Football calls it jockeying and it is the first thing a defender is taught.

import { teamOf, type PlayerId } from './ids.ts';
import type { MatchState } from './state.ts';
import { PITCH } from './units.ts';
import type { Vec2 } from './vec.ts';

/** Metres. How far goal-side of the ball a containing body tries to stand. */
const STAND_OFF = 2.0;

/** Which way this team attacks. Derived from the period, so half time costs nothing. */
function dirOf(team: number, period: number): 1 | -1 {
  return (team === 0) === (period === 1) ? 1 : -1;
}

/**
 * The direction this body should move to contain the ball, as a unit-ish vector.
 *
 * The point aimed at is a short way from the ball TOWARD this side's own goal, so the body ends up between
 * the two. Approaching it is ordinary steering; what makes this contain rather than chase is that the
 * target is never the ball itself.
 */
export function containDirection(state: MatchState, who: PlayerId): Vec2 {
  const dir = dirOf(teamOf(who), state.period);
  const ownGoalX = dir === 1 ? 0 : PITCH.length;

  const ball = state.ball.p;
  const toGoalX = ownGoalX - ball.x;
  const toGoalY = PITCH.width / 2 - ball.y;
  const len = Math.sqrt(toGoalX * toGoalX + toGoalY * toGoalY) || 1;

  const target = {
    x: ball.x + (toGoalX / len) * STAND_OFF,
    y: ball.y + (toGoalY / len) * STAND_OFF,
  };

  const dx = target.x - state.players[who].p.x;
  const dy = target.y - state.players[who].p.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.2) return { x: 0, y: 0 };
  return { x: dx / d, y: dy / d };
}
