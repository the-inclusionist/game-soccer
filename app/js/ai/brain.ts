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
import { DEFAULT_CAPS } from '../sim/body.ts';
import { onPitch } from '../sim/squads.ts';
import { attackDirOf } from '../sim/ends.ts';
import type { Body, MatchState } from '../sim/state.ts';
import { BALL, BOX, PITCH } from '../sim/units.ts';
import { clamp, dist2, type Vec2 } from '../sim/vec.ts';
import { homeSpot, type TeamPlan } from './formation.ts';
import { passErrorOf, pressedAtOf, shotErrorOf, type Ratings } from './ratings.ts';
import { teamPlan } from './plan.ts';
import { thinksThisTick } from './schedule.ts';
import { wentIn } from '../rules/foul.ts';
import { offsideLineOf } from '../rules/offside.ts';

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

/** The middle of the goal this team is attacking, on the area IN PLAY. */
function goalMouthOf(team: TeamId, period: number, playable: Playable): Vec2 {
  const dir = attackDirOf(team, period);
  return { x: dir === 1 ? playable.length : 0, y: playable.width / 2 };
}

/** The point on this keeper's line he should be covering: between the ball and the middle of his goal. */
function keeperSpot(state: MatchState, team: TeamId, playable: Playable): Vec2 {
  const dir = attackDirOf(team, state.period);
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

  // 0 - A dead ball that is OURS to take: whoever of us is nearest goes and takes it.
  //
  //     ⚠️ WITHOUT THIS THE MATCH STOPS, and it is a different wedge from the two before it. The cascade
  //     below sends whoever is nearest a LOOSE ball, and at a dead ball that is as likely to be an
  //     opponent - who is not taking this throw. Measured: two of six whole fixtures ran out of ticks at a
  //     throw-in with ELEVEN MEN EACH still on the pitch, so it was never about cards. The ball was in the
  //     corner, the taking side's nearest man was its KEEPER - who will not leave his line for a ball
  //     fourteen metres away - and every outfielder was holding shape fifteen to twenty metres out.
  //
  //     ⚠️ AND IT COMES BEFORE THE KEEPER RULE, which is the half that makes it work. A goal kick IS the
  //     keeper's to take, and the rule below would send him back to his line instead.
  if (state.restartTaker === team && takerOf(state, team) === id) return ball;

  // 1 - The keeper keeps. He never joins the cascade below, and that alone is why he does not chase the
  //     ball to the halfway line the moment his side is under pressure.
  if (isKeeper(id)) {
    const spot = keeperSpot(state, team, playable);
    return dist2(spot, ball) < KEEPER_RANGE * KEEPER_RANGE ? ball : spot;
  }

  const home = homeSpot(squadIndex, plan, attackDirOf(team, state.period), ball, playable);

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
  //
  //     ⚠️ EXCEPT WHEN IT IS WIDE AND HIGH, and then the forwards go IN. The cross was built and never
  //     fired once in six fixtures at each match length - proved by six byte-identical result sets in a
  //     deterministic simulation - because it asks for somebody arriving in the box, and the 4-4-2 slides
  //     SIDEWAYS with the ball: a wide carrier had team-mates level with him and nobody in front of goal.
  //
  //     ⚠️ AND THEY DO NOT STAND ON EACH OTHER. Two bodies on one spot is one target for a defender and
  //     one body's worth of chance, so the near man takes the near post and the other the far.
  if (weHaveIt && holder !== NOBODY && wideAndHigh(state, holder, attackDirOf(team, state.period), playable)) {
    const near = squadIndex === FORWARDS[0];
    if (near || squadIndex === FORWARDS[1]) {
      const mouth = goalMouthOf(team, state.period, playable);
      const dir = attackDirOf(team, state.period);
      return {
        x: clamp(mouth.x - dir * CROSS_DEPTH, 0, playable.length),
        y: clamp(playable.width / 2 + (near ? -POST_SPLIT : POST_SPLIT), 0, playable.width),
      };
    }
  }

  if (weHaveIt) {
    const dir = attackDirOf(team, state.period);

    // ⚠️ A FORWARD RUNS BEYOND THE BALL, and until this line nobody in this game ever did. The rule
    //    below aims a supporting player at his SHAPE SPOT plus nine metres, and the 4-4-2 slides only a
    //    quarter of the way toward the ball - so with a carrier at seventy-five a forward was aimed at
    //    sixty-nine, BEHIND him. Measured on the gate that found it: the ball on seventy and the forward
    //    aimed at 40.5.
    //
    //    It is why three things could not work at once. The cross waits for a body in the box; the ball
    //    played into a runner's path has nobody running; and a corner and a goal kick are events at the
    //    end of a pitch the attack stopped short of - which is why every lever tried on those two counts
    //    made one of the three worse.
    //
    //    ⚠️ AND HE STOPS AT THE LAST DEFENDER, which is what makes it football rather than two men
    //    camped in the six-yard box - the objection that kept this out of the game until now. A striker
    //    times his run to stay onside, and the line comes from `rules/offside`, so the AI reads the same
    //    line the referee does instead of working out a second one.
    //
    //    ⚠️ THE NINE METRES ARE THE SAME NINE, moved from his shape spot to the BALL. No new number was
    //    chosen: what changed is what he runs ahead OF.
    const along = dir === 1 ? ball.x : playable.length - ball.x;
    const isForward = squadIndex === FORWARDS[0] || squadIndex === FORWARDS[1];
    if (isForward && along >= playable.length / 2) {
      const near = squadIndex === FORWARDS[0];
      const line = offsideLineOf(state, team);
      const want = ball.x + dir * SUPPORT_AHEAD;

      // ⚠️ AND A GAMBLING FORWARD WAS BUILT FOR THE OFFSIDES AND REVERTED. Stopping both of them ON the
      //    line is correct football with a hole in it - a striker who times his run perfectly is never
      //    caught - and the day this run was built the offsides fell from 0.33 a match to 0.00. So the
      //    far-post man was given a stray past the line, scaled by `composure`, holding the near-post man
      //    on it: a forward PAIRING rather than a dice, and Law 11 does not punish standing there.
      //
      //    Twelve fixtures, a child playing, before and after:
      //
      //                    offsides   goals   corners   goal kicks   scorelines
      //      holding           0.00    2.50      0.83         2.00   5-0 1-0 2-0 ... 2-1 1-1
      //      gambling          0.33    3.50      0.50         1.08   7-0 9-1 6-0 ...
      //
      //    ⚠️ IT BOUGHT A THIRD OF ONE COUNT AND SOLD THREE. A man standing permanently beyond the last
      //    defender is a free man for the whole match, so the attack got easier rather than riskier: the
      //    goals overshot their band, the corners and goal kicks fell, and the scorelines went back to
      //    7-0 and 9-1. The offsides never even reached their band.
      const onside = dir === 1 ? Math.min(want, line) : Math.max(want, line);
      return {
        x: clamp(onside, 0, playable.length),
        y: clamp(playable.width / 2 + (near ? -POST_SPLIT : POST_SPLIT), 0, playable.width),
      };
    }

    return { x: clamp(home.x + dir * SUPPORT_AHEAD, 0, playable.length), y: home.y };
  }

  // 4, 5 - Nobody has it, or they do: exactly ONE of us goes, and it is the one the plan named. Everyone
  //        else holds the shape. This single line is the anti-swarm rule.
  //
  //     ⚠️ CLAMPED TO THE PLAYABLE PITCH, WHICH EVERY OTHER BRANCH ALREADY WAS. This one returned the raw
  //        ball position, so the moment anything put the ball outside the training half the presser
  //        followed it out - and `tests/ai-brain` says bodies must stay inside it. It went unnoticed
  //        because nothing could put the ball out there until a defender could hoof it clear.
  if (plan.presserId === squadIndex) {
    // ⚠️ WHERE THE BALL WILL BE, NOT WHERE IT IS. This line returned the ball's current position, which
    //    is pure pursuit - the dog chasing the car. A body aimed that way curves in behind a moving ball
    //    and arrives permanently late, so a pass into space is a pass nobody reaches and a loose ball is
    //    won by whoever was nearer rather than by whoever was quicker. `ai/meet` walks the ball's own path
    //    with the simulation's own integrator and returns the first point he can get to in time.
    // ⚠️ AND IT MARCHES AT THE NOMINAL TOP SPEED RATHER THAN HIS CLUB'S, so the sentence at the top of
    //    `think` stays true: nothing in the movement cascade reads a rating. Handing it `pace` is the
    //    obvious next step and it would give that rating a second home - a quicker club cutting passes
    //    off - but it is a different change with its own measurement, and it is not this one.
    // ⚠️ AND `ai/meet` IS BUILT, GATED AND NOT WIRED HERE, which is a measurement rather than an
    //    oversight. Aiming this body at an interception point instead of at the ball is correct
    //    behaviour - pure pursuit is the dog chasing the car - and it makes the match worse. Twelve
    //    fixtures, empty chair, the same build on the same day:
    //
    //                        throw-ins   corners   goal kicks   goals   fouls
    //      pure pursuit           4.00      2.17         4.00    3.17    4.33
    //      meeting point         10.33      4.33         7.17    1.83    2.00
    //      the band              3.5-6     1.5-3        3-4.5     2-3   2-3.5
    //
    //    A presser who intercepts reaches the ball sooner and knocks it away more often, so the ball goes
    //    out of play far more and the attack stops arriving: three counts jumped ABOVE their band and the
    //    goals fell BELOW theirs. The defence got better and the match got worse, which is the same shape
    //    as the body-contact finding in `sim/step` - correct physics, worse football.
    //
    // ⚠️ AND THE DEEPER REASON IS THAT IT IS ON THE WRONG BODY. The plan asks the intended RECEIVER of
    //    a pass to commit to a meeting point; this cascade has no receiver role at all, and the
    //    designated presser is the only body that ever goes for the ball. So the mechanism landed on the
    //    one player whose job is to DENY the pass, and it made him better at it. It needs the off-ball
    //    roles that come later in the plan - which means that item comes FIRST, not second.
    return { x: clamp(ball.x, 0, playable.length), y: clamp(ball.y, 0, playable.width) };
  }

  // 6, 7 - Mark space by standing in the shape. A dedicated marking rule would be the next thing to add,
  //        and the shape already slides toward the ball, which is most of the effect for none of the cost.
  return home;
}

