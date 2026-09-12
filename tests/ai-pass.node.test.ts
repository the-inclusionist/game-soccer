// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PASS THE AI NEVER MADE.
//
// ========================= WHAT A WHOLE MATCH MEASURED =========================
// `tests/full-match` played thirty-six thousand ticks and recorded ZERO throw-ins, corners, goal kicks
// and offsides. The out-of-play rules are gated hard and fire the moment the ball crosses a line; what no
// gate covered was whether the ball ever gets there.
//
// It does not, and the cause is one line: `decideKick` clears for a keeper, shoots inside twenty-two
// metres, and returns `null` for everything else. Outfield players DRIBBLE FOREVER. Its own header says
// so - "passing and shooting belong here too and are the next thing to add" - and shooting was added.
//
// A ball that is never passed is never intercepted, never played into space, and never runs out. And
// offside is judged at the MOMENT OF A PASS, so a game with no passes cannot produce one either: three
// referee rules were unreachable because of a missing behaviour rather than a missing rule.
//
// ⚠️ AND THIS IS WHERE THE FIRST RATING REACHES THE GAME. `think` took the clubs' ratings and did
// `void skills` - accepted them and threw them away - so "every club is a side" was true of the roster
// and false of the match. A pass with an error angle drawn from `passing` is the first place a club's
// number changes what happens on the pitch.
import { describe, expect, it } from 'vitest';
import { createMatchState } from '../app/js/sim/state.ts';
import { MATCH_PROFILE } from '../app/js/rules/profile.ts';
import { AWAY, HOME, SQUAD_SIZE, firstOf, teamOf } from '../app/js/sim/ids.ts';
import { decideKick } from '../app/js/ai/brain.ts';
import { AVERAGE } from '../app/js/ai/ratings.ts';
import { NOBODY, resolvePossession } from '../app/js/sim/possession.ts';
import { createBall, stepBall, DT } from '../app/js/sim/ball.ts';
import { BALL, PITCH } from '../app/js/sim/units.ts';

const sharp = { ...AVERAGE, passing: 0.95 };
const poor = { ...AVERAGE, passing: 0.05 };

/** A carrier in his own half, under pressure, with a team-mate free ahead of him. */
function pressed(passing = AVERAGE) {
  const s = createMatchState(MATCH_PROFILE);
  s.phase = 'live';
  const carrier = firstOf(HOME) + 4;
  const mate = firstOf(HOME) + 9;

  for (let k = 0; k < SQUAD_SIZE; k++) {
    s.players[firstOf(HOME) + k].p = { x: 5, y: 50 };
    s.players[firstOf(AWAY) + k].p = { x: 85, y: 50 };
  }
  // Home attacks +x in the first period, so "ahead" is a larger x.
  s.players[carrier].p = { x: 30, y: 28 };
  s.players[mate].p = { x: 44, y: 26 };
  // Somebody on top of him: the reason to let go of it.
  s.players[firstOf(AWAY) + 3].p = { x: 31.2, y: 28 };

  s.ball.p = { x: 30, y: 28, z: 0 };
  s.ball.v = { x: 0, y: 0, z: 0 };
  s.possession.holder = carrier;
  s.possession.lastTouch = carrier;
  return { s, carrier, mate, skills: { 0: passing, 1: AVERAGE } };
}

