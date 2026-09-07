// SPDX-License-Identifier: AGPL-3.0-or-later
// WHO HAS THE BALL. And, separately, who touched it last.

import { teamOf, type PlayerId } from './ids.ts';
import type { SideCaps } from './body.ts';
import type { MatchState } from './state.ts';
import { onPitch } from './squads.ts';
import { dist2 } from './vec.ts';
import type { Ball } from './ball.ts';
import { PITCH } from './units.ts';
import { SQUAD_SIZE } from './ids.ts';

/** No player. `-1` rather than `null` so the field is a number everywhere, including in the digest. */
export const NOBODY = -1;

/**
 * Metres. A player controls the ball inside this radius, when nobody has said otherwise.
 *
 * ⚠️ IT PROMISED TO BECOME A FUNCTION OF `control` AND NOW IT HAS, and the promise was kept in the shape
 * it was made in: *"ratings apply at the POINT OF ACTION rather than by branching the logic, so this
 * becomes `0.7 + 0.4 * control` and nothing else in this file changes."* The arithmetic lives in
 * `ai/ratings.controlRadiusOf`; this file receives the ANSWER, so it still knows nothing about clubs.
 *
 * ⚠️ AND IT IS EXACTLY `controlRadiusOf(0.5)`. A default that did not match the middle of the scale would
 * mean every gate driving the simulation without clubs described a different world from the game, and the
 * symptom would have been golden replays quietly ceasing to match.
 */
export const CONTROL_R = 0.9;

/** Metres. Above this the ball is in the air and nobody is dribbling it - it can only be headed. */
export const MAX_CONTROL_HEIGHT = 1.2;

/**
 * Metres per second. How fast a ball can be running AWAY from a body and still be taken by it.
 *
 * ⚠️ WITHOUT IT, A SHOT WAS STRUCK ON EVERY TICK. The ball leaves the foot at 26 metres a second and covers
 * 0.43m in a tick - still inside the control radius - so possession went straight back to the man who had
 * just hit it, and he hit it again. Measured on a real ninety-minute match: 8,352 shots, where football
 * has about twenty-five. Goals, corners and goal kicks all rode on it.
 *
 * ⚠️ AND IT IS ABOVE THE DRIBBLING TOUCH ON PURPOSE, which is the whole reason this rule failed the first
 * time it was tried. A dribble knocks the ball ahead at `TOUCH_GAIN` times the carrier's speed - about
 * 11.2 at a full sprint - so a threshold at a footballer's top speed of 7.6 dispossessed every sprinting
 * dribbler and broke four gates. Twelve is clear of the fastest legal touch and far below a struck ball.
 *
 * ⚠️ ONLY THE AWAY COMPONENT. A ball ARRIVING at any speed can be taken: blocking a shot, or standing in
 * the way of a pass, is what a body is for. Plain speed would stop a keeper holding a shot, which is the
 * one save football is most sure about.
 */
export const MAX_CONTROL_AWAY = 12;

/**
 * Ticks between touches while dribbling. About a third of a second, which is a footballer's stride.
 *
 * ⚠️ A DRIBBLE IS A SERIES OF TOUCHES, NOT GLUE, and the difference is the whole defensive half of the
 * game. A ball welded to the carrier can never be tackled, never intercepted and never run away from him;
 * between touches this one rolls free, which is what makes defending possible at all. Reading the cadence
 * off the tick rather than off a counter keeps it a pure function of the state, so a replay reproduces
 * every touch.
 */
export const TOUCH_PERIOD = 21;

/** How much faster than the carrier the ball is knocked. Under 1 and he would kick it into his own feet. */
const TOUCH_GAIN = 1.25;

/**
 * Seconds a touch is looked ahead by, to ask whether it would put the ball out.
 *
 * `TOUCH_PERIOD` is the time until he touches it again, so the question is exactly "will this ball still be
 * on the pitch when I next reach it" - which is the question a footballer asks.
 */
const TOUCH_LOOKAHEAD = TOUCH_PERIOD / 60;

