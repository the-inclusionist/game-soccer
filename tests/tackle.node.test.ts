// SPDX-License-Identifier: AGPL-3.0-or-later
// A CHALLENGE THAT IS NOT A FOUL TAKES THE BALL.
//
// ========================= THE HOLE THE COUNTS POINTED AT =========================
// `ai/brain.challenger` says who went in, and `rules/foul.judgeTackle` says whether it was a foul. If it
// was NOT a foul, nothing happened at all: the defender ran through the carrier and the carrier kept the
// ball. So this game has never had a tackle that WINS anything, and the machine could take the ball off
// nobody - possession only ever changed when a dribbling touch strayed far enough to be collected.
//
// ⚠️ AND IT IS WHY EIGHT COUNTS MISS AT ONCE. Measured against the Dev's seven-minute bands, the match is
// short of goals, corners, goal kicks, fouls, yellows and offsides and long on throw-ins - and the
// crossings themselves say a body is within a metre of the ball, closing at 6 m/s, on 100 of 101 of them.
// Football's throw-in comes off a DEFLECTION, and a deflection is what a tackle makes. One missing
// behaviour, not eight wrong constants - the same shape as the day `decideKick` returned null for every
// outfield player and this game had no throw-ins at all.
import { describe, expect, it } from 'vitest';
import { tackleFor, KNOCK_SPEED } from '../app/js/sim/tackle.ts';
import { createMatchState } from '../app/js/sim/state.ts';
import { AWAY, HOME, SQUAD_SIZE, firstOf } from '../app/js/sim/ids.ts';
import { NOBODY } from '../app/js/sim/possession.ts';
// ⚠️ THE NUMBER AND NOT THE RATINGS OBJECT. The layering runs sim below rules below ai, so
// `sim/tackle` cannot import `ai/ratings` - it takes the one skill it applies.
const AVERAGE_DEFENDING = 0.5;

/** A home carrier on the ball, with one away defender arriving on him. */
function challenge(closing = { x: 1, y: 0 }) {
  const s = createMatchState();
  s.phase = 'live';
  for (let k = 0; k < SQUAD_SIZE; k++) {
    s.players[firstOf(HOME) + k].p = { x: 10, y: 5 };
    s.players[firstOf(AWAY) + k].p = { x: 80, y: 50 };
  }
  const carrier = firstOf(HOME) + 7;
  const tackler = firstOf(AWAY) + 4;
  s.players[carrier].p = { x: 45, y: 28 };
  s.players[tackler].p = { x: 44, y: 28 };
  s.players[tackler].v = { x: closing.x * 5, y: closing.y * 5 };
  s.ball.p = { x: 45, y: 28, z: 0 };
  s.ball.v = { x: 0, y: 0, z: 0 };
  s.possession.holder = carrier;
  s.possession.lastTouch = carrier;
  return { s, carrier, tackler };
}

describe('a challenge that wins the ball', () => {
  it('[Right] the ball is knocked off the carrier', () => {
    const { s, tackler } = challenge();

    const knock = tackleFor(s, tackler, AVERAGE_DEFENDING);

    expect(knock, 'the tackle won nothing').not.toBeNull();
    expect(Math.sqrt(knock!.vx * knock!.vx + knock!.vy * knock!.vy)).toBeGreaterThan(0);
  });

  // ⚠️ AND IT LEAVES THE BALL LOOSE RATHER THAN HANDING IT OVER. A tackle in football squirts the ball
  //    away and both sides go after it - that scramble is where a corner comes from, and where a throw-in
  //    comes from when it reaches the touchline. A clean transfer of possession would produce neither.
  it('[Interface] it reports the tackler as the toucher, not as the new holder', () => {
    const { s, tackler } = challenge();

    expect(tackleFor(s, tackler, AVERAGE_DEFENDING)!.id).toBe(tackler);
  });

  // ⚠️ THE DIRECTION IS HIS MOMENTUM, which is both football and the only deterministic answer available.
  //    ADR-0049 leaves no room for a dice, and a ball that squirts off a tackle goes where the tackler
  //    was going - so a child can learn that coming in from the left puts the ball out to the right.
  it('[Right] the knock goes the way the tackler was travelling', () => {
    const { s, tackler } = challenge({ x: 0, y: 1 });

    const knock = tackleFor(s, tackler, AVERAGE_DEFENDING)!;

    expect(knock.vy, 'he came in going down the pitch and the ball went up it').toBeGreaterThan(0);
    expect(Math.abs(knock.vy)).toBeGreaterThan(Math.abs(knock.vx));
  });

  it('[Right] and the same challenge always knocks it the same way', () => {
    const a = challenge({ x: 0, y: 1 });
    const b = challenge({ x: 0, y: 1 });

    expect(tackleFor(a.s, a.tackler, AVERAGE_DEFENDING)).toEqual(tackleFor(b.s, b.tackler, AVERAGE_DEFENDING));
  });

  // ⚠️ A TACKLER WHO IS NOT MOVING STILL TAKES IT SOMEWHERE. A stationary defender the carrier runs into
  //    has no momentum to lend, and a knock of zero would leave the ball exactly where it was - which
  //    reads on screen as the tackle not happening at all.
  it('[Boundary] a tackler standing still still puts the ball somewhere', () => {
    const { s, tackler } = challenge({ x: 0, y: 0 });

    const knock = tackleFor(s, tackler, AVERAGE_DEFENDING)!;

    expect(Math.sqrt(knock.vx * knock.vx + knock.vy * knock.vy)).toBeCloseTo(KNOCK_SPEED, 5);
  });

  it('[Zero] there is nothing to win when nobody has the ball', () => {
    const { s, tackler } = challenge();
    s.possession.holder = NOBODY;

    expect(tackleFor(s, tackler, AVERAGE_DEFENDING)).toBeNull();
  });

  it('[Zero] and nobody tackles his own side', () => {
    const { s, carrier } = challenge();
    const mate = firstOf(HOME) + 3;
    s.players[mate].p = { x: 44, y: 28 };

    expect(tackleFor(s, mate, AVERAGE_DEFENDING), `${mate} tackled his own carrier ${carrier}`).toBeNull();
  });

  // ⚠️ A BETTER DEFENDER KNOCKS IT FURTHER FROM THE MAN HE TOOK IT FROM, which is the ratings rule this
  //    repository already lives by: a skill is applied at the point of the ACTION and never branches the
  //    cascade. The same two hundred lines play for a good defence and a poor one.
  it('[Right] a better defender wins it more decisively', () => {
    const { s, tackler } = challenge();
    const good = tackleFor(s, tackler, 0.9)!;
    const poor = tackleFor(s, tackler, 0.1)!;

    const speed = (k: typeof good) => Math.sqrt(k.vx * k.vx + k.vy * k.vy);
    expect(speed(good)).toBeGreaterThan(speed(poor));
  });

  it('[Zero] and defending 0.5 is exactly the constant, so a match with no clubs is the gated world', () => {
    const { s, tackler } = challenge({ x: 0, y: 0 });

    expect(Math.sqrt(tackleFor(s, tackler, AVERAGE_DEFENDING)!.vx ** 2)).toBeCloseTo(KNOCK_SPEED, 5);
  });
});
