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
import { AWAY, firstOf } from '../app/js/sim/ids.ts';
import { AVERAGE } from '../app/js/ai/ratings.ts';
import { DT } from '../app/js/sim/ball.ts';
import { MATCH_PROFILE } from '../app/js/rules/profile.ts';
import { playTick } from '../app/js/play.ts';
import { createMatchState } from '../app/js/sim/state.ts';
import { HOME, SQUAD_SIZE } from '../app/js/sim/ids.ts';
import { NOBODY } from '../app/js/sim/possession.ts';
import { PITCH } from '../app/js/sim/units.ts';
import type { Command } from '../app/js/sim/command.ts';
import { shotErrorOf } from '../app/js/ai/ratings.ts';

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

// ========================= AND HER SHOT IS JUDGED BY THE SAME FUNCTION =========================
// The machine's shot is scattered by its club's `shooting`; a child's went dead centre, every time, from
// any distance. Measured over six five-minute matches with a scripted child playing: FOURTEEN goals, all
// of them struck from between 18.3 and 23.0 metres, median 22.4 - the very edge of shooting range, where
// an ordinary club had just been made to miss. Her matches finished 5-0 and 4-0.
//
// ⚠️ IT IS THE MIRROR OF A DEFECT THIS REPOSITORY ALREADY FIXED, and the mirror is what made it hard to
// see. The fouls used to be judged for a command from a SEAT and for nothing else, so a child could be
// booked and the eleven she played against could not - a law applied to one half of the pitch, and the
// half was hers. This was the same shape with the sign flipped: a rule applied to one half of the pitch,
// and the half was theirs.
//
// ⚠️ AND THE ERROR IS THE CLUB'S, WHICH IS WHAT MAKES THE BADGE MEAN SOMETHING. She picks a club; the six
// numbers add up to the same total for every one of them, so a club that shoots well defends worse. A
// child who can score from distance chose that, and one who cannot can learn to get closer - which is
// exactly what `ai/ratings` says a rating is for.
describe('a child shoots with her club\'s aim, like everybody else', () => {
  const at22 = () => {
    const s = carrying(9);
    s.players[9].p = { x: PITCH.length - 22, y: PITCH.width / 2 };
    s.ball.p = { x: PITCH.length - 22, y: PITCH.width / 2, z: 0 };
    return s;
  };

  /** Where a struck ball crosses the goal line, in metres across the pitch. */
  const crossesAt = (from: { x: number; y: number }, k: { vx: number; vy: number }) =>
    from.y + (k.vy / k.vx) * (PITCH.length - from.x);

  it('[Right] an ordinary club misses from the edge of the range, exactly as the machine does', () => {
    const from = { x: PITCH.length - 22, y: PITCH.width / 2 };
    const kick = strikeFor(at22(), cmd({ verb: 'shoot', power: 1 }), 9, shotErrorOf(0.5))!;

    const across = Math.abs(crossesAt(from, kick) - PITCH.width / 2);
    expect(across, 'her shot went dead centre from twenty-two metres').toBeGreaterThan(3.5);
  });

  it('[Right] and the same club scores from the edge of the box', () => {
    const s = carrying(9);
    const from = { x: PITCH.length - 12, y: PITCH.width / 2 };
    s.players[9].p = { ...from };
    s.ball.p = { ...from, z: 0 };
    const kick = strikeFor(s, cmd({ verb: 'shoot', power: 1 }), 9, shotErrorOf(0.5))!;

    expect(Math.abs(crossesAt(from, kick) - PITCH.width / 2)).toBeLessThan(3.5);
  });

  it('[Zero] a perfect finisher still hits the middle exactly', () => {
    const from = { x: PITCH.length - 22, y: PITCH.width / 2 };
    const kick = strikeFor(at22(), cmd({ verb: 'shoot', power: 1 }), 9, shotErrorOf(1))!;

    expect(crossesAt(from, kick)).toBeCloseTo(PITCH.width / 2, 6);
  });

  it('[Interface] and she shoots the same way every time - no dice', () => {
    const a = strikeFor(at22(), cmd({ verb: 'shoot', power: 1 }), 9, shotErrorOf(0.5));
    const b = strikeFor(at22(), cmd({ verb: 'shoot', power: 1 }), 9, shotErrorOf(0.5));

    expect(a).toEqual(b);
  });
});

// ========================= AND THE WIRE, NOT ONLY THE MODULE =========================
// `sim/strike` will lean a shot when it is handed an aim error, and `tests/strike` proves it does. That
// gate goes on passing if the match never hands it one - which is how this repository has lost eight
// modules that were right, gated and connected to nothing. This drives a real tick.
describe('the seat shot carries the club aim through the match', () => {
  it('[Right] an ordinary club does not shoot dead centre from twenty-two metres', () => {
    const s = createMatchState(MATCH_PROFILE);
    s.phase = 'live';
    const who = firstOf(HOME) + 9;
    for (let k = 0; k < SQUAD_SIZE; k++) {
      s.players[firstOf(HOME) + k].p = { x: 5, y: 50 };
      s.players[firstOf(AWAY) + k].p = { x: 5, y: 5 };
    }
    const from = { x: PITCH.length - 22, y: PITCH.width / 2 };
    s.players[who].p = { ...from };
    s.ball.p = { ...from, z: 0 };
    s.ball.v = { x: 0, y: 0, z: 0 };
    s.possession.holder = who;
    s.possession.lastTouch = who;
    s.controlled[0] = who;

    playTick(
      s,
      { tick: 0, cmds: [{ tick: 0, seat: 0, dx: 0, dy: 0, verb: 'shoot', power: 1, flags: 0 }] },
      DT,
      MATCH_PROFILE,
      { 0: AVERAGE, 1: AVERAGE },
    );

    const across = Math.abs(s.ball.v.y / s.ball.v.x) * 22;
    expect(across, 'the match handed her shot no aim error at all').toBeGreaterThan(3.5);
  });
});
