// SPDX-License-Identifier: AGPL-3.0-or-later
// NINETY SECONDS OF FOOTBALL, RECORDED AS NUMBERS, AND COMPARED AGAINST THE SAME NINETY TOMORROW.
//
// ========================= THE HALF OF `replay` THAT WAS NEVER BUILT =========================
// `tests/replay` asks that a recording replays to the digest trail it was recorded with, and refuses a
// recording from another simulation version. Both are real, and neither can see what this sees: they
// compare a build against ITSELF. A change to the AI rewrites the recording and the replay together, and
// the gate goes on passing while the game becomes a different game.
//
// ⚠️ THE NEED IS MEASURED, NOT ARGUED. `thinksThisTick` was replaced with `return true` - deleting the AI
// budget outright, so twenty-two agents re-decide on every tick instead of one in six - and of seven
// hundred and thirty-eight gates, the only two that went red were the two that ask the schedule module
// what it returns. Every behavioural gate stayed green: the digests, the whole-match slate, the anti-swarm
// count, all of it. Twenty-two players did something different on five ticks out of every six and nothing
// in this repository said so.
//
// ========================= WHAT A RED HERE MEANS, AND WHAT IT DOES NOT =========================
// ⚠️ THIS IS A CHARACTERISATION GATE AND NOT A SPECIFICATION. It says the match is no longer the match it
// was. It does NOT say the new one is worse - it cannot, because no number in it was chosen for being
// right. Every other gate in this repository asserts something football is true of; this one asserts only
// that yesterday and today agree.
//
// So a red here is a QUESTION: did you mean to change how a match plays?
//
//   - If you did - a new behaviour, a tuned constant, a fixed defect - re-run and paste the new trail in,
//     and say IN THE COMMIT MESSAGE what moved and why. The summary below the trail is there to make that
//     sentence writable: it tells you the score, the events and the tick the match ended on.
//   - If you did not, you have just found an accident, and that is the entire reason this file exists.
//
// ⚠️ AND RE-BLESSING IS A DECISION, NEVER A CHORE. A trail updated without a sentence explaining it turns
// this gate into a rubber stamp, at which point it costs a second a run and protects nothing. If you find
// yourself pasting numbers without knowing what changed, the honest move is to go and find out.
import { describe, expect, it } from 'vitest';
import { createMatchState } from '../app/js/sim/state.ts';
import { digest } from '../app/js/sim/digest.ts';
import { playTick } from '../app/js/play.ts';
import { MATCH_PROFILE, withPeriod } from '../app/js/rules/profile.ts';
import { SIM_VERSION } from '../app/js/sim/recorder.ts';
import { CLUBS } from '../app/js/teams/roster.ts';
import { DT } from '../app/js/sim/ball.ts';
import { emptyFrame } from '../app/js/sim/command.ts';

/**
 * Forty-five seconds a half, so ninety seconds is a WHOLE match.
 *
 * ⚠️ IT CROSSES HALF TIME ON PURPOSE. The ends swap there, and that single fact decides the offside line,
 * which way the AI plays and which way a blind child is sent - the rule that lived as five copies until
 * `sim/ends`. A golden that stopped at forty-four seconds would be blind to every second-half defect.
 */
const PROFILE = withPeriod(MATCH_PROFILE, 0.75);

/**
 * A hundred seconds of ticks for a ninety-second match, because STOPPAGES COST TICKS AND NOT CLOCK.
 *
 * ⚠️ IT WAS 5400 - exactly two halves - and that was a match finishing on its last tick with nothing to
 * spare. The shield change gave the sides the ball for twice as long, which brought a goal, a corner and
 * a goal kick into these ninety seconds; every restart spends ticks while the clock is stopped, and full
 * time moved to 5406. The gate went red for a reason that was not a defect and not the change either -
 * it was the margin having been nought all along.
 */
const TICKS = 6000;

/** Ten seconds. Nine checkpoints, so a red names the ten-second window the two builds parted company in. */
const CHECK_EVERY = 600;

