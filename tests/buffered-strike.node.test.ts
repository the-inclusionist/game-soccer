// SPDX-License-Identifier: AGPL-3.0-or-later
// A KICK PRESSED BEFORE THE BALL ARRIVES IS HELD, NOT DROPPED.
//
// ========================= THIS IS THE ACCOMMODATION, NOT A FEEL IMPROVEMENT =========================
// `sim/strike` refuses every kicking verb from a body that is not the holder - one line, `holder !== who`
// - and that refusal is silent. A child who presses as the ball comes to her gets nothing at all: no
// kick, no sound, no reason. She presses again, later, and learns to wait.
//
// ⚠️ FOR A CHILD ON A SCANNING INPUT AN EARLY PRESS IS NOT A MISTAKE, IT IS THE ONLY WAY TO PLAY. A
// scanner steps through options at its own pace; the moment to commit arrives when the highlight arrives,
// not when the ball does. Same for a switch, and same for a child whose hands need a run-up. The three
// charge routes exist because this repository already accepted that argument about HOLDING a key; this is
// the same argument about WHEN one is pressed.
//
// ========================= AND THE WINDOW COULD NOT BE MEASURED, WHICH IS WRITTEN DOWN =========================
// The absorption plan asks for the distribution of time between a child pressing a kick key and gaining
// possession, taken from the scripted-seat runs. ⚠️ THAT MEASUREMENT CANNOT BE TAKEN WITH THE HARNESS
// THIS REPOSITORY HAS: `tests/helpers/scripted-child` presses shoot only when she ALREADY HOLDS the ball,
// so she never presses early, and how early a child presses is exactly the unknown. It is a
// human-factors number and the slate cannot produce it.
//
// What the slate CAN bracket is the two ends, and it did:
//
//   · long enough to forgive a press made as the ball visibly approaches. Measured in `project.ts`: a
//     ball flight is 9 m at the ninetieth percentile and travels at about 26 m/s, which is 21 ticks; the
//     ninety-ninth percentile is 28.5 m, which is 66.
//   · short enough that the kick is still about THIS ball. A press that fires a second and a half later
//     is a shot she has stopped intending, and an accommodation that fires shots nobody wanted is worse
//     than the barrier it removes.
//
// Thirty ticks - half a second - sits between the typical flight and the long one, and half a second is
// an interval a person can feel and argue with. The risk is asymmetric and the choice leans accordingly:
// a window too short merely fails to help, while one too long acts on her behalf.
import { describe, expect, it } from 'vitest';
import { createMatchState } from '../app/js/sim/state.ts';
import { playTick } from '../app/js/play.ts';
import { MATCH_PROFILE, withPeriod } from '../app/js/rules/profile.ts';
import { CLUBS } from '../app/js/teams/roster.ts';
import { DT } from '../app/js/sim/ball.ts';
import { BUFFER_TICKS } from '../app/js/sim/command.ts';
import { NOBODY } from '../app/js/sim/possession.ts';
import type { Command, TickFrame } from '../app/js/sim/command.ts';

const PROFILE = withPeriod(MATCH_PROFILE, 2.5);
const sides = { 0: CLUBS[0].ratings, 1: CLUBS[1].ratings };

const press = (tick: number): Command => ({ tick, seat: 0, dx: 1, dy: 0, verb: 'shoot', power: 1, flags: 0 });
const frame = (tick: number, cmds: Command[] = []): TickFrame => ({ tick, cmds });

/** A live match with her body holding nothing and the ball parked away from everybody. */
function ready() {
  const state = createMatchState(PROFILE);
  state.phase = 'live';
  for (let i = 0; i < state.players.length; i++) state.players[i].p = { x: 5 + (i % 5), y: 5 + Math.floor(i / 5) };
  const me = state.controlled[0];
  state.players[me].p = { x: 45, y: 28 };
  state.ball.p = { x: 70, y: 28, z: 0 };
  state.ball.v = { x: 0, y: 0, z: 0 };
  state.possession.holder = NOBODY;
  return { state, me };
}

