// SPDX-License-Identifier: AGPL-3.0-or-later
// A WHOLE MATCH, FROM THE FIRST WHISTLE TO THE LAST.
//
// ========================= WHAT NO OTHER GATE ASKS =========================
// The anti-wedge gate runs three thousand ticks and asks that a goal happens and the ball goes out. A
// match is thirty-six thousand, it changes ends halfway through, and it has to STOP - and the things most
// likely to prevent that are the newest: a penalty phase nobody takes, a card that empties a side, a
// restart whose taker cannot reach the ball.
//
// ⚠️ AND IT IS THE ONLY PLACE THE WHOLE MACHINE RUNS AGAINST ITSELF. The simulation, the referee, the AI,
// the fouls, the cards and the clock, for the length of a real session, with nobody driving. Everything
// here is deterministic - no clock, no `Math.random` anywhere under `sim/`, `rules/` or `ai/` - so this is
// a repeatable measurement and not a soak that passes on a good day.
// ========================= AND WHAT SIX FIXTURES AT TWO LENGTHS SAY =========================
// Measured per match at the length stated, never extrapolated, against football's 40 throw-ins, 2.7 goals,
// 10 corners, 1.7 bookings and 0.07 sendings-off:
//
// ⚠️ THE GAME IS THE FIVE-MINUTE SCHOOL MATCH, settled by the Dev on 2026-09-07: two halves of two and
// a half, the middle of the three International Superstar Soccer offered. Modern football games were
// considered and dropped - pairing with them is pairing with a different game. Six fixtures, measured
// once, all six reaching full time:
//
//                     throw-ins   goals   corners   goal kicks   offsides   fouls   yellows   pens
//     nobody playing         3.17    1.83      1.00         2.00       0.50    3.67      0.33   0.67
//     a child playing        3.50    2.67      0.67         2.50       0.67    4.00      1.83   0.83
//     the band (mine)       3.5-6     2-3     1.5-3        3-4.5    0.5-1.5   2-3.5   0.5-1.5   rare
//
//     scores, nobody playing    3-0   1-0   0-0   0-3   3-1   0-0
//     scores, a child playing   4-0   3-0   1-0   2-0   3-0   2-1
//
//     balls into the box: 8.50 a match with nobody playing, 10.00 with a child
//
// ⚠️ AND HER SHOT WAS NOT JUDGED BY THE SAME FUNCTION UNTIL 2026-09-07. The machine's shot is scattered
// by its club's `shooting`; hers went dead centre from any distance, and she scored fourteen goals from a
// median of 22.4 metres - the very edge of the range where an ordinary club had just been made to miss.
// It was the mirror of the fouls defect this repository fixed months earlier, with the sign flipped: a
// rule applied to one half of the pitch, and the half was theirs. With her aim now her club's, her
// corners went 0.50 to 1.17, goal kicks 1.00 to 1.83, balls into the box 7.00 to 9.17, and her scorelines
// stopped being 5-0 and 8-0.
//
// ⚠️ WHAT IS STILL SHORT is corners and goal kicks in the played match, and offsides in both.
//
// ⚠️ FOOTBALL'S PER-MATCH COUNTS ARE NOT THIS MATCH'S TARGET, and reading them as one cost days. Forty
// throw-ins and 2.7 goals belong to ninety minutes of football; seven minutes of arcade is a different
// thing on purpose.
//
// ========================= THE BANDS, GIVEN BY THE DEV ON 2026-09-07 =========================
// What an arcade match of each length should contain. These are the ruler now - not football's ninety
// minutes, and not a scaling of it:
//
//     event            3 min      7 min      12 min
//     goals            1 to 3     2 to 4     2 to 5
//     throw-ins        2 to 4     5 to 8     10 to 14
//     corners          1 to 2     2 to 4     4 to 7
//     fouls            1 to 2     3 to 5     6 to 10
//     yellow cards     0 to 1     1 to 2     2 to 4
//     red cards        rare (0)   0 to 1     0 to 1
//     goal kicks       2 to 3     4 to 6     6 to 10
//     offsides         0 to 1     1 to 2     2 to 3
//     penalties        rare (0)   0 to 1     0 to 1
//
// ⚠️ THE FIVE-MINUTE BAND IS INTERPOLATED BY ME, and is marked so. The Dev gave 3, 7 and 12; five sits
// between the first two, and these are the midpoints - correct them rather than trusting them:
//
//     goals 2-3    throw-ins 3.5-6    corners 1.5-3    fouls 2-3.5    yellows 0.5-1.5
//     goal kicks 3-4.5              offsides 0.5-1.5   reds and penalties: rare
//
// Against that, one count is far OVER and five are UNDER: throw-ins 14.3, goals 0.67, corners 0.00, goal
// kicks 0.17, fouls 0.83, yellows 0.17. Offsides, reds and penalties are inside.
//
// ⚠️ AND THE ONE NUMBER UNDERNEATH ALL OF THEM IS 1.67 - the times a ball reaches the penalty area in a
// whole match. Corners, goal kicks and goals are all things that happen at the END of a pitch, and the
// ball gets there under twice a match. It is not a finishing problem: measured over the seven-minute
// build, 0.50 goals came from 5.00 box entries, which is a tenth - better conversion than football's
// (about 1.35 goals from 35 entries). The attack ARRIVES rarely, and converts well when it does.
//
// ⚠️ SO THE NEXT WORK IS THE MECHANISM, NOT NINE CONSTANTS. Tuning six counts upward one at a time
// would be six levers fighting one cause, which is how this repository spent days on a mode nobody could
// select. The measurements that ruled out the obvious causes are recorded where each lever lives:
// `sim/possession` for the contested threshold, `ai/brain` for the mis-weighted pass, `sim/step` for
// body contact.
//
// ========================= AND EVERY NUMBER ABOVE IS A MATCH NOBODY IS PLAYING =========================
// ⚠️ THE BAND BELONGS TO A PLAYED MATCH, AND THIS FILE MEASURES AN EMPTY CHAIR. That was a question for
// a while and it is now a measurement. A scripted seat that plays like a child - chase the ball, run at
// their goal, shoot inside 22 metres - was driven against the same six fixtures:
//
//     five minutes            throw-ins   goals   corners   goal kicks   fouls   yellows   into the box
//     nobody at the keyboard      14.33    0.67      0.00         0.17    0.83      0.17           1.67
//     a child playing              8.50    1.83      0.83         1.33    3.33      1.83           5.33
//     the band (interpolated)     3.5-6     2-3     1.5-3        3-4.5   2-3.5   0.5-1.5              -
//
// Her scores: 0-0, 4-0, 2-0, 3-1, 0-0, 1-0.
//
// One child driving ONE of the eleven triples the balls into the box, triples the goals, halves the
// throw-ins and puts the fouls inside their band. And it UNDERSTATES her: the scripted seat never presses
// switch, and a child presses it constantly to drive whoever is nearest the ball.
//
// ⚠️ WHICH SETTLES WHAT MAY BE TUNED. Driving the AI up to the band on its own would overshoot the
// moment somebody sat down - the counts above would land past the top of every band. The empty-chair
// match is a FLOOR: it has to look like football and it has to finish, and the band is measured with
// somebody playing.
//
// ⚠️ AND A NINETY-MINUTE MODE WAS TUNED FOR DAYS BEFORE ANYBODY NOTICED IT WAS NOT IN THE GAME.
// `FULL_MATCH` is referenced by one test and two comments; no composition root has ever selected it, so
// no child could reach it. The table it was tuned against is kept in `rules/profile` beside the profile
// itself, parked - the measurements are real and the mode is not offered.
//
// ⚠️ AND "IT IS ALL DENSITY" WAS TOO BROAD, which a spike settled. `PITCH` was widened in a throwaway
// experiment and six ninety-minute matches measured at each size:
//
//     pitch      throw-ins   goals   corners        target: 40, 2.7, 10
//     90x56          206.0    17.3       5.0
//     112x70         250.0     5.3       0.3
//     135x84         338.7     0.3       1.3
//     158x98         418.0     2.3       1.3
//
// A bigger world takes the goals down towards the target and pushes the throw-ins UP, away from it. They
// move in opposite directions, so they are not one phenomenon: the goal rate is density and the throw-in
// rate is something else with its own cause. Nothing was kept from the spike - `PITCH` is a module
// constant and making it a profile value touches the rules, the projection and the renderer - but the
// measurement is here so the next person does not conclude what this file concluded first.

