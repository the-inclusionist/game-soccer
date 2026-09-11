// SPDX-License-Identifier: AGPL-3.0-or-later
// TWO BODIES DO NOT STAND IN THE SAME PLACE.
//
// ========================= THE DEFECT IS REAL AND IT IS MOST OF A MATCH =========================
// Measured over a whole match, every pair of the twenty-two every tick: the closest two bodies ever got
// was 0.000 metres - EXACTLY the same point - and 37% of ticks had at least one pair inside 0.8 m.
// Football does not allow it and pillar 5 does not survive it: two figures on one spot are ONE figure, and
// a child looking for her own player finds a single silhouette with two shadows under it.
//
// ========================= AND IT WAS BUILT, MEASURED AND REVERTED ONCE BEFORE =========================
// `sim/step` carries that history: a ninety-minute match went from 4.5 goals to 0.33, and the note
// concludes that a match with a third of a goal in it is a worse game than one with overlapping sprites.
//
// ⚠️ RE-MEASURED ON 2026-09-11 IT COSTS FIVE PER CENT OF THE GOALS, NOT NINETY-THREE. 1.50 to 1.42 over
// the twelve-fixture slate with a child playing. That does not make the old table wrong - it makes it OLD,
// which is a different claim: it belongs to a different match length on a build from before
// sustained-contact possession, before the shield, before her shot was judged by her own club and before a
// forward ran beyond the ball. The two tables cannot be subtracted. What can be said is that the reason
// the feature was reverted does not reproduce on today's game.
//
// ⚠️ AND THE PUSH IS SPLIT EQUALLY, WHICH IS A DECISION AND NOT A SIMPLIFICATION. Moving one body and not
// the other would make the pair's outcome depend on iteration order - the lower index would always win the
// ground - and iteration order is not a fact about football. Halving it also means the ball-carrier is
// displaced as much as the man arriving, which is what stops this becoming a free tackle.

import { onPitch } from './squads.ts';
import type { MatchState } from './state.ts';

/**
 * Metres between two bodies' centres below which they are inside each other.
 *
 * ⚠️ IT IS THE FIGURE'S OWN WIDTH AND NOT A CHOSEN NUMBER. `render/body-pixels` draws a body seven cells
 * across and `project` puts sixteen pixels in a metre with each cell two pixels wide, so a drawn body is
 * about 0.88 m across. Two of them not overlapping ON SCREEN is two centres this far apart, which is the
 * whole point: the defect this closes is a visual one before it is a physical one.
 */
export const BODY_WIDTH = 0.8;

/**
 * Push every overlapping pair apart, both bodies equally.
 *
 * ⚠️ ONE PASS AND NOT A SOLVER. A crowd of three can end a pass still slightly overlapping, and that is
 * accepted: the next tick pushes again, and a body that is 0.7 m from its neighbour instead of 0.0 has
 * already bought everything this exists for. Iterating to convergence would be a physics engine, and the
 * measurement that matters - the closest pair over a whole match - goes from 0.000 m to 0.016 m with a
 * single pass.
 *
 * ⚠️ AND IT IS 231 PAIRS, WHICH IS WHY THERE IS NO GRID. The plan budgeted an 8x8 metre broadphase so
 * these queries would be affordable; twenty-two bodies are 231 comparisons, and a whole match of exactly
 * those was walked in seconds. A grid would be a data structure with its own bugs solving a cost nobody
 * measured.
 */
export function separate(state: MatchState): void {
  const players = state.players;

  for (let i = 0; i < players.length; i++) {
    if (!onPitch(state, i)) continue;
    for (let j = i + 1; j < players.length; j++) {
      if (!onPitch(state, j)) continue;

      const a = players[i].p;
      const b = players[j].p;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= BODY_WIDTH) continue;

      // ⚠️ EXACTLY ON TOP OF EACH OTHER IS THE CASE THAT MUST NOT DIVIDE BY ZERO, and it is not
      //    hypothetical: 0.000 m is the measured minimum. They are pushed apart along `x`, which is
      //    arbitrary and written down rather than left to the sign of a zero.
      const nx = d === 0 ? 1 : dx / d;
      const ny = d === 0 ? 0 : dy / d;
      const push = (BODY_WIDTH - d) / 2;

      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
    }
  }
}
