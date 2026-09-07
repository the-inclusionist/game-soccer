// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT A VERB DOES TO THE BALL - and where "shoot or tackle?" is answered.
//
// ========================= THE CONTEXTUAL VERB IS RESOLVED HERE, IN THE SIMULATION =========================
// `action2` is a shot when your side has the ball and a tackle when it does not. That is a MEANING, and
// meaning depends on the world. The input layer must not know who has the ball: an input layer that reads
// possession is the coupling ADR-0027 measured as the base engine's first defect, rebuilt in a new
// repository. What travels from the input layer is intent - "the strike slot fired, at power 0.7, aimed
// up-left" - and what turns it into a shot or a tackle is this file.
//
// ⚠️ AND THE POWER ARRIVES ALREADY INTEGRATED. The simulation never sees a held button, which is what lets
// the same code serve real time, assisted time and the turn-based mode where a child PICKS the number.
import { describe, expect, it } from 'vitest';
import { strikeFor } from '../app/js/sim/strike.ts';
import { createMatchState } from '../app/js/sim/state.ts';
import { HOME, SQUAD_SIZE } from '../app/js/sim/ids.ts';
import { NOBODY } from '../app/js/sim/possession.ts';
import { PITCH } from '../app/js/sim/units.ts';
import type { Command } from '../app/js/sim/command.ts';

const cmd = (over: Partial<Command> = {}): Command => ({
  tick: 0,
  seat: 0,
  dx: 0,
  dy: 0,
  verb: 'none',
  power: 0.5,
  flags: 0,
  ...over,
});

/** A live match with the ball at the feet of `who`, and everybody else parked far away. */
function carrying(who: number) {
  const s = createMatchState();
  s.phase = 'live';
  for (const p of s.players) p.p = { x: 5, y: 50 };
  s.ball.p = { x: 60, y: 28, z: 0 };
  s.players[who].p = { x: 60, y: 28 };
  s.possession.holder = who;
  s.possession.lastTouch = who;
  return s;
}

describe('striking the ball', () => {
  it('[Zero] a command with no verb strikes nothing', () => {
    expect(strikeFor(carrying(9), cmd(), 9)).toBeNull();
  });

  it('[Zero] and neither does a verb from somebody who has not got the ball', () => {
    const s = carrying(9);
    s.possession.holder = NOBODY;

    expect(strikeFor(s, cmd({ verb: 'shoot' }), 9)).toBeNull();
  });

  it('[Right] a shot leaves toward the goal this side is attacking', () => {
    const kick = strikeFor(carrying(9), cmd({ verb: 'shoot', power: 1 }), 9);

    expect(kick).not.toBeNull();
    expect(kick!.vx).toBeGreaterThan(0);
    expect(Math.abs(kick!.vy)).toBeLessThan(Math.abs(kick!.vx));
  });

  it('[Right] the other side shoots the other way, because ends are derived and never stored', () => {
    const s = carrying(SQUAD_SIZE + 9);
    const kick = strikeFor(s, cmd({ verb: 'shoot', power: 1 }), SQUAD_SIZE + 9);

    expect(kick!.vx).toBeLessThan(0);
  });

  it('[Right] more power is a faster ball, and it is the command that carries the power', () => {
    const soft = strikeFor(carrying(9), cmd({ verb: 'shoot', power: 0.2 }), 9)!;
    const hard = strikeFor(carrying(9), cmd({ verb: 'shoot', power: 1 }), 9)!;

    expect(Math.abs(hard.vx)).toBeGreaterThan(Math.abs(soft.vx));
  });

  // ⚠️ THE FLOOR AGAIN, ONE LAYER ALONG. `charge.ts` guarantees a tap is never zero power; this guarantees
  //    a tap never becomes a ball that does not move. The two together are what a child who cannot hold a
  //    button actually experiences.
  it('[Boundary] even the softest pass moves the ball somewhere', () => {
    const kick = strikeFor(carrying(9), cmd({ verb: 'pass', power: 0 }), 9)!;

    expect(Math.abs(kick.vx) + Math.abs(kick.vy)).toBeGreaterThan(2);
  });

  it('[Right] a pass goes to a team-mate, not to the goal', () => {
    const s = carrying(9);
    s.players[4].p = { x: 62, y: 40 };

    const kick = strikeFor(s, cmd({ verb: 'pass' }), 9)!;

    expect(kick.vy).toBeGreaterThan(0);
  });

  // ⚠️ THE ZERO-LENGTH CASE, WHICH IS THE ONE THAT PRODUCES A NaN. "Nobody to pass to" cannot happen with
  //    eleven players a side, and asserting it would be asserting a fiction; a team-mate standing exactly
  //    ON the ball is real, happens at every restart, and is what divides by zero.
  it('[Zero] a pass to somebody standing exactly on the ball goes upfield, not to NaN', () => {
    const s = carrying(9);
    s.players[4].p = { x: s.ball.p.x, y: s.ball.p.y };

    const kick = strikeFor(s, cmd({ verb: 'pass' }), 9)!;

    expect(Number.isNaN(kick.vx)).toBe(false);
    expect(kick.vx).toBeGreaterThan(0);
    expect(kick.vy).toBe(0);
  });

  it('[Right] a lofted ball leaves the ground, and a grounded one does not', () => {
    const lob = strikeFor(carrying(9), cmd({ verb: 'lob' }), 9)!;
    const through = strikeFor(carrying(9), cmd({ verb: 'through' }), 9)!;

    expect(lob.vz).toBeGreaterThan(0);
    expect(through.vz).toBe(0);
  });

  it('[Right] a through ball is played into the SPACE ahead, so it outruns a short pass', () => {
    const s = carrying(9);
    s.players[4].p = { x: 65, y: 28 };

    const short = strikeFor(s, cmd({ verb: 'pass', power: 1 }), 9)!;
    const through = strikeFor(s, cmd({ verb: 'through', power: 1 }), 9)!;

    expect(Math.abs(through.vx)).toBeGreaterThan(Math.abs(short.vx));
  });

  it('[Interface] the striker is named, so the referee can attribute the touch', () => {
    const kick = strikeFor(carrying(9), cmd({ verb: 'shoot' }), 9)!;

    expect(kick.id).toBe(9);
  });
});

