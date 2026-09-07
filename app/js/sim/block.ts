// SPDX-License-Identifier: AGPL-3.0-or-later
// A BODY IN THE WAY OF A STRUCK BALL.
//
// ========================= WHY A MATCH HAD FOUR THOUSAND SHOTS IN IT =========================
// `resolvePossession` gives the ball to the nearest body inside its control radius, and `MAX_CONTROL_AWAY`
// only refuses a ball RUNNING AWAY from him - "a ball arriving at any speed can be taken: blocking a shot
// is what a body is for". True of blocking, and it was implemented as SWALLOWING.
//
// ⚠️ MEASURED TICK BY TICK: a shot leaves at 24 metres a second and on the very next tick an opponent a
// metre away is the holder and the ball is doing 6. It never travelled. That is why a ninety-minute match
// contained 2,672 shots with a median of FIVE TICKS between them, 2,602 of them by the same man - he
// shoots, somebody absorbs it, it comes back, he shoots again.
//
// ========================= AND THE ALTERNATIVE IS NOT LETTING IT THROUGH =========================
// There is no ball-body collision anywhere in `sim/`; possession is the only interaction a body has with
// the ball. So refusing the fast ball without replacing it would send shots straight THROUGH defenders,
// which is worse and more visible.
//
// A block is the third thing: he does not keep it and it does not pass through him. The pace comes off it
// and it carries on - which also makes it a CORNER when it goes behind, because `lastTouch` is how
// `rules/out-of-play` tells a corner from a goal kick.
//
// ⚠️ THE KEEPER ALREADY HAD THIS, and this is the same shape for everybody else. `sim/save` lets him hold
// what he can reach and tip what he cannot; out here nobody holds a struck ball at all, because a foot is
// not a pair of hands.

import { firstOf, type TeamId } from './ids.ts';
import { NOBODY } from './possession.ts';
import { onPitch } from './squads.ts';
import type { MatchState } from './state.ts';
import type { SideCaps } from './body.ts';
import { CONTROL_R } from './possession.ts';

/**
 * Metres per second. Above this a ball is struck rather than played, and no foot brings it down.
 *
 * ⚠️ IT HAS TO SIT ABOVE A PASS AND BELOW A SHOT, and the gap is wide because a pass is WEIGHTED. A ball
 * aimed to stop a quarter past its man arrives at about a fifth of the speed it left at - a ten-metre pass
 * leaves at twenty and arrives at four - while a shot arrives at twenty-six. Ten is clear of both.
 */
export const CONTROL_SPEED = 10;

/**
 * How much pace survives coming off a shin - and the ball keeps the direction it was going.
 *
 * ⚠️ THREE VERSIONS WERE MEASURED OVER SIX FIXTURES, and only this one is better than no block at all.
 * Per ninety-minute match, against targets of 40 throw-ins, 2.7 goals and 10 corners:
 *
 *                            throw-ins   goals   corners
 *   no block at all              222.7    43.3      16.7
 *   off him, 40% of the pace     971.7     2.3      35.3
 *   off him, 15% of the pace     689.7     7.3     284.7
 *   straight on, 40%             206.0    16.0       2.7   <-
 *
 * ⚠️ PUSHING IT OFF HIM IS PHYSICALLY RIGHTER AND PLAYS WORSE. Every block re-aims the ball, it hits
 * somebody else and is re-aimed again, and the random walk reaches a line: nine hundred and seventy-two
 * throw-ins in one match. Taking the energy off it and letting it carry on is a worse model of a shin and
 * a better model of a match, and that trade is written here rather than discovered again.
 *
 * ⚠️ AND NONE OF THEM FIXES THE MATCH, because the block is downstream of the real number: 2,672 shots
 * in a ninety-minute match against football's twenty-five. Blocking only decides what KIND of chaos a shot
 * becomes. The shot volume is the next thing, and it is upstream of everything measured here.
 */
const BLOCK_KEEP = 0.4;

/**
 * Take the force out of a struck ball that somebody is standing in.
 *
 * Runs after the keeper has had his go and before possession is resolved: a ball he has palmed away must
 * not then be blocked by him again, and a ball nobody blocked must still be there to be taken.
 *
 * ⚠️ HE IS RECORDED AS THE LAST TOUCHER, which is what makes it a CORNER when it goes behind: that is how
 * `rules/out-of-play` tells a corner from a goal kick. And he is marked as having struck it, so he cannot
 * pick up his own block on the next tick - the same rule that stops a man passing to himself.
 */
export function blockBall(state: MatchState, sides?: readonly [SideCaps, SideCaps]): void {
  const ball = state.ball;
  const speed = Math.sqrt(ball.v.x * ball.v.x + ball.v.y * ball.v.y);
  if (speed < CONTROL_SPEED) return;

  let best = NOBODY;
  let bestD2 = Infinity;
  for (let i = 0; i < state.players.length; i++) {
    if (!onPitch(state, i)) continue;
    // The man who struck it is not standing in his own shot.
    if (i === state.lastStruck) continue;

    const dx = state.players[i].p.x - ball.p.x;
    const dy = state.players[i].p.y - ball.p.y;
    const d2 = dx * dx + dy * dy;
    const r = sides === undefined ? CONTROL_R : sides[teamOfIndex(i)].controlRadius;
    if (d2 >= r * r) continue;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  }
  if (best === NOBODY) return;

  ball.v.x *= BLOCK_KEEP;
  ball.v.y *= BLOCK_KEEP;
  ball.v.z = 0;
  ball.grounded = ball.p.z <= 0;

  state.possession.holder = NOBODY;
  // ⚠️ IT CAME OFF HIM, and `rules/out-of-play` tells a corner from a goal kick by exactly this.
  state.possession.lastTouch = best;
  state.lastStruck = best;
}

/** Squad index 0..10 is home, 11..21 away. Local rather than imported to keep this file's surface small. */
function teamOfIndex(i: number): TeamId {
  return (i < firstOf(1) ? 0 : 1) as TeamId;
}