import { describe, expect, it } from 'vitest';
import { createMatchState } from '../app/js/sim/state.ts';
import { digest } from '../app/js/sim/digest.ts';
import { playTick } from '../app/js/play.ts';
import { MATCH_PROFILE, withPeriod } from '../app/js/rules/profile.ts';
import { CLUBS } from '../app/js/teams/roster.ts';
import { DT } from '../app/js/sim/ball.ts';
import { emptyFrame } from '../app/js/sim/command.ts';
import { AWAY, HOME, SQUAD_SIZE, firstOf } from '../app/js/sim/ids.ts';
import { onPitch } from '../app/js/sim/squads.ts';
import { RED } from '../app/js/rules/cards.ts';

/** Five minutes a half: the shortest a grown-up can choose, and still 36,000 ticks of football. */
const PROFILE = withPeriod(MATCH_PROFILE, 5);
const skills = { 0: CLUBS[0].ratings, 1: CLUBS[1].ratings };

/**
 * Six fixtures, every club playing once.
 *
 * ⚠️ ONE MATCH IS AN OBSERVATION AND NOT A PROPERTY, and this file learned it the hard way. "Corners
 * and goal kicks happen" was gated on a single fixture that produced two and one - and three of the other
 * five produce neither, so the gate was measuring which clubs happened to be first in the list. Anything
 * rare enough to be worth asserting is rare enough that one sample cannot answer it.
 *
 * AND SIX WHOLE MATCHES IS WHAT FOUND THE VETO. A restart used to need the GLOBALLY nearest player to be
 * on the taking side, so an opponent standing over the ball held the match up for ever: five fixtures
 * finished and the sixth ran out of ticks stopped at a throw-in. The single-fixture gate had been green
 * through all of it.
 */
