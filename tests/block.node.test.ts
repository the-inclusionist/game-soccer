// SPDX-License-Identifier: AGPL-3.0-or-later
// A BODY IN THE WAY OF A STRUCK BALL.
//
// ⚠️ THIS MODULE HAD NO GATE OF ITS OWN AT ALL until 2026-09-07. It was covered only by what a whole
// match happened to do, which is coverage of the match rather than of the rule - and `sim/block` decides
// whether a shot becomes a corner, which is one of the counts the Dev asked for more of.
import { describe, expect, it } from 'vitest';
import { blockBall, CONTROL_SPEED } from '../app/js/sim/block.ts';
import { createMatchState } from '../app/js/sim/state.ts';
import { AWAY, HOME, SQUAD_SIZE, firstOf } from '../app/js/sim/ids.ts';
import { NOBODY } from '../app/js/sim/possession.ts';

/** A struck ball arriving on a defender who is standing exactly where it is. */
function shotInto(blockerAt: { x: number; y: number }, v: { x: number; y: number }) {
  const s = createMatchState();
  s.phase = 'live';
  for (let k = 0; k < SQUAD_SIZE; k++) {
    s.players[firstOf(HOME) + k].p = { x: 5, y: 5 };
    s.players[firstOf(AWAY) + k].p = { x: 5, y: 52 };
  }
  const blocker = firstOf(AWAY) + 4;
  s.players[blocker].p = { ...blockerAt };
  s.ball.p = { x: blockerAt.x, y: blockerAt.y, z: 0 };
  s.ball.v = { x: v.x, y: v.y, z: 0 };
  s.lastStruck = NOBODY;
  return { s, blocker };
}

const speedOf = (s: ReturnType<typeof createMatchState>) =>
  Math.sqrt(s.ball.v.x * s.ball.v.x + s.ball.v.y * s.ball.v.y);

describe('what a block does', () => {
  it('[Zero] a ball travelling slowly enough to be played is not blocked', () => {
    const { s } = shotInto({ x: 80, y: 28 }, { x: CONTROL_SPEED - 1, y: 0 });
    const was = { ...s.ball.v };

    blockBall(s);

    expect(s.ball.v).toEqual(was);
  });

  it('[Right] a struck ball has most of its pace taken off it', () => {
    const { s } = shotInto({ x: 80, y: 28 }, { x: 24, y: 0 });

    blockBall(s);

    expect(speedOf(s)).toBeLessThan(24 * 0.6);
    expect(speedOf(s), 'the block swallowed it whole').toBeGreaterThan(0);
  });

  // ⚠️ HE IS THE LAST TOUCHER, AND THAT IS WHAT MAKES IT A CORNER. `rules/out-of-play` tells a corner
  //    from a goal kick by whose touch sent it over the line, and nothing else.
  it('[Interface] the blocker is recorded as having touched it', () => {
    const { s, blocker } = shotInto({ x: 80, y: 28 }, { x: 24, y: 0 });

    blockBall(s);

    expect(s.possession.lastTouch).toBe(blocker);
    expect(s.possession.holder, 'he caught it rather than blocking it').toBe(NOBODY);
  });

  it('[Zero] and he cannot pick up his own block on the next tick', () => {
    const { s, blocker } = shotInto({ x: 80, y: 28 }, { x: 24, y: 0 });

    blockBall(s);

    expect(s.lastStruck).toBe(blocker);
  });

  it('[Zero] the man who struck it is not standing in his own shot', () => {
    const { s, blocker } = shotInto({ x: 80, y: 28 }, { x: 24, y: 0 });
    s.lastStruck = blocker;
    const was = { ...s.ball.v };

    blockBall(s);

    expect(s.ball.v).toEqual(was);
  });
});
