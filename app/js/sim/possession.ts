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
 *
 * ⚠️ ONE AND A HALF METRES, AND THE LEVER IS SPENT. The number was first chosen against football's
 * ninety-minute counts, which turned out to be the wrong ruler for a seven-minute arcade match - see
 * `tests/full-match` for the Dev's bands, which replaced them. Re-measured against those bands on the
 * seven-minute match, six fixtures each, all of them reaching full time (band in brackets):
 *
 *     CONTESTED_AT   throw-ins   goals   corners   goal kicks   fouls   yellows
 *                      (5 - 8)   (2-4)     (2-4)        (4-6)   (3-5)     (1-2)
 *     1.5 m              16.83    0.83      0.50         0.67    1.50      0.00
 *     1.1 m              14.50    1.17      0.67         1.17    1.33      0.00
 *     0.8 m               0.33    2.67      0.33         0.50    1.67      0.33
 *     0.5 m               0.00    1.83      0.33         0.33    1.17      0.17
 *
 * Eight tenths is closer to its band than 1.5 on six of the nine counts and is the only setting that ever
 * put the GOALS inside theirs. It was adopted, and then reverted, because it stops the match being played:
 * the anti-deadlock gate in `tests/ai-brain` measures how far the ball travels from the kickoff spot in a
 * hundred seconds, and at 0.8 it manages 17.4 metres against the 20 that gate demands. A carrier who is
 * almost never counted as contested keeps the ball, so the game becomes a dribble in the middle third.
 *
 * ⚠️ GOALS IN BAND DO NOT BUY A MATCH WHERE THE BALL DOES NOT MOVE. That is the trade, written down so
 * the next person does not re-make it: one count landing is worth less than the shape of the game, and
 * the shape is what a child sees.
 *
 * ⚠️ IT IS A CLIFF AND NOT A SLOPE, WHICH IS THE FINDING RATHER THAN THE SETTING. Between 1.1 and 0.8
 * the throw-ins fall from 14.5 to 0.33 - there is no value that produces five to eight, because this rule
 * is BINARY: either the carrier's touch is turned back in or it is not. Measured at the crossings
 * themselves, on the seven-minute match: all 101 of them had a body within 3 metres (median 1.0 m) and
 * 100 of the 101 had somebody closing on the ball at nearly 6 metres a second. Nobody is failing to
 * chase. A man arrives on top of the ball, at speed, and it crosses anyway.
 *
 * So a throw-in here is the carrier walking his own ball out, at one threshold, and nothing at all at the
 * next one down. Football's throw-in comes off a DEFLECTION - a tackle, a block, a misplaced pass - and
 * this game barely produces any of those. Five to eight of them will come from building that, not from
 * moving this number: no setting of a binary rule lands between its two values.
 *
 * ⚠️ AND THE COUNT IS CLOSER FOR THE WRONG REASON, which is measured and worth knowing. Of 281 touchline
 * crossings over three whole matches, 279 were the CARRIER'S OWN SIDE putting it out and 2 were a defender.
 * Football is close to the other way round: a throw-in mostly comes off a deflected tackle, a misplaced
 * pass or a clearance, and this game barely produces any of those.
 *
 * ⚠️ CLAMPING EVERY TOUCH WAS RE-MEASURED ON THIS BUILD and is still worse, though not for the old
 * reason. When it was first tried the touch was the only route to a touchline; there are three now - a
 * block, a clearance and the deliberate corner - and it is STILL 3.0 throw-ins a match against forty:
 *
 *                    throw-ins   goals   corners   bookings      target: 40, 2.7, 10, 1.7
 *     as it is            77.2     2.3      10.8        0.8
 *     every touch          3.0     2.2      15.0        1.8
 *
 * The clamp puts the bookings on football's number exactly and empties the touchlines. Keeping the
 * contested ball out is the better of the two.
 *
 * ⚠️ AND IT HAS NOW BEEN RE-MEASURED THREE TIMES, ON THREE DIFFERENT BUILDS, and rejected each time -
 * which is worth writing down so it stops being re-tried. Once when the touch was the only route to a
 * touchline; once after a block, a clearance and a deliberate corner had been added; and once more after
 * the cross and the run into the box. The last of the three:
 *
 *                  90 min: throw-ins   goals        15 min: throw-ins   goals
 *     as it is                  77.2     4.5                      36.8     2.8
 *     every touch                2.7     2.0                       0.0     4.5
 *
 * It always does the same thing: it empties the touchlines and moves the goals around. The reason it never
 * helps is that it removes the game's only working source of throw-ins without adding one, and the sources
 * football uses - a deflected tackle, a misplaced pass, a clearance charged down - are behaviours this AI
 * has not got rather than thresholds it has wrong.
 *
 * ⚠️ EVERY OTHER LEVER HAS ALSO BEEN MEASURED AND REJECTED: a bigger pitch and fewer players both push
 * the throw-ins UP while pulling the goals down, and deflecting a block off the blocker rather than
 * through him gave 972 a match. The count stands at 77.2 against forty, under twice the target, with all
 * known levers spent.
 */
const CONTESTED_AT = 1.5;

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