const SLATE = [
  [0, 1],
  [2, 3],
  [4, 5],
  [6, 7],
  [8, 9],
  [10, 11],
] as const;

interface Played {
  readonly state: ReturnType<typeof createMatchState>;
  readonly seen: Record<string, number>;
  readonly longestStop: number;
  readonly ticks: number;
}

function playToTheEnd(sides = skills, limit = 80_000): Played {
  const state = createMatchState(PROFILE);
  state.phase = 'live';
  const seen: Record<string, number> = {};
  let longestStop = 0;
  let stopped = 0;
  let ticks = 0;

  // ⚠️ THE LOOP CONDITION IS READ THROUGH A WIDENED COPY, because narrowing on `state.phase` here makes
  //    TypeScript call every later comparison unreachable - the state is MUTATED inside the loop, and the
  //    narrowing describes the value at the top of it. Football is what changes it; the type system is
  //    reasoning about a snapshot.
  const phaseNow = (): string => state.phase;

  for (; ticks < limit && phaseNow() !== 'fullTime'; ticks++) {
    for (const e of playTick(state, emptyFrame(ticks), DT, PROFILE, sides)) {
      seen[e.kind] = (seen[e.kind] ?? 0) + 1;
    }
    const phase = phaseNow();
    if (phase === 'live' || phase === 'kickoff') stopped = 0;
    else {
      stopped += 1;
      if (stopped > longestStop) longestStop = stopped;
    }
  }

  return { state, seen, longestStop, ticks };
}

