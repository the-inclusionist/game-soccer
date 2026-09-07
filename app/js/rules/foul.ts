// SPDX-License-Identifier: AGPL-3.0-or-later
// A CHALLENGE, JUDGED.
//
// ========================= WHERE A FOUL ALREADY WAS =========================
// A tackle out of reach of the ball produced NOTHING - `strikeFor` returned `null` and the lunge cost the
// child nothing at all. That is where a foul is: she went in, missed the ball, and there was somebody
// standing there. Nothing new has to be detected; what was missing is a consequence.
//
// ========================= SEVERITY IS ARITHMETIC, NOT A DICE ROLL =========================
// ⚠️ ADR-0049 requires it, and fairness requires it harder. A card decided by a random number is a card a
// child cannot learn to avoid - she is punished sometimes and not others for the same act, which teaches
// her that the referee is weather. Decided by HOW FAST SHE WENT IN, it is a rule that fits in one
// sentence: go in fast and you go off.
//
// ⚠️ AND THE ARITHMETIC IS THE PERMITTED KIND. `sim/`, `rules/` and `ai/` may use `+ - * /`, comparisons,
// `Math.sqrt`, `abs`, `min/max` and `floor`, and nothing else - because `sqrt` is exactly rounded by
// IEEE-754 and `hypot` and the trigonometric functions are not, which is a divergence between a school
// Chromebook and a teacher's laptop that surfaces as "the replay drifts" and no other symptom.

import { SQUAD_SIZE, firstOf, teamOf, type PlayerId } from '../sim/ids.ts';
import { onPitch } from '../sim/squads.ts';
import type { MatchState } from '../sim/state.ts';
import { BOX, PITCH } from '../sim/units.ts';
import { dist2, type Vec2 } from '../sim/vec.ts';
import type { RulesProfile } from './profile.ts';

/** What the referee saw. `careless` is a free kick, `reckless` a yellow, `violent` a red. */
export type Severity = 'careless' | 'reckless' | 'violent';

export interface Foul {
  readonly by: PlayerId;
  readonly on: PlayerId;
  /** Where it happened, which is where the kick is taken from. */
  readonly at: Vec2;
  readonly severity: Severity;
  /** Inside the OFFENDING side's own penalty area, which is what makes it a penalty. */
  readonly inBox: boolean;
}

/**
 * How close contact is, in metres.
 *
 * Slightly more than a tackle's reach for the ball, because a challenge that misses by a whisker still
 * catches the legs - which is the whole situation this file is about.
 */
const CONTACT = 1.6;

/**
 * The speed at which a challenge stops being careless.
 *
 * ⚠️ THIS COMMENT USED TO NAME TWO CASES AND THE CODE ONLY HANDLED ONE. It said: *"a player standing still
 * whom somebody runs into has not committed anything; two players jogging together at the same pace have
 * not either"* - and it measured plain RELATIVE speed, which gets the second right and the first exactly
 * backwards. A defender who has not moved a centimetre was booked for an attacker running into him at
 * seven metres a second, because a subtraction cannot say which of the two was moving.
 *
 * See `wentIn` below for what is measured instead, and why it takes two bounds rather than one.
 */
export const RECKLESS_SPEED = 5.5;

/**
 * And the speed at which it stops being a booking.
 *
 * ⚠️ NINE IS ABOVE ANYTHING A BODY CAN DO, and that is deliberate now rather than accidental. `capsFor`
 * tops out at 7.6 metres a second, so a red card can no longer be earned by running - only by arriving at
 * full pace into a man who is coming the other way at full pace, which is the one thing in this game that
 * looks like the offence the card is for.
 *
 * It used to be reachable by two ordinary players meeting head-on, because relative speed adds: six each
 * way is twelve. Thirty-one per cent of all fouls measured over three whole matches came out RED.
 */
export const VIOLENT_SPEED = 9;

/** Is `at` inside the penalty area `team` defends this period? */
function insideOwnBox(at: Vec2, team: number, period: number): boolean {
  // The ends swap at half time, so which line a side defends is a fact about the PERIOD - the same
  // mistake a compass makes in the narration, and the same fix.
  const defendsFar = (team === 0) === (period === 2);
  const alongOwnLine = defendsFar ? PITCH.length - at.x : at.x;
  const acrossFromMiddle = at.y - PITCH.width / 2;
  const half = BOX.width / 2;
  // A RECTANGLE and not a distance: a foul level with the goal but out by the touchline is outside the
  // area, and a check on distance-from-goal would call that a penalty.
  return alongOwnLine >= 0 && alongOwnLine <= BOX.depth && acrossFromMiddle > -half && acrossFromMiddle < half;
}

