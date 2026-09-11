// SPDX-License-Identifier: AGPL-3.0-or-later
// WHICH END A SIDE IS ATTACKING.
//
// ========================= ONE SENTENCE, AND IT USED TO BE WRITTEN FIVE TIMES =========================
// The ends swap at half time. That decides where the offside line is, which way the AI plays the ball,
// which way a contained defender stands, and which way the screen reader sends a child who cannot see -
// and it lived as five private copies: `ai/brain`, `narration`, `rules/offside`, `sim/contain` and
// `declaration`, three of them spelled differently and all five agreeing by nothing but coincidence.
//
// ⚠️ THE FAILURE THIS EXISTS TO PREVENT IS THE SIXTH COPY, or the day somebody fixes a second-half bug in
// one of five places. The symptom would be a blind child sent the wrong way for forty-five minutes, with
// nothing on the screen looking wrong - the same class of lie the narration's no-compass rule guards.
//
// ⚠️ AND IT LIVES IN `sim/` BECAUSE `sim/contain` NEEDS IT. The layering runs sim below rules below ai,
// so the one place every layer can reach is the bottom one. It is a fact about identity and periods,
// which is what `ids` is for, and it sits beside it rather than inside it because a file that answers one
// question is a file whose name is the whole of its documentation.
import type { TeamId } from './ids.ts';
import { BOX, PITCH } from './units.ts';
import type { Vec2 } from './vec.ts';

/**
 * `+1` if `team` attacks increasing x in this period, `-1` if it attacks decreasing x.
 *
 * ⚠️ A FUNCTION OF THE PERIOD AND NOT OF THE TEAM. Reading a fixed direction off the team id is right for
 * forty-five minutes and wrong for the other forty-five, and no gate that plays a single half can see it.
 */
export function attackDirOf(team: TeamId | number, period: number): 1 | -1 {
  return (team === 0) === (period === 1) ? 1 : -1;
}

/**
 * Is `at` inside the penalty area `team` DEFENDS this period?
 *
 * ⚠️ IT IS THE SECOND SENTENCE THIS FILE EXISTS FOR, and it arrived as the sixth copy of the first one.
 * `rules/foul` had it privately, to tell a free kick from a penalty; `sim/save` needs the identical
 * question to decide whether the keeper may use his hands. Two copies agreeing by coincidence is exactly
 * what the header above is about, and the second one would have been written against the same period
 * trap.
 *
 * ⚠️ AND IT IS A RECTANGLE, NOT A DISTANCE. A point level with the goal but out by the touchline is
 * OUTSIDE the area, and a check on distance-from-goal calls it inside - which is a penalty given for a
 * foul by the corner flag, and a keeper handling the ball on the wing.
 *
 * ⚠️ THE LINES ARE PART OF THE AREA on the depth and inclusive on neither side, which is football's own
 * answer and is preserved exactly as `rules/foul` had it: `>=` and `<=` along the goal line's normal,
 * strict across. The asymmetry is deliberate and is the reason this is one function and not two.
 *
 * ⚠️ AND `margin` IS FOR A SUBJECT WITH A SIZE. A foul happens at a POINT - where a man was standing - so
 * `rules/foul` passes nothing. A ball has a radius, and football judges it by whether ANY part of it is
 * inside, exactly as `rules/out-of-play` judges a ball wholly over a line. `sim/save` passes
 * `BALL.radius`, and the measurement that forced it is recorded there: a point test refused ninety-seven
 * legal parries a slate and took the corners from three a match to under a half.
 */
export function insideOwnBox(
  at: Vec2,
  team: TeamId | number,
  period: number,
  margin = 0,
): boolean {
  const defendsFar = (team === 0) === (period === 2);
  const alongOwnLine = defendsFar ? PITCH.length - at.x : at.x;
  const acrossFromMiddle = at.y - PITCH.width / 2;
  const half = BOX.width / 2 + margin;
  return (
    alongOwnLine >= -margin &&
    alongOwnLine <= BOX.depth + margin &&
    acrossFromMiddle > -half &&
    acrossFromMiddle < half
  );
}