const played = playToTheEnd();

/** Every fixture on the slate, played out. The rare events are counted across all six. */
const slate = SLATE.map(([h, a]) => playToTheEnd({ 0: CLUBS[h].ratings, 1: CLUBS[a].ratings }));

/** How many of `kind` the whole slate produced. */
const across = (kind: string): number => slate.reduce((n, m) => n + (m.seen[kind] ?? 0), 0);

describe('the match ends', () => {
  it('[Right] it reaches full time under its own steam, with nobody playing', () => {
    expect(played.state.phase).toBe('fullTime');
  });

  // ⚠️ EVERY FIXTURE, AND THIS IS THE GATE THAT FOUND THE VETO. One match ending proves that one
  //    match ends; six clubs' worth of them is the first thing that can catch a wedge which needs a
  //    particular situation to arise - here, an opponent left standing over the ball at a restart the
  //    other side was owed. That fixture ran to the eighty-thousand-tick limit stopped at a throw-in.
  it('[Right] and so does every fixture on the slate, not just the first one', () => {
    for (const [i, match] of slate.entries()) {
      expect(match.state.phase, `${SLATE[i][0]} v ${SLATE[i][1]} never finished`).toBe('fullTime');
    }
  });

  it('[Right] and it plays both halves, changing ends in between', () => {
    expect(played.state.period).toBe(2);
    expect(played.seen.periodExpired ?? 0).toBe(1);
  });

  // ⚠️ THE WEDGE THIS EXISTS FOR. Any stopped phase that nobody can restart holds the match for ever, and
  //    the loop above would simply run out of ticks - so the assertion is on how long play was ever
  //    stopped, not on whether the loop finished.
  it('[Right] and no stoppage ever lasts more than a few seconds', () => {
    expect(played.longestStop, 'play stopped and never restarted').toBeLessThan(60 * 20);
  });
});

