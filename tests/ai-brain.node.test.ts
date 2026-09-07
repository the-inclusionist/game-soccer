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
import { AWAY, HOME, SQUAD_SIZE, firstOf } from '../app/js/sim/ids.ts';
import { createMatchState } from '../app/js/sim/state.ts';
import { NOBODY } from '../app/js/sim/possession.ts';
import { BOX, PITCH } from '../app/js/sim/units.ts';
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

  // ⚠️ THIS GATE COULD NOT FAIL, AND THAT IS WHY IT IS WRITTEN OUT AT LENGTH. It used to call `think`
  //    twice WITHOUT MOVING THE TICK - so both calls asked the same question of the same world, and the
  //    two answers matched whether the stagger existed or not. Measured: `thinksThisTick` was replaced
  //    with `return true`, removing the budget entirely, and this file stayed green on all seventeen.
  //
  //    Worse, it is the gate NAMED for the thing. Pillar 1 - sixty frames a second on a school tablet -
  //    is the dominant engineering constraint of this game, the stagger is how the AI pays it, and the
  //    only gates that noticed its removal were the two that ask `thinksThisTick` what it returns. Those
  //    measure the module. This is supposed to measure the WIRE.
  //
  //    ⚠️ AND IT NEEDS BOTH HALVES. A gate that only shows the target standing still passes on an AI
  //    that never decides anything at all, so the second half moves the tick to one he IS scheduled for
  //    and demands that the target moves. Player 4 decides when `(tick + 4) % 6 === 0`: tick 2, not 3.
  it('[Interface] a body that is not scheduled this tick keeps the target it decided earlier', () => {
    const s = live();
    s.tick = 2;
    think(s, skills);
    const decided = { ...s.players[4].target };

    // The whole match moves to the other end. A fresh decision could not land on the same spot.
    s.ball.p = { x: 5, y: 5, z: 0 };
    s.tick = 3;
    think(s, skills);

    expect(s.players[4].target, 'he decided again on a tick that is not his').toEqual(decided);
  });

  it('[Right] and on the tick that IS his, he decides again', () => {
    const s = live();
    s.tick = 2;
    think(s, skills);
    const decided = { ...s.players[4].target };

    s.ball.p = { x: 5, y: 5, z: 0 };
    s.tick = 8;
    think(s, skills);

    expect(s.players[4].target, 'he never decides at all, so the gate above proves nothing').not.toEqual(
      decided,
    );
  });
});

// ========================= AND SOMEBODY GOES IN THE BOX =========================
// The cross was built and never fired ONCE in six fixtures at each match length - measured, and proved by
// six byte-identical result sets in a deterministic simulation. It asks for somebody arriving in the box,
// because crossing to an empty one is a giveaway with extra steps, and nobody was ever there.
//
// Rule 3 of the cascade sends a supporting player `SUPPORT_AHEAD` past the shape, and the shape is a 4-4-2
// that slides with the ball - so an attacking third with a WIDE carrier has team-mates level with him and
// none in front of goal. Football's answer is that when the ball goes wide, the forwards go in.
describe('the run into the box', () => {
  // ⚠️ SIX TICKS, BECAUSE `think` IS STAGGERED. Agent `i` decides when `(tick + i) % 6 === 0` - the budget
  //    rule that keeps twenty-two brains to about four decisions a tick - so ONE call updates a sixth of
  //    the squad and the forwards are not in it. A gate that called it once reported that nobody went in
  //    for the cross, which was true of that tick and false of the game.
  const decideAll = (s: ReturnType<typeof createMatchState>) => {
    for (let t = 0; t < 6; t++) {
      s.tick = t;
      think(s, { 0: AVERAGE, 1: AVERAGE }, MATCH_PROFILE.playable);
    }
  };

  function wideAttack() {
    const s = createMatchState();
    s.phase = 'live';
    const carrier = firstOf(HOME) + 7;
    for (let k = 0; k < SQUAD_SIZE; k++) {
      s.players[firstOf(HOME) + k].p = { x: 60, y: 28 };
      s.players[firstOf(AWAY) + k].p = { x: 20, y: 50 };
    }
    // Home attacks increasing x in the first period: wide and high.
    s.players[carrier].p = { x: 78, y: 4 };
    s.ball.p = { x: 78, y: 4, z: 0 };
    s.ball.v = { x: 0, y: 0, z: 0 };
    s.possession.holder = carrier;
    s.possession.lastTouch = carrier;
    return { s, carrier };
  }

  it('[Right] the forwards target the box when the ball is wide and high', () => {
    const { s } = wideAttack();

    decideAll(s);

    const inTheBox = [9, 10].filter((k) => {
      const t = s.players[firstOf(HOME) + k].target;
      return t.x > PITCH.length - BOX.depth && Math.abs(t.y - PITCH.width / 2) < BOX.width / 2;
    });
    expect(inTheBox.length, 'nobody went in for the cross').toBeGreaterThan(0);
  });

  // ⚠️ AND THEY DO NOT STAND ON EACH OTHER. Two bodies on one spot is one target for a defender and one
  //    body's worth of chance; a box with two men in it is what a cross is played into.
  it('[Zero] and the two of them do not go to the same spot', () => {
    const { s } = wideAttack();

    decideAll(s);

    const a = s.players[firstOf(HOME) + 9].target;
    const b = s.players[firstOf(HOME) + 10].target;
    expect(Math.abs(a.y - b.y), 'both forwards ran to the same blade of grass').toBeGreaterThan(2);
  });

  // ⚠️ ONLY WHEN THE BALL IS ACTUALLY WIDE. With it in the middle the shape is the shape, and forwards
  //    standing in the box all match would be two men permanently offside and nine playing football.
  it('[Zero] but not when the ball is in the middle', () => {
    const { s, carrier } = wideAttack();
    s.players[carrier].p = { x: 78, y: 28 };
    s.ball.p = { x: 78, y: 28, z: 0 };

    decideAll(s);

    const inTheBox = [9, 10].filter((k) => {
      const t = s.players[firstOf(HOME) + k].target;
      return t.x > PITCH.length - BOX.depth && Math.abs(t.y - PITCH.width / 2) < BOX.width / 2;
    });
    expect(inTheBox.length).toBe(0);
  });
});


