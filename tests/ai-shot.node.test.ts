// SPDX-License-Identifier: AGPL-3.0-or-later
// A SHOT THAT CAN MISS.
//
// ========================= WHY THERE WERE NO GOAL KICKS OR CORNERS =========================
// A whole match produced twenty-eight throw-ins and not one corner, goal kick or offside. The touchlines
// came right the moment the AI could pass; the goal lines did not, and the reason is one line: a shot is
// struck at the exact centre of the mouth. It is never wide, so it either scores or is saved, and a ball
// that is never wide never crosses a goal line for any other reason.
//
// ⚠️ AND IT MAKES A SECOND CLUB RATING REACH THE PITCH. `shooting` had been declared, documented and read
// by nothing - like `passing` before the pass existed. A rating that changes nothing is a number on a
// card, and this repository has now found five of those.
//
// ⚠️ THE AIM LEANS, IT DOES NOT ROLL. ADR-0049 asks for determinism and fairness asks harder: a shot that
// misses by luck is a shot a child cannot learn to take. The same club in the same position takes the
// same shot for ever, and a better finisher's aim is simply nearer the middle.
import { describe, expect, it } from 'vitest';
import { createMatchState } from '../app/js/sim/state.ts';
import { MATCH_PROFILE } from '../app/js/rules/profile.ts';
import { AWAY, HOME, SQUAD_SIZE, firstOf } from '../app/js/sim/ids.ts';
import { decideKick } from '../app/js/ai/brain.ts';
import { AVERAGE } from '../app/js/ai/ratings.ts';
import { GOAL, PITCH } from '../app/js/sim/units.ts';

const sharp = { ...AVERAGE, shooting: 1 };
const poor = { ...AVERAGE, shooting: 0 };

/** A carrier inside shooting range, unmarked, facing the away goal. */
function chance(shooter = AVERAGE, at = { x: 78, y: 28 }) {
  const s = createMatchState(MATCH_PROFILE);
  s.phase = 'live';
  const who = firstOf(HOME) + 9;
  for (let k = 0; k < SQUAD_SIZE; k++) {
    s.players[firstOf(HOME) + k].p = { x: 5, y: 50 };
    s.players[firstOf(AWAY) + k].p = { x: 5, y: 5 };
  }
  s.players[who].p = { x: at.x, y: at.y };
  s.ball.p = { x: at.x, y: at.y, z: 0 };
  s.ball.v = { x: 0, y: 0, z: 0 };
  s.possession.holder = who;
  s.possession.lastTouch = who;
  return { s, who, skills: { 0: shooter, 1: AVERAGE } };
}

/** Where a struck ball crosses the goal line, in metres across the pitch. */
const crossesAt = (from: { x: number; y: number }, k: { vx: number; vy: number }) =>
  from.y + (k.vy / k.vx) * (PITCH.length - from.x);

describe('a chance', () => {
  it('[Right] is struck, and hard', () => {
    const { s, skills } = chance();
    const kick = decideKick(s, MATCH_PROFILE.playable, skills);

    expect(kick).not.toBeNull();
    expect(kick!.vx).toBeGreaterThan(10);
  });

  it('[Right] and it goes toward the goal his side is attacking', () => {
    const { s, skills } = chance();

    expect(decideKick(s, MATCH_PROFILE.playable, skills)!.vx).toBeGreaterThan(0);
  });
});

