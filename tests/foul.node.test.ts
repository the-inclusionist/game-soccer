// SPDX-License-Identifier: AGPL-3.0-or-later
// FOULS, CARDS AND PENALTIES.
//
// ========================= WHY THIS FILE EXISTS, WHICH IS A CORRECTION =========================
// These were listed as out of scope "by decision" for the whole of this game's life. The decision was
// MINE - it sits in the plan under what the Dev could revert - and the README stated it as though it had
// been his, beside two genuine third-party-rights exclusions, which lent it a weight it never had. He
// asked when he had decided that. He had not.
//
// ========================= WHERE A FOUL LIVES =========================
// A tackle out of reach of the BALL does nothing today: the lunge costs the child nothing at all. That is
// exactly where a foul is - the tackler missed the ball and there was somebody standing there.
//
// ⚠️ AND SEVERITY IS DETERMINISTIC, which ADR-0049 requires and which is also the only way this can be
// FAIR. A card decided by a dice roll is a card a child cannot learn to avoid; decided by how fast she
// went in, it is a rule she can be taught in one sentence.
import { describe, expect, it } from 'vitest';
import { createMatchState } from '../app/js/sim/state.ts';
import { MATCH_PROFILE } from '../app/js/rules/profile.ts';
import { AWAY, HOME, SQUAD_SIZE, firstOf } from '../app/js/sim/ids.ts';
import { BOX, PITCH } from '../app/js/sim/units.ts';
import { judgeTackle, RECKLESS_SPEED, VIOLENT_SPEED } from '../app/js/rules/foul.ts';

const live = () => {
  const s = createMatchState(MATCH_PROFILE);
  s.phase = 'live';
  return s;
};

const TACKLER = firstOf(HOME) + 5;

/** A home tackler on top of an away victim, closing at `speed`, with the ball far away. */
function lunge(speed: number, at = { x: 45, y: 28 }) {
  const s = live();
  const on = firstOf(AWAY) + 5;
  for (let k = 0; k < SQUAD_SIZE; k++) s.players[firstOf(AWAY) + k].p = { x: 80, y: 50 };
  s.players[TACKLER].p = { x: at.x, y: at.y };
  s.players[TACKLER].v = { x: speed, y: 0 };
  s.players[on].p = { x: at.x + 0.4, y: at.y };
  s.players[on].v = { x: 0, y: 0 };
  s.ball.p = { x: 5, y: 5, z: 0 };
  return { s, on };
}

/**
 * A home body and an away body on top of each other, each moving at the velocity given, ball far away.
 *
 * The pair above fixes the victim still and moves only the tackler, which cannot ask the question below:
 * WHOSE speed the card is being written for.
 */
function collide(mine: { x: number; y: number }, theirs: { x: number; y: number }) {
  const s = live();
  const on = firstOf(AWAY) + 5;
  for (let k = 0; k < SQUAD_SIZE; k++) s.players[firstOf(AWAY) + k].p = { x: 80, y: 50 };
  s.players[TACKLER].p = { x: 45, y: 28 };
  s.players[TACKLER].v = { ...mine };
  s.players[on].p = { x: 45.4, y: 28 };
  s.players[on].v = { ...theirs };
  s.ball.p = { x: 5, y: 5, z: 0 };
  return s;
}

// ========================= WHOSE SPEED THE CARD IS WRITTEN FOR =========================
// This file's own header says severity is "how fast she went in", and the module says it more precisely:
// *"A player standing still whom somebody runs into has not committed anything; two players jogging
// together at the same pace have not either."*
//
// ⚠️ THE SECOND HALF WAS IMPLEMENTED AND THE FIRST HALF WAS NOT, and nothing asked. Relative closing speed
// makes two players jogging together harmless, correctly - and it books a defender who is STANDING STILL
// when an attacker runs into him at seven metres a second, because the subtraction cannot tell which of
// the two was moving.
//
// Measured over three whole matches: every foul the machine gave away was judged on a closing speed with a
// median of 7.2 and a seventy-fifth percentile of 10, while no BODY in the game can exceed 7.2. Those
// numbers are two players running at each other, and running at each other is what a striker and a
// defender do. Thirty-one per cent of all fouls came out red.
describe('and whose speed it was', () => {
  it('[Zero] a defender standing still whom an attacker runs into is not booked', () => {
    const s = collide({ x: 0, y: 0 }, { x: -8, y: 0 });

    const foul = judgeTackle(s, TACKLER, MATCH_PROFILE);

    expect(foul, 'a man who did not move gave nothing away').not.toBeNull();
    expect(foul?.severity, 'he was booked for somebody else running into him').toBe('careless');
  });

  it('[Zero] and two players running the same way at the same pace is still nothing', () => {
    const s = collide({ x: 7, y: 0 }, { x: 7, y: 0 });

    expect(judgeTackle(s, TACKLER, MATCH_PROFILE)?.severity).toBe('careless');
  });

  // ⚠️ AND THE HEAD-ON CASE IS THE ONE THAT MADE EVERY MATCH A SENDING-OFF FESTIVAL. Two players at six
  //    metres a second, one each way, close at twelve - past the violent threshold - while neither is
  //    doing anything a referee would look at twice.
  it('[Boundary] two players meeting head-on at a normal pace is not violent conduct', () => {
    const s = collide({ x: 6, y: 0 }, { x: -6, y: 0 });

    expect(judgeTackle(s, TACKLER, MATCH_PROFILE)?.severity).not.toBe('violent');
  });

  it('[Right] but a man who flies in at full speed is still reckless', () => {
    const s = collide({ x: 7, y: 0 }, { x: 0, y: 0 });

    const foul = judgeTackle(s, TACKLER, MATCH_PROFILE);

    expect(foul?.severity, 'sprinting into a standing man cost nothing').not.toBe('careless');
  });

  // ⚠️ AND SIDEWAYS IS NOT GOING IN. A defender crossing the front of an attacker at speed is not
  //    challenging him; the speed that matters is the part of it aimed AT the man he hits.
  it('[Boundary] a man running across an opponent is not going in on him', () => {
    const s = collide({ x: 0, y: 8 }, { x: 0, y: 0 });

    expect(judgeTackle(s, TACKLER, MATCH_PROFILE)?.severity).toBe('careless');
  });
});

