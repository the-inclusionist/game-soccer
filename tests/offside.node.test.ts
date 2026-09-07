// SPDX-License-Identifier: AGPL-3.0-or-later
// OFFSIDE. One axis, one comparison, and the comparison is where every implementation gets it wrong.
//
// ========================= WHY THIS IS A MASK AND NOT A BOOLEAN =========================
// Offside is judged AT THE MOMENT OF THE PASS and only matters IF a flagged player then becomes involved.
// A function returning "is X offside now" would answer a question the laws of the game do not ask, and
// would flag a striker standing behind the defence while the ball is nowhere near him. So the pass takes
// a snapshot - one bit per team-mate - and the flag is raised later, by the touch.
//
// ========================= THE ONE-AXIS SIMPLIFICATION, STATED =========================
// Only `x` is used: offside is about being nearer the opponent goal LINE, and a line has one coordinate.
// The real law also requires part of the body to be in play and judges by the attacker's playable parts;
// neither is representable on a pitch made of points, and neither changes a decision at this scale.
import { describe, expect, it } from 'vitest';
import { offsideMask } from '../app/js/rules/offside.ts';
import { PITCH } from '../app/js/sim/units.ts';

const HALFWAY = PITCH.length / 2;

/** Home attacks +x. Defenders are the away side. Positions are x only - see the header. */
function mask(opts: {
  attackers: number[];
  defenders: number[];
  ball: number;
  passer: number;
}): number {
  return offsideMask({ ...opts, dir: 1, halfwayX: HALFWAY });
}

const flagged = (m: number): number[] =>
  [...Array(32).keys()].filter((i) => (m & (1 << i)) !== 0);

describe('the offside snapshot', () => {
  it('[Zero] nobody is flagged when every attacker is in his own half', () => {
    const m = mask({
      attackers: [20, 30, 40],
      defenders: [70, 80, 89],
      ball: 30,
      passer: 1,
    });

    expect(flagged(m)).toEqual([]);
  });

  it('[One] an attacker beyond the last two defenders and beyond the ball is flagged', () => {
    const m = mask({
      attackers: [50, 60, 85],
      defenders: [70, 75, 89],
      ball: 60,
      passer: 1,
    });

    expect(flagged(m)).toEqual([2]);
  });

  // ⚠️ THE BOUNDARY THAT DECIDES GOALS. The law says NEARER than the second-last opponent; level is not
  //    nearer, so a receiver exactly in line is ONSIDE. Writing `>=` here is the classic bug, it is
  //    invisible in play, and it disallows a legal goal roughly once a match.
  it('[Boundary] level with the second-last defender is ONSIDE', () => {
    const m = mask({
      attackers: [50, 60, 75],
      defenders: [70, 75, 89],
      ball: 60,
      passer: 1,
    });

    expect(flagged(m)).toEqual([]);
  });

  it('[Boundary] level with the ball is ONSIDE, even when past the defence', () => {
    const m = mask({
      attackers: [50, 60, 80],
      defenders: [70, 75, 89],
      ball: 80,
      passer: 1,
    });

    expect(flagged(m)).toEqual([]);
  });

  it('[One] the passer is never flagged, however far forward he is', () => {
    const m = mask({
      attackers: [50, 88, 60],
      defenders: [70, 75, 89],
      ball: 88,
      passer: 1,
    });

    expect(flagged(m)).not.toContain(1);
  });

  it('[Boundary] an attacker exactly on the halfway line is in his own half, so he is onside', () => {
    const m = mask({
      attackers: [30, 40, HALFWAY],
      defenders: [46, 47, 48],
      ball: 40,
      passer: 1,
    });

    expect(flagged(m)).toEqual([]);
  });

  it('[Many] against a high line, the second-last opponent is the last outfielder, not the keeper', () => {
    // The away side has pushed both outfielders up to 20 and 22 and left the keeper back on 89. Measured
    // along the attack the two furthest forward are the keeper and the outfielder on 22, so the second-last
    // opponent is 22 - and an attacker on 60 is past it, past the ball and past the halfway line.
    const m = mask({
      attackers: [30, 35, 60],
      defenders: [89, 20, 22],
      ball: 35,
      passer: 1,
    });

    expect(flagged(m)).toEqual([2]);
  });

  it('[Interface] the away side attacks the other way, and the same comparison holds mirrored', () => {
    const m = offsideMask({
      attackers: [40, 30, 5],
      defenders: [20, 15, 1],
      ball: 30,
      passer: 1,
      dir: -1,
      halfwayX: HALFWAY,
    });

    expect(flagged(m)).toEqual([2]);
  });
});