/**
 * The trail, blessed by running it.
 *
 * ⚠️ THESE NUMBERS WERE NOT CHOSEN AND CANNOT BE REASONED ABOUT. They are what this simulation did, which
 * is the whole idea: the value of a golden master is that nobody can talk it into agreeing.
 */
const GOLDEN: readonly number[] = [
  419974381, 1602172179, 3014074223, 3347260423, 3268414972, 461152861, 2578459204, 3523803320, 3581948453,
  3581948453,
];

// ========================= THE TIMES THIS HAS BEEN RE-BLESSED =========================
// Each line is a change that was MEANT to move the match, with what it moved. A trail updated without one
// of these sentences is this gate turning into a rubber stamp.
//
//   2026-09-07  A fair challenge takes the ball. `ai/brain.challenger` and `rules/foul.judgeTackle`
//               covered only the ILLEGAL half of defending: a challenge that was not a foul did nothing
//               at all, so this game had no tackle that won anything and no deflections. In the
//               seven-minute match it moved fouls 1.50 to 2.67, yellows 0.00 to 0.50, throw-ins 16.83
//               down to 13.17, goal kicks 0.67 to 1.17 and offsides 0.50 to 0.83; goals fell 0.83 to
//               0.50, which is a defence that can now take the ball off an attack that could not finish
//               anyway. In these ninety seconds: throw-ins 1 to 5, and an offside that was not there.
//
//   2026-09-07  The shield follows the man, not the radius. A dribbler's own touch put the ball just
//               outside his control radius - 0.96 m against 0.90 - and the shield switched off at that
//               exact moment, so an opponent ten centimetres nearer took it without doing anything. In
//               the five-minute match, with nobody playing: balls into the box 1.67 to 7.33, possession
//               20.7% to 39.2%, changes of possession 227 to 140 a match, goals 0.67 to 2.50, throw-ins
//               14.33 down to 1.33. Scorelines went from 1-0 and 0-0 to 2-1, 3-2, 0-1. In these ninety
//               seconds: a goal, a corner and a goal kick where there had been none, and full time moved
//               from tick 5400 to 5406 - which is why the window above is 6000 now.
//
//   2026-09-07  A shot that can miss. `shotErrorOf` was calibrated for a rating no club has: the twelve
//               are generated between 0.26 and 0.74, and at 0.26 the error was 3.26 m across at the 22 m
//               shooting range - inside the 3.5 m post. No club could miss the target from any distance
//               it would shoot from, and six matches produced NOUGHT goal kicks from shots. Doubled to
//               0.40 at the worst rating, which leaves a perfect finisher at zero. Nobody playing:
//               corners 0.67 to 2.17, goal kicks 0.67 to 2.83, fouls 1.50 to 2.50, yellows 0.33 to 1.00,
//               balls into the box 7.33 to 10.33, goals 2.50 to 1.50. A child playing now lands four of
//               the nine counts inside their bands. In these ninety seconds: the goal is gone and a
//               corner is there instead.
//
//   2026-09-07  A pass into his path. The aim was the receiver's FEET - the spot he stood on when the
//               ball was struck - and a ball is about a second in the air, so every pass to a moving
//               team-mate landed behind him and he had to turn and come back for it. The lead is derived
//               rather than chosen: the speed is already a function of the distance, so the flight time
//               is far/speed, and he is led by his own velocity across it. A child playing: throw-ins
//               3.17 to 3.50 and offsides 0.33 to 0.67 - both INSIDE their bands, offsides for the first
//               time - goals 2.00 to 2.67, goal kicks 1.83 to 2.50, balls into the box 9.17 to 10.00.
//               In these ninety seconds: two throw-ins and a foul, where there had been a corner.
//
//   2026-09-07  A forward runs beyond the ball. Rule 3 aimed a supporting player at his SHAPE spot plus
//               nine metres and the 4-4-2 slides only a quarter of the way, so with the ball on seventy a
//               forward was aimed at 40.5 - thirty metres behind the play, and nobody in this game had
//               ever run past the ball. He stops at the last defender, read from `rules/offside` rather
//               than worked out again. Twelve fixtures, a child playing: throw-ins 3.25 to 3.92 and
//               yellows 1.58 to 1.50, both into band, corners 0.50 to 0.83, goals 2.67 to 2.50 and still
//               in band - five of the nine counts land, against three before. Nobody playing: corners
//               1.00 to 1.75, into band. ⚠️ And offsides fell 0.33 to 0.00, because a forward who
//               times his run to stay onside is never caught by the line. In these ninety seconds: a
//               goal, where there had been two throw-ins and a foul.

