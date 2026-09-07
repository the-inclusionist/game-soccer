// SPDX-License-Identifier: AGPL-3.0-or-later
// HOW MANY PLAYERS ARE ACTUALLY ON THE PITCH.
//
// ========================= A PRACTICE PITCH IS NOT A MATCH WITH THE RULES OFF =========================
// The reference feature is "a free-form rehearsal pitch with a lone keeper and no match structure". With
// twenty-two bodies still running around, switching the rules off produces a kickabout that looks exactly
// like a match nobody is refereeing - which is not what a child asked for when she chose to practise.
//
// ⚠️ AND AN ABSENT BODY MUST BE ABSENT EVERYWHERE, or it is worse than present. A body the renderer hides
// but possession still considers is an invisible player who can take the ball; one the AI skips but the
// offside line still counts is a defender nobody can see holding a line. The gate below asks every
// consumer the same question, because "absent" that half the code believes is a bug with no symptom.
import { describe, expect, it } from 'vitest';
import { createMatchState } from '../app/js/sim/state.ts';
import { onPitch, squadIds } from '../app/js/sim/squads.ts';
import { MATCH_PROFILE, PRACTICE_PROFILE } from '../app/js/rules/profile.ts';
import { AWAY, HOME, SQUAD_SIZE } from '../app/js/sim/ids.ts';
import { playTick } from '../app/js/play.ts';
import { emptyFrame } from '../app/js/sim/command.ts';
import { DT } from '../app/js/sim/ball.ts';
import { AVERAGE } from '../app/js/ai/ratings.ts';
import { NOBODY } from '../app/js/sim/possession.ts';

const skills = { 0: AVERAGE, 1: AVERAGE };

describe('a match', () => {
  it('[Many] puts eleven a side on the pitch', () => {
    const s = createMatchState(MATCH_PROFILE);

    expect(squadIds(s, HOME)).toHaveLength(SQUAD_SIZE);
    expect(squadIds(s, AWAY)).toHaveLength(SQUAD_SIZE);
  });
});

describe('a practice session', () => {
  it('[One] leaves ONE opponent on the pitch, and he is the keeper', () => {
    const s = createMatchState(PRACTICE_PROFILE);

    expect(squadIds(s, AWAY)).toEqual([SQUAD_SIZE]);
  });

  it('[Many] and a handful on our side, not a full eleven', () => {
    const s = createMatchState(PRACTICE_PROFILE);

    expect(squadIds(s, HOME).length).toBeGreaterThan(1);
    expect(squadIds(s, HOME).length).toBeLessThan(SQUAD_SIZE);
  });

  it('[Interface] every id it reports is on the pitch, and every other id is not', () => {
    const s = createMatchState(PRACTICE_PROFILE);
    const reported = new Set([...squadIds(s, HOME), ...squadIds(s, AWAY)]);

    for (let id = 0; id < SQUAD_SIZE * 2; id++) {
      expect(onPitch(s, id), `player ${id}`).toBe(reported.has(id));
    }
  });

  // ⚠️ THE SETUP IS THE TEST. Absent bodies left at their kickoff positions are far from the ball and
  //    already still, so they behave identically whether the guards exist or not - three mutations that
  //    removed the guards all passed against the first version of this. Put ON the ball, and moving, they
  //    would be taken into account by every consumer that had forgotten them.
  // ⚠️ THE PHASE HAS TO BE `live`, and leaving it out used to work by accident. `preMatch` stepped the
  //    world like any other phase until the day the match learned to stop, so these ran a simulation that
  //    should never have been running - and would have gone on passing while the game itself was frozen.
  it('[Zero] an absent body ON the ball still never takes it and never drifts', () => {
    const s = createMatchState(PRACTICE_PROFILE);
    s.phase = 'live';
    const absent = SQUAD_SIZE + 5;
    s.ball.p = { x: 30, y: 28, z: 0 };
    s.players[absent].p = { x: 30, y: 28 };
    s.players[absent].v = { x: 4, y: 4 };
    const before = { ...s.players[absent].p };
    const holders = new Set<number>();

    for (let t = 0; t < 600; t++) {
      playTick(s, emptyFrame(t), DT, PRACTICE_PROFILE, skills);
      if (s.possession.holder !== NOBODY) holders.add(s.possession.holder);
    }

    expect(s.players[absent].p, 'an absent body drifted').toEqual(before);
    expect([...holders].filter((id) => !onPitch(s, id)), 'an absent body took the ball').toEqual([]);
  });

  // The think guard is a COST guard, not a correctness one - the steering guard already keeps an absent
  // body still. It is kept because deciding for bodies nobody can see is work a school tablet cannot spare,
  // and this is what says so.
  it('[Performance] no decision is ever spent on a body that is not playing', () => {
    const s = createMatchState(PRACTICE_PROFILE);
    s.phase = 'live';
    const before = s.players.map((p) => ({ ...p.target }));

    for (let t = 0; t < 600; t++) playTick(s, emptyFrame(t), DT, PRACTICE_PROFILE, skills);

    for (let id = 0; id < s.players.length; id++) {
      if (onPitch(s, id)) continue;
      expect(s.players[id].target, `player ${id} was given a target`).toEqual(before[id]);
    }
  });

  it('[Right] and the ones who ARE there do move, so the test above is not measuring a frozen match', () => {
    const s = createMatchState(PRACTICE_PROFILE);
    s.phase = 'live';
    const present = squadIds(s, HOME)[1];
    const before = { ...s.players[present].p };

    for (let t = 0; t < 600; t++) playTick(s, emptyFrame(t), DT, PRACTICE_PROFILE, skills);

    expect(s.players[present].p).not.toEqual(before);
  });
});

describe('the digest', () => {
  it('[Interface] a state knows how many are on the pitch, so a replay cannot disagree about it', () => {
    const match = createMatchState(MATCH_PROFILE);
    const practice = createMatchState(PRACTICE_PROFILE);

    expect(match.onPitch).not.toEqual(practice.onPitch);
  });
});