/**
 * Ticks of unbroken pressure a challenger needs before the ball is his.
 *
 * ⚠️ A THIRD OF A SECOND, AND IT IS THE WHOLE CLAIM RATHER THAN A CONSTANT TO TUNE. The old model gave
 * the ball to whoever was nearest on the tick, so a possession lasted seven ticks and the game was a
 * scramble; this asks a defender to STAY there. It is what the reference game does in as many words -
 * "stay touch-tight, sustained contact wins the ball" - and it is what makes containing worth doing.
 */
export const PRESSURE_WINS = 20;

// ⚠️ THIS LIVES HERE AND NOT IN `ai/ratings` BECAUSE `sim/` MAY NEVER IMPORT `ai/`, and the rule caught
// it: the factor was written beside `pressureRateOf` because the two are multiplied together, and that
// would have been the layering inverted for the sake of one import. It reads no rating at all - it is
// pure geometry, which is what `sim/` is for. The RATE is a fact about a club and stays in `ai`; the
// SHAPE of a duel is a fact about the world and belongs next to the duel.
/**
 * How much faster a challenger in FRONT of the carrier takes the ball than one directly behind him.
 *
 * ⚠️ THE NUMBER IS A RATIO AND THE RATIO IS THE POINT. A challenger dead behind accrues at 1, one
 * alongside at 1.5 and one in front at 2 - so turning your back trebles nothing and halves everything,
 * which is about what a shield is worth in football. A spread narrower than this would leave the game
 * claiming a skill and charging nothing for it, which is the defect this exists to close arriving as a
 * number too small to feel.
 */
export const AHEAD_BONUS = 1;

/**
 * The positional half of a duel: how fast this challenger wins the ball, given where he stands.
 *
 * `align` is the alignment between the way the carrier is facing and the direction from the carrier to
 * the challenger - +1 directly in front of him, 0 alongside, -1 directly behind.
 *
 * ⚠️ `sim/possession` NEVER ASKED WHERE HE WAS, and measured on 2026-09-08 a chaser reached 0.00 metres
 * from the ball and won it in about twenty-three ticks from any gap and at any pace. Standing on the
 * wrong side of a carrier cost him nothing, so shielding was a word rather than a skill - and a child who
 * turns her back is doing the one thing football gives her to protect the ball.
 *
 * ⚠️ AND BEHIND IS SLOW, NEVER NOTHING. A factor of zero would be the shield-forever exploit arriving
 * through the other door: a defender glued to a carrier's back must still win it eventually, because
 * football does not let anybody keep the ball for ever by turning round.
 *
 * ⚠️ AND IT IS A DOT PRODUCT AND NOT AN ANGLE. `Math.atan2` is the obvious way to ask which side a man
 * is on, and it is forbidden here because it is not exactly rounded - two machines replaying one match
 * could disagree about who won the ball. An alignment of unit vectors is a multiply and an add.
 */
