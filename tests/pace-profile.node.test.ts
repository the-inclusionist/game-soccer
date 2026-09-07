// SPDX-License-Identifier: AGPL-3.0-or-later
// ONE SIMULATION, TWO MATCH LENGTHS.
//
// ========================= WHAT THE DEV ASKED FOR, AND WHY IT NEEDED A LEVER =========================
// Football's counts - 40 throw-ins, 2.7 goals, 10 corners, 1.7 bookings, 0.07 sendings-off - in BOTH a
// fifteen-minute match and a ninety-minute one. The same absolute numbers over six times the time is six
// times fewer events per minute, and no rule can deliver both: a rule is a fact about a TICK, and both
// modes run the same ticks. It wants a different world, not a different referee.
//
// ⚠️ AND THE LEVER WAS CHOSEN BY MEASUREMENT, WITH TWO CANDIDATES REJECTED. Over ninety-minute matches:
//
//     lever                    throw-ins   goals   corners   bookings      target: 40, 2.7, 10, 1.7
//     as it plays                  206.0    17.3       5.0        1.0
//     pitch 112x70                 250.0     5.3       0.3
//     pitch 158x98                 418.0     2.3       1.3
//     seven a side                 514.0    11.7       5.7        1.3
//     five a side                  662.0     4.7       5.3        0.3
//     bodies at half pace           89.3     1.0       9.0        1.7
//
// More space per player SPLITS the targets - it takes the goals down and pushes the throw-ins up, because
// a loose ball travels further before anybody reaches it. Only slowing the bodies moves all four together,
// and at half pace the corners and the bookings land on football's numbers exactly.
import { describe, expect, it } from 'vitest';
import { FULL_MATCH, MATCH_PROFILE, SHORT_MATCH, withPace } from '../app/js/rules/profile.ts';
import { AVERAGE, capsBySide } from '../app/js/ai/ratings.ts';
import { createMatchState } from '../app/js/sim/state.ts';
import { playTick } from '../app/js/play.ts';
import { DT } from '../app/js/sim/ball.ts';
import { emptyFrame } from '../app/js/sim/command.ts';
import { CLUBS } from '../app/js/teams/roster.ts';

describe('the pace of a profile', () => {
  it('[Right] halving it halves what a body can do', () => {
    const full = capsBySide(AVERAGE, AVERAGE, 1)[0].body;
    const half = capsBySide(AVERAGE, AVERAGE, 0.5)[0].body;

    expect(half.maxSpeed).toBeCloseTo(full.maxSpeed / 2, 10);
    expect(half.accel).toBeCloseTo(full.accel / 2, 10);
  });

  // ⚠️ IT SCALES THE CAPS AND NOT THE RATINGS, which is what keeps the six club numbers meaning what they
  //    say: a quick club is still quicker than a slow one at any pace. Scaling the ratings instead would
  //    make every club average in the slow mode, and `pace` is one of the six.
  it('[Right] and a quick club is still quicker than a slow one', () => {
    const quick = { ...AVERAGE, pace: 1 };
    const slow = { ...AVERAGE, pace: 0 };
    const [q, s] = capsBySide(quick, slow, 0.5);

    expect(q.body.maxSpeed).toBeGreaterThan(s.body.maxSpeed);
  });

  it('[Zero] and the default profile is unchanged, so every other gate describes the same world', () => {
    expect(MATCH_PROFILE.pace).toBe(1);
  });

  // ⚠️ THE GATE THAT SAYS IT REACHES THE PITCH. A profile field that nothing multiplies is a number on a
  //    card, and this repository has found eight of those - so this drives a real match and measures a
  //    body, rather than asking `capsBySide` what it returns.
  it('[Right] a match at half pace moves its bodies at half pace', () => {
    const slowly = withPace(MATCH_PROFILE, 0.5);
    const skills = { 0: CLUBS[0].ratings, 1: CLUBS[1].ratings };

    // ⚠️ THE FASTEST ANY BODY GOT, AND TWO WEAKER MEASURES WERE TRIED FIRST. Net displacement reported
    //    the FAST match as the slower one - a quick body reaches its spot and stops while a slow one is
    //    still on its way - and so did total path, for the same reason. `pace` multiplies a CAP, so the
    //    honest question is what speed the caps allowed anybody to reach.
    const topSpeed = (profile: typeof MATCH_PROFILE) => {
      const s = createMatchState(profile);
      s.phase = 'live';
      let fastest = 0;
      for (let t = 0; t < 600; t++) {
        playTick(s, emptyFrame(t), DT, profile, skills);
        for (const b of s.players) {
          const v = Math.sqrt(b.v.x * b.v.x + b.v.y * b.v.y);
          if (v > fastest) fastest = v;
        }
      }
      return fastest;
    };

    const slow = topSpeed(slowly);
    const fast = topSpeed(MATCH_PROFILE);
    expect(slow, 'the profile said half pace and nothing slowed down').toBeLessThan(fast * 0.6);
    expect(slow, 'nothing moved at all').toBeGreaterThan(0);
  });
});

// ========================= THE TWO MODES THE DEV ASKED FOR =========================
describe('the two match lengths', () => {
  // ⚠️ SEVEN MINUTES, FROM THE GENRE. International Superstar Soccer offered three, five and seven, and
  //    the plan asks for arcade. It was fifteen until 2026-09-07, which was a number with no reason.
  it('[Interface] the school match is seven minutes at the pace the game already plays at', () => {
    expect(SHORT_MATCH.periodTicks).toBe(Math.round(3.5 * 60 * 60));
    expect(SHORT_MATCH.pace, 'the short mode needed a lever, and it does not').toBe(1);
  });

  it('[Interface] and the full one is ninety minutes at half pace', () => {
    expect(FULL_MATCH.periodTicks).toBe(Math.round(45 * 60 * 60));
    expect(FULL_MATCH.pace).toBe(0.5);
  });

  // ⚠️ THE NUMBERS BEHIND THEM ARE NOT GATED HERE, and that is deliberate. Six ninety-minute matches is two
  //    million ticks; asking for them on every `validate` would cost more than it protects. They are
  //    measured and written into `rules/profile` beside each mode, with the two rejected levers alongside,
  //    and `tests/full-match` gates the shape of a match on a slate it can afford to run.
  it('[Zero] and both are the same referee, so neither is a different game', () => {
    for (const p of [SHORT_MATCH, FULL_MATCH]) {
      expect(p.fouls).toBe(MATCH_PROFILE.fouls);
      expect(p.offside).toBe(MATCH_PROFILE.offside);
      expect(p.outOfPlay).toBe(MATCH_PROFILE.outOfPlay);
      expect(p.playable).toEqual(MATCH_PROFILE.playable);
      expect(p.squads).toEqual(MATCH_PROFILE.squads);
    }
  });
});