describe('when a tackle is a foul', () => {
  it('[Right] a lunge that misses the ball and hits a player is a foul', () => {
    const { s, on } = lunge(2);

    const foul = judgeTackle(s, TACKLER, MATCH_PROFILE);

    expect(foul).not.toBeNull();
    expect(foul?.by).toBe(TACKLER);
    expect(foul?.on).toBe(on);
  });

  it('[Zero] a lunge at nobody is not a foul, it is just a lunge', () => {
    const s = live();
    s.players[TACKLER].p = { x: 45, y: 28 };
    for (let k = 0; k < SQUAD_SIZE; k++) s.players[firstOf(AWAY) + k].p = { x: 5, y: 50 };
    s.ball.p = { x: 5, y: 5, z: 0 };

    expect(judgeTackle(s, TACKLER, MATCH_PROFILE)).toBeNull();
  });

  // ⚠️ THE ONE THAT KEEPS THE GAME PLAYABLE. Every challenge is contact; if contact were a foul, a child
  //    would be penalised for playing football. What makes it a foul is missing the BALL.
  it('[Zero] a tackle that reaches the ball is not a foul, however close the opponent is', () => {
    const { s } = lunge(2);
    s.ball.p = { x: s.players[TACKLER].p.x + 0.3, y: s.players[TACKLER].p.y, z: 0 };

    expect(judgeTackle(s, TACKLER, MATCH_PROFILE)).toBeNull();
  });

  it('[Zero] and a team-mate is not an opponent', () => {
    const { s } = lunge(2);
    for (let k = 0; k < SQUAD_SIZE; k++) s.players[firstOf(AWAY) + k].p = { x: 80, y: 50 };
    s.players[firstOf(HOME) + 6].p = { x: s.players[TACKLER].p.x + 0.4, y: s.players[TACKLER].p.y };

    expect(judgeTackle(s, TACKLER, MATCH_PROFILE)).toBeNull();
  });

  it('[Zero] a profile with the laws switched off gives no fouls at all', () => {
    const { s } = lunge(9);

    expect(judgeTackle(s, TACKLER, { ...MATCH_PROFILE, fouls: false })).toBeNull();
  });
});

describe('how bad it was', () => {
  const severityAt = (speed: number) => judgeTackle(lunge(speed).s, TACKLER, MATCH_PROFILE)?.severity;

  it('[Right] the same challenge always earns the same card', () => {
    expect(severityAt(6)).toBe(severityAt(6));
  });

  it('[Right] a slow challenge is careless - a free kick and no card', () => {
    expect(severityAt(1)).toBe('careless');
  });

  it('[Boundary] at the reckless speed it is reckless, and just under it is not', () => {
    expect(severityAt(RECKLESS_SPEED)).toBe('reckless');
    expect(severityAt(RECKLESS_SPEED - 0.01)).toBe('careless');
  });

  it('[Boundary] and at the violent speed it is violent', () => {
    expect(severityAt(VIOLENT_SPEED)).toBe('violent');
    expect(severityAt(VIOLENT_SPEED - 0.01)).toBe('reckless');
  });

  it('[Interface] the three grades are ordered, and both thresholds are reachable', () => {
    expect(RECKLESS_SPEED).toBeGreaterThan(0);
    expect(RECKLESS_SPEED).toBeLessThan(VIOLENT_SPEED);
  });
});

describe('a foul in the box', () => {
  // Home defends x = 0 in the first period, so a foul BY home near x = 0 is inside its own area.
  it('[Right] a defender fouling inside his own area gives a penalty', () => {
    const { s } = lunge(2, { x: BOX.depth - 3, y: PITCH.width / 2 });

    expect(judgeTackle(s, TACKLER, MATCH_PROFILE)?.inBox).toBe(true);
  });

  it('[Zero] the same foul a metre outside the area is a free kick', () => {
    const { s } = lunge(2, { x: BOX.depth + 1, y: PITCH.width / 2 });

    expect(judgeTackle(s, TACKLER, MATCH_PROFILE)?.inBox).toBe(false);
  });

  // ⚠️ THE AREA IS A RECTANGLE AND NOT A DISTANCE. A foul level with the goal but out by the touchline is
  //    outside it, and a check on distance-from-goal would call that a penalty.
  it('[Zero] and wide of the area is outside it, however near the goal line', () => {
    const { s } = lunge(2, { x: 2, y: 2 });

    expect(judgeTackle(s, TACKLER, MATCH_PROFILE)?.inBox).toBe(false);
  });

  it('[Zero] a foul at the far end is not a penalty against the side that did not commit it', () => {
    const { s } = lunge(2, { x: PITCH.length - 5, y: PITCH.width / 2 });

    expect(judgeTackle(s, TACKLER, MATCH_PROFILE)?.inBox).toBe(false);
  });
});