// ========================= AND A FORWARD RUNS BEYOND THE BALL =========================
// Rule 3 sends a supporting player to his SHAPE SPOT plus nine metres, and the 4-4-2 slides only a quarter
// of the way toward the ball - so with a carrier at seventy-five metres a forward is aimed at sixty-nine,
// BEHIND him. Nobody in this game has ever run past the ball.
//
// It is why three things could not work at once. The cross waits for a body in the box; the ball played
// into a runner's path has nobody running; and corners and goal kicks are events at the end of a pitch
// the attack stopped short of. Measured: 1.67 to 10 balls into the box a match, and corners at 0.50
// against a band of 1.5 to 3, with every lever tried on them making one of the three worse.
//
// ⚠️ AND HE STOPS AT THE LAST DEFENDER, which is the whole of what makes it football rather than two men
// camped in the six-yard box. A striker times his run to stay onside; the line comes from
// `rules/offside.offsideLineOf`, so the AI reads the same line the referee does rather than copying it.
describe('the run beyond the ball', () => {
  function attacking(ballAt: number, backLine: number) {
    const s = createMatchState();
    s.phase = 'live';
    const carrier = firstOf(HOME) + 7;
    for (let k = 0; k < SQUAD_SIZE; k++) {
      s.players[firstOf(HOME) + k].p = { x: ballAt - 12, y: 28 };
      s.players[firstOf(AWAY) + k].p = { x: backLine, y: 20 + k };
    }
    s.players[carrier].p = { x: ballAt, y: 28 };
    s.ball.p = { x: ballAt, y: 28, z: 0 };
    s.ball.v = { x: 0, y: 0, z: 0 };
    s.possession.holder = carrier;
    s.possession.lastTouch = carrier;
    return s;
  }

  // ⚠️ THE TICK HAS TO MOVE, and this gate was written without moving it - so `think` asked
  //    `thinksThisTick(9, state.tick)` the same question six times and the forward never decided at all.
  //    It is the same mistake the run-into-the-box gate in this file records making, which is what a
  //    written-down defect is for.
  const forwardTarget = (s: ReturnType<typeof createMatchState>) => {
    for (let t = 0; t < 6; t++) {
      think(s, { 0: AVERAGE, 1: AVERAGE }, MATCH_PROFILE.playable);
      s.tick += 1;
    }
    return s.players[firstOf(HOME) + 9].target;
  };

  it('[Right] with the ball high, a forward is aimed past it', () => {
    const s = attacking(70, 84);

    expect(forwardTarget(s).x, 'he was aimed behind the man on the ball').toBeGreaterThan(70);
  });

  // ⚠️ NOT PAST THE LAST DEFENDER. Two men camped beyond the line are two men permanently offside and
  //    nine playing football, which is the objection that kept this rule out of the game until now.
  // ⚠️ THE NEAR-POST MAN HOLDS THE LINE and the far-post man gambles past it, which is a forward
  //    PAIRING rather than a dice. A striker who times his run perfectly is never caught, and the day
  //    this run was built the offsides went from 0.33 a match to 0.00 - correct football with a hole in
  //    it. He is not punished for standing there: Law 11 raises the flag only when the ball is PLAYED to
  //    him, which is why a poacher is a position and not a mistake.
  it('[Boundary] the near-post forward holds the line', () => {
    const s = attacking(70, 76);
    for (let t = 0; t < 6; t++) {
      think(s, { 0: AVERAGE, 1: AVERAGE }, MATCH_PROFILE.playable);
      s.tick += 1;
    }

    expect(s.players[firstOf(HOME) + 9].target.x, 'he ran himself offside').toBeLessThanOrEqual(76.001);
  });

  // ⚠️ A GAMBLING FAR-POST FORWARD WAS BUILT HERE AND REVERTED - see `ai/brain` for the table. He
  //    bought a third of the offside count and sold the goals, the corners and the goal kicks, because a
  //    man standing permanently beyond the last defender is a free man for the whole match.

  it('[Zero] and he holds the shape while the ball is in our own half', () => {
    const deep = attacking(20, 84);
    const high = attacking(70, 84);

    expect(forwardTarget(deep).x, 'he ran into the box off a ball in our own half').toBeLessThan(
      PITCH.length - BOX.depth,
    );
    expect(forwardTarget(high).x, 'the run beyond does not reach the box even when it should').toBeGreaterThan(
      PITCH.length - BOX.depth,
    );
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
  // ⚠️ TWO DIFFERENT CLUBS, FOR THE SECOND TIME IN THIS FILE AND FOR THE SAME REASON. `AVERAGE` against
  //    `AVERAGE` is a mirror - the away shape is the home shape rotated half a turn and the simulation has
  //    no randomness in it - and once restarts stopped being played straight back out of play, that mirror
  //    produced twelve thousand ticks with NO STOPPAGE AT ALL. The precondition of this gate could not be
  //    met by a match the game cannot actually produce: `fixtureOf` refuses a club playing itself.
  it('[Zero] and it never wedges - every stoppage is followed by play resuming', () => {
    const s = createMatchState();
    s.phase = 'live';
    const sides = { 0: CLUBS[0].ratings, 1: CLUBS[1].ratings };
    let stoppages = 0;
    let resumptions = 0;

    // ⚠️ LONG ENOUGH FOR STOPPAGES TO EXIST AT ALL. Twelve thousand ticks was set when this game had
    //    364 throw-ins per ninety minutes; holding the ten yards until a restart is taken brought that
    //    to 52 - about football's rate - and three minutes of football legitimately contains two or
    //    three stoppages. The claim is unchanged; the window is long enough to meet its precondition.
    for (let t = 0; t < 36000; t++) {
      for (const e of playTick(s, emptyFrame(t), DT, MATCH_PROFILE, sides)) {
        if (e.kind.startsWith('crossed') || e.kind === 'goalScored') stoppages += 1;
        if (e.kind === 'restartTaken' || e.kind === 'ballMoved') resumptions += 1;
      }
    }

    // ⚠️ THE PRECONDITION, NOT THE CLAIM. This gate is about a stoppage that never ends, and it needs at
    //    least one stoppage to look at - it does not have an opinion about how many there should be. It
    //    asked for four when the game produced 364 throw-ins per ninety minutes; at football's rate a
    //    ten-minute window contains one or two, and the FREQUENCY is gated on the slate in
    //    `tests/full-match` where six whole matches can answer it.
    expect(stoppages, 'nothing stopped play at all, so nothing was checked').toBeGreaterThan(0);
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
      // ⚠️ AND FORTY THOUSAND EACH, for the same reason: goals fell to three per ninety minutes -
      //    football's own rate - once restarts stopped being contested the instant they were taken.
      for (let t = 0; t < 40_000; t++) {
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