/**
 * Metres in from the goal line a cross is aimed - the penalty spot's depth, where a header is taken.
 */
const CROSS_DEPTH = 9.5;

/** The two squad indices that go in for a cross: the 4-4-2's forwards, per `sim/state`'s kickoff shape. */
const FORWARDS: readonly [number, number] = [9, 10];

/** Metres either side of the middle the two of them take, so a cross has two men to find and not one. */
const POST_SPLIT = 3;

/**
 * Upward speed on a cross.
 *
 * ⚠️ IT HAS TO LEAVE THE FLOOR, and that is the point rather than decoration. `MAX_CONTROL_HEIGHT` means
 * nobody controls a ball above 1.2 metres, so a lofted ball arrives UNCONTROLLABLE and has to be dealt
 * with instead of received - which is the situation a defender clears and a keeper punches, and the
 * situation that produces a corner. A cross along the floor is a pass with a different name.
 */
const CROSS_LIFT = 5;

/**
 * Is he wide enough, and far enough up, for the ball into the box to be the right one?
 *
 * The attacking third and outside the width of the box: from the middle a cross is a pass, and from your
 * own half it is a hopeful ball nobody asked for.
 */
function wideAndHigh(state: MatchState, holder: PlayerId, dir: 1 | -1, playable: Playable): boolean {
  const at = state.players[holder].p;
  const along = dir === 1 ? at.x : playable.length - at.x;
  const across = Math.abs(at.y - playable.width / 2);
  return along >= playable.length * (2 / 3) && across > BOX.width / 2;
}

