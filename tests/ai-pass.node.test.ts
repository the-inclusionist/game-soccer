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
  it('[Right] a sharper passer aims straighter than a poor one', () => {
    const good = decideKick(pressed(sharp).s, MATCH_PROFILE.playable, { 0: sharp, 1: AVERAGE })!;
    const bad = decideKick(pressed(poor).s, MATCH_PROFILE.playable, { 0: poor, 1: AVERAGE })!;

    const aim = (k: { vx: number; vy: number }) => Math.abs(Math.atan2(k.vy, k.vx));
    // The intended line is toward the team-mate; the poor passer's is further off it.
    expect(aim(good)).not.toBe(aim(bad));
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
