// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CASCADE, and the one test that says whether any of this is football.
//
// ========================= WHY A CASCADE AND NOT A BEHAVIOUR TREE =========================
// Seven ordered questions, first match wins. A behaviour tree would be more expressive and would also be
// a second language to read, a second thing to debug and a second place for the cost budget to escape
// through. Football's decisions are naturally ranked - the keeper keeps, the carrier carries, the nearest
// chases - so the ranking IS the algorithm.
//
// ========================= THE ONE PRESSER RULE =========================
// The failure that makes cheap football AI unwatchable is eleven players converging on the ball. It is
// not fixed by tuning; it is fixed by only ONE player per side being allowed to chase the carrier, which
// is also what real defending looks like. It is a plan-level fact, decided once per team, not a decision
// each agent takes about itself.
import { describe, expect, it } from 'vitest';
import { teamPlan } from '../app/js/ai/plan.ts';
import { think } from '../app/js/ai/brain.ts';
import { AVERAGE } from '../app/js/ai/ratings.ts';
import { CLUBS } from '../app/js/teams/roster.ts';
import { AWAY, HOME, SQUAD_SIZE } from '../app/js/sim/ids.ts';
import { createMatchState } from '../app/js/sim/state.ts';
import { NOBODY } from '../app/js/sim/possession.ts';
import { PITCH } from '../app/js/sim/units.ts';
import { dist2 } from '../app/js/sim/vec.ts';
import { playTick } from '../app/js/play.ts';
import { emptyFrame } from '../app/js/sim/command.ts';
import { DT } from '../app/js/sim/ball.ts';
import { MATCH_PROFILE, PRACTICE_PROFILE } from '../app/js/rules/profile.ts';

const skills = { [HOME]: AVERAGE, [AWAY]: AVERAGE } as const;

function live() {
  const s = createMatchState();
  s.phase = 'live';
  return s;
}

describe('the team plan', () => {
  it('[One] names exactly one presser when the other side has the ball', () => {
    const s = live();
    s.possession.holder = SQUAD_SIZE + 5;

    const plan = teamPlan(s, HOME);

    expect(plan.presserId).toBeGreaterThanOrEqual(0);
    expect(plan.presserId).toBeLessThan(SQUAD_SIZE);
  });

  it('[Zero] names no presser when we have the ball ourselves', () => {
    const s = live();
    s.possession.holder = 4;

    expect(teamPlan(s, HOME).presserId).toBe(-1);
  });

  it('[Right] the presser is the nearest of ours to the ball, and ties go to the lower shirt', () => {
    const s = live();
    s.possession.holder = SQUAD_SIZE + 5;
    s.ball.p = { x: 40, y: 28, z: 0 };
    for (let i = 0; i < SQUAD_SIZE; i++) s.players[i].p = { x: 10, y: 10 };
    s.players[7].p = { x: 41, y: 28 };

    expect(teamPlan(s, HOME).presserId).toBe(7);
  });

  it('[Right] holding the ball is an attacking plan with a high line; defending sits deeper', () => {
    const s = live();
    s.possession.holder = 4;
    const attacking = teamPlan(s, HOME);
    s.possession.holder = SQUAD_SIZE + 4;
    const defending = teamPlan(s, HOME);

    expect(attacking.mode).toBe('attack');
    expect(defending.mode).toBe('defend');
    expect(attacking.lineHeight).toBeGreaterThan(defending.lineHeight);
  });

  it('[Zero] a loose ball is a transition, and both sides read it that way', () => {
    const s = live();
    s.possession.holder = NOBODY;

    expect(teamPlan(s, HOME).mode).toBe('transition');
    expect(teamPlan(s, AWAY).mode).toBe('transition');
  });
});