describe('the finisher', () => {
  // ⚠️ THE GATE THIS FILE EXISTS FOR. A shot at the dead centre is a shot that can only be scored or
  //    saved, and a match of those has no goal kicks in it.
  it('[Right] a poor one misses the target from distance', () => {
    const { s, skills } = chance(poor, { x: 68, y: 28 });
    const kick = decideKick(s, MATCH_PROFILE.playable, skills)!;

    const across = Math.abs(crossesAt({ x: 68, y: 28 }, kick) - PITCH.width / 2);
    expect(across, 'a hopeless finisher still hits the target').toBeGreaterThan(GOAL.width / 2);
  });

  it('[Right] and a perfect one hits the middle of the mouth exactly', () => {
    const { s, skills } = chance(sharp, { x: 68, y: 28 });
    const kick = decideKick(s, MATCH_PROFILE.playable, skills)!;

    expect(crossesAt({ x: 68, y: 28 }, kick)).toBeCloseTo(PITCH.width / 2, 6);
  });

  // ⚠️ A MISS FROM SIX YARDS WOULD BE A JOKE. The error is an ANGLE, so the same finisher who sprays it
  //    from thirty metres puts it away from close in - which is what makes a rating readable as skill
  //    rather than as a dice.
  it('[Right] the same poor finisher scores from close in', () => {
    const from = { x: 87, y: 28 };
    const { s, skills } = chance(poor, from);
    const kick = decideKick(s, MATCH_PROFILE.playable, skills)!;

    const across = Math.abs(crossesAt(from, kick) - PITCH.width / 2);
    expect(across, 'he cannot score from three metres out').toBeLessThan(GOAL.width / 2);
  });

  it('[Zero] and the same club shoots the same way every time - no dice', () => {
    const a = decideKick(chance(poor).s, MATCH_PROFILE.playable, { 0: poor, 1: AVERAGE })!;
    const b = decideKick(chance(poor).s, MATCH_PROFILE.playable, { 0: poor, 1: AVERAGE })!;

    expect(a).toEqual(b);
  });

  it('[Boundary] every shot still travels at a real speed, whoever takes it', () => {
    for (const shooter of [poor, AVERAGE, sharp]) {
      const kick = decideKick(chance(shooter).s, MATCH_PROFILE.playable, { 0: shooter, 1: AVERAGE })!;
      const speed = Math.sqrt(kick.vx * kick.vx + kick.vy * kick.vy);
      expect(speed).toBeGreaterThan(20);
      expect(speed).toBeLessThan(40);
    }
  });
});

// ========================= A SHOT IS STRUCK ONCE =========================
// Measured on a real ninety-minute match: **8,352 shots**. Football has about twenty-five.
//
// The carrier strikes the ball, it leaves at 26 metres a second - and covers 0.43m in a tick, which is
// still inside his control radius. So `resolvePossession` gives it straight back to him and he strikes it
// again, and a "shot" is a burst of dozens of them. It is the same defect that made goals 45 a match, and
// it feeds the corners and goal kicks too, because every one of those strikes can go behind.
//
// ⚠️ THE RULE WAS TRIED ONCE AND REVERTED WITH THE WRONG NUMBER. "Nobody can control a ball leaving them
// faster than they can run" was set at a footballer's top speed, 7.6 - which is BELOW the dribbling touch,
// since a dribble knocks the ball ahead at 1.25 times the carrier's speed. It dispossessed every sprinting
// dribbler and broke four gates, and the conclusion drawn was that the rule was wrong. The rule was right
// and the threshold was inside the thing it had to leave alone.
import { playTick } from '../app/js/play.ts';
import { DT } from '../app/js/sim/ball.ts';
import { emptyFrame } from '../app/js/sim/command.ts';

describe('a shot in a running match', () => {
  it('[Right] is struck once, not on every tick until the ball is gone', () => {
    const { s, skills } = chance(AVERAGE, { x: 78, y: 28 });

    // ⚠️ TWENTY TICKS, AND THE FIRST VERSION USED SIXTY. At 26 metres a second the ball is over the goal
    //    line in twenty-eight, and the kickoff that follows is itself a step change in the ball's velocity
    //    - so a sixty-tick window counted the restart as a second strike and reported three. The claim is
    //    about the ball not being re-struck AS IT LEAVES HIM, so the window has to end before it arrives.
    let strikes = 0;
    let last = 0;
    for (let t = 0; t < 20; t++) {
      playTick(s, emptyFrame(t), DT, MATCH_PROFILE, skills);
      const now = Math.sqrt(s.ball.v.x * s.ball.v.x + s.ball.v.y * s.ball.v.y);
      // ⚠️ A STRIKE ADDS ENERGY, and drag and landing only remove it - so the test is a RISE in speed and
      //    not a change in it. The first version measured any step change and counted the ball landing as
      //    a second shot: `land` turns an airborne ball into a rolling one and the horizontal velocity
      //    moves by more than five metres a second when it does.
      if (now > last + 5) strikes += 1;
      last = now;
    }

    expect(strikes, 'the ball was hammered over and over as it left him').toBe(1);
  });
});