/** And what those numbers LOOK like, so a red can be described in a sentence rather than in hexadecimal. */
const SUMMARY = {
  phase: 'fullTime',
  goals: [1, 0],
  goalScored: 1,
  crossedTouchline: 0,
  foulGiven: 0,
};

function play() {
  const skills = { 0: CLUBS[0].ratings, 1: CLUBS[1].ratings };
  const state = createMatchState(PROFILE);
  state.phase = 'live';
  const trail: number[] = [];
  const seen: Record<string, number> = {};

  for (let t = 0; t < TICKS; t++) {
    for (const e of playTick(state, emptyFrame(t), DT, PROFILE, skills)) {
      seen[e.kind] = (seen[e.kind] ?? 0) + 1;
    }
    if ((t + 1) % CHECK_EVERY === 0) trail.push(digest(state));
  }

  return { state, trail, seen };
}

describe('ninety seconds that must stay the same ninety seconds', () => {
  // ⚠️ PINNED TO THE VERSION, so a simulation that declares itself new is not silently measured against an
  //    old world. `sim/recorder` already refuses a recording from another version; the trail below belongs
  //    to the same version, and bumping one without the other is the mistake this catches.
  it('[Interface] the trail belongs to this simulation version', () => {
    expect(SIM_VERSION, 'the simulation version moved - the golden trail below is from the old one').toBe(1);
  });

  it('[Right] a whole match plays out exactly as it did when this was blessed', () => {
    const { trail } = play();

    expect(trail).toHaveLength(GOLDEN.length);
    for (let i = 0; i < GOLDEN.length; i++) {
      expect(
        trail[i],
        `the match changed somewhere in the ten seconds ending at tick ${(i + 1) * CHECK_EVERY}. ` +
          'That is not automatically a defect - read the header of this file before touching the numbers.',
      ).toBe(GOLDEN[i]);
    }
  });

  // ⚠️ THE HALF A PERSON CAN READ. A digest that moved says only THAT the match changed; this says what
  //    it changed INTO, which is the difference between re-blessing blind and writing the sentence the
  //    commit message needs.
  it('[Right] and the match it plays is still the one described beside the trail', () => {
    const { state, seen } = play();

    expect(state.phase, 'the match no longer reaches full time in ninety seconds').toBe(SUMMARY.phase);
    expect([...state.goals]).toEqual(SUMMARY.goals);
    expect(seen.goalScored ?? 0).toBe(SUMMARY.goalScored);
    expect(seen.crossedTouchline ?? 0).toBe(SUMMARY.crossedTouchline);
    expect(seen.foulGiven ?? 0).toBe(SUMMARY.foulGiven);
  });

  // ⚠️ AND THE GOLDEN IS ONLY WORTH THE FIXTURE IT PLAYS. One pairing is one observation - the whole-match
  //    gate learned that the hard way and now plays a slate of six. This deliberately does NOT: six
  //    ninety-second matches would cost six times as much to protect the same claim, because a change to
  //    the simulation that misses THIS fixture and hits another is not a thing that happens. What the
  //    slate buys is coverage of rare EVENTS; what this buys is a tripwire, and one wire is enough.
  it('[Interface] the same ninety seconds twice in a row is the same ninety seconds', () => {
    expect(play().trail).toEqual(play().trail);
  });
});
