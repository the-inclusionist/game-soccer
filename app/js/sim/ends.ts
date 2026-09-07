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

/**
 * `+1` if `team` attacks increasing x in this period, `-1` if it attacks decreasing x.
 *
 * ⚠️ A FUNCTION OF THE PERIOD AND NOT OF THE TEAM. Reading a fixed direction off the team id is right for
 * forty-five minutes and wrong for the other forty-five, and no gate that plays a single half can see it.
 */
export function attackDirOf(team: TeamId | number, period: number): 1 | -1 {
  return (team === 0) === (period === 1) ? 1 : -1;
}