describe('what a match contains', () => {
  // Every match has restarts in it - that is a property of ten minutes of football and not a frequency.
  it('[Right] restarts are taken, in every fixture', () => {
    for (const [i, match] of slate.entries()) {
      expect(match.seen.restartTaken ?? 0, `${SLATE[i][0]} v ${SLATE[i][1]} never restarted`).toBeGreaterThan(0);
    }
  });

  // ⚠️ ASKED OF THE SLATE, BECAUSE A GOALLESS DRAW IS FOOTBALL. This used to assert a goal in ONE ten-minute
  //    match, which is not a property of anything - and it went red the day the machine stopped fouling
  //    every four seconds, because that fixture finished nil-nil. Two of the six do.
  //
  //    Eleven goals across six matches, measured. A goal arrives roughly every thirty to fifty-five
  //    thousand ticks, so a ten-minute half-length match producing none is the ordinary case rather than a
  //    symptom - and what would be a symptom is SIX of them producing none, which is what this asks.
  it('[Right] and goals are scored across a slate of fixtures', () => {
    expect(across('goalScored'), 'nobody scored in six whole matches').toBeGreaterThan(0);
  });

  // ⚠️ MEASURED AND NOT MET, and left stated rather than quietly dropped. A whole match produced ZERO
  //    throw-ins, ZERO corners, ZERO goal kicks and ZERO offsides: the ball never crosses a line in
  //    thirty-six thousand ticks. Football is largely the ball going out and coming back, and a match
  //    without any of it is a match with a shape nobody would recognise.
  //
  //    Nothing is wrong with the out-of-play rules - `tests/out-of-play` and `tests/offside` gate them
  //    hard, and they fire the moment the ball is put over a line. What no gate covers is whether the AI
  //    ever puts it there, and the answer is that it does not: twenty-two agents keep it in a tight loop
  //    in midfield. That is an AI shortcoming, it is now measured, and it wants its own session.
  // ⚠️ MET, and it was one missing behaviour rather than three missing rules. `decideKick` cleared for a
  //    keeper, shot inside twenty-two metres and returned `null` for everything else, so outfield players
  //    DRIBBLED FOR EVER - and a ball that is never passed is never intercepted, never played into space
  //    and never runs out. A whole match now produces twenty-eight throw-ins where it produced none.
  it('[Right] and the ball goes out of play, which in a real match it does constantly', () => {
    expect(played.seen.crossedTouchline ?? 0, 'the ball never left the pitch').toBeGreaterThan(0);
  });

  // ⚠️ AND AT ABOUT FOOTBALL'S RATE, WHICH TOOK FIVE ATTEMPTS AND FOUR MEASUREMENTS. 52 throw-ins per
  //    ninety minutes against roughly forty in the real game, down from 364 when this started.
  //
  //    What finally did it was not the touch and not the restart's weight, both of which were tried and
  //    measured worse. Every crossing had EXACTLY TWO bodies within five metres of the ball - the carrier
  //    and one opponent, never a swarm - and 40 of 48 came within one second of a restart. The keep-out
  //    was applied ONCE, when the ball was placed, and the cascade then walked the other side's presser
  //    straight back onto it like any other loose ball. A referee holds the ten yards until it is gone.
  it('[Right] and not in the loop it used to be in', () => {
    // ⚠️ MEASURED AT THIS LENGTH AND NOT EXTRAPOLATED, which is the mistake this file made for a day. Six
    //    ten-minute matches give 55 throw-ins - 9.2 each - and the ceiling is loose enough not to fail on
    //    one scrappy afternoon while still catching a return to the loop that produced hundreds.
    //
    //    ⚠️ The figure this gate was written against, "about 35 at football's forty per ninety minutes", was
    //    a ten-minute count multiplied by nine. It was wrong twice: the matches it counted were mostly
    //    FROZEN - a parried ball marked grounded in mid-air switched gravity off, see `tests/ball` - and a
    //    rate measured over ten minutes does not survive being stretched to ninety in this game anyway. A
    //    real ninety-minute match gives 122.
    // ⚠️ RE-BASED WHEN A MAN STOPPED PASSING TO HIMSELF, and the direction is the uncomfortable one. Six
    //    ten-minute matches went from 55 throw-ins to 136, because 70% of all passes used to be the SAME
    //    pass issued again a tick later - the passer took his own ball back before it had left his feet -
    //    and a ball that never travels is a ball that never goes out. The low count was the defect.
    //
    //    This is a LOOP detector and not a football-rate gate: the loop it exists for produced hundreds a
    //    match. The rate against football lives in the table above and is far out, which is stated there.
    expect(across('crossedTouchline'), 'the ball is going out constantly again').toBeLessThan(260);
  });

  // ⚠️ MET, AND BY THE SHOT RATHER THAN BY THE RULES. A shot aimed at the exact centre of the mouth can
  //    only be scored or saved, so the ball never crossed a goal line for any other reason and a whole
  //    match produced no corners and no goal kicks at all. With `shooting` scattering the aim it produces
  //    both.
  //
  //    The numbers are small - two corners and one goal kick - and the ceiling is deliberately absent:
  //    this asks that the two restarts are REACHABLE, which is what was actually wrong. How often they
  //    should happen is a question about the AI, and pinning a number nobody has tuned would turn an
  //    honest gate into a guess that goes red the next time the shape of play changes.
  // ⚠️ ASKED OF THE SLATE, BECAUSE ONE MATCH CANNOT ANSWER IT. Half the fixtures produce no corner
  //    at all and half produce no goal kick, so a single-fixture version of this gate measured the club
  //    list rather than the game - it went green on the first pair and red on the next change to the AI,
  //    for a reason that had nothing to do with the AI.
  //
  //    Five corners, three goal kicks and four offsides across six matches, measured. There is no ceiling
  //    for the usual reason: how OFTEN they should happen is a question about the AI, and pinning a number
  //    nobody has tuned turns an honest gate into a guess.
  it('[Right] and goal kicks and offsides happen across a slate of fixtures', () => {
    expect(across('crossedGoalLineByAttacker'), 'no goal kick in six whole matches').toBeGreaterThan(0);
    expect(across('offsideGiven'), 'no offside in six whole matches').toBeGreaterThan(0);
  });

  // ⚠️ AND CORNERS, WHICH NOW HAVE A CAUSE INSTEAD OF A COINCIDENCE. This was taken out of the gate above
  //    because the count walked 5, 1, 5, 2, 1, 0 across a day of AI changes, none of them about corners: a
  //    `> 0` assertion on it was a coin that had been landing heads. Nothing in the game could actually
  //    produce one - `receiverFor` only passes forward, the keeper's clearance goes forward, and a shot was
  //    binary because there was no save model at all.
  //
  //    `sim/save` is that model, and a keeper who can reach a ball but not hold it tips it wider and
  //    slower. Four corners across six matches, and the difference from the five this gate used to pass on
  //    is that there is now a mechanism behind them rather than a ricochet.
  // ⚠️ AND CORNERS WENT BACK UNDER, WHICH A BLOCK COST. When a body stopped SWALLOWING a struck ball -
  //    measured, a shot left at 24 metres a second and an opponent a metre away held it on the next tick -
  //    shots started dying at defenders' feet instead of running behind. Corners per ninety-minute match
  //    went 16.7 to 2.7 against football's ten, and six ten-minute matches now produce none at all.
  //
  //    It is stated rather than gated because the sample cannot answer it: at 2.7 a match, six ten-minute
  //    fixtures expect about half a corner. The claim is real and the measurement is in `sim/block`, which
  //    also records the two other deflection models that were tried and are worse.
  // ⚠️ THE SHORT MODE'S CORNERS ARE MEASURED, NOT MET, AND THE LEVERS ARE EXHAUSTED. Every other number
  //    the Dev asked of a fifteen-minute match lands - 37.3 throw-ins against 40 and 2.7 goals against 2.7
  //    - and the corners sit at 1.3 against ten.
  //
  //    They come almost entirely from the KEEPER, not from the defender who puts it out on purpose:
  //    measured, a ninety-minute match has 267 parries and 1.3 deliberate corners, and a fifteen-minute one
  //    has 26.7 and 1.0. Parries scale with time, so the short match simply contains a sixth of them - and
  //    the Dev's school target asks for a whole match's corners inside a quarter of an hour.
  //
  //    ⚠️ AND WIDENING THE DEPTH AT WHICH A DEFENDER PUTS IT OUT DOES NOT REACH IT. From the six-yard
  //    area to the penalty area, over six fixtures at each length:
  //
  //                       90 min: corners   goals        15 min: corners   goals
  //        5.5 m                     10.8     2.3                     1.3     2.7
  //        10 m                      13.5     4.3                     1.2     3.0
  //        14 m                      20.5     4.3                     1.5     3.0
  //
  //    The short match does not move at all and the long match's goals get worse, so 5.5 stays. Ten corners
  //    in fifteen minutes wants a source that fires on attacking play rather than on a keeper's hands -
  //    a cross, which this AI has no notion of.
  it.todo('[Right] and corners often enough for six short matches to contain one');

  // ⚠️ OFFSIDE WAS A MISSING WIRE RATHER THAN A MISSING RULE. `rules/offside` was written, gated
  //    hard by `tests/offside`, and imported by `declaration.ts` - for the `gate` role that tints the
  //    offside zone - and by nothing that played the match. `offsideGiven` was an event with a case in
  //    `takerFor` and no producer anywhere: the sixth time here that a module was right, its gate was
  //    right, and nobody called it. It is gated on the slate above, with the other two restarts that are
  //    too rare for one fixture to answer for.

  // ⚠️ ALSO MEASURED AND NOT MET: five sendings-off in one ten-minute match, after the presser was taught
  //    to contain rather than dive in - which cut it from what had been a side reduced to six. Real
  //    football sees roughly one red card every ten matches. The remaining cause is that the machine can
  //    only ever commit a challenge at or above the reckless speed, because speed is the only evidence of
  //    intent a body can offer - so every AI foul is at least a booking and two of them are a red.
  //
  //    The fix is not a higher threshold. It is that a presser which cannot win the ball should not
  //    arrive at all, and that is a decision about defending rather than about cards.
  // ⚠️ MET, AND THE LAST THING IT NEEDED WAS NOT ABOUT CARDS AT ALL. One booking and no sending-off
  //    across six whole matches - about 1.5 bookings per ninety minutes, where football has 1.7.
  //
  //    The road here was four findings, three of them measurements that contradicted something written in
  //    the code: severity was graded on relative speed while the module promised it was not; both
  //    thresholds were left calibrated against that replaced quantity; the challenge line was the card
  //    line, so the machine could not express carelessness. The last one was a restart being played
  //    straight back out of play, which had nothing to do with cards and everything to do with how often
  //    two bodies met at speed near a touchline.
  //
  //    ⚠️ A CEILING AND NO FLOOR, on purpose. At football's rate a six-match sample legitimately contains
  //    zero of them, so a floor would be a coin - the same mistake the corner gate made all day. The
  //    ceiling is what catches a regression to the thirty-one reds this started at, and it is loose enough
  //    not to fail on one busy afternoon.
  it('[Right] and cards are rare, the way they are in football', () => {
    // Seven bookings and no sending-off across six ten-minute matches, measured at that length.
    expect(across('bookingGiven'), 'the referee has started booking people again').toBeLessThan(12);
    expect(across('sendingOff'), 'a sending-off every other match is not football').toBeLessThan(4);
  });

  // ⚠️ THE RULE MUST BE RARE ENOUGH TO BE A RULE. A referee that whistles constantly is not a referee, and
  //    the AI challenge threshold is the only thing holding this down.
  // ⚠️ ASKED OF THE SLATE, BECAUSE ONE TEN-MINUTE MATCH LEGITIMATELY HAS NONE. This asked it of a single
  //    fixture and went red the day fouls came down to football's frequency - the referee did not break,
  //    the sample got too small for the question. It is the fourth gate in this file to make that mistake
  //    and the fourth to be moved onto the slate for it.
  it('[Boundary] fouls happen across a slate, and are not most of the match', () => {
    const fouls = across('foulGiven') + across('penaltyGiven');

    expect(fouls, 'six whole matches with no foul at all').toBeGreaterThan(0);
    // The ceiling is loose on purpose: it is here to catch a referee that has started whistling every
    // tick, not to pin a number nobody has tuned.
    expect(fouls, 'the referee never stops whistling').toBeLessThan(720);
  });

  // ⚠️ MET, AND THE THIRD ATTEMPT WAS THE ONE THAT WAS NOT ABOUT DEFENDING AT ALL. A side used to finish a
  //    ten-minute match reduced to four, and the first two attempts both changed WHERE the presser stood:
  //    the first stopped play resuming, the second produced a match with no goals at any containing
  //    distance from 1.1 to 3.0 metres, because a defender who holds his ground is never beaten.
  //
  //    The defect was in the MEASUREMENT. `rules/foul` graded a challenge by the plain relative speed of
  //    two bodies while its own comment promised that *"a player standing still whom somebody runs into
  //    has not committed anything"* - which relative speed cannot deliver. Measured over three whole
  //    matches: every foul was graded on a closing speed with a median of 7.2 and a p75 of 10, while no
  //    BODY in this game can exceed 7.2. Those numbers were two players running at each other, which is
  //    what a striker and a defender do, and thirty-one per cent of all fouls came out RED.
  //
  //    Grading on what the tackler BROUGHT - his own speed at the man, capped by the speed the gap was
  //    closing at - took red cards across the slate from thirty-one to three, and no side now finishes
  //    below ten. Nothing about defending changed.
  //
  //    ⚠️ AND THE RATE, WHICH TOOK TWO MORE FINDINGS. The first was that BOTH thresholds were still
  //    calibrated against the quantity `wentIn` replaced: 5.5 and 9 were chosen when severity was the
  //    RELATIVE speed of two bodies, which adds - so nine became unreachable once the number was capped by
  //    the tackler's own top speed of 7.6 (measured: zero violent challenges in six whole matches) and 5.5
  //    became "any challenge made at a run". They are shares of his own top speed now, which is also the
  //    only version that is FAIR: a fixed threshold in metres books a quick club more often than a slow one
  //    for the identical act.
  //
  //    The second was that raising the card line raised the CHALLENGE line with it, because they were one
  //    number - and the machine nearly stopped fouling: ten fouls per ninety minutes against football's
  //    twenty-two, two of six matches with none at all. `rules/foul` had carried that coupling in writing
  //    since fouls existed: *"the machine does not give away CARELESS fouls, because it cannot express
  //    carelessness."* Two questions, two numbers.
  //
  //    ⚠️ Red cards across six matches: 31 this morning, 3 once the measurement was fixed, 1 now, and no
  //    side finishing below ten. ⚠️ Still not football's rate: about 1.5 reds and 10 bookings per ninety
  //    minutes against roughly 0.1 and 1.7. The catastrophe is gone and the frequency is not.
  it('[Zero] and no side is reduced by cards to fewer than eight, in any fixture', () => {
    for (const [i, match] of slate.entries()) {
      for (const team of [HOME, AWAY]) {
        let playing = 0;
        for (let k = 0; k < SQUAD_SIZE; k++) if (onPitch(match.state, firstOf(team) + k)) playing += 1;
        const who = `${SLATE[i][0]} v ${SLATE[i][1]}: team ${team}`;
        expect(playing, `${who} finished with ${playing}`).toBeGreaterThanOrEqual(8);
      }
    }
  });

  // ⚠️ THE FLOOR THAT IS STILL A REAL GATE. The requirement above is unmet and stated; this is the line
  //    below which the match stops being football at all, and it must never be crossed silently.
  it('[Boundary] but nobody plays a match against three men, in any fixture', () => {
    for (const [i, match] of slate.entries()) {
      for (const team of [HOME, AWAY]) {
        let playing = 0;
        for (let k = 0; k < SQUAD_SIZE; k++) if (onPitch(match.state, firstOf(team) + k)) playing += 1;
        const who = `${SLATE[i][0]} v ${SLATE[i][1]}: team ${team}`;
        expect(playing, `${who} was reduced to ${playing}`).toBeGreaterThan(3);
      }
    }
  });

  it('[Interface] every card recorded is one of the two the laws have', () => {
    for (const [id, card] of played.state.cards.entries()) {
      expect(card, `player ${id}`).toBeGreaterThanOrEqual(0);
      expect(card, `player ${id}`).toBeLessThanOrEqual(RED);
    }
  });
});

describe('and it is the same match every time', () => {
  // The claim the whole arithmetic discipline exists for, asked at the largest scale available: a school
  // Chromebook and a teacher's laptop have to produce the same match, and drift shows up over a match
  // rather than over a hundred ticks.
  it('[Right] the same profile and the same clubs give the same match, to the last bit', () => {
    const again = playToTheEnd();

    expect(again.state.phase).toBe('fullTime');
    expect(digest(again.state)).toBe(digest(played.state));
    expect(again.ticks).toBe(played.ticks);
    expect(again.seen).toEqual(played.seen);
  });
});
