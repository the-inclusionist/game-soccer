// SPDX-License-Identifier: AGPL-3.0-or-later
// THE STEP. One tick of football, and the only place the world changes.
//
// ========================= THE ORDER IS FIXED AND IT IS THE CONTRACT =========================
// Intent, then bodies, then ball, then the clock. Changing this order changes outcomes, so it is written
// down here rather than being whatever the statements happened to be in: a recorded match replays
// correctly only because every future reader keeps this order.
//
// ⚠️ NO CLOCK, NO DEVICE, NO RANDOMNESS. `step` reads its arguments and nothing else. The three clock
// modes differ in WHO CALLS THIS AND WHEN, never in what it does - that is the whole claim, and
// `tests/step.node.test.ts` is where it stops being a claim.

import { stepBall } from './ball.ts';
import { stepBody } from './body.ts';
import { FLAG_JOCKEY, FLAG_SPRINT, type TickFrame } from './command.ts';
import { DEFAULT_CAPS } from './body.ts';
import { containDirection } from './contain.ts';
import { NOBODY, resolvePossession } from './possession.ts';
import { teamOf } from './ids.ts';
import { onPitch } from './squads.ts';
import type { MatchState } from './state.ts';
import type { Vec2 } from './vec.ts';

export { emptyFrame } from './command.ts';

const STILL: Vec2 = Object.freeze({ x: 0, y: 0 });

/** What sprinting multiplies top speed by, free and with the ball at your feet. */
const SPRINT_FREE = 1.18;
const SPRINT_WITH_BALL = 1.04;

export function step(
  state: MatchState,
  frame: TickFrame,
  dt: number,
  base?: readonly Vec2[],
  moveBall = true,
): void {
  // 1 - INTENT. A desired direction per body, defaulting to standing still. Built as a dense array rather
  //     than a map so the iteration below is by index, which is what keeps ties deterministic.
  // ⚠️ THE BASE IS THE AI AND THE COMMANDS WIN OVER IT, in that order and never the other way. A child
  //     driving a body has to override what the AI wanted for it on the SAME tick; if the AI were applied
  //     afterwards, her input would be silently discarded whenever the two disagreed - which is exactly
  //     when it matters.
  const desired: Vec2[] = state.players.map((_, i) => base?.[i] ?? STILL);

  // ⚠️ SPRINT IS PER BODY, NOT GLOBAL, so the caps are an array rather than one value. It was a flag no
  //     module read at all until this line existed: it travelled from the keyboard into the command and
  //     stopped there, and every test still passed because they all asserted on the COMMAND.
  const caps = state.players.map(() => DEFAULT_CAPS);

  for (const cmd of frame.cmds) {
    const who = state.controlled[cmd.seat];
    if (who === undefined) continue; // a command from a seat nobody is sitting in is data, not an error

    // ⚠️ CONTAINING ONLY MEANS ANYTHING WHEN THE BALL IS NOT YOURS. Held while your own side has it, it
    //    aimed the body at a spot between the ball and its OWN goal - so a child holding contain walked her
    //    own ball backwards toward her own keeper. A LOOSE ball still counts as not yours: staying
    //    goal-side of a ball nobody has is exactly what a defender does rather than diving at it, and
    //    gating on "an opponent holds it" made the control switch itself off the instant he lost it.
    const ourBall =
      state.possession.holder !== NOBODY && teamOf(state.possession.holder) === teamOf(who);
    const jockeying = (cmd.flags & FLAG_JOCKEY) !== 0 && !ourBall;

    desired[who] = jockeying ? containDirection(state, who) : { x: cmd.dx, y: cmd.dy };

    if ((cmd.flags & FLAG_SPRINT) !== 0) {
      // Carrying costs speed, which is the whole reason sprinting is a choice instead of something to hold
      // down for ninety minutes.
      const carrying = state.possession.holder === who;
      const gain = carrying ? SPRINT_WITH_BALL : SPRINT_FREE;
      caps[who] = { maxSpeed: DEFAULT_CAPS.maxSpeed * gain, accel: DEFAULT_CAPS.accel };
    }
  }

  // 2 - BODIES, in index order.
  // ⚠️ AN ABSENT BODY IS NOT INTEGRATED, not integrated with a zero intent. A body that is stepped with no
  //     input still has its velocity decayed and its facing recomputed, which is state changing for
  //     somebody who is not playing - and the digest would report a world moving while nothing happened.
  for (let i = 0; i < state.players.length; i++) {
    if (!onPitch(state, i)) continue;
    stepBody(state.players[i], desired[i], dt, caps[i]);
  }

  // 3 - BALL. Skipped while play is stopped: at a dead ball the players walk into position and the ball
  //     stays on its spot, which is football and is also what stops a restart from being taken by the
  //     ball rolling away from the spot it was just placed on.
  if (moveBall) stepBall(state.ball, dt);

  // 4 - POSSESSION, after everything has moved. Deciding it before the bodies move would answer "who has
  //     the ball" about a world that no longer exists, and the referee reads this on the same tick.
  resolvePossession(state);

  // 5 - THE CLOCK, last, so that everything above ran at the tick it is numbered with.
  state.tick += 1;
}
