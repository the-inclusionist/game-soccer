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
import { judgeTackle, RECKLESS_FRACTION, VIOLENT_FRACTION } from '../app/js/rules/foul.ts';
import { DEFAULT_CAPS } from '../app/js/sim/body.ts';

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
// ========================= AND AGAINST WHAT SCALE =========================
// ⚠️ THE THRESHOLDS WERE CALIBRATED AGAINST A QUANTITY THAT NO LONGER EXISTS. `5.5` and `9` were chosen
// when severity was the plain RELATIVE speed of two bodies, which adds: two players meeting head-on at six
// metres a second made twelve. Grading on what the tackler BROUGHT caps the number at his own top speed -
// and no body in this game can exceed 7.6.
//
// So `9` became unreachable and `5.5` became routine. Measured over six whole matches: ZERO violent
// challenges, and twenty of twenty-eight fouls reckless, where football books about one foul in twelve.
// The presser's own speed when he fouls has a median of 6.65, so a threshold at 5.5 says "any challenge
// made at a run is a booking".
//
// ⚠️ AND THE SCALE IS THE TACKLER'S OWN TOP SPEED, not a number in metres. A fixed threshold books a quick
// club more often than a slow one for the identical act, which is a rating punishing the child who chose
// the badge with pace on it - and `capsFor` spreads top speed from 6.2 to 7.6, so the same challenge is a
// card for one club and a free kick for another. As a fraction, "flat out" means the same thing to
// everybody, which is the only version that is fair AND that a child can be taught in a sentence.
describe('the scale a challenge is judged against', () => {
  /** The severity of a lunge at `speed` by a body whose own top speed is `top`. */
  function gradedAt(speed: number, top = DEFAULT_CAPS.maxSpeed) {
    const { s } = lunge(speed);
    return judgeTackle(s, TACKLER, MATCH_PROFILE, top)?.severity;
  }

  it('[Right] going in at three-quarters of your pace is a free kick, not a card', () => {
    expect(gradedAt(0.75 * DEFAULT_CAPS.maxSpeed)).toBe('careless');
  });

  // ⚠️ 0.85 IS THE BAND THIS WHOLE CHANGE MOVES. At the old fixed 5.5 a challenge at 5.87 was a booking;
  //    a defender running at 85% of what he can do is going in hard and is not being reckless with
  //    anybody, and twenty of twenty-eight machine fouls were landing in exactly this band.
  it('[Right] and so is going in at eighty-five per cent of it', () => {
    expect(gradedAt(0.85 * DEFAULT_CAPS.maxSpeed)).toBe('careless');
  });

  it('[Right] but flat out is a booking', () => {
    expect(gradedAt(DEFAULT_CAPS.maxSpeed)).toBe('reckless');
  });

  // ⚠️ AND A SENDING-OFF NEEDS MORE THAN A BODY CAN RUN, which is what makes it mean something. Sprint is
  //    the only thing in the game that takes a body past its own top speed, so a straight red is a
  //    SPRINTING lunge and nothing else - one sentence, and a child can be taught it.
  it('[Right] and only a sprinting lunge is violent', () => {
    expect(gradedAt(1.1 * DEFAULT_CAPS.maxSpeed)).toBe('reckless');
    expect(gradedAt(1.2 * DEFAULT_CAPS.maxSpeed)).toBe('violent');
  });

  // ⚠️ THE FAIRNESS GATE, and the reason the scale is a fraction at all. The same act by a quick club and a
  //    slow one gets the same card. Against a fixed threshold in metres it does not: 6.4 was a booking for
  //    the slow club and nothing for the quick one, for identical football.
  it('[Zero] a quick club and a slow one get the same card for the same act', () => {
    const quick = 7.6;
    const slow = 6.2;

    expect(gradedAt(0.9 * quick, quick)).toBe(gradedAt(0.9 * slow, slow));
    expect(gradedAt(1.0 * quick, quick)).toBe(gradedAt(1.0 * slow, slow));
  });
});

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
    expect(severityAt(RECKLESS_FRACTION * DEFAULT_CAPS.maxSpeed)).toBe('reckless');
    expect(severityAt(RECKLESS_FRACTION * DEFAULT_CAPS.maxSpeed - 0.01)).toBe('careless');
  });

  it('[Boundary] and at the violent speed it is violent', () => {
    expect(severityAt(VIOLENT_FRACTION * DEFAULT_CAPS.maxSpeed)).toBe('violent');
    expect(severityAt(VIOLENT_FRACTION * DEFAULT_CAPS.maxSpeed - 0.01)).toBe('reckless');
  });

  it('[Interface] the three grades are ordered, and both thresholds are reachable', () => {
    expect(RECKLESS_FRACTION).toBeGreaterThan(0);
    expect(RECKLESS_FRACTION).toBeLessThan(VIOLENT_FRACTION);
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

// ========================= ⚠️ WHO THE CHALLENGE WAS AGAINST =========================
// Measured 2026-09-11 over the six-fixture slate with a child playing: THIRTEEN OF THIRTY-TWO FOULS were
// given against a player who was not carrying the ball, and the median speed the tackler brought at those
// men was 0.030 of his own top speed. The fouls on the actual carrier read 0.905 in the same slate.
//
// ⚠️ AND THE CAUSE IS TWO MODULES DISAGREEING ABOUT WHO WAS BEING CHALLENGED. `ai/brain.challenger`
// returns a presser because he is going in ON THE CARRIER; `judgeTackle` then looks around him and books
// him for whoever is NEAREST. Those are different men, and they are systematically different: this
// function refuses a challenge that reached the ball, so a challenge that gets here is more than a metre
// and a half from the ball - which is more than a metre and a half from the man holding it. The carrier is
// usually not even a candidate. The bystander is not an unlucky edge case; he is what the search finds.
//
// ⚠️ THE CHILD'S LUNGE IS THE OTHER CASE AND IT IS NOT THE SAME ACT. She presses tackle at whatever is in
// front of her and does not name anybody, so whoever she catches is who she caught. The caller knows which
// of the two acts it is, and that is why this is an argument rather than a rule inside the search.
describe('who the challenge was against', () => {
  /** A tackler going in on a man 1.2 m away, with a bystander standing nearer and moving with him. */
  function pastABystander() {
    const s = live();
    const target = firstOf(AWAY) + 5;
    const bystander = firstOf(AWAY) + 6;
    for (let k = 0; k < SQUAD_SIZE; k++) s.players[firstOf(AWAY) + k].p = { x: 80, y: 50 };
    s.players[TACKLER].p = { x: 45, y: 28 };
    s.players[TACKLER].v = { x: 7, y: 0 };
    s.players[target].p = { x: 46.2, y: 28 };
    s.players[target].v = { x: 0, y: 0 };
    s.players[bystander].p = { x: 45, y: 28.4 };
    s.players[bystander].v = { x: 7, y: 0 };
    s.ball.p = { x: 5, y: 5, z: 0 };
    return { s, target, bystander };
  }

  it('[Right] a named man is the man fouled, even when somebody else is nearer', () => {
    const { s, target, bystander } = pastABystander();

    const foul = judgeTackle(s, TACKLER, MATCH_PROFILE, DEFAULT_CAPS.maxSpeed, target);

    expect(foul?.on, 'the foul was given against a man nobody went in on').toBe(target);
    expect(foul?.on).not.toBe(bystander);
  });

  // ⚠️ [Zero] AND THE WHOLE POINT IS THAT THIS IS NOT A FOUL AT ALL. A presser who went in on the carrier
  //    and did not reach him has caught nobody - and the bystander he happens to be walking beside is not
  //    a free kick. This is the case the slate was full of.
  it('[Zero] and if he never reached the named man there is no foul, however near anybody else is', () => {
    const { s, target } = pastABystander();
    s.players[target].p = { x: 55, y: 28 };

    expect(judgeTackle(s, TACKLER, MATCH_PROFILE, DEFAULT_CAPS.maxSpeed, target)).toBeNull();
  });

  it('[Zero] a named team-mate is not a foul either', () => {
    const { s } = pastABystander();
    const mate = firstOf(HOME) + 6;
    s.players[mate].p = { x: 45.4, y: 28 };

    expect(judgeTackle(s, TACKLER, MATCH_PROFILE, DEFAULT_CAPS.maxSpeed, mate)).toBeNull();
  });

  // ⚠️ AND NAMING NOBODY IS THE CHILD'S LUNGE, which must keep working exactly as it did.
  it('[Right] naming nobody still finds whoever he caught', () => {
    const { s, bystander } = pastABystander();

    expect(judgeTackle(s, TACKLER, MATCH_PROFILE)?.on).toBe(bystander);
  });
});