/**
 * Metres. An opponent this close makes the ball CONTESTED, and a contested ball may go out.
 *
 * ⚠️ THIS IS THE WHOLE OF WHY THE THROW-IN RATE IS FIXABLE AT ALL. Measured: every one of 115 touchline
 * crossings across four whole matches came off a dribbling touch at about 7.8 metres a second, none of
 * them airborne and none of them off a clearance - so the touch was the game's only route to a touchline.
 * Clamping it outright was tried twice, and took the rate from six times football's to ZERO.
 *
 * Football's answer is neither. A player in the clear keeps the ball in - he turns inside, and running it
 * out is a mistake he does not make. A player with somebody on him puts it out constantly, and that is
 * where throw-ins come from. So the clamp asks whether he is alone, and nothing here is a dice: the same
 * two bodies in the same two places give the same answer for ever.
 */
const CONTESTED_AT = 2;

/**
 * Metres. How much closer a rival must be before he takes the ball off the current carrier, when nobody
 * has said otherwise. It is `tackleMarginOf(0.5)` exactly - see `ai/ratings`.
 *
 * ⚠️ WITHOUT THIS THE BALL GOES NOWHERE, and it was measured rather than predicted: two forwards
 * converging on the centre spot swapped possession every tick, each knocking the ball back the way the
 * other had just knocked it, and a six-thousand-tick match ended two metres from the kickoff. The margin
 * is also exactly what shielding is - a carrier with his body between the ball and an opponent keeps it -
 * so the fix and the football turn out to be the same thing.
 */
export const SHIELD_MARGIN = 0.35;

export interface Possession {
  /** Who is dribbling right now, or `NOBODY`. */
  holder: PlayerId;
  /**
   * Who touched it last, and it OUTLIVES the holder. A corner and a goal kick are the same event told
   * apart by this one fact, and it is asked after the ball has already gone out - when `holder` is
   * necessarily `NOBODY`.
   */
  lastTouch: PlayerId;
}

export function createPossession(): Possession {
  return { holder: NOBODY, lastTouch: NOBODY };
}

/**
 * Decide who, if anyone, has the ball this tick.
 *
 * One pass over the squads in index order, keeping the smallest squared distance and the smallest index
 * on a tie. No sort: a comparator's tie-breaking would silently become part of the simulation's
 * determinism, and nothing would say so.
 */
/** Is anybody from the other side close enough to the ball to make it a contested one? */
function contested(state: MatchState, carrier: PlayerId): boolean {
  const them = teamOf(carrier) === 0 ? SQUAD_SIZE : 0;
  for (let k = 0; k < SQUAD_SIZE; k++) {
    const id = them + k;
    if (!onPitch(state, id)) continue;
    if (dist2(state.players[id].p, state.ball.p) < CONTESTED_AT * CONTESTED_AT) return true;
  }
  return false;
}

/**
 * How fast the ball is leaving `at`, in metres a second. Negative when it is coming towards it.
 *
 * A ball sitting exactly on somebody has no direction to leave in, so it is not leaving: zero, rather than
 * a division every caller would have to guard.
 */
function runningAway(at: { x: number; y: number }, ball: Ball): number {
  const dx = ball.p.x - at.x;
  const dy = ball.p.y - at.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d === 0) return 0;
  return (ball.v.x * dx + ball.v.y * dy) / d;
}

