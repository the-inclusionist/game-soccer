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
