// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CASCADE. Seven ordered questions, first match wins.
//
// ========================= WHY A CASCADE AND NOT A BEHAVIOUR TREE =========================
// Football's decisions are naturally RANKED - the keeper keeps, the carrier carries, the nearest chases -
// so the ranking is the algorithm. A behaviour tree would be more expressive and would also be a second
// language to read, a second thing to debug, and a second place for the cost budget to leak through.
//
// ========================= THE DECISION IS CACHED, THE STEERING IS NOT =========================
// An agent decides every sixth tick and steers toward the point it decided on every tick. That is why the
// stagger costs nothing visually: a footballer does not re-plan sixty times a second, but he does keep
// running. The cached point lives on the BODY, in the state, so it is covered by the digest and a replay
// reproduces it - a cache outside the state would be state nobody could see.

import { SQUAD_SIZE, firstOf, isKeeper, teamOf, type PlayerId, type TeamId } from '../sim/ids.ts';
import { NOBODY } from '../sim/possession.ts';
import { onPitch } from '../sim/squads.ts';
import type { Body, MatchState } from '../sim/state.ts';
import { PITCH } from '../sim/units.ts';
import { clamp, dist2, type Vec2 } from '../sim/vec.ts';
import { homeSpot, type TeamPlan } from './formation.ts';
import { passErrorOf, shotErrorOf, type Ratings } from './ratings.ts';
import { teamPlan } from './plan.ts';
import { thinksThisTick } from './schedule.ts';
import { RECKLESS_SPEED } from '../rules/foul.ts';

/** Metres. A supporting player runs this far ahead of the shape when his side has the ball. */
const SUPPORT_AHEAD = 9;

/** Metres. How far off his line a keeper will come. */
const KEEPER_RANGE = 8;

/** Metres. How far beyond the ball a dribbler aims - far enough to keep moving, near enough to keep it. */
const CARRY_LEAD = 2.5;

/**
 * Metres. Inside this a body eases toward its target instead of running at it.
 *
 * ⚠️ IT IS SMALL ON PURPOSE, and the first value was too generous by a factor of two. At two metres a
 * dribbler - whose target is only a couple of metres ahead of the ball - spent his whole life inside the
 * easing band, crept forward at a fraction of his speed, and knocked the ball proportionally nowhere. An
 * arrival radius has to be small next to a stride, or it stops being an arrival and becomes a speed limit.
 */
const ARRIVE_RADIUS = 0.8;

/** The area in play. A practice session is half a pitch, and every position below is laid out on it. */
export type Playable = { readonly length: number; readonly width: number };

/** Which way this team attacks, given the period. Derived, so half time costs nothing to handle. */
function dirOf(team: TeamId, period: number): 1 | -1 {
  const home = team === 0;
  const firstPeriod = period === 1;
  return home === firstPeriod ? 1 : -1;
}

/** The middle of the goal this team is attacking, on the area IN PLAY. */
function goalMouthOf(team: TeamId, period: number, playable: Playable): Vec2 {
  const dir = dirOf(team, period);
  return { x: dir === 1 ? playable.length : 0, y: playable.width / 2 };
}

/** The point on this keeper's line he should be covering: between the ball and the middle of his goal. */
function keeperSpot(state: MatchState, team: TeamId, playable: Playable): Vec2 {
  const dir = dirOf(team, state.period);
  const lineX = dir === 1 ? 1.5 : playable.length - 1.5;
  const ball = state.ball.p;

  return {
    x: clamp(lineX + (ball.x - lineX) * 0.06, 0, playable.length),
    y: clamp(playable.width / 2 + (ball.y - playable.width / 2) * 0.5, 0, playable.width),
  };
}

/**
 * Where this body should be heading. The cascade, in order.
 *
 * Every branch returns a POINT, never a velocity: steering turns a point into movement every tick, and
 * keeping the decision as a destination is what lets it be cached for six ticks without looking frozen.
 */