export function resolvePossession(state: MatchState, sides?: readonly [SideCaps, SideCaps]): void {
  const { ball, players, possession } = state;

  if (ball.p.z >= MAX_CONTROL_HEIGHT) {
    possession.holder = NOBODY;
    return;
  }

  // ⚠️ REACH IS PER SIDE NOW, so "within reach" and "nearest" are two questions where they used to be one
  //    initialiser. A single `bestD2` seeded with the radius answered both at once, and it cannot survive
  //    two radii: a deft dribbler a metre away and a clumsy one at ninety centimetres are both candidates
  //    or not depending on WHOSE radius the seed was.
  const reachOf = (i: number): number =>
    sides === undefined ? CONTROL_R : sides[teamOf(i)].controlRadius;

  let best = NOBODY;
  let bestD2 = Infinity;

  for (let i = 0; i < players.length; i++) {
    if (!onPitch(state, i)) continue;
    // Law 15: the man who took the restart may not play it again until somebody else has.
    if (i === state.tookRestart) continue;
    const d2 = dist2(players[i].p, ball.p);
    const r = reachOf(i);
    if (d2 >= r * r) continue;
    if (runningAway(players[i].p, ball) > MAX_CONTROL_AWAY) continue;
    // Strictly nearer, so an exact tie leaves `best` on the LOWER index that got there first.
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  }

  // The carrier shields: he keeps the ball unless the challenger is CLEARLY closer. Compared in metres
  // rather than in squared metres, because a margin in squared units would mean different things at
  // different distances - and this margin is a body's width, which does not change with range.
  const held = possession.holder;
  if (held !== NOBODY && held !== best) {
    const heldD2 = dist2(players[held].p, ball.p);
    const heldReach = reachOf(held);
    // ⚠️ THE MARGIN IS THE CHALLENGER'S AND NOT THE CARRIER'S. It is what HE has to overcome, so it is his
    //    side's `defending` that sets it - reading it off the man being robbed would turn the rating into
    //    a shielding rating and put it on the wrong six numbers entirely.
    const margin =
      sides === undefined || best === NOBODY ? SHIELD_MARGIN : sides[teamOf(best)].tackleMargin;
    if (heldD2 < heldReach * heldReach && Math.sqrt(heldD2) - Math.sqrt(bestD2) < margin) {
      best = held;
    }
  }

  // ⚠️ TAKING THE BALL IS ITSELF A TOUCH, and leaving that out was a defect with a strange symptom: a
  //    player who won the ball and ran lost it again within a third of a second, every time. The cadence
  //    is counted on the global tick, so somebody who gained possession at tick 5 had to wait until tick 21
  //    for his first touch - and by then he had outrun a ball that had not moved. Football has no such
  //    gap: the first thing a player does with the ball is touch it.
  const gained = best !== possession.holder;
  possession.holder = best;
  if (best === NOBODY) return;

  // Somebody else has played it, so the restart is over and the taker is an ordinary player again.
  state.tookRestart = -1;

  possession.lastTouch = best;
  if (!gained && state.tick % TOUCH_PERIOD !== 0) return;

  // The touch. A carrier standing still SHIELDS the ball instead of knocking it away, which falls out of
  // using his own velocity rather than his facing: no speed, no touch, and no special case to write.
  const carrier = players[best];
  ball.v.x = carrier.v.x * TOUCH_GAIN;
  ball.v.y = carrier.v.y * TOUCH_GAIN;
  ball.grounded = true;

  // ⚠️ A MAN IN THE CLEAR DOES NOT RUN THE BALL OUT. Chasing a ball near a touchline means running AT that
  //    touchline, and the touch is his own velocity - so unopposed carriers were putting it out all match.
  //    With somebody on him it stays as it is: a contested ball going out is football, and it is the only
  //    thing left in this game that produces a throw-in at all.
  //
  // ⚠️ ACROSS ONLY, NEVER ALONG. A goal line is not a touchline: a shot has to cross it, and turning a
  //    carrier's touch aside at the mouth would defend the one line the ball is SUPPOSED to leave by.
  //
  // ⚠️ AND IT REFLECTS RATHER THAN ZEROING. Setting the across-component to nothing was measured and it
  //    PINNED THE BALL TO THE LINE - it stopped going out, never came back in, and six whole matches
  //    produced no goals at all. Turning inside is the move a footballer makes when the line runs out.
  const ahead = ball.p.y + ball.v.y * TOUCH_LOOKAHEAD;
  if ((ahead < 0 || ahead > PITCH.width) && !contested(state, best)) ball.v.y = -ball.v.y;
}