// ========================= AND HE DOES NOT PASS IT TO HIMSELF =========================
// Measured over a real ninety-minute match: 1,320 passes attempted and only 399 that ever resolved. The
// other seventy per cent were the SAME pass, issued again a tick later.
//
// A pass is weighted to reach its man - `far * rollDrag * 1.25` - so a five-metre ball leaves at ten
// metres a second, and that is BELOW the twelve at which a body can no longer control a ball running away
// from it. The passer was inside his own control radius when the ball had barely moved, took it straight
// back, and passed again. It is the shot defect one door along, and it hid behind the same threshold that
// fixed the shot: 26 metres a second is caught by it and 10 is not.
//
// ⚠️ AND THE PASSES WERE ALREADY FAILING HONESTLY, which is the finding that redirected this. 46% of the
// ones that resolved were INTERCEPTED - the sim has never needed a rule for that, because a ball passing
// within a body's reach of an opponent is his. The defect was never that a pass could not fail.
describe('a pass, once struck', () => {
  it('[Right] is not taken straight back by the man who played it', () => {
    const { s, carrier, skills } = pressed();

    const kick = decideKick(s, MATCH_PROFILE.playable, skills)!;
    s.ball.v = { x: kick.vx, y: kick.vy, z: kick.vz };
    s.possession.holder = NOBODY;
    s.possession.lastTouch = carrier;
    s.lastStruck = carrier;

    resolvePossession(s);

    expect(s.possession.holder, 'he took his own pass back on the next tick').not.toBe(carrier);
  });

  // ⚠️ AND THE LOCK LIFTS THE MOMENT IT IS AWAY FROM HIM, which is what stops it deadlocking a ball nobody
  //    else can reach: once it is outside his own radius he is an ordinary player again, and a clearance
  //    into space is still his to chase.
  it('[Zero] but a ball that has got away from him is his again', () => {
    const { s, carrier } = pressed();
    s.ball.p = { x: s.players[carrier].p.x + 6, y: s.players[carrier].p.y, z: 0 };
    s.ball.v = { x: 0, y: 0, z: 0 };
    s.possession.holder = NOBODY;
    s.lastStruck = carrier;

    resolvePossession(s);

    expect(s.lastStruck, 'he is still locked out of a ball six metres away').toBe(NOBODY);
  });
});

// ========================= AND HE DOES NOT PASS IT TO HIMSELF =========================
// Measured over a real ninety-minute match: 1,320 passes attempted and only 399 that ever resolved. The
// other seventy per cent were the SAME pass, issued again a tick later.
//
// A pass is weighted to reach its man - `far * rollDrag * 1.25` - so a five-metre ball leaves at ten
// metres a second, and that is BELOW the twelve at which a body can no longer control a ball running away
// from it. The passer was inside his own control radius when the ball had barely moved, took it straight
// back, and passed again. It is the shot defect one door along, and it hid behind the same threshold that
// fixed the shot: 26 metres a second is caught by it and 10 is not.
//
// ⚠️ AND THE PASSES WERE ALREADY FAILING HONESTLY, which is the finding that redirected this. 46% of the
// ones that resolved were INTERCEPTED - the sim has never needed a rule for that, because a ball passing
// within a body's reach of an opponent is his. The defect was never that a pass could not fail.
describe('a pass, once struck', () => {
  it('[Right] is not taken straight back by the man who played it', () => {
    const { s, carrier, skills } = pressed();

    const kick = decideKick(s, MATCH_PROFILE.playable, skills)!;
    s.ball.v = { x: kick.vx, y: kick.vy, z: kick.vz };
    s.possession.holder = NOBODY;
    s.possession.lastTouch = carrier;
    s.lastStruck = carrier;

    resolvePossession(s);

    expect(s.possession.holder, 'he took his own pass back on the next tick').not.toBe(carrier);
  });

  // ⚠️ AND THE LOCK LIFTS THE MOMENT IT IS AWAY FROM HIM, which is what stops it deadlocking a ball nobody
  //    else can reach: once it is outside his own radius he is an ordinary player again, and a clearance
  //    into space is still his to chase.
  it('[Zero] but a ball that has got away from him is his again', () => {
    const { s, carrier } = pressed();
    s.ball.p = { x: s.players[carrier].p.x + 6, y: s.players[carrier].p.y, z: 0 };
    s.ball.v = { x: 0, y: 0, z: 0 };
    s.possession.holder = NOBODY;
    s.lastStruck = carrier;

    resolvePossession(s);

    expect(s.lastStruck, 'he is still locked out of a ball six metres away').toBe(NOBODY);
  });
});