export function decide(
  state: MatchState,
  id: PlayerId,
  plan: TeamPlan,
  playable: Playable = PITCH,
): Vec2 {
  const team = teamOf(id);
  const squadIndex = id - firstOf(team);
  const holder = state.possession.holder;
  const ball = { x: state.ball.p.x, y: state.ball.p.y };

  // 1 - The keeper keeps. He never joins the cascade below, and that alone is why he does not chase the
  //     ball to the halfway line the moment his side is under pressure.
  if (isKeeper(id)) {
    const spot = keeperSpot(state, team, playable);
    return dist2(spot, ball) < KEEPER_RANGE * KEEPER_RANGE ? ball : spot;
  }

  const home = homeSpot(squadIndex, plan, dirOf(team, state.period), ball, playable);

  // 2 - I have the ball: run onto it, a step further up the pitch than it is.
  //
  //     ⚠️ THE TARGET IS THE BALL WITH A LEAD, NOT A DISTANT POINT UP THE PITCH, and the difference was
  //     measured. Aiming twenty metres ahead made the carrier outrun the ball - he travels 2.4m between
  //     touches and the ball, slowed by rolling drag, travels 2 - so he left it behind, lost control,
  //     turned back for it, and the dribble became a forty-second oscillation that went nowhere. A short
  //     lead keeps him on it, and the touch does the travelling. That IS dribbling.
  if (holder === id) {
    // ⚠️ AND THE LEAD POINTS AT THE GOAL, not straight up the pitch. Carrying along `x` alone walked the
    //    ball into the corner flag and left it there: at the goal line the target clamps to the pitch, the
    //    body has nowhere left to go, its velocity falls to zero, the dribbling touch stops firing, and
    //    the match parks. Aiming at the mouth is both better football and the thing that makes the corner
    //    stop being an attractor.
    const mouth = goalMouthOf(team, state.period, playable);
    const dx = mouth.x - ball.x;
    const dy = mouth.y - ball.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    return {
      x: clamp(ball.x + (dx / d) * CARRY_LEAD, 0, playable.length),
      y: clamp(ball.y + (dy / d) * CARRY_LEAD, 0, playable.width),
    };
  }

  const weHaveIt = holder !== NOBODY && teamOf(holder) === team;

  // 3 - We have the ball and I do not: hold the shape, pushed a little forward. Off-the-ball movement is
  //     invisible even to sighted players and it is most of what a team does.
  if (weHaveIt) {
    const dir = dirOf(team, state.period);
    return { x: clamp(home.x + dir * SUPPORT_AHEAD, 0, playable.length), y: home.y };
  }

  // 4, 5 - Nobody has it, or they do: exactly ONE of us goes, and it is the one the plan named. Everyone
  //        else holds the shape. This single line is the anti-swarm rule.
  if (plan.presserId === squadIndex) return ball;

  // 6, 7 - Mark space by standing in the shape. A dedicated marking rule would be the next thing to add,
  //        and the shape already slides toward the ball, which is most of the effect for none of the cost.
  return home;
}

/** All the ratings a match needs, by team. */
export type Skills = Readonly<Record<number, Ratings>>;

/**
 * One AI pass over the whole match.
 *
 * Two team plans and about four agent decisions - not twenty-two. The plans are computed every tick here
 * because they are two calls, and the expensive half is the per-agent decision, which is staggered.
 */
export function think(
  state: MatchState,
  skills: Skills,
  playable: Playable = PITCH,
): void {
  void skills;
  const plans = [teamPlan(state, 0 as TeamId), teamPlan(state, 1 as TeamId)];

  for (let id = 0; id < state.players.length; id++) {
    if (!onPitch(state, id)) continue;
    if (!thinksThisTick(id, state.tick)) continue;
    const target = decide(state, id, plans[teamOf(id)], playable);
    const body: Body = state.players[id];
    body.target.x = target.x;
    body.target.y = target.y;
  }
}