/**
 * ...and is there anybody in there to cross to?
 *
 * ⚠️ THE TWO ARE SEPARATE BECAUSE REUSING ONE WAS CIRCULAR. The run into the box asked `crossFrom`,
 * which asks whether somebody is already in the box - and the run is what puts them there. Neither ever
 * fired, and the gate reported "nobody went in for the cross" while the code was waiting for exactly the
 * body it was refusing to send. The geometry is one question and the occupancy is another.
 */
function crossFrom(state: MatchState, holder: PlayerId, dir: 1 | -1, playable: Playable): boolean {
  if (!wideAndHigh(state, holder, dir, playable)) return false;

  // ⚠️ AND ONLY IF SOMEBODY IS IN THERE. Crossing to an empty box is a giveaway with extra steps, and it
  //    was measured: without this the long match's goals went from 2.3 to 4.2 against a target of 2.7,
  //    because a ball hung up in front of an unguarded goal falls to whoever is nearest and that is as
  //    often an attacker as a defender. A cross is aimed at a place, but it is played because somebody is
  //    arriving at it.
  //
  // ⚠️ AND WITH THAT CONDITION IT NEVER FIRES IN A MATCH, which is measured and left standing rather
  //    than loosened. Six fixtures at each length came back byte-identical to the build with no cross in
  //    it, and this simulation is deterministic, so identical output is proof that a branch never ran.
  //    NOBODY RUNS INTO THE BOX: rule 3 of the cascade sends a supporting player `SUPPORT_AHEAD` past the
  //    shape, and the shape is a 4-4-2 that slides with the ball, so an attacking third with a wide
  //    carrier has team-mates level with him and none in front of the goal.
  //
  //    Third rule today that was right, gated, and unreachable for want of a situation - after the
  //    defender who puts it behind and the sideways ball. The run into the box is what this one waits
  //    for, and it is named here so the next person wires the two together rather than widening this
  //    condition until something fires.
  const team = teamOf(holder);
  const first = firstOf(team);
  for (let k = 0; k < SQUAD_SIZE; k++) {
    const id = first + k;
    if (id === holder || !onPitch(state, id)) continue;
    const p = state.players[id].p;
    const deep = dir === 1 ? p.x : playable.length - p.x;
    if (deep >= playable.length - BOX.depth && Math.abs(p.y - playable.width / 2) <= BOX.width / 2) {
      return true;
    }
  }
  return false;
}

/**
 * Metres. How deep in his own half a player has to be before a ball with nowhere to go is hammered clear.
 *
 * ⚠️ HIS OWN THIRD AND NOT ANYWHERE, which is what keeps it a clearance rather than a way of never playing
 * football. A player hoofing it from the halfway line every time he is closed down turns every match into
 * two goalkeepers kicking to each other.
 */
const OWN_THIRD_OF = 1 / 3;

/**
 * Metres from his own goal line inside which a pressed defender puts the ball out rather than upfield.
 *
 * The goal area's depth, which is the patch of grass where playing it anywhere but away is how a side
 * concedes. Deeper than this a defender has a pitch in front of him and uses it.
 */
const GOAL_AREA = 5.5;

/**
 * Pressed, deep, and nobody to pass to: get rid of it.
 *
 * ⚠️ ONLY THE KEEPER EVER CLEARED HIS LINES. An outfield player in his own box with a man on him and no
 * forward receiver simply DRIBBLED, which is not football - and which is also the reason this game had no
 * legitimate way for the ball to leave the pitch. Clamping the dribbling touch so it could not knock the
 * ball out was tried twice and took throw-ins from six times football's rate to ZERO, which proved the
 * touch was the only route to a touchline the game had. A clearance is football's, and it is the one this
 * cascade was plainly missing.
 *
 * ⚠️ IT LEAVES THE FLOOR, which is what makes it a clearance and not a bad pass: `CLEARANCE_LIFT` puts it
 * over the man in front of him, and a ball in the air is one nobody dribbles.
 *
 * ⚠️ AND IT IS AIMED SLIGHTLY WIDE, away from the middle. A clearance up the middle of your own box is the
 * one every coach shouts about, and aiming it out towards the touchline is both the instruction a child
 * gets and - measured, in the count above - the throw-ins football has and this did not.
 */
function clearIt(state: MatchState, holder: PlayerId, dir: 1 | -1, playable: Playable): Kick | null {
  const me = state.players[holder].p;
  // ⚠️ OF THE PLAYABLE PITCH AND NOT OF `PITCH`. The practice profile is half a pitch, and a third
  //    measured on the full one covers two thirds of it - so a training session became twenty-two bodies
  //    chasing clearances out of the area they are supposed to stay inside. `tests/ai-brain` caught it.
  const along = dir === 1 ? me.x : playable.length - me.x;
  if (along > playable.length * OWN_THIRD_OF) return null;

  // Towards the nearer touchline: away from the middle is where a clearance goes.
  const wide = me.y < playable.width / 2 ? -1 : 1;

  // ⚠️ A CLEARANCE IS A FRACTION OF THE PITCH, NOT A NUMBER OF METRES. The practice profile is HALF a
  //    pitch, and twenty-two metres a second carries the ball clean out of it - so a training session
  //    became a squad chasing hoofed balls out of the area they are meant to stay inside, which
  //    `tests/ai-brain` reported as bodies at x=56 on a 45-metre field. Scaling it by the playable length
  //    keeps the same shot of football on any size of pitch.
  const hoof = CLEARANCE_SPEED * (playable.length / PITCH.length);
  return {
    id: holder,
    vx: dir * hoof,
    vy: wide * hoof * CLEAR_WIDE,
    vz: CLEARANCE_LIFT,
  };
}

/** How much of a clearance goes across rather than up. A quarter is "out towards the line", not sideways. */
const CLEAR_WIDE = 0.25;