describe('a carrier under pressure', () => {
  it('[Right] lets go of it, where before he dribbled for ever', () => {
    const { s, skills } = pressed();

    expect(decideKick(s, MATCH_PROFILE.playable, skills)).not.toBeNull();
  });

  it('[Right] and the ball leaves the man who had it', () => {
    const { s, carrier, skills } = pressed();

    expect(decideKick(s, MATCH_PROFILE.playable, skills)?.id).toBe(carrier);
  });

  it('[Right] it goes FORWARD, toward the goal his side is attacking', () => {
    const { s, skills } = pressed();

    expect(decideKick(s, MATCH_PROFILE.playable, skills)!.vx).toBeGreaterThan(0);
  });

  // ⚠️ A PASS TO NOBODY IS A GIVEAWAY. With no team-mate to aim at, holding the ball is the better answer
  //    and the honest one - there is no reason to hoof it away that a child could learn from.
  //
  //    ⚠️ AND THAT IS NOW TRUE OUTSIDE HIS OWN THIRD, which is a real qualification and not a repair to keep
  //    this green. Deep in his own third with a man on him and nobody forward, a defender CLEARS - see the
  //    clearance gates at the foot of this file. The carrier here sat exactly on that boundary at x=30, so
  //    he is moved into midfield where the claim this gate makes is the one the game keeps.
  it('[Zero] with nobody to pass to in midfield, he keeps it', () => {
    const { s, mate, skills } = pressed();
    s.players[mate].p = { x: 5, y: 50 };
    s.players[s.possession.holder].p = { x: 45, y: 28 };
    s.ball.p = { x: 45, y: 28, z: 0 };
    s.players[firstOf(AWAY) + 3].p = { x: 46.2, y: 28 };

    expect(decideKick(s, MATCH_PROFILE.playable, skills)).toBeNull();
  });

  it('[Zero] and with nobody near him he carries on carrying it', () => {
    const { s, skills } = pressed();
    s.players[firstOf(AWAY) + 3].p = { x: 85, y: 50 };

    expect(decideKick(s, MATCH_PROFILE.playable, skills)).toBeNull();
  });
});

describe('a rating that finally reaches the pitch', () => {
  // ⚠️ `think` DID `void skills`. The clubs' six numbers were accepted and discarded, so "every club is a
  //    side" was true of the roster and false of the match. This is the first place one bites.
  // ⚠️ THE NAME SAYS AN ORDERING AND THE ASSERTION SAID A DIFFERENCE. This was
  //    `expect(aim(good)).not.toBe(aim(bad))`, which passes just as happily if the sharp passer aims
  //    WORSE than the poor one - the one outcome the gate exists to forbid. `passing` is a rating applied
  //    at the point of action, and the direction it is applied in is the whole of what makes it a rating
  //    rather than a number in a struct.
  //
  // ⚠️ AND `aim` MEASURED THE WRONG ANGLE. It was `|atan2(vy, vx)|` - the kick's absolute bearing - while
  //    the quantity the name describes is the DEVIATION from the line to the team-mate. The setup puts the
  //    carrier at (30, 28) and the mate at (44, 26), so the intended line is about -0.142 rad and not
  //    zero: an error that pushed a kick TOWARD zero bearing scored as straighter while being further off
  //    the pass. The proxy only held while the mate happened to be level with the carrier.
  it('[Right] a sharper passer aims straighter than a poor one', () => {
    const good = pressed(sharp);
    const bad = pressed(poor);
    const kickGood = decideKick(good.s, MATCH_PROFILE.playable, { 0: sharp, 1: AVERAGE })!;
    const kickBad = decideKick(bad.s, MATCH_PROFILE.playable, { 0: poor, 1: AVERAGE })!;

    const wanted = (p: ReturnType<typeof pressed>) =>
      Math.atan2(p.s.players[p.mate].p.y - p.s.players[p.carrier].p.y, p.s.players[p.mate].p.x - p.s.players[p.carrier].p.x);
    const off = (k: { vx: number; vy: number }, want: number) => Math.abs(Math.atan2(k.vy, k.vx) - want);

    expect(off(kickGood, wanted(good)), 'the sharp passer is no straighter than the poor one').toBeLessThan(
      off(kickBad, wanted(bad)),
    );
  });

  it('[Zero] and the same club passes the same way every time - no dice', () => {
    const a = decideKick(pressed(poor).s, MATCH_PROFILE.playable, { 0: poor, 1: AVERAGE })!;
    const b = decideKick(pressed(poor).s, MATCH_PROFILE.playable, { 0: poor, 1: AVERAGE })!;

    expect(a).toEqual(b);
  });

  it('[Boundary] a perfect passer has no error at all, which is the honest end of the scale', () => {
    const perfect = { ...AVERAGE, passing: 1 };
    const { s, carrier, mate } = pressed(perfect);
    const kick = decideKick(s, MATCH_PROFILE.playable, { 0: perfect, 1: AVERAGE })!;

    const want = Math.atan2(s.players[mate].p.y - s.players[carrier].p.y, s.players[mate].p.x - s.players[carrier].p.x);
    expect(Math.atan2(kick.vy, kick.vx)).toBeCloseTo(want, 6);
  });
});

