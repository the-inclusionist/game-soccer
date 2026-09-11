// SPDX-License-Identifier: AGPL-3.0-or-later
// THE HARNESS THAT LETS A MEASUREMENT BE TAKEN OF A MATCH SOMEBODY IS PLAYING.
//
// `tests/full-match` records a whole table measured with a scripted seat and states the conclusion that
// governs every later tuning decision: the band belongs to a PLAYED match, and driving the AI up to the
// band on its own would overshoot the moment somebody sat down. The harness that produced that table was
// never kept, so every measurement since has had to reinvent a child - and two children written a week
// apart are two measurements wearing one name.
//
// ⚠️ SO THE HARNESS IS COMMITTED AND IT IS GATED, because a helper nothing asserts about is a helper that
// can quietly stop playing. That is not hypothetical: the first version of this file's own probe reported
// a child who looked plausible in every count and was driving nobody, and it took a possession share to
// see it. The gate below is that share.
import { describe, expect, it } from 'vitest';
import { createMatchState } from '../app/js/sim/state.ts';
import { playTick } from '../app/js/play.ts';
import { MATCH_PROFILE, withPeriod } from '../app/js/rules/profile.ts';
import { CLUBS } from '../app/js/teams/roster.ts';
import { DT } from '../app/js/sim/ball.ts';
import { emptyFrame } from '../app/js/sim/command.ts';
import { NOBODY } from '../app/js/sim/possession.ts';
import { childFrame } from './helpers/scripted-child.ts';

const PROFILE = withPeriod(MATCH_PROFILE, 2.5);

/**
 * How much of the ball her body has, as a share of every tick anybody holds it.
 *
 * ⚠️ TWO FIXTURES AND NOT TWELVE, deliberately. This gate asks whether the harness DRIVES, which is a
 * property of one match; the twelve-fixture slate is for measuring counts, where the spread is the point
 * and a whole slate costs minutes. A gate that took minutes would be a gate people skip.
 */
function shareOfHeldTicks(home: number, away: number, played: boolean): number {
  const sides = { 0: CLUBS[home].ratings, 1: CLUBS[away].ratings };
  const state = createMatchState(PROFILE);
  state.phase = 'live';

  let held = 0;
  let hers = 0;
  const phaseNow = (): string => state.phase;
  for (let t = 0; t < 80_000 && phaseNow() !== 'fullTime'; t++) {
    playTick(state, played ? childFrame(state, t) : emptyFrame(t), DT, PROFILE, sides as never);
    if (state.possession.holder !== NOBODY) {
      held++;
      if (state.possession.holder === state.controlled[0]) hers++;
    }
  }
  return hers / Math.max(1, held);
}

describe('the scripted child', () => {
  // ⚠️ THE ASSERTION IS THE COMPARISON AND NOT A THRESHOLD, and the difference matters. A bare "she holds
  //    it more than a fifth of the time" would go red the day the AI got better at keeping the ball away
  //    from her, which is a change to the GAME and not a break in the harness. Against the same fixture
  //    with nobody at the keyboard, what is left is the thing this file is about: does driving her body
  //    change anything at all.
  it('[Right] drives her body: she holds the ball far more than the seat does on its own', () => {
    for (const [h, a] of [
      [0, 1],
      [2, 3],
    ] as const) {
      const idle = shareOfHeldTicks(h, a, false);
      const hers = shareOfHeldTicks(h, a, true);
      expect(hers, `${h} v ${a}: the scripted child is not driving`).toBeGreaterThan(idle * 1.5);
    }
  }, 300_000);

  // ⚠️ AND SHE SHOOTS, WHICH THE GATE ABOVE DOES NOT COVER AND A MUTATION PROVED. Making her verb
  //    permanently `none` left both assertions above green: chasing and driving are one claim, taking a
  //    shot is another, and the harness header promises all three. A harness half-gated is a harness that
  //    can lose half its behaviour silently - and the half it would lose is the half that scores.
  it('[Right] and she takes shots, which chasing alone would not produce', () => {
    const state = createMatchState(PROFILE);
    state.phase = 'live';
    const sides = { 0: CLUBS[0].ratings, 1: CLUBS[1].ratings };

    let shots = 0;
    const phaseNow = (): string => state.phase;
    for (let t = 0; t < 80_000 && phaseNow() !== 'fullTime'; t++) {
      const frame = childFrame(state, t);
      if (frame.cmds.some((c) => c.verb === 'shoot')) shots++;
      playTick(state, frame, DT, PROFILE, sides as never);
    }

    expect(shots, 'the scripted child never tried to score').toBeGreaterThan(0);
  }, 300_000);

  // ⚠️ AND SHE IS DETERMINISTIC, which is what makes her a ruler rather than a weather report. Every
  //    measurement taken with this harness is re-runnable, and a number that moves between two runs is a
  //    change in the game rather than in the child.
  it('[Zero] the same fixture twice gives exactly the same share', () => {
    expect(shareOfHeldTicks(0, 1, true)).toBe(shareOfHeldTicks(0, 1, true));
  }, 300_000);
});