/** Put the ball at her feet, so the next tick gives her possession. */
function giveHerTheBall(state: ReturnType<typeof ready>['state'], me: number): void {
  state.ball.p = { x: state.players[me].p.x, y: state.players[me].p.y, z: 0 };
  state.ball.v = { x: 0, y: 0, z: 0 };
}

describe('a kick pressed before the ball arrives', () => {
  // ⚠️ [Zero] A PRESS ABOUT NOTHING STAYS NOTHING. If the ball never comes, the buffer must expire in
  //    silence rather than wait for a ball ten seconds later and fire at it - which is the version of
  //    this feature that acts on her behalf instead of for her.
  it('[Zero] a press with no ball coming does nothing at all', () => {
    const { state } = ready();
    playTick(state, frame(0, [press(0)]), DT, PROFILE, sides as never);

    for (let t = 1; t < BUFFER_TICKS + 5; t++) playTick(state, frame(t), DT, PROFILE, sides as never);

    expect(state.pendingVerb[0], 'a press about nothing is still armed').toBe(-1);
    expect(state.lastStruck, 'a press about nothing struck something').not.toBe(state.controlled[0]);
  });

  // ⚠️ AND EXACTLY ONCE, ON THE TICK SHE GAINS IT. Firing on the press would be no buffer at all; firing
  //    on every tick until she lets go would empty the buffer into a burst of kicks.
  it('[One] fires exactly once, on the tick she gains the ball', () => {
    const { state, me } = ready();
    playTick(state, frame(0, [press(0)]), DT, PROFILE, sides as never);
    expect(state.ball.v.x, 'it fired on the press').toBe(0);

    giveHerTheBall(state, me);
    playTick(state, frame(1), DT, PROFILE, sides as never);

    // ⚠️ WHO STRUCK IT, NOT WHETHER THE BALL MOVED. A ball moves because somebody is dribbling it just
    //    as readily as because it was kicked, and the first version of this gate could not tell the two
    //    apart - it passed on an opponent running away with it.
    expect(state.lastStruck, 'the buffered kick never fired').toBe(me);
    expect(state.pendingVerb[0], 'the buffer was not cleared by firing').toBe(-1);
  });

  // ⚠️ [Boundary] ONE TICK EITHER SIDE OF THE WINDOW, and both halves are asserted against the same
  //    fixture. A gate that only checked the inside would pass on a buffer that never expires, which is
  //    the dangerous failure - a kick she pressed a minute ago going off when the ball finally arrives.
  it('[Boundary] the last tick of the window still fires, and the first one past it does not', () => {
    for (const [wait, shouldFire] of [
      [BUFFER_TICKS - 1, true],
      [BUFFER_TICKS + 1, false],
    ] as const) {
      const { state, me } = ready();
      playTick(state, frame(0, [press(0)]), DT, PROFILE, sides as never);
      for (let t = 1; t <= wait; t++) playTick(state, frame(t), DT, PROFILE, sides as never);

      giveHerTheBall(state, me);
      playTick(state, frame(wait + 1), DT, PROFILE, sides as never);

      expect(state.lastStruck === me, `waiting ${wait} ticks: expected fire=${shouldFire}`).toBe(shouldFire);
    }
  });

  // ⚠️ [Interface] AN OPPONENT TAKING IT CANCELS IT, and this is what bounds the damage. Without it a
  //    press survives a turnover and fires when she wins the ball back - a kick belonging to a different
  //    passage of play, which is exactly the shot nobody wanted.
  it('[Interface] an opponent taking the ball cancels the press', () => {
    const { state, me } = ready();
    playTick(state, frame(0, [press(0)]), DT, PROFILE, sides as never);

    const theirs = 11 + 5;
    state.players[theirs].p = { x: 70, y: 28 };
    playTick(state, frame(1), DT, PROFILE, sides as never);
    expect(state.possession.holder, 'the fixture did not hand it to an opponent').toBe(theirs);
    expect(state.pendingVerb[0], 'the press survived a turnover').toBe(-1);

    giveHerTheBall(state, me);
    playTick(state, frame(2), DT, PROFILE, sides as never);
    expect(state.lastStruck, 'a cancelled press still fired').not.toBe(me);
  });
});