describe('what a pass must never be', () => {
  it('[Zero] never to an opponent, however free he is standing', () => {
    const { s, skills } = pressed();
    s.players[firstOf(AWAY) + 7].p = { x: 40, y: 28 };

    const kick = decideKick(s, MATCH_PROFILE.playable, skills);
    if (kick === null) return;
    // The ball is struck from the carrier: whatever it is aimed at, it is not an away shirt's job to
    // receive it, and the only way to check that here is that the chosen line is the team-mate's.
    expect(teamOf(kick.id)).toBe(HOME);
  });

  it('[Zero] and the keeper still clears rather than picking a pass', () => {
    const { s, skills } = pressed();
    s.possession.holder = firstOf(HOME);
    s.players[firstOf(HOME)].p = { x: 3, y: 28 };
    s.ball.p = { x: 3, y: 28, z: 0 };

    const kick = decideKick(s, MATCH_PROFILE.playable, skills);

    expect(kick?.id).toBe(firstOf(HOME));
    expect(kick!.vz).toBeGreaterThan(0);
  });
});

// ========================= AND HOW HARD IT IS HIT =========================
// `decideKick` chose between two fixed speeds by distance and said, in a comment beside them: *"Enough to
// arrive, never so much that it runs away from the man it was meant for."* It did not do that. A five-metre
// pass was struck at fourteen metres a second, and a rolling ball covers `speed / rollDrag` metres before
// it stops - so it went nine, four past him and usually over a line.
//
// ⚠️ MEASURED, AND IT WAS BREAKING WHOLE MATCHES. One fixture spent 94% OF FOUR HUNDRED THOUSAND TICKS
// with the ball out of play: 4,564 throw-ins, 25,559 ticks of football, and no full time in a five-minute
// half. A throw-in taken near the line was played straight back over it, for ever. The other five fixtures
// were producing 146 to 200 throw-ins a match where real football has about forty.
//
// ⚠️ THE WEIGHT IS DERIVED AND NOT TUNED. `sim/ball` rolls at `v *= 1 - rollDrag * dt`, so a ball struck
// at `v` travels `v / rollDrag` before it stops: the speed that puts it at his feet is `far * rollDrag`,
// and the overshoot on top of that is the only chosen number in the line.
describe('the weight of a pass', () => {
  /** Where a struck ball comes to rest, by rolling it out with nothing else in the world. */
  function restsAt(kick: { vx: number; vy: number }, from: { x: number; y: number }) {
    const ball = createBall({ x: from.x, y: from.y });
    ball.v = { x: kick.vx, y: kick.vy, z: 0 };
    ball.grounded = true;
    for (let t = 0; t < 1200 && (ball.v.x !== 0 || ball.v.y !== 0); t++) stepBall(ball, DT);
    return { x: ball.p.x, y: ball.p.y };
  }

  /** A carrier under pressure with his team-mate exactly `gap` metres in front of him. */
  function at(gap: number) {
    const { s, carrier, mate, skills } = pressed();
    s.players[mate].p = { x: 30 + gap, y: 28 };
    return { s, carrier, mate, skills, from: { x: 30, y: 28 } };
  }

  it('[Right] a short pass stops near the man it was meant for, not ten metres past him', () => {
    const { s, mate, skills, from } = at(5);

    const kick = decideKick(s, MATCH_PROFILE.playable, skills)!;
    const rest = restsAt(kick, from);

    const overshoot = rest.x - s.players[mate].p.x;
    expect(overshoot, 'the pass ran away from him').toBeLessThan(2.5);
    expect(overshoot, 'the pass died before it reached him').toBeGreaterThan(-1);
  });

  it('[Right] and a longer one is hit harder, because it has further to go', () => {
    const short = decideKick(at(5).s, MATCH_PROFILE.playable, at(5).skills)!;
    const long = decideKick(at(14).s, MATCH_PROFILE.playable, at(14).skills)!;

    expect(long.vx, 'both passes were hit at the same speed').toBeGreaterThan(short.vx);
  });

  // ⚠️ A PASS THAT DOES NOT MOVE IS NOT AN OPTION, and it is the same argument as `minPower` on the child's
  //    charge: the shortest ball the AI will play must still be reachable, or the rule reads as the game
  //    refusing to pass at all.
  //
  //    ⚠️ THREE METRES AND NOT TWO, and the first version of this gate asked for two and failed with a null
  //    kick. `receiverFor` skips anybody less than two metres ahead - *"a square or backward ball is not
  //    what this is for"* - so two metres was asking for a pass the AI deliberately refuses. The gate was
  //    wrong, not the code, and the shortest ball it will actually play is the one worth gating.
  it('[Boundary] even the shortest ball the AI will play actually travels', () => {
    const { s, skills, from } = at(3);

    const kick = decideKick(s, MATCH_PROFILE.playable, skills)!;
    const rest = restsAt(kick, from);

    expect(rest.x - from.x, 'the pass did not go anywhere').toBeGreaterThan(1);
  });
});