// ========================= AND ONLY WITH A SIGHT OF GOAL =========================
// The AI shot whenever the carrier was inside twenty-two metres, with no notion of whether there was
// anything to shoot at. A footballer checks one thing before he hits it: can he see the goal.
//
// ⚠️ THIS WAS MEASURED, REVERTED, AND THEN MEASURED AGAIN - and the second verdict is the opposite of the
// first, for a reason worth keeping. The first measurement was taken on a build where SEVENTY PER CENT OF
// ALL PASSES were the same pass issued again a tick later, because the passer could take his own ball back
// before it left his feet. On that build the rule sent throw-ins from 70 to 180 a match and sendings-off
// from none to three, and it was rejected.
//
// With the self-pass fixed, the same rule on the same slate:
//
//                          without        with        target
//   corners                    72.7        16.7          10
//   goal kicks                 99.7        29.0
//   goals                      48.0        43.3           2.7
//   bookings                    1.7         1.3           1.7
//   throw-ins                 155.7       222.7          40
//
// Better on four of the Dev's five numbers, and corners go from seven times the target to under two. A
// conclusion measured on a defective build is not a conclusion, and this file had one for a day.
// ========================= AND THE BALL FROM WIDE =========================
// The two deviations left in this match both pointed at the same missing thing. Corners come almost
// entirely from the KEEPER - 267 parries a match against 1.3 deliberate corners - so a short match, which
// contains a sixth of the parries, cannot reach the Dev's ten. And 279 of 281 throw-ins are the carrier
// walking his own ball out, where football's come off a deflection.
//
// Both want a ball hit INTO the box from wide, which this cascade had no notion of: `receiverFor` picks
// the freest man further up the pitch, and a cross is not aimed at a man at all - it is aimed at a place,
// hopefully, and what happens next is a scramble. A scramble is where corners come from.
//
// ⚠️ AND IT IS LOFTED, WHICH IS THE POINT. `MAX_CONTROL_HEIGHT` means nobody controls a ball above 1.2m,
// so a cross arrives uncontrollable and has to be dealt with rather than received - which is exactly the
// situation a defender clears and a keeper punches.
describe('a ball from wide', () => {
  /** A home carrier `x` metres up the pitch and `y` across it, unmarked. */
  function wide(x: number, y: number) {
    const s = createMatchState(MATCH_PROFILE);
    s.phase = 'live';
    const who = firstOf(HOME) + 7;
    for (let k = 0; k < SQUAD_SIZE; k++) {
      s.players[firstOf(HOME) + k].p = { x: 5, y: 28 };
      s.players[firstOf(AWAY) + k].p = { x: 5, y: 5 };
    }
    s.players[who].p = { x, y };
    // Somebody arriving in the box, because a cross is played to a man even though it is aimed at a place.
    s.players[firstOf(HOME) + 9].p = { x: 82, y: 28 };
    s.ball.p = { x, y, z: 0 };
    s.ball.v = { x: 0, y: 0, z: 0 };
    s.possession.holder = who;
    s.possession.lastTouch = who;
    return { s, who, skills: { 0: AVERAGE, 1: AVERAGE } };
  }

  it('[Right] from the byline he crosses it, rather than dribbling into the corner flag', () => {
    const { s, skills } = wide(80, 4);

    const kick = decideKick(s, MATCH_PROFILE.playable, skills);

    expect(kick, 'he kept it in the corner').not.toBeNull();
    expect(kick!.vy, 'the cross did not go towards the middle').toBeGreaterThan(0);
    expect(kick!.vz, 'a cross along the floor is a pass').toBeGreaterThan(0);
  });

  it('[Right] and from the other touchline it comes back the other way', () => {
    const { s, skills } = wide(80, 52);

    expect(decideKick(s, MATCH_PROFILE.playable, skills)!.vy).toBeLessThan(0);
  });

  // ⚠️ ONLY FROM WIDE AND ONLY HIGH UP. A cross from the middle is a pass, and one from your own half is a
  //    hopeful ball nobody asked for.
  // ⚠️ SIXTY-FIVE METRES AND NOT EIGHTY, and the first version measured the wrong kick. Central at eighty
  //    he is inside shooting range with a clear lane, so he SHOOTS - and a shot is lofted too, so the gate
  //    read `vz > 0` and reported a cross. Out of range and central, a cross is the only lofted ball he
  //    could play, so `null` is the whole answer.
  it('[Zero] but from the middle of the attacking third he does not', () => {
    const { s, skills } = wide(65, 28);

    expect(decideKick(s, MATCH_PROFILE.playable, skills), 'he crossed it from the middle').toBeNull();
  });

  // ⚠️ AND NOT TO AN EMPTY BOX, which is a giveaway with extra steps. Measured: without this the long
  //    match's goals went from 2.3 to 4.2 against a target of 2.7, because a ball hung up in front of an
  //    unguarded goal falls to whoever is nearest and that is as often an attacker as a defender.
  it('[Zero] and not when there is nobody in the box to cross to', () => {
    const { s, skills } = wide(80, 4);
    s.players[firstOf(HOME) + 9].p = { x: 5, y: 28 };

    const kick = decideKick(s, MATCH_PROFILE.playable, skills);

    expect(kick === null || kick.vz === 0, 'he crossed it to nobody').toBe(true);
  });

  it('[Zero] and not from his own half, however wide he is', () => {
    const { s, skills } = wide(30, 4);
    const kick = decideKick(s, MATCH_PROFILE.playable, skills);

    expect(kick === null || kick.vz === 0, 'he crossed it from his own half').toBe(true);
  });
});