/**
 * A desired direction for every body, from its cached target. Magnitude falls off near the target so a
 * body arrives instead of orbiting - a seek with no arrival is the classic jitter around a destination.
 */
export function steerAll(state: MatchState): Vec2[] {
  const out: Vec2[] = [];

  for (let id = 0; id < state.players.length; id++) {
    if (!onPitch(state, id)) {
      out.push({ x: 0, y: 0 });
      continue;
    }
    const body = state.players[id];
    const dx = body.target.x - body.p.x;
    const dy = body.target.y - body.p.y;
    const d2 = dx * dx + dy * dy;

    if (d2 < 0.04) {
      out.push({ x: 0, y: 0 });
      continue;
    }

    const d = Math.sqrt(d2);
    const speed = d < ARRIVE_RADIUS ? d / ARRIVE_RADIUS : 1;
    out.push({ x: (dx / d) * speed, y: (dy / d) * speed });
  }

  return out;
}

/** A ball struck by a foot. `id` is who struck it, so the referee can attribute the touch. */
export interface Kick {
  readonly id: PlayerId;
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;
}

/** Metres per second a keeper puts on a clearance, and how high he lifts it. */
const CLEARANCE_SPEED = 22;
const CLEARANCE_LIFT = 5;

/** Metres. Inside this a carrier shoots instead of carrying on. */
const SHOOT_RANGE = 22;

/** Metres per second on a shot, and the small lift that keeps it off the turf. */
const SHOT_SPEED = 26;
const SHOT_LIFT = 1.6;

/** Metres per second on a pass. Short balls arrive; long ones have to travel. */
const PASS_SPEED_SHORT = 14;
const PASS_SPEED_LONG = 19;

/**
 * Does anybody strike the ball this tick?
 *
 * ⚠️ TODAY THIS IS THE KEEPER'S CLEARANCE AND NOTHING ELSE, and the omission was measured rather than
 * planned: without it a keeper who collected the ball simply held it forever. His cascade branch says
 * "cover the line", so once the ball was at his feet his target was where he already stood, he never
 * moved, the dribbling touch never fired, and a six-thousand-tick match ended with the goalkeeper
 * standing on the ball and the phase stuck on `live`. A deadlock that no unit test above could see.
 *
 * Passing and shooting belong here too and are the next thing to add. The shape is already right: a
 * decision that returns a struck ball, applied by the match tick, never by the AI itself.
 */
/**
 * Which CPU player is making a challenge this tick, or `null`.
 *
 * ⚠️ THIS EXISTS TO REMOVE AN ASYMMETRY, not to make the AI cleverer. A foul was judged for commands
 * from a SEAT and for nothing else, so a child could be booked and sent off and the eleven players she was
 * playing against could not. That is a law that applies to one side of the pitch, and the side it applies
 * to is hers.
 *
 * ⚠️ ONLY THE DESIGNATED PRESSER, which is the anti-swarm rule doing a second job. Ten players hold
 * their shape and one chases; if every body near the carrier could commit a foul, a crowded box would
 * whistle every tick and the match would be nothing but free kicks.
 *
 * ⚠️ AND IT ANSWERS ONLY "who is challenging", never "was it a foul". `rules/foul.judgeTackle` decides
 * that, for her and for the machine, out of the same function - which is the only version of fair that
 * survives somebody reading the code.
 */