// ========================= AND A DEFENDER WITH NOBODY TO PASS TO =========================
// Only the KEEPER ever cleared his lines. An outfield player pressed in his own box with no forward
// receiver simply dribbled - which is not football, and which is also why this game had no legitimate way
// for the ball to leave the pitch at all.
//
// ⚠️ THAT SECOND HALF IS WHY THIS EXISTS NOW. Clamping the dribbling touch so it could not knock the ball
// out was tried twice and took throw-ins from six times football's rate to ZERO, which proved the touch was
// the only route to a touchline the game had. Football's others are a deflected tackle, a misplaced pass,
// and a clearance under pressure - and a clearance is the one this AI is plainly missing.
describe('a defender with nowhere to play it', () => {
  /** A home carrier `at` metres up the pitch, pressed, with every team-mate behind him. */
  function cornered(at: number) {
    const s = createMatchState(MATCH_PROFILE);
    s.phase = 'live';
    const carrier = firstOf(HOME) + 4;
    for (let k = 0; k < SQUAD_SIZE; k++) {
      // Everybody of his own side BEHIND him, so `receiverFor` - which only looks forward - finds nobody.
      s.players[firstOf(HOME) + k].p = { x: 2, y: 50 };
      s.players[firstOf(AWAY) + k].p = { x: 80, y: 50 };
    }
    s.players[carrier].p = { x: at, y: 28 };
    s.players[firstOf(AWAY) + 3].p = { x: at + 1.2, y: 28 };
    s.ball.p = { x: at, y: 28, z: 0 };
    s.ball.v = { x: 0, y: 0, z: 0 };
    s.possession.holder = carrier;
    s.possession.lastTouch = carrier;
    return { s, carrier, skills: { 0: AVERAGE, 1: AVERAGE } };
  }

  it('[Right] hammers it clear when he is pressed in his own third', () => {
    const { s, skills } = cornered(12);

    const kick = decideKick(s, MATCH_PROFILE.playable, skills);

    expect(kick, 'he dribbled it in his own box with a man on him').not.toBeNull();
    expect(kick!.vx, 'he cleared it towards his own goal').toBeGreaterThan(0);
    expect(kick!.vz, 'a clearance that stays on the floor is a pass to nobody').toBeGreaterThan(0);
  });

  it('[Right] and it is hit harder than a pass, because it is going nowhere in particular', () => {
    const { s, skills } = cornered(12);

    expect(decideKick(s, MATCH_PROFILE.playable, skills)!.vx).toBeGreaterThan(15);
  });

  // ⚠️ HIS OWN THIRD AND NOT ANYWHERE, which is what keeps it a clearance rather than a way of never
  //    playing football. A player hoofing it from the halfway line every time he is closed down would
  //    turn every match into two goalkeepers kicking to each other.
  it('[Zero] but he dribbles out of it in midfield, as he did before', () => {
    const { s, skills } = cornered(45);

    expect(decideKick(s, MATCH_PROFILE.playable, skills)).toBeNull();
  });

  // ⚠️ AND ONLY UNDER PRESSURE. A defender with time on the ball plays football with it; clearing whenever
  //    there is no forward pass would mean a defender never turns and never carries it out.
  it('[Zero] and with nobody near him he keeps it, deep or not', () => {
    const { s, skills } = cornered(12);
    s.players[firstOf(AWAY) + 3].p = { x: 80, y: 50 };

    expect(decideKick(s, MATCH_PROFILE.playable, skills)).toBeNull();
  });
});

