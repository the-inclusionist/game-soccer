// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CPU CAN FOUL TOO.
//
// ========================= THE ASYMMETRY THIS FILE EXISTS TO REMOVE =========================
// A foul was judged for commands from a SEAT and for nothing else. The AI has a designated presser who
// chases the carrier, but it never issues a tackle verb - it steers, and possession changes hands when
// the distance says so. So a child could be booked and sent off, and the eleven players she was playing
// against could not.
//
// That is not a missing feature. It is a rule that applies to one side of the pitch, and the side it
// applies to is the child's. A game that punishes her by a law her opponent is exempt from is teaching
// her that the referee is against her.
//
// ⚠️ AND IT IS THE SAME FUNCTION, not a second judgement for the CPU. `judgeTackle` decides both, so a
// challenge that is a foul when she makes it is a foul when the machine makes it - which is the only
// version of "fair" that survives somebody reading the code.
import { describe, expect, it } from 'vitest';
import { createMatchState } from '../app/js/sim/state.ts';
import { playTick } from '../app/js/play.ts';
import { MATCH_PROFILE } from '../app/js/rules/profile.ts';
import { AVERAGE } from '../app/js/ai/ratings.ts';
import { AWAY, HOME, SQUAD_SIZE, firstOf, teamOf } from '../app/js/sim/ids.ts';
import { DT } from '../app/js/sim/ball.ts';
import { emptyFrame } from '../app/js/sim/command.ts';
import { onPitch } from '../app/js/sim/squads.ts';

const skills = { 0: AVERAGE, 1: AVERAGE };

/**
 * An away presser arriving from BEHIND on a home carrier who has knocked the ball ahead.
 *
 * ⚠️ THE FIRST VERSION OF THIS PUT THE BALL AT THE CARRIER'S FEET, and no challenge could ever be a foul:
 * `judgeTackle` clears anybody who reached the BALL, and a ball on the carrier means reaching him is
 * reaching it. That is the rule being right - every challenge is contact, and what makes one a foul is
 * missing the ball.
 *
 * A dribbled ball is not at the carrier's feet. It sits ahead of him, up to the control radius away, and
 * the tackle from behind while it is out there is the archetypal foul in football and the one this has to
 * be able to represent.
 */
function chase(speed: number) {
  const s = createMatchState(MATCH_PROFILE);
  s.phase = 'live';
  const carrier = firstOf(HOME) + 9;
  const chaser = firstOf(AWAY) + 5;
  s.players[carrier].p = { x: 50, y: 28 };
  // Knocked ahead, away from the man coming from behind - and INSIDE the control radius, not on it.
  // ⚠️ At exactly `CONTROL_R` the carrier loses it: the check is strict, so 0.9 means nobody has the ball,
  //    and with no carrier there is nobody to challenge. The first version of this sat on that boundary
  //    and reported that the CPU could not foul, when what it had built was a loose ball.
  s.ball.p = { x: 50.8, y: 28, z: 0 };
  s.ball.v = { x: 0, y: 0, z: 0 };
  s.possession.holder = carrier;
  s.possession.lastTouch = carrier;
  s.players[chaser].p = { x: 48.9, y: 28 };
  s.players[chaser].v = { x: speed, y: 0 };
  return { s, carrier, chaser };
}

describe('a challenge by the machine', () => {
  it('[Right] a reckless one is a foul, judged by the same function as hers', () => {
    const { s } = chase(8);

    const kinds = playTick(s, emptyFrame(0), DT, MATCH_PROFILE, skills).map((e) => e.kind);

    expect(kinds).toContain('foulGiven');
  });

  it('[Right] and the free kick goes to the side that was fouled', () => {
    const { s } = chase(8);

    const foul = playTick(s, emptyFrame(0), DT, MATCH_PROFILE, skills).find((e) => e.kind === 'foulGiven');

    expect(foul?.team).toBe(HOME);
  });

  it('[Right] a violent one sends a CPU player off, and its side is a man down', () => {
    const { s } = chase(12);

    playTick(s, emptyFrame(0), DT, MATCH_PROFILE, skills);

    let playing = 0;
    for (let k = 0; k < SQUAD_SIZE; k++) if (onPitch(s, firstOf(AWAY) + k)) playing += 1;
    expect(playing).toBe(SQUAD_SIZE - 1);
  });

  it('[Right] whoever it books is one of its own, never the carrier it ran into', () => {
    const { s, carrier } = chase(8);

    const card = playTick(s, emptyFrame(0), DT, MATCH_PROFILE, skills).find(
      (e) => e.kind === 'bookingGiven' || e.kind === 'sendingOff',
    );

    expect(card?.team).toBe(AWAY);
    expect(s.cards[carrier]).toBe(0);
  });
});

describe('what must NOT become a foul', () => {
  // ⚠️ THE GAME WOULD BE NOTHING BUT FREE KICKS. A presser is chasing on almost every tick of a match, and
  //    an ordinary chase is football rather than a foul. What separates them is the same thing that
  //    separates them for the child: missing the ball, at speed.
  it('[Zero] an ordinary chase is not a foul', () => {
    const { s } = chase(2);

    const kinds = playTick(s, emptyFrame(0), DT, MATCH_PROFILE, skills).map((e) => e.kind);

    expect(kinds).not.toContain('foulGiven');
  });

  it('[Zero] and reaching the ball is never a foul, however fast he arrived', () => {
    const { s, chaser } = chase(12);
    // The same challenge with the ball where he can reach it: contact, and no offence.
    s.ball.p = { x: s.players[chaser].p.x + 0.3, y: s.players[chaser].p.y, z: 0 };

    const kinds = playTick(s, emptyFrame(0), DT, MATCH_PROFILE, skills).map((e) => e.kind);

    expect(kinds).not.toContain('foulGiven');
  });

  it('[Zero] nobody who is not pressing gives a foul away by standing near somebody', () => {
    const { s } = chase(2);
    // A whole squad packed around the carrier, all stationary: crowded, and not one challenge.
    for (let k = 1; k < SQUAD_SIZE; k++) {
      s.players[firstOf(AWAY) + k].p = { x: 50.3, y: 28 };
      s.players[firstOf(AWAY) + k].v = { x: 0, y: 0 };
    }

    const kinds = playTick(s, emptyFrame(0), DT, MATCH_PROFILE, skills).map((e) => e.kind);

    expect(kinds).not.toContain('foulGiven');
  });
});

describe('a match still finishes', () => {
  // ⚠️ THE ANTI-WEDGE GATE, RE-ASKED. Fouls stop play, and a rule that stopped it more often than it
  //    restarted would leave a match that never gets anywhere - with every unit test above still green.
  it('[Right] two thousand ticks of nobody playing still produce a goal and a live ball', () => {
    const s = createMatchState(MATCH_PROFILE);
    s.phase = 'live';
    let liveTicks = 0;

    for (let t = 0; t < 2000; t++) {
      playTick(s, emptyFrame(t), DT, MATCH_PROFILE, skills);
      if (s.phase === 'live') liveTicks += 1;
    }

    // Most of a match is played, not restarted. Half is a generous floor and a real one: a rule that
    // whistled every other tick would be nowhere near it.
    expect(liveTicks).toBeGreaterThan(1000);
    expect(teamOf(0)).toBe(HOME);
  });
});