describe('the cascade', () => {
  it('[One] the keeper stays near his own goal even when the ball is at the other end', () => {
    const s = live();
    s.ball.p = { x: 85, y: 28, z: 0 };

    for (let t = 0; t < 600; t++) {
      playTick(s, emptyFrame(t), DT, MATCH_PROFILE, skills);
    }

    expect(s.players[0].p.x).toBeLessThan(PITCH.length / 3);
  });

  // ⚠️ THE ANTI-SWARM GATE. Without the one-presser rule this number is eleven, and the game stops being
  //    football at every loose ball - which is most of a match.
  it('[Many] never more than a handful of one side within five metres of the ball', () => {
    const s = live();
    let worst = 0;

    for (let t = 0; t < 900; t++) {
      playTick(s, emptyFrame(t), DT, MATCH_PROFILE, skills);
      let near = 0;
      for (let i = 0; i < SQUAD_SIZE; i++) {
        if (dist2(s.players[i].p, s.ball.p) < 25) near += 1;
      }
      if (near > worst) worst = near;
    }

    expect(worst).toBeLessThanOrEqual(4);
  });

  it('[Right] with the ball loose, somebody actually goes and gets it', () => {
    const s = live();
    s.ball.p = { x: 45, y: 28, z: 0 };
    const before = Math.min(...s.players.map((p) => dist2(p.p, s.ball.p)));

    for (let t = 0; t < 120; t++) {
      playTick(s, emptyFrame(t), DT, MATCH_PROFILE, skills);
    }

    const after = Math.min(...s.players.map((p) => dist2(p.p, s.ball.p)));
    expect(after).toBeLessThan(before);
  });

  it('[Interface] thinking is staggered, so a body keeps steering toward a target it decided earlier', () => {
    const s = live();
    think(s, skills);
    const first = { ...s.players[4].target };

    think(s, skills);

    expect(s.players[4].target).toEqual(first);
  });
});

describe('a match that plays itself', () => {
  // ⚠️ THE GATE THAT SAYS WHETHER ANY OF THIS IS FOOTBALL. Twenty-two agents, no human input, and the
  //    only two questions worth asking: does the ball ever leave play, and does anybody ever score. An AI
  //    that deadlocks passes every unit test above and fails this one.
  // A hundred seconds is enough to see the match MOVE - the ball changes ends, somebody scores, the phase
  // changes. It is not enough to be sure a ball goes out, which is measured over a longer match below;
  // asserting it here would be asserting a frequency rather than a behaviour.
  it('[Right] from a kickoff, with nobody playing, the match actually progresses', () => {
    const s = createMatchState();
    s.phase = 'live';
    const phasesSeen = new Set<string>();
    const startX = s.ball.p.x;
    let travelled = 0;

    for (let t = 0; t < 6000; t++) {
      playTick(s, emptyFrame(t), DT, MATCH_PROFILE, skills);
      phasesSeen.add(s.phase);
      const from = Math.abs(s.ball.p.x - startX);
      if (from > travelled) travelled = from;
    }

    expect(phasesSeen.size).toBeGreaterThan(1);
    expect(travelled).toBeGreaterThan(20);
  });

  // ⚠️ THE PROPERTY IS "PLAY KEEPS RESUMING", NOT "THE PHASE IS LIVE AT TICK 6000". A match legitimately
  //    ends a tick on a throw-in, so asserting the final phase would fail for a reason that is not a bug.
  //    What must never happen is play stopping and never starting again - which is exactly the deadlock
  //    this file found three times: the goalkeeper who held the ball forever, the dead ball nobody walked
  //    to because bodies did not move while stopped, and the kickoff that answered the wrong event.
  it('[Zero] and it never wedges - every stoppage is followed by play resuming', () => {
    const s = createMatchState();
    s.phase = 'live';
    let stoppages = 0;
    let resumptions = 0;

    for (let t = 0; t < 12000; t++) {
      for (const e of playTick(s, emptyFrame(t), DT, MATCH_PROFILE, skills)) {
        if (e.kind.startsWith('crossed') || e.kind === 'goalScored') stoppages += 1;
        if (e.kind === 'restartTaken' || e.kind === 'ballMoved') resumptions += 1;
      }
    }

    expect(stoppages).toBeGreaterThan(3);
    // ⚠️ ONE OUTSTANDING STOPPAGE IS ALLOWED, AND THE COMMENT ABOVE ALREADY SAID WHY. The run stops at a
    //    fixed tick, and it can stop DURING a throw-in - measured: at tick 12,000 the phase was `throwIn`,
    //    fifty-nine stoppages and fifty-eight resumptions. Requiring equality made "the clock ran out mid
    //    throw-in" indistinguishable from a wedge, and it had been green by luck rather than by argument.
    //    At most one stoppage can be in flight at any instant, so one is the honest allowance and two
    //    would still be a wedge.
    expect(resumptions).toBeGreaterThanOrEqual(stoppages - 1);
  });

  // ⚠️ TWO DIFFERENT CLUBS, AND THAT IS NOT A CONVENIENCE. This used to run `AVERAGE` against `AVERAGE`,
  //    and once the machine stopped fouling every four seconds those two never scored at all: measured at
  //    108,000 ticks - thirty minutes - 167 throw-ins, three fouls, no goals, no corners, no goal kicks.
  //
  //    The reason is symmetry. The away side is the home side's shape rotated by half a turn, the
  //    simulation has no randomness in it by design, and two sides with identical ratings therefore play a
  //    mirror image of each other for ever. Any difference at all breaks it, and `fixtureOf` REFUSES a club
  //    playing itself - so the configuration this gate used is one the game cannot produce.
  //
  //    ⚠️ It is written down rather than quietly swapped, because it says something true about how these
  //    goals are scored: the AI was living off the chaos of a foul every four seconds, and with the foul
  //    rate corrected to football's the deadlock underneath became visible. That is an AI weakness, it is
  //    now measured, and it wants the session about defending that the README already owes.
  // ⚠️ THREE FIXTURES, AND IT TOOK THREE GOES TO ADMIT WHY. This asked one club pair for a goal, and it
  //    has now gone red twice for reasons that had nothing to do with the claim: once when the machine
  //    stopped fouling every four seconds, and again when the card thresholds were recalibrated. Each time
  //    the honest-looking repair was to run it for longer - and lengthening a gate until a chaotic system
  //    happens to oblige is fitting the test to the data.
  //
  //    "A long match produces the whole vocabulary" is a claim about the GAME, not about one club pair.
  //    Measured under this profile, the first goal arrives on tick 2,607 for one pair and 14,523 for
  //    another, and a third does not score in eighty thousand at all. Asked of the union of three, it is a
  //    question with an answer; asked of any one of them, it is a coin.
  it('[Right] a long match produces the whole vocabulary of restarts, not just one', () => {
    const seen = new Set<string>();

    for (const [h, a] of [[0, 1], [4, 5], [8, 9]] as const) {
      const s = createMatchState();
      s.phase = 'live';
      const sides = { 0: CLUBS[h].ratings, 1: CLUBS[a].ratings };
      for (let t = 0; t < 24_000; t++) {
        for (const e of playTick(s, emptyFrame(t), DT, MATCH_PROFILE, sides)) seen.add(e.kind);
      }
    }

    expect(seen.has('crossedTouchline')).toBe(true);
    expect(seen.has('goalScored')).toBe(true);
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });
});

