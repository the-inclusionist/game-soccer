// SPDX-License-Identifier: AGPL-3.0-or-later
// THE KEEPER GETS A HAND TO IT.
//
// ========================= WHY A GAME WITH NO PARRY HAS NO CORNERS =========================
// There was no save model at all. The keeper is a body, and a body takes the ball when it comes inside its
// control radius - so a shot was binary: he caught everything he could touch, and everything else went in.
//
// ⚠️ A KEEPER WHO NEVER SPILLS IS A KEEPER WHO NEVER CONCEDES A CORNER, and that is the whole of why this
// game has none. Football's corners come almost entirely from a defender putting the ball behind his own
// line, and this AI has no way to do that: `receiverFor` only passes FORWARD, the keeper's clearance goes
// forward, and nothing deflects. Measured over six whole matches: zero corners, against football's ten a
// match. The rule for a corner has been written and gated since the referee existed; what was missing was
// anything that could produce one.
//
// ========================= AND IT IS A TIP ROUND THE POST, NOT A PUSH BACK OUT =========================
// ⚠️ THE FIRST VERSION OF THIS COULD NOT PRODUCE A CORNER AT ALL, and the geometry says why in one line: it
// sent the ball straight out from the goal's centre, which is the one direction that is guaranteed to take
// it AWAY from the goal line. It was a save that always kept the ball in play, and six more matches
// produced six more nil corners.
//
// A keeper who reaches a ball he cannot hold does not push it back where it came from - he gets a hand
// across it and it carries on, wider and slower. So the parry keeps the ball's forward direction, takes
// two thirds of its pace off, and turns it OUTWARD from the middle of his goal by as much again. A ball
// heading just inside the post goes just outside it, which is a save AND a corner; a ball already heading
// wide goes wider and is still a corner, because he touched it; and a ball heading down the middle is
// nudged and still goes in, because a fingertip is not a save.
//
// ⚠️ ADR-0049 asks that every outcome be deterministic, and a save is exactly where a game reaches for a
// random number. There is none here: whether he holds it depends on HOW CLOSE it is, and which way it goes
// depends on WHICH SIDE OF HIM it was. A child can learn that - shoot near the post and the best he can do
// is put it behind.

import { firstOf, type TeamId } from './ids.ts';
import { CONTROL_R } from './possession.ts';
import { onPitch } from './squads.ts';
import type { MatchState } from './state.ts';
import { PITCH } from './units.ts';
import type { SideCaps } from './body.ts';

/**
 * Metres. How far a keeper can reach, which is further than a foot.
 *
 * He has hands and he dives; an outfield player controls the ball at 0.9. The gap between the two is the
 * whole of what this file is about - inside the control radius he holds it, and out to here he can only
 * get a hand to it.
 */
export const KEEPER_REACH = 2.6;

/**
 * How much of the ball's forward pace survives being tipped.
 *
 * ⚠️ IT HAS TO BE ENOUGH TO REACH THE LINE. A parry that dies in the six-yard box is a tap-in every time
 * and a keeper worse than none; a third of a shot is about eight metres a second, which carries it behind
 * and leaves a follow-up a real chance when it does not.
 */
const PARRY_KEEP = 1 / 3;

/**
 * How far across the ball he gets, as a multiple of the pace he leaves on it.
 *
 * ⚠️ IT IS THE SAME AGAIN ON PURPOSE - a right angle's worth of deflection. A ball a metre from the line
 * has about a tenth of a second left, and a nudge would move it a hand's width in that time; to put a shot
 * from inside the post to outside it, the sideways pace has to be the forward pace. That is a keeper
 * getting a strong hand across it, which is what a save near the post looks like.
 */
const PARRY_WIDE = 1;

/**
 * Metres per second. Below this the ball is not a shot and he simply picks it up.
 *
 * A keeper who palmed away every ball rolling near him would never hold anything at all, and a goal kick
 * would become impossible to take. Faster than any body can run, so what this catches is a STRUCK ball.
 */
const SHOT_ENOUGH = 12;

/** The centre of the goal `team` defends this period, which is what a parry points away from. */
function ownGoal(team: TeamId, period: number): { x: number; y: number } {
  // The ends swap at half time, so which line a side defends is a fact about the PERIOD. Same rule as
  // `rules/foul.insideOwnBox` and `rules/referee.defenderOf`, and it must not disagree with either.
  const defendsFar = (team === 0) === (period === 2);
  return { x: defendsFar ? PITCH.length : 0, y: PITCH.width / 2 };
}

/**
 * Let each keeper have a go at a struck ball, and palm away what he cannot hold.
 *
 * Runs after the ball has moved and before possession is resolved: a ball he has just pushed away must not
 * then be handed to him as the nearest body, and a ball he can hold must still be there to be held.
 *
 * ⚠️ AND HE BECOMES THE LAST TOUCHER, which is the half that makes it a CORNER. `rules/out-of-play` tells a
 * corner from a goal kick by whose touch sent it over, and a parry nobody recorded would award the goal
 * kick to the side that was attacking.
 */
export function keeperSave(state: MatchState, sides?: readonly [SideCaps, SideCaps]): void {
  const ball = state.ball;
  const speed = Math.sqrt(ball.v.x * ball.v.x + ball.v.y * ball.v.y);
  if (speed < SHOT_ENOUGH) return;

  for (const team of [0, 1] as const) {
    const id = firstOf(team);
    if (!onPitch(state, id)) continue;

    const me = state.players[id];
    const dx = ball.p.x - me.p.x;
    const dy = ball.p.y - me.p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d >= KEEPER_REACH) continue;

    // Inside his own hands: he holds it, and `resolvePossession` will say so on this same tick.
    const hold = sides === undefined ? CONTROL_R : sides[team].controlRadius;
    if (d < hold) continue;

    const goal = ownGoal(team, state.period);
    // Which side of his goal's middle the ball is on. Exactly on the middle it goes to his left, which is
    // arbitrary and written down rather than left to the sign of a zero.
    const wide = ball.p.y - goal.y >= 0 ? 1 : -1;

    const on = ball.v.x * PARRY_KEEP;
    ball.v.x = on;
    ball.v.y = wide * Math.abs(on) * PARRY_WIDE;
    ball.v.z = 0;
    ball.grounded = true;
    state.possession.holder = -1;
    state.possession.lastTouch = id;
    return; // one ball, one keeper
  }
}
