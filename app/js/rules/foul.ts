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
import { DEFAULT_CAPS } from '../sim/body.ts';
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
 * The share of his own top speed at which a challenge stops being careless.
 *
 * ⚠️ IT IS A FRACTION AND NOT A SPEED, and both halves of that were paid for by measurement.
 *
 * The number USED to be 5.5 metres a second, chosen when severity was the plain RELATIVE speed of two
 * bodies - which adds, so two players meeting head-on at six each made twelve. `wentIn` grades what the
 * tackler BROUGHT, capped by his own top speed, and no body in this game can exceed 7.6. The thresholds
 * were never recalibrated to the new quantity, so `9` became unreachable and `5.5` became routine:
 * measured over six whole matches, ZERO violent challenges and twenty of twenty-eight fouls reckless,
 * where football books about one foul in twelve.
 *
 * ⚠️ AND A FIXED THRESHOLD IN METRES IS UNFAIR. `capsFor` spreads top speed from 6.2 to 7.6, so the same
 * act is a card for a quick club and a free kick for a slow one - a rating punishing the child who chose
 * the badge with pace on it, which is exactly what ADR-0049 is about. As a fraction, "flat out" means the
 * same thing to everybody.
 *
 * 0.95 is going in at everything you have. Below it there is a real band - a defender at 85% is going in
 * hard and is not being reckless with anybody - and that band is where twenty of those twenty-eight fouls
 * were landing.
 */
export const RECKLESS_FRACTION = 0.95;

/**
 * And the share at which it stops being a booking.
 *
 * ⚠️ ABOVE 1.0 ON PURPOSE, because that makes a sending-off mean something a child can be taught in one
 * sentence. Sprint is the only thing in this game that takes a body past its own top speed - `SPRINT_FREE`
 * is 1.18 - so a straight red is a SPRINTING lunge and nothing else. Every other red is two bookings,
 * which is football's usual route to one anyway.
 *
 * It also means the machine cannot be sent off directly: the AI never sprints into a challenge. That is
 * not a gap, it is the rule working - a body that does not fly in does not get a red for flying in.
 */
export const VIOLENT_FRACTION = 1.15;

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
export function judgeTackle(
  state: MatchState,
  by: PlayerId,
  profile: RulesProfile,
  top: number = DEFAULT_CAPS.maxSpeed,
): Foul | null {
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

  // ⚠️ AGAINST HIS OWN TOP SPEED, so the same act by a quick club and a slow one gets the same card.
  const severity: Severity =
    going >= VIOLENT_FRACTION * top
      ? 'violent'
      : going >= RECKLESS_FRACTION * top
        ? 'reckless'
        : 'careless';

  return {
    by,
    on: victim,
    at: { x: them.p.x, y: them.p.y },
    severity,
    inBox: insideOwnBox(them.p, team, state.period),
  };
}