describe('a practice session', () => {
  // ⚠️ THE HALF PITCH HAS TO BE REAL, NOT A CLAIM THE DECLARATION MAKES ALONE. Before this, `topology()`
  //    reported half a pitch while every body still spread over the whole one - the sonar would have
  //    counted paces across a space nobody was playing in. A field that only one consumer honours is a
  //    field that is wrong somewhere, and the gate is here rather than in the declaration because the
  //    bodies are what make it true.
  it('[Boundary] every body stays inside the training half', () => {
    const s = createMatchState();
    s.phase = 'live';
    s.ball.p = { x: PRACTICE_PROFILE.playable.length / 2, y: 28, z: 0 };

    for (let t = 0; t < 1800; t++) playTick(s, emptyFrame(t), DT, PRACTICE_PROFILE, skills);

    for (let i = 0; i < s.players.length; i++) {
      expect(s.players[i].target.x, `player ${i}`).toBeLessThanOrEqual(
        PRACTICE_PROFILE.playable.length + 0.001,
      );
    }
  });

  it('[Right] and on a full pitch they use all of it, so the clamp above is not just a small number', () => {
    const s = createMatchState();
    s.phase = 'live';

    for (let t = 0; t < 1800; t++) playTick(s, emptyFrame(t), DT, MATCH_PROFILE, skills);

    const deepest = Math.max(...s.players.map((p) => p.target.x));
    expect(deepest).toBeGreaterThan(PRACTICE_PROFILE.playable.length);
  });
});