export function challenger(state: MatchState, team: TeamId): PlayerId | null {
  const holder = state.possession.holder;
  if (holder === NOBODY || teamOf(holder) === team) return null;

  const plan = teamPlan(state, team);
  if (plan.presserId < 0) return null;

  const id = firstOf(team) + plan.presserId;
  if (!onPitch(state, id)) return null;

  const me = state.players[id];
  const them = state.players[holder];
  if (dist2(me.p, them.p) > CHALLENGE_RANGE * CHALLENGE_RANGE) return null;

  // ⚠️ AND HE HAS TO HAVE GONE IN, which is the whole of what this extra condition is. A presser is
  //    beside the carrier on almost every tick of a match; if being there were a challenge, the machine
  //    would concede a free kick every tick and the game would be nothing but restarts.
  //
  // ⚠️ THIS IS AN INTENT TEST AND NOT A SEVERITY ONE, and the difference is why it lives here rather
  //    than in `rules/foul`. The LAW is identical for both sides - `judgeTackle` decides what a challenge
  //    was worth, for her and for the machine, out of the same function. What differs is when each side
  //    is deemed to have MADE one: she pressed the button, and the machine has no button. The only
  //    evidence of deliberateness a body can offer is the speed it arrived at.
  //
  //    The asymmetry that survives is that the machine does not give away CARELESS fouls, because it
  //    cannot express carelessness. It is written down rather than hidden, and it is the smallest gap
  //    that keeps a match from being a series of free kicks.
  const dx = me.v.x - them.v.x;
  const dy = me.v.y - them.v.y;
  return dx * dx + dy * dy >= WENT_IN * WENT_IN ? id : null;
}

/**
 * Closing speed at which the machine is deemed to have made a challenge rather than to be running beside
 * somebody. It is `rules/foul`'s own reckless threshold, imported rather than repeated - two numbers that
 * had to agree would eventually not.
 */
const WENT_IN = RECKLESS_SPEED;

/** Metres. How close the presser has to be to the carrier to count as having gone in at all. */
const CHALLENGE_RANGE = 2.0;

/** Metres. An opponent this close is pressure, and pressure is the reason to let the ball go. */
const PRESSED_AT = 2.6;

/** Metres. Further than this and a pass is a hopeful ball rather than a pass. */
const PASS_RANGE = 26;

/**
 * The team-mate worth giving it to, or `null`.
 *
 * ⚠️ FORWARD, FREE, AND IN RANGE - in that order, and all three matter. Backwards is safe and produces
 * a match that never arrives anywhere; a marked man is a giveaway; beyond the range a pass stops being a
 * pass. With nobody who qualifies the answer is NULL and the carrier keeps it, because hoofing it away is
 * not something a child can learn anything from.
 */
function receiverFor(state: MatchState, carrier: PlayerId, playable: Playable): PlayerId | null {
  const team = teamOf(carrier);
  const dir = dirOf(team, state.period);
  const me = state.players[carrier].p;

  let best: PlayerId | null = null;
  let bestScore = 0;

  for (let k = 0; k < SQUAD_SIZE; k++) {
    const id = firstOf(team) + k;
    if (id === carrier || isKeeper(id) || !onPitch(state, id)) continue;

    const at = state.players[id].p;
    const ahead = (at.x - me.x) * dir;
    if (ahead <= 2) continue; // a square or backward ball is not what this is for

    const d2 = dist2(me, at);
    if (d2 > PASS_RANGE * PASS_RANGE) continue;
    if (at.x < 0 || at.x > playable.length || at.y < 0 || at.y > playable.width) continue;

    // How free he is: the gap to his nearest marker. Ties break on the smallest index, like possession
    // does, so two identical options never depend on iteration order.
    let room = Infinity;
    for (let j = 0; j < SQUAD_SIZE; j++) {
      const foe = firstOf(team === 0 ? 1 : 0) + j;
      if (!onPitch(state, foe)) continue;
      const gap = dist2(at, state.players[foe].p);
      if (gap < room) room = gap;
    }

    // Forward AND free, neither able to dominate: a marked man twenty metres up the pitch is worse than a
    // free one ten metres up.
    const score = ahead * Math.sqrt(room);
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }

  return best;
}

