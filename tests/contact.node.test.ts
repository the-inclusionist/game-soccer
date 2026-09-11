// SPDX-License-Identifier: AGPL-3.0-or-later
// NOBODY STANDS INSIDE ANYBODY.
import { describe, expect, it } from 'vitest';
import { BODY_WIDTH, separate } from '../app/js/sim/contact.ts';
import { createMatchState } from '../app/js/sim/state.ts';
import { RED } from '../app/js/rules/cards.ts';

/** Everybody parked far apart, so a fixture only contains what it puts there. */
function apart() {
  const s = createMatchState();
  s.phase = 'live';
  for (let i = 0; i < s.players.length; i++) s.players[i].p = { x: 2 + i * 3, y: 2 };
  return s;
}

const gap = (s: ReturnType<typeof apart>, i: number, j: number): number => {
  const dx = s.players[i].p.x - s.players[j].p.x;
  const dy = s.players[i].p.y - s.players[j].p.y;
  return Math.sqrt(dx * dx + dy * dy);
};

describe('two bodies in the same place', () => {
  it('[Right] are pushed apart to a body width', () => {
    const s = apart();
    s.players[3].p = { x: 45, y: 28 };
    s.players[7].p = { x: 45.2, y: 28 };

    separate(s);

    expect(gap(s, 3, 7)).toBeCloseTo(BODY_WIDTH, 6);
  });

  // ⚠️ [Zero] EXACTLY ON TOP OF EACH OTHER IS THE CASE THAT MUST NOT DIVIDE BY ZERO, and it is not
  //    hypothetical: 0.000 m is the measured minimum over a whole match. A NaN here would put two bodies
  //    nowhere at all, and every later comparison against their position would quietly answer false.
  it('[Zero] and two bodies on exactly one point are separated rather than lost', () => {
    const s = apart();
    s.players[3].p = { x: 45, y: 28 };
    s.players[7].p = { x: 45, y: 28 };

    separate(s);

    expect(Number.isFinite(s.players[3].p.x), 'a body went to NaN').toBe(true);
    expect(Number.isFinite(s.players[7].p.x), 'a body went to NaN').toBe(true);
    expect(gap(s, 3, 7)).toBeCloseTo(BODY_WIDTH, 6);
  });

  // ⚠️ BOTH MOVE, AND EQUALLY. Pushing one and not the other would make the outcome depend on iteration
  //    order - the lower index would always keep the ground - and iteration order is not a fact about
  //    football. It is also what stops this being a free tackle: the carrier is displaced as much as the
  //    man arriving.
  it('[Right] both of them move, by the same amount', () => {
    const s = apart();
    s.players[3].p = { x: 45, y: 28 };
    s.players[7].p = { x: 45.2, y: 28 };

    separate(s);

    expect(45 - s.players[3].p.x).toBeCloseTo(s.players[7].p.x - 45.2, 6);
  });

  it('[Zero] a pair already far enough apart is not touched at all', () => {
    const s = apart();
    s.players[3].p = { x: 45, y: 28 };
    s.players[7].p = { x: 45 + BODY_WIDTH + 0.01, y: 28 };

    separate(s);

    expect(s.players[3].p.x).toBe(45);
    expect(s.players[7].p.x).toBe(45 + BODY_WIDTH + 0.01);
  });

  // ⚠️ [Boundary] A SENT-OFF BODY IS NOT ON THE PITCH AND MUST NOT SHOVE ANYBODY. `onPitch` is the one
  //    function that answers "is he playing", and every list in this game is asked through it - a body
  //    that kept pushing after a red card would be an invisible player moving real ones.
  it('[Boundary] and a sent-off body pushes nobody', () => {
    const s = apart();
    s.cards[7] = RED;
    s.players[3].p = { x: 45, y: 28 };
    s.players[7].p = { x: 45, y: 28 };

    separate(s);

    expect(s.players[3].p.x, 'a player who has left the pitch moved somebody').toBe(45);
  });

  it('[Many] a crowd on one point ends with nobody on top of anybody', () => {
    const s = apart();
    for (const i of [1, 2, 3, 4, 5]) s.players[i].p = { x: 45, y: 28 };

    for (let pass = 0; pass < 8; pass++) separate(s);

    for (const i of [1, 2, 3, 4, 5]) {
      for (const j of [1, 2, 3, 4, 5]) {
        if (i >= j) continue;
        expect(gap(s, i, j), `${i} and ${j} are still inside each other`).toBeGreaterThan(BODY_WIDTH * 0.5);
      }
    }
  });
});