describe('a sight of goal', () => {
  it('[Right] with the lane clear he shoots, as he always did', () => {
    const { s, skills } = chance(AVERAGE, { x: 78, y: 28 });

    expect(decideKick(s, MATCH_PROFILE.playable, skills)).not.toBeNull();
  });

  it('[Zero] but a defender standing in the way stops him', () => {
    const { s, skills } = chance(AVERAGE, { x: 78, y: 28 });
    s.players[firstOf(AWAY) + 4].p = { x: 84, y: 28 };

    expect(decideKick(s, MATCH_PROFILE.playable, skills), 'he shot it straight at a defender').toBeNull();
  });

  // ⚠️ THE KEEPER IS NOT A BLOCKER. You shoot AT him - he is the last thing between the ball and the net by
  //    definition, and counting him would mean nobody ever shoots at all.
  it('[Zero] and the keeper on his line does not count as in the way', () => {
    const { s, skills } = chance(AVERAGE, { x: 78, y: 28 });
    s.players[firstOf(AWAY)].p = { x: 89, y: 28 };

    expect(decideKick(s, MATCH_PROFILE.playable, skills), 'nobody can ever shoot now').not.toBeNull();
  });

  it('[Boundary] a defender well off the lane does not block it', () => {
    const { s, skills } = chance(AVERAGE, { x: 78, y: 28 });
    s.players[firstOf(AWAY) + 4].p = { x: 84, y: 34 };

    expect(decideKick(s, MATCH_PROFILE.playable, skills)).not.toBeNull();
  });
});