/**
 * How hard he went in: the speed he brought into the contact, and no more than the speed the gap was
 * actually closing at.
 *
 * ⚠️ TWO BOUNDS, AND EACH ONE ALONE GETS A CASE WRONG. Both are measured ALONG THE LINE to the man he
 * hits, because speed across him is not going in on him.
 *
 *   · `closing` - how fast the gap between them shrinks. Alone, it books a defender who is standing still
 *     when somebody runs into him, and it calls two players meeting head-on at six metres a second a
 *     twelve, which is past a red card for something no referee would look at twice.
 *   · `approach` - how fast HE is going at HIM. Alone, it books two players jogging along together at the
 *     same pace, who are not closing on each other at all.
 *
 * The smaller of the two is the honest answer to "what did HE bring", and it is the sentence the rule was
 * always meant to be: go in fast and you go off. A man who did not move brings nothing however fast the
 * world moves around him, and a man sprinting beside somebody at the same speed is not sprinting AT him.
 *
 * ⚠️ AND IT IS THE PERMITTED ARITHMETIC. Two dot products, one `sqrt`, `min` and `max` - no `hypot`, no
 * trigonometry, so a school Chromebook and a teacher's laptop grade the same challenge the same way.
 *
 * ⚠️ EXPORTED BECAUSE `ai/brain` ASKS THE SAME QUESTION. It decides WHETHER the machine went in and
 * this file decides WHAT IT WAS WORTH, and the two used to share a NUMBER while measuring different
 * quantities - which is the drift the shared constant was introduced to prevent, arriving through the
 * other door. A presser who had not moved was deemed to have gone in and then graded careless: a free
 * kick given away by a man standing still.
 */
export function wentIn(at: Vec2, mine: Vec2, his: Vec2, theirs: Vec2): number {
  const dx = his.x - at.x;
  const dy = his.y - at.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  // Standing in the same place as somebody is not a challenge, and it is the one input with no direction.
  if (d === 0) return 0;

  const ux = dx / d;
  const uy = dy / d;
  const closing = (mine.x - theirs.x) * ux + (mine.y - theirs.y) * uy;
  const approach = mine.x * ux + mine.y * uy;

  const lesser = closing < approach ? closing : approach;
  return lesser > 0 ? lesser : 0;
}

/**
 * Judge a tackle that did not reach the ball.
 *
 * Returns `null` when there is nothing to give: the laws are switched off, the tackler reached the ball
 * after all, or there was nobody within contact.
 *
 * ⚠️ IT CHECKS THE BALL ITSELF RATHER THAN TRUSTING THE CALLER. Every challenge is contact, and if
 * contact alone were a foul a child would be penalised for playing football. What makes it a foul is
 * MISSING THE BALL, so that condition belongs beside the rest of the judgement and not in whichever
 * caller happens to arrive first.
 */
export function judgeTackle(state: MatchState, by: PlayerId, profile: RulesProfile): Foul | null {
  if (!profile.fouls) return null;
  if (!onPitch(state, by)) return null;

  const me = state.players[by];
  const ball = { x: state.ball.p.x, y: state.ball.p.y };
  if (dist2(me.p, ball) <= CONTACT * CONTACT) return null; // he got the ball: play on

  const team = teamOf(by);
  const first = firstOf(team === 0 ? 1 : 0);

  let victim: PlayerId | null = null;
  let closest = CONTACT * CONTACT;
  for (let k = 0; k < SQUAD_SIZE; k++) {
    const id = first + k;
    if (!onPitch(state, id)) continue;
    const d2 = dist2(me.p, state.players[id].p);
    // `<` and not `<=`, and the smallest index wins a tie - the same tie-breaking possession uses, so two
    // modules cannot disagree about who was nearest.
    if (d2 < closest) {
      closest = d2;
      victim = id;
    }
  }
  if (victim === null) return null;

  const them = state.players[victim];
  const going = wentIn(me.p, me.v, them.p, them.v);

  const severity: Severity =
    going >= VIOLENT_SPEED ? 'violent' : going >= RECKLESS_SPEED ? 'reckless' : 'careless';

  return {
    by,
    on: victim,
    at: { x: them.p.x, y: them.p.y },
    severity,
    inBox: insideOwnBox(them.p, team, state.period),
  };
}