/** Metres. How close an opponent has to be to the line of a shot to be standing in it. */
const BLOCKS_AT = 1.0;

/**
 * Metres. Nearer the ball than this and an opponent is ON the shooter, not in front of him.
 *
 * ========================= ⚠️ THE MAN MARKING HIM WAS COUNTED AS STANDING IN HIS SHOT =========================
 * Projecting an opponent onto the segment from the ball to the mouth and clamping the projection to
 * [0, 1] puts a defender who is level with the shooter, or behind him, at the lane's own STARTING POINT -
 * where the offset measured is his distance from the SHOOTER rather than from the lane. The designated
 * presser is on the carrier for most of an attack, so he blocked the shot by being there.
 *
 * 📏 Measured 2026-09-11 from inside `sightOfGoal` itself, over the six-fixture slate, counting every
 * time the cascade asked whether the goal could be seen:
 *
 *     slate                 asked   clear   rate    shot taken from, p50
 *     nobody playing, before  1561     645  41.3%                 12.3 m
 *     nobody playing, after   1250     752  60.2%                 13.1 m
 *     a child playing, before 1650     744  45.1%                 11.7 m
 *     a child playing, after  1006     760  75.5%                 11.5 m
 *
 * A shot was possible two times in five and is now possible three in five, or three in four with a child
 * playing. The distance it is struck from barely moves, which is the half that says this opened a lane
 * rather than lowering a bar: the same shots, refused less often.
 *
 * ⚠️ AND THE NUMBER OF ASKS FALLS, which is the attack resolving instead of circling. Fewer ticks are
 * spent carrying the ball inside twenty-two metres because more of them end in a strike.
 *
 * ⚠️ AND IT COSTS GOALS AGAINST THEIR BAND, which is written down rather than buried. Twelve fixtures:
 * 3.67 to 4.00 with a child playing and 3.92 to 4.50 with an empty chair, against a band of two to three.
 * The game was already over that band and this takes it further over. What it buys is corners into band
 * (1.25 to 1.58) and throw-ins down from 14.08 to 12.67 - the largest out-of-band count the game has.
 *
 * ⚠️ AND IT IS THE SAME METRE AS `BLOCKS_AT`, DELIBERATELY. The lane test asks who is standing BETWEEN
 * two points; a man within a metre of one of them is at that point, not between them. One number for both
 * axes says that in a sentence, and two numbers would be two things to tune where there is one idea.
 *
 * A man at your feet is why you shoot NOW. He is not why you cannot.
 */
export const BLOCKS_FROM = BLOCKS_AT;

