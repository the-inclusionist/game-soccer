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
import { DEFAULT_CAPS, type SideCaps } from './body.ts';
import { containDirection } from './contain.ts';
import { NOBODY, resolvePossession } from './possession.ts';
import { keeperSave } from './save.ts';
import { blockBall } from './block.ts';
import { teamOf } from './ids.ts';
import { onPitch } from './squads.ts';
import type { MatchState } from './state.ts';
import type { Vec2 } from './vec.ts';

export { emptyFrame } from './command.ts';

const STILL: Vec2 = Object.freeze({ x: 0, y: 0 });

/** What sprinting multiplies top speed by, free and with the ball at your feet. */
const SPRINT_FREE = 1.18;
const SPRINT_WITH_BALL = 1.04;

/**
 * One tick.
 *
 * ⚠️ `sides` IS CAPS AND NOT RATINGS, and the distinction is the whole reason the simulation can be tested
 * with no clubs in it. `capsFor` turns a club's `pace` into a top speed and an acceleration; this function
 * receives the ANSWER, so `sim/` never learns that clubs exist and the seam stays the only place that
 * knows both. Omitted, everybody gets `DEFAULT_CAPS`, which is exactly a side of all-average players.
 */
export function step(
  state: MatchState,
  frame: TickFrame,
  dt: number,
  base?: readonly Vec2[],
  moveBall = true,
  sides?: readonly [SideCaps, SideCaps],
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
  // ⚠️ SEEDED PER SIDE, WHICH IS WHERE PACE ENTERS THE MATCH. It was `DEFAULT_CAPS` for all twenty-two, so
  //     `capsFor` was imported by nobody and the clubs ran at identical speeds while a card said otherwise.
  const caps = state.players.map((_, i) => (sides === undefined ? DEFAULT_CAPS : sides[teamOf(i)].body));

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
      // ⚠️ AGAINST HIS OWN CAP AND NOT AGAINST THE DEFAULT. Multiplying the default would make every club
      //    sprint at exactly the same speed - and a match is mostly spent sprinting, so pace would be a
      //    rating a child could never see, which reads as the rating not working rather than as one
      //    multiplication against the wrong base.
      caps[who] = { maxSpeed: caps[who].maxSpeed * gain, accel: caps[who].accel };
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

  // 2b - AND NOBODY STANDS INSIDE ANYBODY - WHICH IS NOT TRUE HERE, AND `sim/contact` IS THE ONE LINE
  //      THAT WOULD MAKE IT SO. The module is built and gated six ways; the wire would go on this line,
  //      after the bodies move and before the ball does, so a body cannot be pushed onto a ball that has
  //      already been resolved.
  //
  //      ========================= WHAT IT COSTS NOW, MEASURED 2026-09-11 =========================
  //      Twelve fixtures, a child playing, with `ai/brain.challenger` no longer lunging from behind:
  //
  //          build                                goals   throw-ins   corners   goal kicks   fouls   offside
  //          as committed                          1.50        6.92      1.83         2.83    3.08       -
  //          bodies, challenger as it was          1.50        5.50      1.17         1.92    6.08    0.17
  //          bodies, no challenger at all          1.50        6.67      1.83         2.83    0.00    0.67
  //          bodies + no lunge from behind         1.75        4.50      1.67         2.75    3.33    0.42
  //
  //      ⚠️ THE LAST ROW IS THE BEST MATCH THIS REPOSITORY HAS MEASURED. Goals UP toward their band,
  //      throw-ins into it from above, offsides up from well below, fouls and corners still inside. It is
  //      the first change in a long sequence that improves counts instead of trading one for another.
  //
  //      ⚠️ AND IT IS NOT WIRED, BECAUSE THE CARDS EXPLODE. Twenty-five bookings across the six-fixture
  //      slate against a gate that allows twelve - about four a match, against a band of half a card to
  //      one and a half. The fouls stay in band and their SEVERITY does not: `rules/foul` grades a
  //      challenge by what the tackler brought to the contact, and a presser who is shoved off and closes
  //      again arrives harder every time. A match with four bookings every five minutes is not football,
  //      and tuning the card thresholds to hide it would be tuning away the symptom.
  //
  //      ⚠️ AND EVERY FOUL IN THIS GAME COMES FROM THE MACHINE, which this measurement proved rather
  //      than assumed: with `challenger` disabled entirely the count is 0.00. The README has said as much
  //      since before bodies had volume, and it is why the lunge rule - which IS wired - belongs to the
  //      duel rather than to this.
  //
  //      ========================= AND THAT QUESTION IS NOW ANSWERED, 2026-09-11 =========================
  //      The line above used to ask whether the severity was the closing speed being inflated by the push
  //      itself, and reasoned that separation moves positions without touching velocities so `wentIn`
  //      should not see it. ⚠️ IT DOES SEE IT, AND THE REASONING WAS WRONG IN A WAY WORTH KEEPING: the
  //      quantity did not change, the POPULATION did. Every challenge `rules/foul` judged over the
  //      six-fixture slate with a child playing was recorded, both builds:
  //
  //          build                challenges   fouls   bookings   median wentIn/top   carded
  //          as committed              235.2    5.33       0.50               0.845    12.5%
  //          with bodies wired         408.0    9.83       2.17               0.912    23.7%
  //
  //      ⚠️ THE GAP AT JUDGEMENT GETS SMALLER WITH BODIES, NOT BIGGER - median 1.434 m to 1.307 m, with a
  //      quarter of them pinned at exactly 0.800, which is `BODY_WIDTH`. So nothing is being shoved into
  //      anything: the push puts a floor under the distance and the challenges arrive closer to it.
  //
  //      ⚠️ WHAT DOUBLES IS THE NUMBER OF REAL CHALLENGES. Split by whether the man fouled was the one
  //      carrying the ball, the two builds are two different mixtures of the same two events:
  //
  //          build                on the carrier              on a bystander
  //          as committed         19 fouls, median 0.905      13 fouls, median 0.030
  //          with bodies wired    42 fouls, median 0.941      17 fouls, median 0.125
  //
  //      Real challenges go up 2.2 times and bystanders 1.3, so the near-zero mode falls from 41% of all
  //      fouls to 29% and the whole distribution lifts. The median real challenge moves four per cent.
  //
  //      ⚠️ AND FOUR PER CENT IS ENOUGH BECAUSE THE THRESHOLD SITS IN THE DENSEST PART OF IT.
  //      `RECKLESS_FRACTION` is 0.95 and the seventy-fifth percentile of this population moves 0.916 to
  //      0.949 - the bar is standing exactly where the mass is. A threshold placed there multiplies
  //      whatever moves the distribution, which is why the fouls go up 1.8 times and the cards 4.3.
  //
  //      So the cards are not coming from contact, and they are not coming from somewhere else either:
  //      they come from a bar tuned on a build whose challenges were being dragged down by bystanders.
  //      ⚠️ WHICH MAKES THE BYSTANDER THE THING TO FIX FIRST, and it is a defect in `rules/foul` that has
  //      nothing to do with bodies - it is there right now, in the committed build, in two fouls of every
  //      five. The note beside the victim loop carries it.

  // 2c - THE HISTORY OF THAT ONE LINE, KEPT BECAUSE IT IS WHY IT WAS ABSENT FOR MONTHS - WHICH IS NOT TRUE HERE, MEASURED, AND BUILT AND REVERTED ONCE.
  //
  //      ⚠️ THE DEFECT IS REAL AND IS MOST OF A MATCH. Every pair of the twenty-two, every tick, over a
  //      whole match: the closest two bodies ever got was 0.000 metres - EXACTLY the same point - there
  //      were 13,058 pair-observations closer than 0.2 m, and 21,160 of 36,000 ticks (58.8%) had at least
  //      one pair inside 0.8 m. Football does not allow it and pillar 5 does not survive it: two
  //      twelve-pixel figures on one spot are ONE figure.
  //
  //      ⚠️ AND THE FIX COSTS THE MATCH ITS GOALS. A pairwise push apart, both bodies equally, clamped
  //      to the pitch, was written with seven gates and wired here. It works - the closest pair went from
  //      0.000 m to 0.532 m - and six fixtures at each length said this, against football's 40 throw-ins,
  //      2.7 goals, 10 corners and 1.7 bookings:
  //
  //          build                    length   throw-ins   goals   corners   bookings
  //          as committed             90 min        77.2     4.5      11.5        1.7
  //          whole overlap per tick   90 min        63.7    0.33       7.8       0.67
  //          a quarter per tick       90 min        69.7    0.33       9.8       0.67
  //          as committed             15 min        36.8     2.8       1.2        0.5
  //          whole overlap per tick   15 min        16.7     4.5       1.5        0.0
  //          a quarter per tick       15 min        18.7     4.5       0.3        0.0
  //
  //      A ninety-minute match with a third of a goal in it is a worse game than one with overlapping
  //      sprites, and body contact is not in the parity list this game is measured against.
  //
  //      ⚠️ AND IT IS NOT CHAOS, WHICH WAS CHECKED BEFORE CONCLUDING. Nudging one player's kickoff spot
  //      by 1 cm and by 2 cm left every count identical to two decimal places, so these numbers are a
  //      signal and not a re-rolled match. The two push rates giving the SAME 0.33 goals says the same
  //      thing from the other side: it is not a matter of degree.
  //
  //      ⚠️ WHAT THE NEXT ATTEMPT SHOULD MEASURE FIRST is whether the shots collapse or only the goals.
  //      If the shots hold and the goals fall, it is the keeper being displaced off his line; if the
  //      shots fall too, separation is breaking the attack before it arrives. That was not measured, and
  //      guessing between the two is how this file has acquired wrong explanations before.
  //
  //      ========================= MEASURED 2026-09-11, AND NEITHER COLLAPSES =========================
  //      ⚠️ THE GOALS BARELY MOVE ON THIS BUILD. The separation above was rebuilt from this note's own
  //      description - a pairwise push apart, both bodies equally - and run against the twelve-fixture
  //      slate with a child playing, five minutes a match:
  //
  //          build          saves/match   goals   throw-ins   corners   goal kicks   fouls   pairs inside 0.8 m
  //          overlapping           82.8    1.50        6.92      1.83         2.83    3.08               37.0%
  //          separated             59.0    1.42        4.25      1.08         2.42    6.75               18.1%
  //
  //      A five per cent fall in the goals, not the ninety-three per cent this note was written about.
  //      The question is answered and the answer is neither branch: the saves fall 29%, the goals fall
  //      5%, and what actually moves is the FOULS, which more than double and go past their band.
  //
  //      ⚠️ AND THIS DOES NOT MAKE THE OLD TABLE WRONG - it makes it OLD, which is a different claim
  //      and the honest one. Those numbers are a ninety-minute and a fifteen-minute match on a build
  //      before sustained-contact possession, before the shield, before her shot was judged by her club
  //      and before a forward ran beyond the ball. Different length and different game; the two tables
  //      cannot be subtracted. What can be said is that the measurement taken TODAY, on today's build,
  //      does not reproduce the reason this feature was reverted.
  //
  //      ⚠️ SO THE ITEM IS REOPENED RATHER THAN SETTLED. The absorption plan marks the positional duel
  //      as the one item whose feasibility is genuinely uncertain, and the uncertainty was this table.
  //      What stands in the way now is different and smaller: the fouls, and the fact that separation
  //      alone would hand this game the shield-forever exploit it has never had - measured, a chaser
  //      currently reaches 0.00 m from the ball because he walks THROUGH the carrier. Those two must be
  //      answered together, which is what the plan meant by landing both halves in one change.
  //
  //      ⚠️ THE PLAN'S `broadphase` IS NOT WHAT ANY OF THIS NEEDS. It budgeted an 8x8 metre grid so the
  //      pair queries would be affordable; twenty-two bodies are 231 pairs, and the measurements above
  //      walked 36,000 ticks of exactly those comparisons in seconds. The plan was right that contact was
  //      missing and wrong about what finding it would cost.

  // 3 - BALL. Skipped while play is stopped: at a dead ball the players walk into position and the ball
  //     stays on its spot, which is football and is also what stops a restart from being taken by the
  //     ball rolling away from the spot it was just placed on.
  if (moveBall) stepBall(state.ball, dt);

  // 3b - THE KEEPER'S HANDS, after the ball has moved and before possession is resolved. A ball he has
  //      just pushed away must not then be handed to him as the nearest body, and a ball he can hold must
  //      still be there to be held. See `sim/save`: it is why this game has corners at all.
  if (moveBall) keeperSave(state, sides);

  // 3c - AND A BODY IN THE WAY OF A STRUCK BALL. After the keeper, because a ball he has palmed away must
  //      not be blocked by him again; before possession, because a blocked ball belongs to nobody. See
  //      `sim/block`: without it a body ABSORBED a shot, and a match carried four thousand of them.
  if (moveBall) blockBall(state, sides);

  // 4 - POSSESSION, after everything has moved. Deciding it before the bodies move would answer "who has
  //     the ball" about a world that no longer exists, and the referee reads this on the same tick.
  resolvePossession(state, sides);

  // 5 - THE CLOCK, last, so that everything above ran at the tick it is numbered with.
  state.tick += 1;
}
