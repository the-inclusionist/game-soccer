// SPDX-License-Identifier: AGPL-3.0-or-later
// THE REFEREE. The only place a rule is decided.
//
// `evaluate` READS and returns; `applyEvents` is the only thing that writes. Keeping the decision apart
// from its consequence is what lets a test assert "this position IS a corner" without also asserting
// where twenty-two bodies then go - and it is what lets the same decision drive four consumers.

import { HOME, teamOf, type TeamId } from '../sim/ids.ts';
import { NOBODY } from '../sim/possession.ts';
import type { MatchState } from '../sim/state.ts';
import type { RuleEvent } from './events.ts';
import { judgeBall, type EndId } from './out-of-play.ts';
import { nextPhase } from './phase.ts';
import type { RulesProfile } from './profile.ts';

/** Which team defends `end`. Home defends end 0 in the first period, and they swap at half time. */
export function defenderOf(end: EndId, period: number): TeamId {
  const homeDefendsZero = period === 1;
  const homeDefends: EndId = homeDefendsZero ? 0 : 1;
  return end === homeDefends ? HOME : (1 as TeamId);
}

/** Is the ball dead - nobody in control? A period ends only on a dead ball, never mid-dribble. */
const ballIsDead = (state: MatchState): boolean => state.possession.holder === NOBODY;

/**
 * Everything the laws have to say about this tick.
 *
 * Returns at most one ball verdict plus at most one clock verdict: two independent facts, and a ball
 * going out on the very tick the half expires is both a throw-in and half time.
 */
export function evaluate(state: MatchState, profile: RulesProfile): RuleEvent[] {
  if (state.phase !== 'live') return [];

  const events: RuleEvent[] = [];
  const verdict = judgeBall(state.ball);

  if (verdict.kind === 'goal') {
    // Whoever defends that end conceded, so the other team scored. Derived rather than stored, because a
    // stored "attacking team" would have to be remembered to swap at half time and would one day not be.
    const conceded = defenderOf(verdict.end, state.period);
    events.push({ kind: 'goalScored', team: (1 - conceded) as TeamId });
  } else if (verdict.kind === 'touchline' && profile.outOfPlay) {
    events.push({ kind: 'crossedTouchline', at: verdict.at });
  } else if (verdict.kind === 'goalLine' && profile.outOfPlay) {
    // ⚠️ THE ONE FACT THAT TELLS A CORNER FROM A GOAL KICK is who touched it last, and it is asked after
    //    the ball has already gone - when nobody is holding it. That is why `lastTouch` outlives `holder`.
    const toucher = state.possession.lastTouch;
    const defending = defenderOf(verdict.end, state.period);
    const byDefender = toucher !== NOBODY && teamOf(toucher) === defending;
    events.push({
      kind: byDefender ? 'crossedGoalLineByDefender' : 'crossedGoalLineByAttacker',
      at: verdict.at,
    });
  }

  if (profile.clock === 'count' && ballIsDead(state)) {
    const elapsed = profile.periodTicks * state.period;
    if (state.tick >= elapsed) {
      events.push({ kind: state.period >= 2 ? 'secondPeriodExpired' : 'periodExpired' });
    }
  }

  return events;
}

/** Turn the referee's decisions into the world's new phase, score and period. */
export function applyEvents(state: MatchState, events: readonly RuleEvent[], profile: RulesProfile): void {
  for (const event of events) {
    const to = nextPhase(state.phase, event.kind, profile);
    if (to === null) continue;

    if (event.kind === 'goalScored' && event.team !== undefined) state.goals[event.team] += 1;
    if (event.kind === 'periodExpired') state.period += 1;

    state.phase = to;
  }
}
