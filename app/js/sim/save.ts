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

import { firstOf, teamOf, type TeamId } from './ids.ts';
import { CONTROL_R, NOBODY as NOBODY_KICK } from './possession.ts';
import { insideOwnBox } from './ends.ts';
import { onPitch } from './squads.ts';
import type { MatchState } from './state.ts';
import { BALL, PITCH } from './units.ts';
import type { SideCaps } from './body.ts';

/**
 * Metres. How far a keeper can reach, which is further than a foot.
 *
 * He has hands and he dives; an outfield player controls the ball at 0.9. The gap between the two is the
 * whole of what this file is about - inside the control radius he holds it, and out to here he can only
 * get a hand to it.
 */
export const KEEPER_REACH = 2.6;

// ========================= AND MAKING IT SITUATIONAL IS NOT THE NEXT MOVE, MEASURED =========================
// The absorption plan puts "give the keeper a reach that grows with the shooter's distance and shrinks
// with ball speed" FIRST, on the grounds that a constant is a binary filter sitting downstream of every
// shooting-side change and unable to feel any of them. That reasoning is right and the conclusion does not
// follow, which twelve fixtures said before a line of it was written.
//
// Every save in the slate, detected by this module's own signature - the keeper becomes `lastTouch` and
// the ball is held by nobody - with the shooter read from `lastTouch` one tick earlier:
//
//                        saves   shooter distance p10/p50/p90   ball speed p10/p50/p90   ticks since last
//     nobody playing       551          0.2 / 1.3 / 7.6 m         24.0 / 26.2 / 26.9        57
//     a child playing      696          0.4 / 1.0 / 5.3 m         25.3 / 26.2 / 27.0         5
//
// ⚠️ THE SPEED AXIS IS NOT AN AXIS. Every shot arrives at between 24 and 27 metres a second; there is
// nothing for a reach to discriminate on. Half of the model the plan describes has no live variable
// behind it, and building it would be building a function of a constant.
//
// ⚠️ AND THE MEDIAN SHOT IS STRUCK FROM ONE METRE, which is not a shot - it is a body walking the ball
// into him. At that range the time available is 38 milliseconds, a little over two ticks. No keeper
// reacts to that and ours should not pretend to; a reach that shrank honestly at one metre would let
// through nearly every one of these.
//
// ⚠️ AND THE MEDIAN GAP BETWEEN SAVES IS FIVE TICKS, which names what is actually happening. `sim/block`
// recorded the identical signature for outfield bodies and used the identical words: "he shoots, somebody
// absorbs it, it comes back, he shoots again", median FIVE ticks apart. So these are not fifty-eight shots
// a match. They are a handful of attacks caught in a parry loop, counted once per bounce - and the p90 gap
// of 324 ticks is the genuine, separated shots showing through underneath.
//
// ⚠️ SO THE KEEPER IS NOT MAGNETIC SO MUCH AS BESIEGED, and he is currently the only thing standing
// between the loop and a scoreline nobody would believe. Taking his reach away first would not reveal
// better football; it would convert a loop that ends in a parry into a loop that ends in a goal. What is
// upstream is the shot volume at point-blank range - which `sim/block` also named, in writing, as "the
// next thing, and it is upstream of everything measured here".
//
// The plan's ordering argument survives its own conclusion: the keeper DOES flatten every measurement
// downstream. He is just not the first thing to move.
//
// Measured 2026-09-11 with `tests/helpers/scripted-child`, which is committed and gated precisely so the
// next person can re-run this rather than re-derive it.

/**
 * How much of the ball's forward pace survives being tipped.
 *
 * ⚠️ IT HAS TO BE ENOUGH TO REACH THE LINE. A parry that dies in the six-yard box is a tap-in every time
 * and a keeper worse than none; a third of a shot is about eight metres a second, which carries it behind
 * and leaves a follow-up a real chance when it does not.
 */
const PARRY_KEEP = 1 / 3;