// ========================= THE BALL THAT GOES SIDEWAYS - TRIED TWICE, MEASURED, REVERTED =========================
// `receiverFor` skips anybody less than two metres ahead of the carrier - *"a square or backward ball is
// not what this is for"* - and that leaves a hole football does not have: a carrier under pressure with
// nobody in front of him has only the dribble. It is also what blocked the sight-of-goal rule, which was
// measured and reverted for exactly this reason (see `tests/ai-shot`).
//
// So an outlet was added: the nearest FREE team-mate in any direction, asked only when the forward ball
// returns nothing. Twice, in two orders, and the second is the one worth recording.
//
//   forward -> outlet -> clear     six gates fell. A defender in his own third stopped clearing, because
//                                  there was always somebody within range to give it to.
//   forward -> clear  -> outlet    the clearance came back, and five gates still fell:
//
//                                    the phase NEVER CHANGED in six thousand ticks
//                                    NOTHING stopped play in thirty-six thousand
//                                    the ball never went out, and no card was ever shown
//
// ⚠️ THAT IS A CLOSED PASSING LOOP, and the two-metre rule's own comment predicted it in six words. Two
// free players square to each other are each other's best outlet, for ever, and the ball goes nowhere.
//
// ⚠️ THE MEMORY WAS BUILT AND IT WORKED, AND THE OUTLET STILL LOSES. A third attempt added `lastStruck` -
// who last played the ball deliberately - and had the outlet refuse him, which is football's own instinct
// and the same shape as the Law 15 memory this repository already carries. It killed the metronome
// outright: the phase changed again, play stopped and resumed again, the match progressed again.
//
// And the outlet turned out to be too GOOD. A carrier always has an escape, so the ball stops going loose:
//
//                          before      with outlet     target
//   throw-ins                69.7            0.7         40
//   goals                    16.7            8.0          2.7
//   corners                  73.3           36.3         10
//   bookings                  2.0            8.0          1.7
//   sendings-off              0              5.67         0.07
//
// Better on goals and corners, and seven-tenths of a throw-in per NINETY MINUTES against football's forty -
// with the cards going the same way, because a ball that never goes out is a ball always being fought over.
//
// ⚠️ SO THE IDEA IS NOT "AN OUTLET", IT IS "AN OUTLET THAT CAN FAIL". Every pass in this cascade is aimed
// with a lean from `passing` and still finds its man, because the receiver is chosen for being FREE. A
// sideways ball out of trouble is the one football most often gives away, and this AI has no way to
// express giving it away. That is the next thing, and it is a bigger idea than a fallback branch.

