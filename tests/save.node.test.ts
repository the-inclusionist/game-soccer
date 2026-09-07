// SPDX-License-Identifier: AGPL-3.0-or-later
// THE KEEPER GETS A HAND TO IT.
//
// ========================= THE GATE THAT EXISTS FOR THE CORNERS =========================
// Six whole matches produced ZERO corners, against football's ten a match, and the reason was not the
// corner rule - that has been written and gated since the referee existed. Nothing in the game could
// produce one: `receiverFor` only passes forward, the keeper's clearance goes forward, and there was no
// save model at all, so a shot was binary. He caught everything he could touch and everything else went
// in. A keeper who never spills never concedes a corner.
//
// ⚠️ AND THE SAVE IS GEOMETRY. ADR-0049 asks that every outcome be deterministic, and a save is exactly
// where a game reaches for a random number. Whether he holds it depends on how close it is; where a parry
// goes depends on where it was. Both are things a child can watch and learn from.
import { describe, expect, it } from 'vitest';
import { createMatchState } from '../app/js/sim/state.ts';
import { MATCH_PROFILE } from '../app/js/rules/profile.ts';
import { AWAY, HOME, SQUAD_SIZE, firstOf } from '../app/js/sim/ids.ts';
import { NOBODY } from '../app/js/sim/possession.ts';
import { KEEPER_REACH, keeperSave } from '../app/js/sim/save.ts';
import { PITCH } from '../app/js/sim/units.ts';

/**
 * A shot arriving at the away keeper, `off` metres to one side of him, at `speed`.
 *
 * Away defends the far line in the first period, so a ball behind him is a larger `x`. Everybody else is
 * parked at the other end: this file is about one body.
 */
function shotAt(off: number, speed = 26) {
  const s = createMatchState(MATCH_PROFILE);
  s.phase = 'live';
  for (let k = 0; k < SQUAD_SIZE; k++) {
    s.players[firstOf(HOME) + k].p = { x: 10, y: 50 };
    s.players[firstOf(AWAY) + k].p = { x: 10, y: 4 };
  }
  const keeper = firstOf(AWAY);
  s.players[keeper].p = { x: PITCH.length - 1, y: PITCH.width / 2 };
  s.ball.p = { x: PITCH.length - 1, y: PITCH.width / 2 + off, z: 0 };
  s.ball.v = { x: speed, y: 0, z: 0 };
  s.ball.grounded = true;
  s.possession.holder = NOBODY;
  s.possession.lastTouch = firstOf(HOME) + 9;
  return { s, keeper };
}

describe('a shot the keeper can only reach', () => {
  // ⚠️ THE FIRST VERSION OF THIS FILE ASSERTED THE OPPOSITE, and the whole point was lost in it. It asked
  //    that the ball be pushed straight back out from the goal's centre - which is the one direction
  //    guaranteed to keep it in play, so six more matches produced six more nil corners. A keeper who
  //    reaches a ball he cannot hold gets a hand ACROSS it: it carries on, wider and slower.
  it('[Right] carries on past him, with two thirds of the pace taken off it', () => {
    const { s } = shotAt(1.6);

    keeperSave(s);

    expect(s.ball.v.x, 'he punched it back where it came from').toBeGreaterThan(0);
    expect(s.ball.v.x, 'the shot went through him unchanged').toBeLessThan(26 / 2);
  });

  // ⚠️ AND THIS IS THE CORNER. A ball heading just inside the post goes just outside it, which is a save
  //    and a corner at once - and a ball already heading wide goes wider and is a corner because he
  //    touched it, where untouched it would have been a goal kick.
  it('[Right] and is turned outward, away from the middle of his goal', () => {
    const { s } = shotAt(1.6);

    keeperSave(s);

    expect(Math.abs(s.ball.v.y), 'he got no hand across it at all').toBeGreaterThan(
      Math.abs(s.ball.v.x) / 2,
    );
  });

  // ⚠️ THE HALF THAT MAKES IT A CORNER. `rules/out-of-play` tells a corner from a goal kick by whose touch
  //    sent the ball over, so a parry nobody recorded would award the goal kick to the side attacking.
  it('[Right] and he is the last man to touch it', () => {
    const { s, keeper } = shotAt(1.6);

    keeperSave(s);

    expect(s.possession.lastTouch).toBe(keeper);
    expect(s.possession.holder).toBe(NOBODY);
  });

  it('[Right] and it still has pace on it, or a parry is a tap-in', () => {
    const { s } = shotAt(1.6);

    keeperSave(s);

    const away = Math.sqrt(s.ball.v.x * s.ball.v.x + s.ball.v.y * s.ball.v.y);
    expect(away, 'the ball died in the six-yard box in front of him').toBeGreaterThan(6);
  });
});

describe('and what he does not touch', () => {
  it('[Zero] a shot at his chest is held, not palmed away', () => {
    const { s } = shotAt(0.3);
    const before = { ...s.ball.v };

    keeperSave(s);

    expect(s.ball.v, 'he flicked away a ball he had in his hands').toEqual(before);
  });

  it('[Zero] and a shot he cannot reach goes past him untouched', () => {
    const { s } = shotAt(KEEPER_REACH + 0.1);
    const before = { ...s.ball.v };

    keeperSave(s);

    expect(s.ball.v).toEqual(before);
  });

  // ⚠️ A KEEPER WHO PALMED AWAY EVERY ROLLING BALL WOULD NEVER HOLD ANYTHING, and a goal kick would become
  //    impossible to take: the taker walks to the ball, touches it, and it would fly off him.
  it('[Zero] a ball rolling gently to him is not a save at all', () => {
    const { s } = shotAt(1.6, 4);
    const before = { ...s.ball.v };

    keeperSave(s);

    expect(s.ball.v).toEqual(before);
  });

  it('[Zero] and the keeper at the other end is not involved', () => {
    const { s } = shotAt(1.6);

    keeperSave(s);

    expect(s.possession.lastTouch).not.toBe(firstOf(HOME));
  });
});

describe('the direction it goes', () => {
  // ⚠️ AWAY FROM THE GOAL AND NOT SIMPLY SIDEWAYS, which is what makes a parry near the post cross the
  //    line beside it. The line from the goal's centre through the ball is the only direction that is
  //    right at every angle - straight out from the middle, and increasingly sideways towards the posts.
  it('[Right] a ball reached to his left goes further left, and to his right further right', () => {
    const left = shotAt(-1.6);
    const right = shotAt(1.6);

    keeperSave(left.s);
    keeperSave(right.s);

    expect(left.s.ball.v.y).toBeLessThan(0);
    expect(right.s.ball.v.y).toBeGreaterThan(0);
  });

  // ⚠️ AND THE ENDS SWAP AT HALF TIME, so which goal he is protecting is a fact about the PERIOD. Reading
  //    it off the team id alone would have him palm every second-half shot into his own net.
  it('[Boundary] and he turns it outward at the other end too, in the second half', () => {
    const { s } = shotAt(1.6);
    s.period = 2;
    s.players[firstOf(AWAY)].p = { x: 1, y: PITCH.width / 2 };
    s.ball.p = { x: 1, y: PITCH.width / 2 + 1.6, z: 0 };
    s.ball.v = { x: -26, y: 0, z: 0 };

    keeperSave(s);

    // Still going the way it was, still turned away from the middle of the goal he is defending now.
    expect(s.ball.v.x).toBeLessThan(0);
    expect(s.ball.v.y).toBeGreaterThan(0);
  });
});
