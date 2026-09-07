// SPDX-License-Identifier: AGPL-3.0-or-later
// WHERE PLAY RESUMES: the ball on its spot, and the bodies given room.
//
// ⚠️ THE KEEP-OUT IS A RULE, NOT POLISH. A corner taken with a defender standing on the ball is a
// turnover with extra steps. Without this the AI converges on the ball at every dead ball - which is most
// of a match - and the game stops looking like football. It is also an accessibility fact: the sonar
// answers "where can I put the ball", and at a restart that answer has to be a spot the child can reach.

import { teamOf, type TeamId } from '../sim/ids.ts';
import type { MatchState } from '../sim/state.ts';
import { GOAL, PENALTY_SPOT, PITCH } from '../sim/units.ts';
import { clamp, len2, norm, type Vec2 } from '../sim/vec.ts';
import type { RuleEvent } from './events.ts';
import { defenderOf } from './referee.ts';
import type { EndId } from './out-of-play.ts';

/** Metres. Nine-fifteen is ten yards, and it is what makes a restart a restart. */
export const KEEP_OUT = 9.15;

/** Metres from the goal line. A goal kick is taken from the goal area; one number stands for the box. */
export const GOAL_KICK_DEPTH = 5.5;

const endOf = (x: number): EndId => (x > PITCH.length / 2 ? 1 : 0);

/** Where the ball is placed for this event. */
export function restartSpot(event: RuleEvent, period: number): Vec2 {
  const at = event.at;

  switch (event.kind) {
    // A free kick is taken from where the foul was, which is the only restart in the game whose spot is
    // simply the place something happened.
    case 'foulGiven':
      return { x: clamp(at?.x ?? 0, 0, PITCH.length), y: clamp(at?.y ?? 0, 0, PITCH.width) };

    // ⚠️ AND A PENALTY IS ON THE SPOT, wherever the foul was - which is the point of a penalty. Which
    //    spot depends on `event.team`: `rules/events` says that field is the side the event is ABOUT, and
    //    a penalty is about the side AWARDED it, so the ball goes to the goal the OTHER side defends.
    //    Reading it the other way round puts every penalty at the wrong end, and it reads as a fault in
    //    the camera rather than in the laws.
    case 'penaltyGiven': {
      const theyDefendFar = ((event.team ?? 0) === 0) !== (period === 2);
      return {
        x: theyDefendFar ? PITCH.length - PENALTY_SPOT : PENALTY_SPOT,
        y: PITCH.width / 2,
      };
    }

    case 'crossedTouchline':
      // Clamped along the pitch: a ball crossing the touchline beyond the goal line would otherwise put
      // the throw-in outside the field entirely.
      return { x: clamp(at?.x ?? 0, 0, PITCH.length), y: at?.y === 0 ? 0 : PITCH.width };

    case 'crossedGoalLineByDefender': {
      const end = endOf(at?.x ?? 0);
      return {
        x: end === 1 ? PITCH.length : 0,
        y: (at?.y ?? 0) > PITCH.width / 2 ? PITCH.width : 0,
      };
    }

    case 'crossedGoalLineByAttacker': {
      const end = endOf(at?.x ?? 0);
      return {
        x: end === 1 ? PITCH.length - GOAL_KICK_DEPTH : GOAL_KICK_DEPTH,
        y: PITCH.width / 2,
      };
    }

    default:
      // Kickoff: after a goal, at half time, and at the start. Always the centre spot.
      return { x: PITCH.length / 2, y: PITCH.width / 2 };
  }
}

/** Which side takes this restart. */
function takerOf(event: RuleEvent, period: number): TeamId | null {
  const at = event.at;
  if (event.kind === 'crossedGoalLineByDefender') {
    return (1 - defenderOf(endOf(at?.x ?? 0), period)) as TeamId;
  }
  if (event.kind === 'crossedGoalLineByAttacker') {
    return defenderOf(endOf(at?.x ?? 0), period);
  }
  return null;
}

/**
 * Push one body out to exactly `KEEP_OUT` from the spot, on the pitch.
 *
 * ⚠️ IT REFLECTS, IT DOES NOT CLAMP, and the difference is whether the rule is a rule. A corner spot sits
 * on the touchline, so half the circle around it is off the pitch; clamping a body back onto the line
 * would leave it INSIDE the keep-out while looking like it had been moved, and the guarantee would be
 * false exactly where it matters most. Flipping the offending component keeps the distance exact and the
 * body on the field. It works because the pitch is wider than two keep-outs on both axes (90 and 56
 * against 18.3), so the reflected point is always inside - an assumption `units.ts` would have to break
 * for this to stop holding, and a test would say so.
 *
 * A body standing EXACTLY on the spot has no direction to be pushed in, and `norm` honestly returns the
 * zero vector rather than inventing one. The fallback points along the pitch, away from the nearest end -
 * an arbitrary choice, but one made once and written down.
 */
function pushOut(p: Vec2, spot: Vec2): void {
  // ⚠️ ONLY BODIES THAT ARE TOO CLOSE ARE MOVED, and the first version moved everybody. It set every
  //    non-taker to EXACTLY the keep-out distance, which is a teleport rather than a push: a goalkeeper
  //    sixty metres away was dragged to a ring around a throw-in on the far touchline and spent the rest
  //    of the match trying to walk home. The symptom surfaced as "the keeper does not stay near his goal",
  //    which is nowhere near where the defect lived.
  const away = { x: p.x - spot.x, y: p.y - spot.y };
  if (len2(away) >= KEEP_OUT * KEEP_OUT) return;
  const dir = len2(away) === 0 ? { x: spot.x > PITCH.length / 2 ? -1 : 1, y: 0 } : norm(away);

  let dx = dir.x;
  let dy = dir.y;
  if (spot.x + dx * KEEP_OUT < 0 || spot.x + dx * KEEP_OUT > PITCH.length) dx = -dx;
  if (spot.y + dy * KEEP_OUT < 0 || spot.y + dy * KEEP_OUT > PITCH.width) dy = -dy;

  p.x = spot.x + dx * KEEP_OUT;
  p.y = spot.y + dy * KEEP_OUT;
}

/**
 * Put the ball on its spot, dead, and give the taker room.
 *
 * The taker's side keeps its shape; everyone else is given the ten yards. Both halves matter: without the
 * keep-out a corner is a turnover, and without leaving the taker alone there is nobody to take it.
 */
export function applyRestart(state: MatchState, event: RuleEvent): void {
  const spot = restartSpot(event, state.period);

  state.ball.p = { x: spot.x, y: spot.y, z: 0 };
  state.ball.v = { x: 0, y: 0, z: 0 };
  state.ball.grounded = true;

  const taker = takerOf(event, state.period);
  for (let i = 0; i < state.players.length; i++) {
    const body = state.players[i];
    const isTaker = taker !== null && teamOf(i) === taker;
    if (isTaker) {
      // The taker's side keeps its shape; only a body standing ON the spot is nudged, so that somebody
      // can actually reach the ball and nobody is left occupying it.
      if (len2({ x: body.p.x - spot.x, y: body.p.y - spot.y }) === 0) {
        body.p.x = clamp(spot.x + (spot.x > PITCH.length / 2 ? -1 : 1) * GOAL.height, 0, PITCH.length);
      }
      continue;
    }
    pushOut(body.p, spot);
  }

  for (const body of state.players) {
    body.v = { x: 0, y: 0 };
  }
}