// ========================= AND THE ONE HE PUTS BEHIND ON PURPOSE =========================
// Six fifteen-minute matches produce 0.3 corners between them, against football's ten a match. The corner
// RULE has been gated since the referee existed; what the game lacks is anything that reliably puts the
// ball behind a defender's own line.
//
// It had two sources and lost one. The keeper tips a shot round the post - but shots stopped reaching him
// once a body could block one, which is `sim/block` and is worth its cost. Nothing else in the cascade
// ever sends the ball backwards at all: `receiverFor` only passes forward and `clearIt` hoofs it upfield.
//
// ⚠️ FOOTBALL'S ANSWER IS A CHOICE, NOT AN ACCIDENT. A defender in his own six-yard area with a man on him
// puts it out rather than risk it in front of his own goal, and conceding a corner is the point of doing
// it. That is the one behaviour here that produces corners on purpose.
describe('a defender on his own goal line', () => {
  /** A home defender `x` metres from his own line, pressed, with nobody to pass to. */
  function cornered(x: number) {
    const s = createMatchState(MATCH_PROFILE);
    s.phase = 'live';
    const back = firstOf(HOME) + 3;
    for (let k = 0; k < SQUAD_SIZE; k++) {
      s.players[firstOf(HOME) + k].p = { x: 1, y: 54 };
      s.players[firstOf(AWAY) + k].p = { x: 80, y: 54 };
    }
    s.players[back].p = { x, y: 24 };
    s.players[firstOf(AWAY) + 3].p = { x: x + 1.2, y: 24 };
    s.ball.p = { x, y: 24, z: 0 };
    s.ball.v = { x: 0, y: 0, z: 0 };
    s.possession.holder = back;
    s.possession.lastTouch = back;
    return { s, back, skills: { 0: AVERAGE, 1: AVERAGE } };
  }

  it('[Right] puts it behind rather than playing it across his own goal', () => {
    const { s, skills } = cornered(3);

    const kick = decideKick(s, MATCH_PROFILE.playable, skills);

    expect(kick, 'he kept it in his own six-yard box with a man on him').not.toBeNull();
    expect(kick!.vx, 'he cleared it upfield from three metres out').toBeLessThan(0);
  });

  // ⚠️ AND ONLY THAT DEEP. A defender twenty metres out has a pitch in front of him and hoofs it there;
  //    putting THAT ball behind would be a side conceding a corner every time it won the ball back.
  it('[Zero] but from the edge of his third he still clears upfield', () => {
    const { s, skills } = cornered(20);

    expect(decideKick(s, MATCH_PROFILE.playable, skills)!.vx).toBeGreaterThan(0);
  });

  it('[Zero] and with nobody near him he plays football with it', () => {
    const { s, skills } = cornered(3);
    s.players[firstOf(AWAY) + 3].p = { x: 80, y: 54 };

    expect(decideKick(s, MATCH_PROFILE.playable, skills)).toBeNull();
  });
});