describe('tackling', () => {
  // ⚠️ THE SAME BUTTON, THE OTHER MEANING. Nothing in the input layer chose this; the world did.
  it('[Right] the strike slot with the ball at an opponent feet takes the ball, not a shot', () => {
    const s = createMatchState();
    s.phase = 'live';
    for (const p of s.players) p.p = { x: 5, y: 50 };
    s.ball.p = { x: 60, y: 28, z: 0 };
    s.players[SQUAD_SIZE + 4].p = { x: 60, y: 28 };
    s.possession.holder = SQUAD_SIZE + 4;
    s.players[9].p = { x: 60.4, y: 28 };

    const kick = strikeFor(s, cmd({ verb: 'tackle' }), 9);

    expect(kick).not.toBeNull();
    expect(kick!.id).toBe(9);
  });

  it('[Zero] a tackle at nothing is nothing - no ball is touched from across the pitch', () => {
    const s = carrying(SQUAD_SIZE + 4);
    s.players[9].p = { x: 5, y: 5 };

    expect(strikeFor(s, cmd({ verb: 'tackle' }), 9)).toBeNull();
  });

  it('[Zero] and you cannot tackle your own team-mate', () => {
    const s = carrying(4);
    s.players[9].p = { x: 60.4, y: 28 };

    expect(strikeFor(s, cmd({ verb: 'tackle' }), 9)).toBeNull();
  });
});

describe('the pitch keeps its shape', () => {
  it('[Boundary] no strike ever exceeds what a foot can do', () => {
    for (const verb of ['shoot', 'pass', 'through', 'lob'] as const) {
      const kick = strikeFor(carrying(9), cmd({ verb, power: 1 }), 9)!;
      const speed = Math.sqrt(kick.vx * kick.vx + kick.vy * kick.vy + kick.vz * kick.vz);
      expect(speed, verb).toBeLessThanOrEqual(34);
      expect(kick.vx, verb).not.toBeNaN();
    }
  });

  it('[Interface] a carrier on the goal line still produces a finite strike', () => {
    const s = carrying(9);
    s.players[9].p = { x: PITCH.length, y: PITCH.width / 2 };
    s.ball.p = { x: PITCH.length, y: PITCH.width / 2, z: 0 };

    const kick = strikeFor(s, cmd({ verb: 'shoot', power: 1 }), 9)!;

    expect(Number.isFinite(kick.vx)).toBe(true);
    expect(Number.isFinite(kick.vy)).toBe(true);
  });
});

describe('who the seat is', () => {
  it('[Interface] the seat drives a body, and the verb belongs to that body', () => {
    const s = carrying(9);
    s.goals = [0, 0];

    expect(strikeFor(s, cmd({ verb: 'shoot' }), 9)!.id).toBe(9);
    expect(strikeFor(s, cmd({ verb: 'shoot' }), 10)).toBeNull();
    expect(HOME).toBe(0);
  });
});