export function pressureFactorOf(align: number): number {
  const clamped = align < -1 ? -1 : align > 1 ? 1 : align;
  // ⚠️ CENTRED ON ONE, AND THE FIRST VERSION WAS NOT. It ran from 1 to 2, which never made anybody
  //    SLOWER - so it did not make shielding worth anything, it made every defender in the game better at
  //    tackling. That is the opposite of what this match needs, which is attacks that last longer, and it
  //    passed every gate because "in front beats behind" was true of it. Half to one and a half keeps the
  //    average duel exactly where it was and puts the whole difference into WHERE the man is standing.
  return 0.5 + AHEAD_BONUS * ((clamped + 1) / 2);
}

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

  // ⚠️ THE LOCK LIFTS WHEN THE BALL IS AWAY FROM HIM, and that is what keeps it from deadlocking a ball
  //    nobody else can reach: a clearance into space is still his to chase. It only has to survive the few
  //    ticks in which the ball has not yet left his feet, which is the whole of the defect.
  const struck = state.lastStruck;
  if (struck !== NOBODY) {
    const away = dist2(players[struck].p, ball.p);
    const r = reachOf(struck);
    if (away >= r * r) state.lastStruck = NOBODY;
  }

  for (let i = 0; i < players.length; i++) {
    if (!onPitch(state, i)) continue;
    // Law 15: the man who took the restart may not play it again until somebody else has.
    if (i === state.tookRestart) continue;
    // And nobody passes to himself: see `lastStruck`.
    if (i === state.lastStruck) continue;
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
  // ⚠️ AND THE BALL IS WON BY SUSTAINED CONTACT, NOT BY BEING NEARER FOR ONE TICK. Everything below the
  //    shield used to decide possession afresh sixty times a second, which made the ball a coin: at the
  //    tick an opponent took it the loser was a median of 0.96 m from it and the taker 0.86 m, 88.7% of
  //    all changes went to the other side, and a possession lasted SEVEN TICKS.
  //
  //    That is also why `passing` did nothing measurable - over sixty matches the completion rate was
  //    flat at 31% from rating 0.1 to 0.9, because how straight a ball was hit cannot matter when the
  //    outcome is decided by which body is nearest when it lands - and why CONTAINING was built and
  //    reverted three times: a defender who holds his ground was never beaten, because holding ground
  //    IS how the old model won the ball.
  //
  //    ⚠️ THE DELIBERATE ROUTE IS STILL THERE AND IS STILL BETTER. `sim/tackle` is a challenge somebody
  //    MAKES, and it wins the ball at once; this is what merely standing on him does, and it is slower.
  const held = possession.holder;

  // ⚠️ PRESSURE IS FOR A CONTEST, NOT FOR A BALL HE HAS ALREADY LOST. It only applies while the carrier
  //    is still within a stride of the ball - the same reach the shield uses. Beyond that he is not in
  //    contact with anything, the ball is loose, and it belongs to whoever gets there: making a defender
  //    wait twenty ticks for a ball nobody is holding would be a rule about nothing.
  const stillOnIt =
    held !== NOBODY &&
    dist2(players[held].p, ball.p) <
      (reachOf(held) + (sides === undefined || best === NOBODY ? SHIELD_MARGIN : sides[teamOf(best)].tackleMargin)) **
        2;

  if (stillOnIt && best !== NOBODY && teamOf(best) !== teamOf(held) && best !== held) {
    if (state.pressedBy !== best) {
      state.pressedBy = best;
      state.pressure = 0;
    }
    // ⚠️ A BETTER DEFENDER GETS THERE SOONER, which is what stops this change from quietly unwiring
    //    `defending`. See `ai/ratings.pressureRateOf`; average is exactly 1.
    // ⚠️ AND WHERE HE STANDS DECIDES HOW FAST, which this never asked. A challenger dead behind the
    //    carrier accrues at the base rate; one alongside half again; one in front at double. Measured
    //    before it existed: a chaser won the ball in about twenty-three ticks from any gap and at any
    //    pace, because being on the wrong side of a man cost him nothing - so shielding was a word and
    //    not a skill, and a child who turns her back was doing the one thing football gives her for
    //    nothing in return.
    // ⚠️ THE ALIGNMENT IS THE CARRIER'S FACING AGAINST THE DIRECTION TO THE CHALLENGER, as a dot
    //    product of unit vectors: a multiply and an add, and a `Math.sqrt` that is exactly rounded.
    //    `Math.atan2` is the obvious way to ask which side a man is on and it is forbidden here, because
    //    it is not exactly rounded and two machines replaying one match could disagree about who won.
    const carrier = players[held];
    const away = { x: players[best].p.x - carrier.p.x, y: players[best].p.y - carrier.p.y };
    const far = Math.sqrt(away.x * away.x + away.y * away.y);
    const align = far === 0 ? 0 : (away.x * carrier.facing.x + away.y * carrier.facing.y) / far;
    state.pressure += (sides === undefined ? 1 : sides[teamOf(best)].pressureRate) * pressureFactorOf(align);
    if (state.pressure < PRESSURE_WINS) {
      possession.holder = held;
      possession.lastTouch = held;
      return;
    }
    state.pressure = 0;
    state.pressedBy = NOBODY;
  } else {
    state.pressure = 0;
    state.pressedBy = NOBODY;
  }

  if (held !== NOBODY && held !== best) {
    const heldD2 = dist2(players[held].p, ball.p);
    const heldReach = reachOf(held);
    // ⚠️ THE MARGIN IS THE CHALLENGER'S AND NOT THE CARRIER'S. It is what HE has to overcome, so it is his
    //    side's `defending` that sets it - reading it off the man being robbed would turn the rating into
    //    a shielding rating and put it on the wrong six numbers entirely.
    const margin =
      sides === undefined || best === NOBODY ? SHIELD_MARGIN : sides[teamOf(best)].tackleMargin;

    // ⚠️ THE SHIELD REACHES A STRIDE PAST HIS RADIUS, and this line is the whole of a defect that ran
    //    the match. It used to ask `heldD2 < heldReach * heldReach` - the carrier had to still have the
    //    ball IN his control radius to be allowed to shield it. But a dribbler knocks the ball ahead of
    //    himself: that is what a dribble is, and the touch puts it a shade OUTSIDE that radius. So the
    //    shield switched off at the exact moment it was needed, and any opponent a hand's breadth nearer
    //    took the ball without doing anything at all.
    //
    //    Measured over six five-minute matches, at the tick an opponent took it: the loser was a median
    //    of 0.96 m from the ball and the taker 0.86 m - ten centimetres - against a control radius of
    //    0.90 m. Ninety-six against ninety is the mechanism, not a coincidence. Only 9% of steals had the
    //    loser genuinely beaten. The match ran 227 changes of possession, a median possession of SEVEN
    //    ticks, a ball controlled 20.7% of the time and never out of the middle two sixths.
    //
    //    ⚠️ AND THE FOOTBALL AND THE FIX ARE ONE SENTENCE: you take the ball off a man by TACKLING him,
    //    not by standing ten centimetres nearer. `sim/tackle` is the other half of it.
    const shieldReach = heldReach + margin;
    if (heldD2 < shieldReach * shieldReach && Math.sqrt(heldD2) - Math.sqrt(bestD2) < margin) {
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