/** Can he see the goal from here? The keeper is not a blocker - you shoot AT him. */
function sightOfGoal(state: MatchState, team: TeamId, from: Vec2, mouth: Vec2): boolean {
  const dx = mouth.x - from.x;
  const dy = mouth.y - from.y;
  const lane = dx * dx + dy * dy;
  if (lane === 0) return true;

  const first = firstOf(team === 0 ? 1 : 0);
  for (let k = 1; k < SQUAD_SIZE; k++) {
    const id = first + k;
    if (!onPitch(state, id)) continue;
    const p = state.players[id].p;
    // ⚠️ THE MAN ON THE BALL IS NOT IN THE LANE. Read the note on `BLOCKS_FROM`: without this line the
    //    clamp below turned the marker into a blocker and no shot was ever possible.
    const nx = p.x - from.x;
    const ny = p.y - from.y;
    if (Math.sqrt(nx * nx + ny * ny) < BLOCKS_FROM) continue;
    const along = clamp((nx * dx + ny * dy) / lane, 0, 1);
    const ox = from.x + dx * along - p.x;
    const oy = from.y + dy * along - p.y;
    if (Math.sqrt(ox * ox + oy * oy) < BLOCKS_AT) return false;
  }
  return true;
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
  // ⚠️ NOTHING IN THE MOVEMENT CASCADE READS A RATING, and `void skills` says so out loud rather than
  //    leaving an unused parameter. A gambling forward needed `composure` and was reverted - see `decide`
  //    - so this is true again, and it will stop being true the moment any movement depends on a club.
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
 * Who of `team` goes and takes the dead ball: the nearest, and an outfielder if the side has one.
 *
 * ⚠️ THE KEEPER IS THE LAST RESORT AND NOT THE FIRST, and it is football as much as safety. A keeper who
 * takes throw-ins leaves his goal empty for the twenty seconds it takes him to walk there and back, and a
 * child watching would learn something false about the position. He takes it only when his side has
 * nobody else left - which a match with enough red cards in it can reach.
 *
 * Ties break on the smallest index, the same rule possession uses, so no two modules can disagree about
 * who got there first.
 */
function takerOf(state: MatchState, team: TeamId): PlayerId {
  const first = firstOf(team);
  let best = NOBODY;
  let bestD2 = Infinity;
  let keeper = NOBODY;

  for (let k = 0; k < SQUAD_SIZE; k++) {
    const id = first + k;
    if (!onPitch(state, id)) continue;
    if (isKeeper(id)) {
      keeper = id;
      continue;
    }
    const d2 = dist2(state.players[id].p, { x: state.ball.p.x, y: state.ball.p.y });
    if (d2 < bestD2) {
      bestD2 = d2;
      best = id;
    }
  }

  return best === NOBODY ? keeper : best;
}

/**
 * A desired direction for every body, from its cached target. Magnitude falls off near the target so a
 * body arrives instead of orbiting - a seek with no arrival is the classic jitter around a destination.
 *
 * ⚠️ EXCEPT FOR THE ONE BODY THAT IS NOT GOING TO A PLACE. Arriving and running a man down are two
 * movements and this function had one primitive for both. The designated presser's target IS the ball, so
 * the last `ARRIVE_RADIUS` of his chase - eight tenths of a metre - was run at a fraction of his speed,
 * falling linearly to nothing. That is precisely the distance a challenge happens over, and
 * `challenger` only counts a man as having gone in above a fraction of his top speed: a presser who
 * decelerates into contact does not challenge anybody, he hovers.
 *
 * ⚠️ AND NOTHING LOOKED WRONG, WHICH IS WHY IT SURVIVED. He still won the ball - standing on top of
 * somebody and accumulating pressure never required arriving at speed. It is `sim/possession`'s
 * positional duel that makes the difference matter, because a duel is decided by WHERE he is when he gets
 * there, and a body that has been braking for eight tenths of a metre has had time to end up behind.
 *
 * ========================= SO IT WAS BUILT AND MEASURED, AND IT IS NOT HERE =========================
 * Four lines: exempt the two pressers from the easing band. Gated three ways, including the one that
 * matters - ⚠️ `presserId` IS -1 FOR A SIDE THAT HAS THE BALL, and `firstOf(team) + -1` is a REAL INDEX,
 * the last man of the OTHER side, so the obvious arithmetic hands the chase primitive to a body on the
 * wrong team and produces a valid answer to a different question.
 *
 * Twelve fixtures, five minutes a half, no bodies wired:
 *
 *     build                   fouls   cards   corners   throw-ins   offsides   goals
 *     a child playing
 *       as committed           3.50    1.25      3.00       16.92       0.50    3.50
 *       the presser chases     4.00    1.00      2.42       11.33       0.92    2.67
 *     nobody playing
 *       as committed           3.50    0.83      2.92        5.25       0.42    3.83
 *       the presser chases     4.00    1.25      1.33       10.58       0.50    3.08
 *     the band              2 - 3.5  0.5-1.5   1.5 - 3     3.5 - 6    0.5-1.5   2 - 3
 *
 * ⚠️ IT IMPROVES THE PLAYED MATCH AND BREAKS THE UNPLAYED ONE. With a child the goals come back inside
 * their band, the offsides double, the throw-ins fall by a third and no sending-off happens at all. With
 * an empty chair the corners fall BELOW their band and the throw-ins DOUBLE - and the corner gate in
 * `tests/full-match`, which asks that every fixture produce one, goes red on a fixture that produces
 * none.
 *
 * ⚠️ AND THAT IS THE THIRD TIME THIS EXACT SHAPE HAS BEEN MEASURED. See the note in `decide`'s presser
 * branch above for `ai/meet`, and `sim/step` for body contact. Three unrelated mechanisms - an
 * interception point, bodies with volume, and a chase that does not brake - each make the DEFENCE better
 * and each make the match worse in the same direction: the ball goes out of play more, and the attack
 * stops arriving. Written out, the three tables say one thing.
 *
 * ⚠️ SO THE FRAGILE HALF IS THE ATTACK, AND IT IS NOT A CONSTANT. Every defensive improvement this
 * repository has measured has been paid for out of the same account, because `ai/brain` has no answer to
 * a defence that works: the cascade has no receiver role, nobody commits to a run, and a possession that
 * meets resistance ends rather than develops. The absorption plan says so in its own words in the note
 * above - *"it needs the off-ball roles that come later in the plan - which means that item comes FIRST,
 * not second"* - and three measurements have now arrived at it from three directions. The next work is
 * the attack, and the two parked defensive changes become affordable the moment it exists.
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

/**
 * Metres. Inside this a carrier shoots instead of carrying on.
 *
 * ⚠️ AND MORE SHOTS IS NOT MORE FOOTBALL, which was measured after the Dev asked for more corners and
 * goal kicks. `sim/block` had pointed upstream - "the shot volume is the next thing" - and six shots a
 * match producing three goals is a 50% conversion against football's ten, so shooting more looked like
 * the free lever. Twelve fixtures each, both ways round, with a child playing:
 *
 *     range   goals   corners   goal kicks
 *      22m     2.67      0.50         1.92
 *      26m     1.25      0.08         0.42
 *      30m     0.67      0.25         0.58
 *
 * ⚠️ EVERYTHING FELL, INCLUDING THE TWO IT WAS MEANT TO RAISE. A longer range does not add shots to the
 * attacks that already exist - it REPLACES them, because a carrier who may shoot from thirty metres shoots
 * from thirty metres instead of carrying the ball to twenty. He never reaches the box, and a corner and a
 * goal kick are things that happen at the end of a pitch he stopped going to.
 *
 * So the shot volume was not upstream after all: the attacks are. That note in `sim/block` is answered
 * here rather than left standing.
 */
const SHOOT_RANGE = 22;

/** Metres per second on a shot, and the small lift that keeps it off the turf. */
const SHOT_SPEED = 26;
const SHOT_LIFT = 1.6;

/** Metres per second on a pass. Short balls arrive; long ones have to travel. */
/**
 * How far past the receiver a pass is weighted to run, as a multiple of the distance to him.
 *
 * A ball weighted to stop exactly at his feet arrives dead, and a dead ball is one a defender reaches
 * first. A quarter over is a ball still moving when it gets there and settling a stride beyond him, which
 * is what "into his path" means.
 */
const PASS_OVERRUN = 1.25;

// ⚠️ AND A PASS WHOSE WEIGHT CAN BE WRONG WAS BUILT, MEASURED AND REJECTED. Football's commonest throw-in
//    comes off a ball hit too hard, and this game has none of those: measured, 279 of 281 crossings are the
//    carrier walking his own ball over the line. So `passWeightErrorOf(passing) = (1 - passing) * 0.6` went
//    into `ai/ratings` and was applied right here as `PASS_OVERRUN + off`, `off` signed by a DIFFERENT bit
//    of the shirt number from the angle's - `(holder >> 1) & 1` - so that the two errors would read as two
//    faults and not as one. Six fixtures at each length, against 40 throw-ins, 2.7 goals, 10 corners, 1.7
//    bookings and 0.07 sendings-off:
//
//        build                       length   throw-ins   goals   corners   bookings   reds
//        as committed                90 min        77.2     4.5      11.5        1.7   0.00
//        mis-weighted pass           90 min        87.7     2.0      14.8        2.0   0.50
//        mis-weighted + touch clamp  90 min         3.8     3.0      14.3        2.5   0.67
//        as committed                15 min        36.8     2.8       1.2        0.5   0.00
//        mis-weighted pass           15 min        33.8     2.3       0.8        0.8   0.00
//        mis-weighted + touch clamp  15 min         0.0     3.5       0.8        0.3   0.00
//
//    ⚠️ IT BOUGHT ONE TARGET AND SOLD FOUR. The goals come down past 2.7 from the far side, and every
//    other count moves away - including the throw-ins it was built to reduce, which went UP by ten a match.
//    WHY they went up was not measured, and no explanation is written here for it: this same decision has
//    carried two wrong explanations before, and both were written before anybody had counted anything.
//
//    ⚠️ AND THE CLAMPED PAIR IS THE USUAL EMPTY TOUCHLINE. Nought throw-ins in a fifteen-minute match is
//    not a match anybody plays; `sim/possession` records that clamp being rejected for the third time.
//
//    A DEFECT is fixed whatever the counts do. A new BEHAVIOUR is judged on them, and this one failed on
//    four of five. The mechanism is still the right one and the game still wants it - what it needs first
//    is a receiver who moves to a ball that misses him, and that is repertoire this cascade has not got.

/** Metres per second. The floor keeps the shortest ball the AI will play moving at all... */
const PASS_SPEED_MIN = 5;

/**
 * ...and the ceiling is what a foot can do along the ground.
 *
 * ⚠️ IT MEANS A BALL BEYOND FIFTEEN METRES FALLS SHORT, and that is stated rather than hidden: at this
 * speed a rolling ball covers `24 / 1.6` metres, so a pass to a man twenty-five away is a ball into space
 * in front of him rather than a ball to his feet. The old fixed speeds could not reach him either - 19
 * covered under twelve metres - so nothing regressed; what is new is that the shortfall is now a
 * consequence of one rule instead of an accident of two constants.
 */
const PASS_SPEED_MAX = 24;

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
export function challenger(
  state: MatchState,
  team: TeamId,
  top: number = DEFAULT_CAPS.maxSpeed,
): PlayerId | null {
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
  // ⚠️ AND "GONE IN" IS `rules/foul`'S OWN MEASURE, not a second one that happens to share its number.
  //    This used to compare the plain relative speed of the two bodies, so a presser who had not moved a
  //    centimetre was deemed to have made a challenge because the CARRIER ran into HIM - and the referee
  //    then graded it careless and gave a free kick away against a man standing still. The constant was
  //    already imported for exactly this reason; the measurement had to follow it.
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
  // ⚠️ A DEFENDER BEHIND THE MAN DOES NOT LUNGE, and without this line bodies with volume made the
  //    machine foul twice as often. Measured over the twelve-fixture slate with a child playing and with
  //    `sim/contact` wired: 6.08 fouls a match against a band of 2 to 3.5 - and with this whole function
  //    disabled, 0.00. EVERY foul in this game comes from here, which the README already said in a world
  //    where nobody had a body: the fouls above the band come from the MACHINE and not from a child
  //    choosing to use the tackle.
  //
  // ⚠️ AND SEPARATION IS WHAT MADE IT WORSE, mechanically. `rules/foul.judgeTackle` lets a challenge go
  //    when the tackler reached the BALL - "he got the ball: play on" - and before bodies had volume the
  //    presser could stand on it, 0.00 m away. Pushed off it, he is inside the contact radius of a MAN and
  //    outside it of the ball, which is the definition of a foul. The lunge did not get worse; it stopped
  //    being able to succeed.
  //
  // ⚠️ SO THE ANSWER IS THE GEOMETRY THAT ARRIVED WITH THE DUEL. A man in front of the carrier or
  //    alongside him can get a foot in; one behind cannot, and football does not ask him to - he stays
  //    with his man and takes it by pressure, which `sim/possession` pays him for at half rate. It is the
  //    same alignment the duel reads, asked by the other half of one idea.
  const behind = { x: me.p.x - them.p.x, y: me.p.y - them.p.y };
  const far = Math.sqrt(behind.x * behind.x + behind.y * behind.y);
  const align = far === 0 ? 0 : (behind.x * them.facing.x + behind.y * them.facing.y) / far;
  if (align < 0) return null;

  return wentIn(me.p, me.v, them.p, them.v) >= WENT_IN_FRACTION * top ? id : null;
}

/**
 * The share of his own top speed at which the machine is deemed to have made a challenge rather than to
 * be running beside somebody.
 *
 * ⚠️ IT USED TO BE THE RECKLESS THRESHOLD ITSELF, and that identity is what made every machine foul a
 * booking. `rules/foul` carried the consequence in writing: *"the asymmetry that survives is that the
 * machine does not give away CARELESS fouls, because it cannot express carelessness."* If the line for
 * having challenged at all is the line for a card, then every challenge is a card - and twenty of
 * twenty-eight fouls over six whole matches came out reckless, where football books about one in twelve.
 *
 * ⚠️ AND SEPARATING THEM STOPPED BEING OPTIONAL when severity was recalibrated to a share of the tackler's
 * top speed: the challenge threshold rose with it and the machine nearly stopped fouling. Measured: seven
 * fouls across six whole matches, ten per ninety minutes where football has twenty-two, two of the six
 * with none at all. A referee who never whistles is as wrong as one who never stops.
 *
 * What must not drift between the two is HOW going-in is measured, and that is one function. The
 * thresholds are two questions - "did he go in" and "was it a card" - and they had no business being one
 * number.
 *
 * 0.8 is going in at a run rather than at a jog: below it a body is moving near somebody, above it at him.
 * Measured across six whole matches at 0.7, 0.8 and 0.95 - the coupled value - it gives 39 fouls per
 * ninety minutes against football's 22, where 0.7 gives 48 and the coupled value gives 10 with two of the
 * six matches producing NO FOUL AT ALL. It is the only one of the three that whistles in every match.
 */
const WENT_IN_FRACTION = 0.8;

/** Metres. How close the presser has to be to the carrier to count as having gone in at all. */
const CHALLENGE_RANGE = 2.0;

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
  const dir = attackDirOf(team, state.period);
  const me = state.players[carrier].p;

  let best: PlayerId | null = null;
  let bestScore = 0;

  for (let k = 0; k < SQUAD_SIZE; k++) {
    const id = firstOf(team) + k;
    if (id === carrier || isKeeper(id) || !onPitch(state, id)) continue;

    const at = state.players[id].p;
    const ahead = (at.x - me.x) * dir;
    // ========================= ⚠️ THIS LINE REJECTS 99.6% OF EVERY CANDIDATE EVER CONSIDERED =========================
    // Measured 2026-09-11 over the six-fixture slate, with a counter on each filter in this loop. Of
    // 579,339 team-mates examined, 576,769 were refused HERE - and 52 for being beyond `PASS_RANGE`, and
    // none at all for standing off the pitch. 2,518 survived, which is 0.4%.
    //
    // The consequence, measured in the same run and in the two before it, is a chain with no missing link:
    //
    //   · pressed and looking for a pass 64,371 times, `receiverFor` returns null in 98.0% of them;
    //   · so 90% of ALL possessions are one man - 3,687 of 4,078 have exactly one toucher;
    //   · so 24 of the 28 goals in a slate are scored by a move in which one player touched the ball;
    //   · so freezing eight of a side's eleven where they stand costs that side ZERO goals in attack
    //     (`ai/plan` carries that table);
    //   · so every defensive improvement measured today was paid for out of an account with nothing in it,
    //     which is the convergence recorded beside `steerAll`.
    //
    // ⚠️ AND THE LINE IS NOT A BUG. It is a decision, and its own comment states it: a square or backward
    // ball is not what this is for. What the measurement adds is the PRICE, which nobody had: refusing
    // every ball that is not forward refuses the passing game, because the carrier is by construction the
    // man who has run furthest up the pitch - he is carrying the ball at the goal. Almost nobody is ever
    // ahead of him.
    //
    // ========================= ⚠️ AND THE SWEEP THAT ANSWERED THAT SAYS: LEAVE IT ALONE =========================
    // The question was "what does a receiver have to be, if not two metres further forward". Four
    // definitions, six fixtures each, nobody at the keyboard:
    //
    //     definition                                goals   multi-touch goals   possessions   multi-touch
    //     A  ahead > 2 m, as it is                     29            2 (6.9%)          4,078         9.6%
    //     B  square allowed (ahead > -2)                24            1 (4.2%)          4,547        11.0%
    //     C  any direction, forward preferred           8            0 (0.0%)          1,799        36.4%
    //     D  the freest man, no preference             15            0 (0.0%)          2,415        14.4%
    //
    //                                               corners   goal kicks   throw-ins   fouls
    //     A                                               8           26          23      28
    //     B                                               6           22          18      17
    //     C                                               0            2           0      16
    //     D                                               9           42           0      10
    //
    // ⚠️ THE PASSING GAME IS REACHABLE AND IT IS NOT WORTH HAVING. Definition C nearly quadruples the share
    // of possessions with more than one toucher - 9.6% to 36.4%, so the manipulation unquestionably landed
    // - and takes the match apart: eight goals instead of twenty-nine, no corner at all, no throw-in at
    // all, two goal kicks. That is twenty-two men passing sideways for five minutes, which is precisely
    // what the line above was written against, now measured rather than feared.
    //
    // ⚠️ AND THE DECIDING COLUMN IS MULTI-TOUCH GOALS, WHICH NEVER MOVES OFF ZERO. A scores 2 of 29 that
    // way, B scores 1 of 24, and the two definitions that actually produce passing score NONE. So more
    // passing does not buy team goals; it buys possession without penetration and costs the goals that
    // were there. The receiver filter is not what stands between this game and a passing attack.
    //
    // ⚠️ WHICH WALKS BACK HALF OF THE NOTE ABOVE. "Refusing every ball that is not forward refuses the
    // passing game" is true and is measured. The implication anybody would draw from it - that this line
    // is therefore why the attack has nothing in it - is NOT supported: loosening it produces more passes
    // and fewer goals, with team goals still at zero. The price paid here buys something.
    //
    // ⚠️ AND ONE TRAP IS RECORDED FOR WHOEVER TRIES NEXT: the forward requirement is enforced TWICE. This
    // filter is one; the score below is the other, because `bestScore` starts at 0 and `ahead * sqrt(room)`
    // cannot be positive for a man who is not ahead. Removing the filter alone is a no-op, and measuring
    // that no-op would report that square balls change nothing.
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
  const dir = attackDirOf(team, state.period);

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
  if (d2 <= SHOOT_RANGE * SHOOT_RANGE && sightOfGoal(state, team, state.ball.p, mouth)) {
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

  // ⚠️ AND FROM WIDE, HIGH UP, HE CROSSES IT - pressure or none, because a cross is not an escape. It
  //    is the one ball this cascade never had: `receiverFor` picks the freest man further up the pitch,
  //    and a cross is not aimed at a man at all. It is aimed at a PLACE, hopefully, and the scramble that
  //    follows is where football's corners come from.
  //
  //    Both deviations left in this match asked for it. Corners came almost entirely from the keeper - 267
  //    parries a ninety-minute match against 1.3 deliberate corners - so a short match, holding a sixth of
  //    the parries, could not reach ten however deep a defender was told to put it out. And 279 of 281
  //    throw-ins were the carrier walking his own ball out, where football's come off a deflection.
  if (crossFrom(state, holder, dir, playable)) {
    const mouth = goalMouthOf(team, state.period, playable);
    const to = { x: mouth.x - dir * CROSS_DEPTH, y: playable.width / 2 };
    const cx = to.x - state.ball.p.x;
    const cy = to.y - state.ball.p.y;
    const d = Math.sqrt(cx * cx + cy * cy) || 1;
    const speed = d * BALL.rollDrag;
    return { id: holder, vx: (cx / d) * speed, vy: (cy / d) * speed, vz: CROSS_LIFT };
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
  // ⚠️ `composure` IS THE SIXTH AND LAST RATING TO REACH THE PITCH, and it spends itself here: when the
  //    carrier lets go. Every one of the six now changes something a child can see or hear, and none of
  //    them branches the cascade - which is what the whole design rested on.
  const pressedAt = pressedAtOf(skills?.[team]?.composure ?? 0.5);
  if (pressure > pressedAt * pressedAt) return null;

  // ⚠️ AND FROM HIS OWN GOAL AREA HE PUTS IT OUT, BEFORE HE LOOKS FOR A PASS. Putting this inside
  //    `clearIt` - which is only reached when there is NOBODY to pass to - was measured and never fired
  //    once in six whole matches, because a defender that deep almost always has somebody ahead of him.
  //    It passed its hand-built gate and was unreachable in play.
  //
  //    A defender on his own line with a man on him does not pick a pass across his own goal. He puts it
  //    out, and conceding the corner is the point of doing it - which is also the only thing in this
  //    cascade that sends the ball over a goal line on purpose. The keeper's tip round the post was the
  //    other source, and shots stopped reaching him once a body could block one.
  // ⚠️ AND IT STILL DOES NOT FIRE, RE-MEASURED ON 2026-09-07 AFTER FOUR CHANGES TO THE MATCH. Counting
  //    the SITUATION rather than the rule - a defender holding the ball within eight metres of his own
  //    line with a rival inside three - six five-minute matches produced it 0.00 times. Not rarely:
  //    never. The rule is right and unreachable, which is a shape this repository has now found three
  //    times and is worth naming: a rule that is right, gated, and waiting on a situation the game does
  //    not produce.
  //
  //    So the corners this game has are the KEEPER'S: 1.00 a match, of which 0.67 come off him and 0.33
  //    off an outfielder, against a band of 1.5 to 3. Getting there is a matter of more shots reaching
  //    him, not of any threshold here - and raising the shot error to make shots miss (which the goal
  //    kicks needed) pulls the other way. That tension is the next thing to measure, not to guess at.
  const deep = dir === 1 ? me.x : playable.length - me.x;
  if (deep <= GOAL_AREA) {
    const out = CLEARANCE_SPEED * (playable.length / PITCH.length);
    const wide = me.y < playable.width / 2 ? -1 : 1;
    return { id: holder, vx: -dir * out, vy: wide * out * CLEAR_WIDE, vz: CLEARANCE_LIFT };
  }

  const mate = receiverFor(state, holder, playable);
  if (mate === null) return clearIt(state, holder, dir, playable);

  const to = state.players[mate].p;
  let px = to.x - me.x;
  let py = to.y - me.y;
  let far = Math.sqrt(px * px + py * py) || 1;

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

  // ⚠️ THE WEIGHT OF THE PASS, AND THE COMMENT THAT USED TO BE HERE PROMISED IT WITHOUT DOING IT. It said
  //    "enough to arrive, never so much that it runs away from the man it was meant for" beside a choice
  //    between two fixed speeds by distance: a five-metre ball was struck at fourteen metres a second and
  //    travelled nine, four past him and usually over a line.
  //
  //    Measured, and it was breaking whole matches. One fixture spent 94% OF FOUR HUNDRED THOUSAND TICKS
  //    with the ball out of play - 4,564 throw-ins, 25,559 ticks of football, no full time in a five-minute
  //    half - because a throw-in taken near the line was played straight back over it, for ever. The other
  //    five were producing 146 to 200 throw-ins a match where football has about forty.
  //
  //    ⚠️ AND IT IS DERIVED, NOT TUNED. `sim/ball` rolls at `v *= 1 - rollDrag * dt`, so a ball struck at
  //    `v` covers `v / rollDrag` metres before it stops. The speed that puts it at his feet is therefore
  //    `far * rollDrag`, and the overrun on top is the only chosen number in the line - which is why the
  //    drag constant is imported rather than a matching number being written down twice.
  const wanted = far * BALL.rollDrag * PASS_OVERRUN;
  const speed = clamp(wanted, PASS_SPEED_MIN, PASS_SPEED_MAX);

  // ⚠️ AND IT IS PLAYED WHERE HE WILL BE, NOT WHERE HE STANDS. The aim used to be the receiver's FEET -
  //    the spot he was on when the ball was struck - and a ball takes about a second to arrive, so every
  //    pass to a moving team-mate landed BEHIND him. He had to stop, turn and come back for it, which is
  //    the opposite of what a pass is for, and it is a large part of why the attack never progressed: a
  //    side passing backwards to itself keeps the ball in the middle third, which is what six matches
  //    measured before this line existed.
  //
  //    ⚠️ THE LEAD IS DERIVED AND NOT CHOSEN. The speed is already a function of the distance, so the
  //    time the ball spends travelling is `far / speed` and leading him by his own velocity across that
  //    time is arithmetic. One iteration: the aim moves and the speed does not, because a second pass at
  //    re-deriving the speed from the moved aim converges on nothing a child could see.
  //
  //    ⚠️ AND IT IS CLAMPED TO THE PITCH. A winger sprinting at the touchline would otherwise be passed
  //    to a spot in the stands, which is a throw-in the passer chose to concede.
  const flight = far / speed;
  const runner = state.players[mate].v;
  const ahead = {
    x: clamp(to.x + runner.x * flight, 0, playable.length),
    y: clamp(to.y + runner.y * flight, 0, playable.width),
  };
  px = ahead.x - me.x;
  py = ahead.y - me.y;
  far = Math.sqrt(px * px + py * py) || 1;
  const ax = px / far;
  const ay = py / far;

  return { id: holder, vx: (ax - ay * lean) * speed, vy: (ay + ax * lean) * speed, vz: 0 };
}

export { SQUAD_SIZE };