// ========================= AND THE LOOP IS WHERE THE GOALS COME FROM, MEASURED 2026-09-11 =========================
// Two separate items arrived at this constant from opposite directions. The keeper measurement above found
// a median of five ticks between saves and called it a parry loop; the off-ball measurement in `ai/plan`
// found that attacks never last long enough for a run to finish, which is what a possession stuck
// bouncing looks like from the other end. `sim/block` had already written that the shot volume is
// "upstream of everything measured here". Three records, one suspect - so it was swept.
//
// Twelve fixtures, a child playing:
//
//     PARRY_KEEP   saves/match   gap p50   goals   corners   goal kicks
//       1/3             82.8        16t     1.50      1.83         2.83
//       0.7             38.8        83t     0.67      3.17         3.67
//       1.1              6.8      1725t     0.17      0.00         0.08
//
// ⚠️ THE LEVER WORKS AND IT IS THE WRONG LEVER. A firmer parry does break the loop - saves halve, and
// the gap between them goes from a quarter of a second to a second and a half - and it takes the goals
// with it, because THE LOOP IS WHERE THE GOALS COME FROM. Eighty-three saves a match reads like pure
// waste until you take it away and the scoring goes with it: those bounces are the attacks, counted once
// per bounce. At 1.1 the game stops existing - two tenths of a goal and not one corner in twelve matches.
//
// ⚠️ AND IT IS THE TRADE THE DEV HAS ALREADY RULED ON. Corners and goal kicks have been under band for
// weeks and 0.7 puts both of them in or beside it - at exactly the cost of the goals. That is the same
// one-for-one the shot error sweep found, and the ruling from 2026-09-07 covers it word for word:
// corners and goal kicks are bought with goals, and a children's game keeps the goals. So nothing here
// moves, and the table is written down so the next person to arrive at this constant from a fourth
// direction does not have to re-run it.
//
// ⚠️ AND IT CORRECTS HALF OF WHAT I WROTE ABOVE. The note on the keeper's reach says taking it away
// would "convert a loop that ends in a parry into a loop that ends in a goal", which is still the honest
// prediction for THAT lever. What I did not know when I wrote it is that the loop is load-bearing: it is
// not a defect sitting in front of the football, it is most of the football there is.

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

    // ⚠️ HANDS ONLY INSIDE HIS OWN AREA, which is Law 12 and which this loop did not ask. It asked only
    //    whether he was on the PITCH, so a keeper who had come out palmed shots away at the halfway line.
    //    It was invisible because `ai/brain` keeps him within `KEEPER_RANGE` of his line and never walks
    //    him out - but a CHILD driving a keeper can, and a rule obeyed only because nobody tries it is
    //    not a rule.
    //
    // ⚠️ AND IT IS THE BALL'S POSITION AND NOT THE KEEPER'S, because handling is where the ball is when
    //    he touches it. A keeper standing on his line reaching two metres past it has his hands outside
    //    the area, which football does not allow and which testing his own feet would.
    //
    // ⚠️ AND `insideOwnBox` IS SHARED WITH `rules/foul` RATHER THAN COPIED. It is the same question asked
    //    for a different reason, it depends on the PERIOD because the ends swap, and it is a rectangle
    //    rather than a radius - three chances for two private copies to disagree, which is exactly what
    //    `sim/ends` was created to stop happening a second time.
    // ⚠️ AND IT IS ANY PART OF THE BALL, WHICH IS THE WHOLE OF WHY `BALL.radius` IS HERE. Measured over
    //    the twelve-fixture slate, the first version of this line - the ball's CENTRE inside the area -
    //    refused ninety-seven parries a slate and took the corners from 3.00 a match to 0.42. Every one
    //    of the refusals was at a depth of about MINUS ten centimetres: the ball straddling his own goal
    //    line, four to seven metres wide of the goal, still in play because `rules/out-of-play` requires
    //    it to have WHOLLY crossed - and partly inside the area, which football allows him to handle.
    //    A point test moves every line by one radius, which is the same sentence `sim/units` writes
    //    beside that constant, and here it moved a law.
    if (!insideOwnBox(ball.p, team, state.period, BALL.radius)) continue;

    // ========================= ⚠️ AND THE OTHER HALF OF LAW 12 IS NOT BUILT, FOR A NAMED REASON =========================
    // The absorption plan's item K is two laws: hands only inside his own area, which is the line above,
    // and NEVER FROM A DELIBERATE KICK BY A TEAM-MATE. The second one needs a fact this simulation does
    // not keep.
    //
    // ⚠️ `possession.lastTouch` CANNOT ANSWER IT, and that is the whole blocker rather than an excuse.
    // `sim/block` sets `lastTouch` when a body DEFLECTS the ball - by design, because that is how
    // `rules/out-of-play` tells a corner from a goal kick - so the one field that survives a ball's flight
    // conflates a pass with a blocked shot. Football is explicit that a keeper MAY handle a ball that came
    // off a team-mate accidentally, so a law written against `lastTouch` would punish exactly the case the
    // law exempts. `state.lastStruck` is the deliberate half, and it is a LOCK rather than a record: it is
    // cleared the moment the ball leaves the striker's own reach, which is a few ticks into a pass.
    //
    // ⚠️ SO IT TOOK A NEW FIELD - `state.lastKick`, who last DELIBERATELY kicked it - written where
    // `play.ts` applies a strike, a dribbling knock and an AI kick, and never by `sim/block` or by this
    // file. It cost a digest row and a bump of `SIM_VERSION`, which is the price of a fact the simulation
    // did not keep.
    //
    // ⚠️ AND `lastTouch === lastKick` IS THE SECOND HALF OF THE CONDITION, not decoration. The law is
    // about a ball that reaches him FROM that kick; once anybody else has played it the ball is no longer
    // the one his team-mate sent him, and football gives him his hands back. Without it the restriction
    // would outlive the pass it was about and follow the ball through a whole passage of play.
    //
    // ⚠️ AND HIS OWN KICK IS NOT A TEAM-MATE'S. Playing his own clearance again is a different law - the
    // second touch - and reading this one loosely would quietly implement that one too, wrongly.
    const kicked = state.lastKick;
    const fromOurOwn =
      kicked !== NOBODY_KICK &&
      kicked !== id &&
      teamOf(kicked) === team &&
      state.possession.lastTouch === kicked;
    if (fromOurOwn) continue;
    //
    // ⚠️ AND THE ACCESS CLAUSE OF ITEM K BELONGS TO THAT HALF AND NOT TO THIS ONE. The plan asks for «the
    // caption and the reader say why play stopped, as they do for offside», and this law stops nothing -
    // it takes a power away, it does not award anything. Narrating a refusal here would be worse than
    // silence: over half of them are on a ball that has already wholly crossed the line, so the child
    // would hear "he cannot handle that" one tick before "goal kick" and learn a rule that had nothing to
    // do with what she just saw. The back-pass half DOES stop play in football, and that is where the
    // sentence a child needs lives.

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
    // ⚠️ ONLY GROUNDED IF IT IS ON THE GROUND. Claiming it for a ball still in the air froze it there: with
    //    no vertical speed and `grounded` set, `sim/ball` skipped gravity entirely, and a parry taken at
    //    head height left the ball hanging at 1.2 metres - above `MAX_CONTROL_HEIGHT`, so unreachable -
    //    for the rest of the match. `sim/ball` refuses the lie now; this stops telling it.
    ball.v.z = 0;
    ball.grounded = ball.p.z <= 0;
    state.possession.holder = -1;
    state.possession.lastTouch = id;
    return; // one ball, one keeper
  }
}
