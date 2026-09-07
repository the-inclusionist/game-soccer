// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SENTENCE A CHILD RECEIVES. One of the four consumers of the referee's event list.
//
// ========================= ENDS SWAP AT HALF TIME, SO A COMPASS IS A LIE =========================
// "Their goal is to the east" is true for one half and false for the other. A child who learned it before
// the break would be sent the wrong way for the entire second half, and nothing on screen would look
// wrong. So no direction is ever narrated from a raw coordinate: every one derives from which end THIS
// side is attacking, in one function, called from one place.
//
// ========================= AND NOT EVERYTHING INTERRUPTS =========================
// The engine has two live regions: a polite one and an assertive one that cuts off whatever is being
// read. A goal earns the interruption. A throw-in does not - a screen reader that talks over the score to
// say "throw-in" is one a child switches off, and then she hears nothing at all.

import type { Speakable } from '@the-inclusionist/engine/core/contract.js';
import type { RuleEvent } from './rules/events.ts';
import { URGENT } from './rules/events.ts';
import type { TeamId } from './sim/ids.ts';
import { PITCH } from './sim/units.ts';

export interface NarrationCtx {
  readonly period: number;
  /** The side the child is playing for. Everything is told from here. */
  readonly us: TeamId;
  readonly t: (key: string, params?: Record<string, string | number>) => string;
}

/** Which way `team` attacks. Derived from the period, so half time costs one function and no memory. */
function dirOf(team: TeamId, period: number): 1 | -1 {
  return (team === 0) === (period === 1) ? 1 : -1;
}

/**
 * Is this end the one we are attacking?
 *
 * ⚠️ THE ONLY PLACE A COORDINATE BECOMES A DIRECTION. Everything else in this file speaks in "ours" and
 * "theirs", which are true in both halves.
 */
function isTheirEnd(x: number, ctx: NarrationCtx): boolean {
  const end = x > PITCH.length / 2 ? 1 : -1;
  return end === dirOf(ctx.us, ctx.period);
}

const ours = (team: TeamId | undefined, ctx: NarrationCtx): boolean => team === ctx.us;

/** The sentence for one event, already resolved through the dictionary. */
export function narrate(event: RuleEvent, ctx: NarrationCtx): string {
  const mine = ours(event.team, ctx);

  switch (event.kind) {
    case 'goalScored':
      return ctx.t(mine ? 'say.goal.ours' : 'say.goal.theirs');

    case 'offsideGiven':
      // `team` is the side penalised, so "ours" here means our attack was pulled back.
      return ctx.t(mine ? 'say.offside.ours' : 'say.offside.theirs');

    case 'crossedTouchline':
      return ctx.t('say.throwIn');

    case 'crossedGoalLineByDefender':
      return ctx.t(isTheirEnd(event.at?.x ?? 0, ctx) ? 'say.corner.ours' : 'say.corner.theirs');

    case 'crossedGoalLineByAttacker':
      return ctx.t(isTheirEnd(event.at?.x ?? 0, ctx) ? 'say.goalKick.theirs' : 'say.goalKick.ours');

    case 'restartTaken':
      return ctx.t(mine ? 'say.restart.ours' : 'say.restart.theirs');

    case 'ballMoved':
      return ctx.t('say.kickoff');

    case 'periodExpired':
      return ctx.t('say.halfTime');

    case 'secondPeriodExpired':
      return ctx.t('say.fullTime');

    // `team` is the side the foul was given TO, so "ours" means the kick is ours.
    case 'foulGiven':
      return ctx.t(mine ? 'say.foul.ours' : 'say.foul.theirs');

    case 'penaltyGiven':
      return ctx.t(mine ? 'say.penalty.ours' : 'say.penalty.theirs');

    // ⚠️ AND A CARD NAMES THE OFFENDER'S SIDE, which is the OPPOSITE reading of the two above. A card
    //    is against somebody; a kick is for somebody. `foulEvent` and `cardEvent` each put the side their
    //    own sentence needs on the event, so neither reader has to remember a rule.
    case 'bookingGiven':
      return ctx.t(mine ? 'say.booking.ours' : 'say.booking.theirs');

    case 'sendingOff':
      // The sentence says the side is a player down, because that is the part that changes the match.
      return ctx.t(mine ? 'say.sentOff.ours' : 'say.sentOff.theirs');

    case 'start':
      return ctx.t('say.start');
  }

  // ⚠️ NO `default`, AND THAT IS THE POINT OF THIS REWRITE. It used to end in
  //    `default: return t('say.start')`, so the day fouls existed a blind child heard "the match begins"
  //    every time one was given - a wrong answer delivered confidently, which is worse than silence and
  //    which no test would catch, because a real sentence came back. The switch is exhaustive now, so a
  //    thirteenth event fails the TYPECHECK the way it already does in `audio/cues`.
  //
  //    This line is unreachable while `PhaseEvent` is what it is, and TypeScript needs it anyway.
  return ctx.t('say.start');
}

/**
 * The same event, shaped for the engine's announcement channel.
 *
 * The gender travels with the text because pt-BR needs the agreement, and getting it from a lookup at the
 * point of speech is what the `Speakable` type exists to prevent.
 */
export function announce(
  event: RuleEvent,
  ctx: NarrationCtx = { period: 1, us: 0, t: (k) => k },
): { readonly kind: 'event'; readonly name: Speakable; readonly urgent: boolean } {
  return {
    kind: 'event',
    name: { text: narrate(event, ctx), gender: 'm', plural: false },
    urgent: URGENT.has(event.kind),
  };
}
