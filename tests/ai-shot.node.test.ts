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

// ========================= AND ONLY WITH A SIGHT OF GOAL - TRIED, MEASURED, REVERTED =========================
// Measured on a ninety-minute match, after a shot stopped being struck on every tick: 73 corners and 133
// goal kicks - about 206 balls over a goal line, where football has roughly twenty-five SHOTS in total.
// The AI shoots whenever the carrier is inside twenty-two metres, with no notion of whether there is
// anything to shoot at, and every one that misses comes back as a corner or a goal kick and is shot again.
//
// A footballer checks one thing before he hits it: can he see the goal. So the shot was gated on a clear
// lane - no opponent within a body's width of the line from the ball to the mouth, the keeper excepted
// because you shoot AT him. It works, and it costs more than it saves:
//
//   corners      73.3 -> 17.7   (target 10)   BETTER
//   goal kicks  133.3 -> 31.7                 BETTER
//   throw-ins    69.7 -> 179.7  (target 40)   far worse
//   goals        16.7 -> 24.0   (target 2.7)  worse
//   bookings      2.0 -> 6.7    (target 1.7)  worse
//   sendings-off  0    -> 3.0   (target 0.07) worse
//
// ⚠️ AND THE REASON IS THE HALF THAT IS MISSING, NOT THE RULE. A carrier who may not shoot falls through
// to the pass branch, which wants pressure AND a receiver further up the pitch - and inside the box there
// is nobody further up. So he dribbles, in a crowd, next to a line: contact, cards, and the ball out.
//
// Football's answer is that a man who cannot shoot plays it ACROSS or BACK, and this cascade has no such
// ball in it - `receiverFor` skips anybody less than two metres ahead of the carrier, by design. The
// sight-of-goal rule is worth having the day that exists, and not before.