export function decideKick(state: MatchState, playable: Playable = PITCH, skills?: Skills): Kick | null {
  const holder = state.possession.holder;
  if (holder === NOBODY) return null;

  const team = teamOf(holder);
  const dir = dirOf(team, state.period);

  if (isKeeper(holder)) {
    const across = clamp(playable.width / 2 - state.players[holder].p.y, -12, 12) / 40;
    return { id: holder, vx: dir * CLEARANCE_SPEED, vy: across * CLEARANCE_SPEED, vz: CLEARANCE_LIFT };
  }

  // A shot. Struck at the middle of the mouth, which is a placeholder for the accuracy a `shooting`
  // rating will scatter - and the reason a rating scatters an aim rather than rolling for a goal is
  // ADR-0049: the outcome comes out of position and skill, never out of luck.
  const mouth = goalMouthOf(team, state.period, playable);
  const dx = mouth.x - state.ball.p.x;
  const dy = mouth.y - state.ball.p.y;
  const d2 = dx * dx + dy * dy;
  if (d2 <= SHOOT_RANGE * SHOOT_RANGE) {
    const d = Math.sqrt(d2) || 1;
    // ⚠️ THE SECOND RATING THAT REACHES THE PITCH, and the reason there were no goal kicks. A shot struck
    //    at the exact centre of the mouth is a shot that can only be scored or saved - it is never wide,
    //    so the ball never crosses a goal line for any other reason, and a whole match produced twenty-
    //    eight throw-ins and not one goal kick.
    //
    //    Leaned, not rolled, and by the shirt number like the pass: the same club in the same position
    //    takes the same shot for ever. A child can learn to get closer before shooting; she could learn
    //    nothing from a dice.
    const aim = shotErrorOf(skills?.[team]?.shooting ?? 0.5);
    const lean = holder % 2 === 0 ? aim : -aim;
    const nx = dx / d;
    const ny = dy / d;
    return {
      id: holder,
      vx: (nx - ny * lean) * SHOT_SPEED,
      vy: (ny + nx * lean) * SHOT_SPEED,
      vz: SHOT_LIFT,
    };
  }

  // ⚠️ HE ONLY LETS GO UNDER PRESSURE. A carrier who passed whenever a pass existed would produce a
  //    match of nothing but passing, and dribbling is half of what a child watches for. Pressure is the
  //    reason football has passes at all.
  const me = state.players[holder].p;
  let pressure = Infinity;
  for (let j = 0; j < SQUAD_SIZE; j++) {
    const foe = firstOf(team === 0 ? 1 : 0) + j;
    if (!onPitch(state, foe)) continue;
    const gap = dist2(me, state.players[foe].p);
    if (gap < pressure) pressure = gap;
  }
  if (pressure > PRESSED_AT * PRESSED_AT) return null;

  const mate = receiverFor(state, holder, playable);
  if (mate === null) return null;

  const to = state.players[mate].p;
  const px = to.x - me.x;
  const py = to.y - me.y;
  const far = Math.sqrt(px * px + py * py) || 1;

  // ⚠️ THE FIRST RATING THAT REACHES THE PITCH. `think` did `void skills` - the clubs' six numbers
  //    were accepted and thrown away, so "every club is a side" was true of the roster and false of the
  //    match. A pass leans off its line by an angle from `passing`, and a perfect passer's error is ZERO:
  //    the honest end of the scale rather than a floor somebody chose.
  //
  //    ⚠️ AND THE LEAN IS DETERMINISTIC, not rolled. ADR-0049 asks for it and fairness asks harder: a
  //    pass that misses by luck is a pass a child cannot learn to make. Which way it leans comes from the
  //    carrier's own shirt number, so the same club in the same position plays the same ball for ever.
  const error = passErrorOf(skills?.[team]?.passing ?? 0.5);
  const lean = holder % 2 === 0 ? error : -error;
  const nx = px / far;
  const ny = py / far;

  // Enough to arrive, never so much that it runs away from the man it was meant for.
  const speed = far < 10 ? PASS_SPEED_SHORT : PASS_SPEED_LONG;
  return { id: holder, vx: (nx - ny * lean) * speed, vy: (ny + nx * lean) * speed, vz: 0 };
}

export { SQUAD_SIZE };