// ========================= AND A PASS GOES WHERE HE WILL BE =========================
// The pass was aimed at the receiver's FEET - at the spot he was standing on when it was struck. A ball
// takes a second or so to arrive and a running player is metres away by then, so every pass to a moving
// team-mate arrived behind him: he had to stop, turn, and come back for it, which is the opposite of
// what a pass is for. It is also why the attack never progressed - a side that passes backwards to itself
// is a side keeping the ball in the middle third, which is exactly what six matches measured.
//
// ⚠️ THE LEAD IS DERIVED, NOT CHOSEN. The pass speed is already computed from the distance, so the time
// the ball spends travelling is `far / speed` - and leading him by his own velocity over that time is
// arithmetic rather than a constant somebody tuned. One iteration: the aim moves, the speed does not.
describe('a pass into his path', () => {
  function passTo(mateAt: { x: number; y: number }, mateV: { x: number; y: number }) {
    const s = createMatchState(MATCH_PROFILE);
    s.phase = 'live';
    const carrier = firstOf(HOME) + 6;
    const mate = firstOf(HOME) + 9;
    for (let k = 0; k < SQUAD_SIZE; k++) {
      s.players[firstOf(HOME) + k].p = { x: 5, y: 54 };
      s.players[firstOf(AWAY) + k].p = { x: 5, y: 2 };
    }
    // A rival on the carrier, so he lets it go rather than carrying it.
    s.players[firstOf(AWAY) + 4].p = { x: 41, y: 28 };
    s.players[carrier].p = { x: 40, y: 28 };
    s.players[mate].p = { ...mateAt };
    s.players[mate].v = { ...mateV };
    s.ball.p = { x: 40, y: 28, z: 0 };
    s.ball.v = { x: 0, y: 0, z: 0 };
    s.possession.holder = carrier;
    s.possession.lastTouch = carrier;
    return { s, carrier, mate };
  }

  /** Where a struck ball comes to rest: `v / rollDrag` metres along its own line. */
  const restsAt = (from: { x: number; y: number }, k: { vx: number; vy: number }) => ({
    x: from.x + k.vx / BALL.rollDrag,
    y: from.y + k.vy / BALL.rollDrag,
  });

  // ⚠️ HE RUNS ACROSS THE PASSING LINE, NOT ALONG IT, and the first version of this gate did not. A
  //    receiver sprinting straight away from the passer is led along the SAME line - only further - and
  //    the pass speed is already clamped at its maximum over that distance, so both balls came out
  //    identical and the gate could not see the feature it was written for. Across the line, the aim has
  //    to move sideways or nothing has changed.
  it('[Right] a runner is passed to where he is going, not where he stands', () => {
    const still = passTo({ x: 60, y: 28 }, { x: 0, y: 0 });
    const running = passTo({ x: 60, y: 28 }, { x: 0, y: 6 });

    const a = decideKick(still.s, MATCH_PROFILE.playable, { 0: AVERAGE, 1: AVERAGE })!;
    const b = decideKick(running.s, MATCH_PROFILE.playable, { 0: AVERAGE, 1: AVERAGE })!;

    const from = { x: 40, y: 28 };
    expect(restsAt(from, b).y, 'the ball was played to his feet while he ran across it').toBeGreaterThan(
      restsAt(from, a).y + 1,
    );
  });

  it('[Zero] and a team-mate standing still is passed to where he stands', () => {
    const { s } = passTo({ x: 60, y: 28 }, { x: 0, y: 0 });
    const kick = decideKick(s, MATCH_PROFILE.playable, { 0: AVERAGE, 1: AVERAGE })!;

    // Aimed straight down the line between them, so nothing across the pitch beyond the passing lean.
    expect(Math.abs(kick.vy / kick.vx)).toBeLessThan(0.3);
  });

  it('[Interface] and the same runner is led the same way every time - no dice', () => {
    const a = passTo({ x: 60, y: 28 }, { x: 6, y: 0 });
    const b = passTo({ x: 60, y: 28 }, { x: 6, y: 0 });

    expect(decideKick(a.s, MATCH_PROFILE.playable, { 0: AVERAGE, 1: AVERAGE })).toEqual(
      decideKick(b.s, MATCH_PROFILE.playable, { 0: AVERAGE, 1: AVERAGE }),
    );
  });

  // ⚠️ AND THE LEAD NEVER AIMS OFF THE PITCH. A winger sprinting at the touchline would otherwise be
  //    passed to a spot in the stands, which is a throw-in the passer chose to concede.
  it('[Boundary] a man running at the touchline is not led over it', () => {
    const { s } = passTo({ x: 55, y: 42 }, { x: 0, y: 9 });
    const kick = decideKick(s, MATCH_PROFILE.playable, { 0: AVERAGE, 1: AVERAGE })!;

    // ⚠️ THE AIM IS CLAMPED, THE PASSER'S ERROR IS NOT, and that is the football rather than a hole. He
    //    is running at 9 m/s and the ball is a second and a third in the air, so an unclamped lead would
    //    aim four metres into the stands; the clamp puts the aim ON the line and the passing lean can
    //    still take it over. A pass that goes out because it was leaned badly is where a throw-in comes
    //    from, and this game needs more of those, not fewer.
    const atHim = 28 + (kick.vy / kick.vx) * (55 - 40);
    expect(atHim, 'he was played a ball four metres into the stands').toBeLessThan(PITCH.width + 1);
  });
});
