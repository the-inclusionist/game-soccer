// SPDX-License-Identifier: AGPL-3.0-or-later
// A SEAT THAT PLAYS LIKE A CHILD, SO A MEASUREMENT CAN BE TAKEN OF A MATCH SOMEBODY IS PLAYING.
//
// ========================= WHY THIS IS A COMMITTED HELPER AND NOT A PROBE =========================
// `tests/full-match` records a whole table measured with a scripted seat — throw-ins, goals, corners,
// goal kicks, fouls, yellows and balls into the box, against an empty chair — and states the conclusion
// that settles what may be tuned at all: **the band belongs to a PLAYED match, and driving the AI up to
// the band on its own would overshoot the moment somebody sat down.**
//
// ⚠️ AND THE HARNESS THAT PRODUCED IT WAS NEVER KEPT. The numbers are in a comment and the thing that
// made them is gone, so every later measurement has had to reinvent a child — and two children written a
// week apart are two different measurements wearing the same name. The absorption plan gates three items
// on "the slate with a child playing"; without one shape of child, those three results cannot be read
// against each other or against the table already recorded.
//
// ⚠️ IT IS DELIBERATELY THE SAME CHILD AS THAT TABLE'S: chase the ball, run at their goal, shoot inside
// twenty-two metres. Not a better one. A harness that plays better than the recorded one would move every
// number in the table without anybody having changed the game.
//
// ⚠️ AND IT UNDERSTATES HER, WHICH IS WRITTEN DOWN RATHER THAN FIXED. She never presses switch, and a real
// child presses it constantly to drive whoever is nearest the ball. So every count this produces is a
// FLOOR for a played match, not a centre — and a lever tuned until this child reaches a band will sit past
// the top of it for the child who switches.

// ========================= ⚠️ AND IT DISTORTS ONE COUNT, WHICH UNDERSTATING DOES NOT EXPLAIN =========================
// Measured 2026-09-11 over the six-fixture slate, every crossing of a touchline:
//
//     slate              throw-ins a match   in the middle third   last touched by the body SHE drives
//     nobody playing                  3.83                  100%                                 13.0%
//     a child playing                12.17                  100%                                 50.7%
//
// ⚠️ THE EMPTY CHAIR IS INSIDE ITS BAND - 3.5 to 6 - AND THE PLAYED MATCH IS AT TWICE THE TOP OF IT. And
// the difference is not spread across her eleven: over the whole slate her TEN TEAM-MATES put the ball out
// exactly as often as the away side did, and the single body this harness drives accounted for half of
// every throw-in in the game. One body in twenty-two.
//
// In all thirty-seven of those she was the last man to HOLD the ball as well as the last to touch it, and
// she was nine metres away from it when it crossed - so it left her and ran out with nobody else involved.
//
// ⚠️ WHAT THAT MEANS FOR EVERY NUMBER TAKEN "WITH A CHILD PLAYING": the throw-in count is a fact about
// this harness before it is a fact about the game, and it must not be tuned against.
//
// ========================= ⚠️ AND THE SENTENCE THAT USED TO SIT HERE WAS WRONG =========================
// It said: "the other counts are not implicated - her side's share of goals, corners, fouls and offsides
// tracks the away side's". That was asserted and not measured, and it is kept here rather than deleted
// because the correction is the more useful half. Measured over the same six fixtures:
//
//     slate              goals home / away   of her side's goals, last touched by HER   corners home / away
//     nobody playing                13 / 16                                          5                0 / 8
//     a child playing               27 /  1                                         24               0 / 10
//
// ⚠️ THE HARNESS SCORES TWENTY-FOUR OF THE TWENTY-EIGHT GOALS IN THE GAME, and the side it plays against
// scores ONCE IN SIX MATCHES. With an empty chair the same two sides finish 13-16. One body out of
// twenty-two, chasing the ball everywhere and shooting inside twenty-two metres, both scores almost
// everything and flattens the opposing attack.
//
// ⚠️ SO THIS HARNESS DOES NOT UNDERSTATE A CHILD, WHICH IS WHAT THE PARAGRAPH ABOVE CLAIMS. It understates
// her in one way - she never presses switch - and MASSIVELY overstates her in another, because a real
// child drives one body and this one is always exactly where the ball is. Both halves are true at once and
// only the first was written down.
//
// ⚠️ AND THAT IS WHAT "GOALS 4.00 AGAINST A BAND OF 2 TO 3" HAS BEEN MEASURING. The Dev's bands belong to
// a played match and this is the only played match this repository can produce, so the number is not
// wrong so much as it is about the wrong player. Nothing should be tuned against it until there is a
// harness whose scoring share looks like a child's.
//
// ⚠️ AND ONE MORE THING THE SAME MEASUREMENT TURNED UP, unexplained and worth somebody's attention: the
// HOME side is awarded no corner at all, in either condition, across six fixtures. Eighteen corners in the
// slate and every one of them away. That is not the harness - it happens with an empty chair too.
//
// ⚠️ AND THE MECHANISM IS NOT MEASURED, WHICH IS SAID PLAINLY RATHER THAN GUESSED AT. The shape matches a
// defect this repository has already recorded once, in `sim/state` beside `tookRestart`: a body that has
// run sideways onto the ball carries a velocity pointing at the line it just ran to, and the dribbling
// touch fires along it. That was fixed for restart TAKERS and for nobody else. It is a hypothesis with a
// precedent, not a finding - the probe that would have settled it timed the gap between CHANGES of kicker
// rather than between kicks, and its number is therefore not recorded here.

import type { Command, TickFrame } from '../../app/js/sim/command.ts';
import type { MatchState } from '../../app/js/sim/state.ts';
import { attackDirOf } from '../../app/js/sim/ends.ts';
import { HOME } from '../../app/js/sim/ids.ts';
import { PITCH } from '../../app/js/sim/units.ts';

/** Metres. Inside this of their goal she shoots; outside it she runs. The recorded child's range. */
export const SHOOT_FROM = 22;

/** Full power, in the command's own 0..255. She is a child: she does not meter a shot. */
const FULL = 255;

/**
 * The frame for one tick with seat 0 driven.
 *
 * ⚠️ SHE DRIVES WHICHEVER BODY THE SEAT ALREADY HOLDS, and does not choose it. `state.controlled` is the
 * simulation's answer to "which body is this seat driving" and it is a fact about the world, not about the
 * input — so a harness that picked its own body would be measuring a game nobody can play.
 */
export function childFrame(state: MatchState, tick: number): TickFrame {
  const me = state.controlled[0];
  if (me === undefined || me < 0) return { tick, cmds: [] };

  const body = state.players[me];
  if (body === undefined) return { tick, cmds: [] };

  const dir = attackDirOf(HOME, state.period);
  const goal = { x: dir === 1 ? PITCH.length : 0, y: PITCH.width / 2 };

  const mine = state.possession.holder === me;
  // With the ball she runs at their goal; without it she runs at the ball. That is the whole policy.
  const to = mine ? goal : state.ball.p;

  const dx = to.x - body.p.x;
  const dy = to.y - body.p.y;
  const far = Math.sqrt(dx * dx + dy * dy);

  const gx = goal.x - body.p.x;
  const gy = goal.y - body.p.y;
  const toGoal = Math.sqrt(gx * gx + gy * gy);

  const cmd: Command = {
    tick,
    seat: 0,
    dx: far === 0 ? 0 : dx / far,
    dy: far === 0 ? 0 : dy / far,
    verb: mine && toGoal <= SHOOT_FROM ? 'shoot' : 'none',
    power: FULL,
    flags: 0,
  };
  return { tick, cmds: [cmd] };
}
