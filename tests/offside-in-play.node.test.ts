// SPDX-License-Identifier: AGPL-3.0-or-later
// OFFSIDE REACHING THE MATCH.
//
// ========================= WHY THIS FILE HAD TO EXIST =========================
// `rules/offside` was written, gated hard by `tests/offside`, and imported by `declaration.ts` - for the
// `gate` role that tints the offside zone for a child with low vision - and BY NOTHING THAT PLAYS THE
// MATCH. Nobody took the snapshot at the moment of a pass, so no flag was ever raised, and `offsideGiven`
// was an event with a case in `takerFor` and no producer anywhere in the repository.
//
// A whole match confirmed it: zero offsides in thirty-six thousand ticks, with the ball played forward
// constantly. That is the sixth time here that a module was right, its gate was right, and the wire was
// missing - and the shape never varies. A unit test proves the arithmetic; nothing proves anybody calls
// it. Only a gate that plays football asks the second question.
//
// ========================= THE TWO HALVES, AND WHY THEY ARE TWO =========================
// The snapshot is taken WHEN THE BALL IS PLAYED and the flag is raised WHEN IT IS TOUCHED, which is the
// law rather than a convenience. A striker standing behind the defence while the ball is at the other end
// has committed nothing; he commits it by getting involved. Judging position alone would penalise a child
// for standing still, which is the single most confusing thing a referee can do.
import { describe, expect, it } from 'vitest';
import { createMatchState } from '../app/js/sim/state.ts';
import { playTick } from '../app/js/play.ts';
import { MATCH_PROFILE, PRACTICE_PROFILE } from '../app/js/rules/profile.ts';
import { AWAY, HOME, SQUAD_SIZE, firstOf } from '../app/js/sim/ids.ts';
import { DT } from '../app/js/sim/ball.ts';
import { PITCH } from '../app/js/sim/units.ts';
import type { Command } from '../app/js/sim/command.ts';
import type { MatchState } from '../app/js/sim/state.ts';
import type { RulesProfile } from '../app/js/rules/profile.ts';

const cmd = (over: Partial<Command> = {}): Command => ({
  tick: 0, seat: 0, dx: 1, dy: 0, verb: 'none', power: 1, flags: 0, ...over,
});

/**
 * A home pass forward, with one team-mate ahead of the defence and one level with it.
 *
 * The away keeper is left deep on his line and the other ten are parked on `defenceAt`, so the
 * second-last opponent is exactly `defenceAt` and the arithmetic under test is legible from the numbers
 * rather than from a diagram. Home attacks increasing `x` in the first period.
 */
function setUp(strikerAt: number, defenceAt = 40) {
  const s = createMatchState(MATCH_PROFILE);
  s.phase = 'live';
  const passer = firstOf(HOME) + 9;
  const striker = firstOf(HOME) + 10;

  for (let k = 0; k < SQUAD_SIZE; k++) {
    s.players[firstOf(HOME) + k].p = { x: 20, y: 10 };
    s.players[firstOf(AWAY) + k].p = { x: defenceAt, y: 50 };
  }
  // The keeper is the LAST opponent, so the ten in front of him decide the line.
  s.players[firstOf(AWAY)].p = { x: 88, y: 28 };

  s.players[passer].p = { x: 50, y: 28 };
  s.players[striker].p = { x: strikerAt, y: 28 };
  s.ball.p = { x: 50, y: 28, z: 0 };
  s.ball.v = { x: 0, y: 0, z: 0 };
  s.ball.grounded = true;
  s.possession.holder = passer;
  s.possession.lastTouch = passer;
  s.controlled[0] = passer;

  return { s, passer, striker };
}

/**
 * Play the pass, let the ball travel, then put `who` on it and let the next tick see the touch.
 *
 * ⚠️ THE BALL HAS TO GET AWAY FROM THE PASSER FIRST, and skipping that made every one of these gates
 * report the wrong thing. A pass moves the ball a quarter of a metre in a tick; the passer is still
 * standing inside his own control radius, so he simply takes it back on the next tick and the touch under
 * test never happens. A full-power pass rolls about nine and a half metres and stops - measured - so a
 * hundred and twenty quiet ticks is a ball at rest, well clear of everybody, waiting to be touched.
 */
function passThenTouch(s: MatchState, who: number, profile: RulesProfile = MATCH_PROFILE) {
  const passer = s.controlled[0];
  playTick(s, { tick: 0, cmds: [cmd({ verb: 'pass' })] }, DT, profile);

  // He has played it and moved on. Left where he is, the test would be about a man standing on a ball.
  if (who !== passer) s.players[passer].p = { x: 20, y: 10 };
  for (let t = 1; t < TRAVEL; t++) playTick(s, { tick: t, cmds: [] }, DT, profile);

  s.players[who].p = { x: s.ball.p.x, y: s.ball.p.y };
  return playTick(s, { tick: TRAVEL, cmds: [] }, DT, profile);
}

/** Ticks a full-power pass needs to roll out and stop. Two seconds. */
const TRAVEL = 120;

describe('a pass to a man beyond the defence', () => {
  it('[Right] is offside the moment he touches it', () => {
    const { s, striker } = setUp(80);

    const events = passThenTouch(s, striker);

    expect(events.map((e) => e.kind), 'the flag was never raised').toContain('offsideGiven');
    expect(s.phase).toBe('freeKick');
  });

  // ⚠️ THE EVENT NAMES THE SIDE IT IS GIVEN AGAINST, which is the opposite convention from a foul, and
  //    `takerFor` flips it. Both readings are on the event rather than in a rule somebody has to hold in
  //    their head, and this is the gate that says which is which.
  it('[Right] and the kick belongs to the defending side', () => {
    const { s, striker } = setUp(80);

    const flag = passThenTouch(s, striker).find((e) => e.kind === 'offsideGiven');

    expect(flag?.team, 'the flag is given against the attacking side').toBe(HOME);
    expect(s.restartTaker).toBe(AWAY);
  });

  // ⚠️ AND IT IS TAKEN WHERE HE WAS, not on the centre spot. `restartSpot` had no case for this event, so
  //    it fell to the default - which is a kickoff. An offside forty metres from goal would have restarted
  //    the match at the halfway line, and it would have looked like the referee losing the ball.
  it('[Right] and it is taken where the offence was, not at the centre spot', () => {
    const { s, striker } = setUp(80);

    passThenTouch(s, striker);

    expect(s.ball.p.x, 'the free kick was moved to the centre spot').toBeGreaterThan(PITCH.length / 2 + 10);
  });
});

describe('and when it is not offside', () => {
  // ⚠️ LEVEL IS ONSIDE, and it is the law rather than a rounding choice: "nearer to the opponents' goal
  //    line than" is what the text says, and level is not nearer. `rules/offside` gates the comparison;
  //    this gates that the match asks it of the right numbers.
  it('[Boundary] a man level with the second-last defender is onside', () => {
    const { s, striker } = setUp(40);

    const events = passThenTouch(s, striker);

    expect(events.map((e) => e.kind)).not.toContain('offsideGiven');
    expect(s.phase).toBe('live');
  });

  it('[Zero] a man in his own half is onside however deep the defence is', () => {
    const { s, striker } = setUp(30, 20);

    const events = passThenTouch(s, striker);

    expect(events.map((e) => e.kind)).not.toContain('offsideGiven');
  });

  // ⚠️ THE SNAPSHOT DIES ON THE FIRST TOUCH, WHOEVER MAKES IT. A defender cutting the pass out ends the
  //    passage of play; a striker who was standing offside and then jogs back onto a loose ball is not
  //    penalised for where he was two passes ago. Without this the flag would stay armed for the rest of
  //    the match and go up at some unrelated moment, which is the worst kind of wrong.
  it('[Zero] a defender touching it first kills the flag', () => {
    const { s, striker } = setUp(80);
    const defender = firstOf(AWAY) + 5;

    passThenTouch(s, defender);

    s.players[defender].p = { x: 40, y: 50 };
    s.players[striker].p = { x: s.ball.p.x, y: s.ball.p.y };
    const events = playTick(s, { tick: TRAVEL + 1, cmds: [] }, DT, MATCH_PROFILE);

    expect(events.map((e) => e.kind)).not.toContain('offsideGiven');
  });

  // ⚠️ THE PASSER HIMSELF IS NEVER FLAGGED, and it is not an edge case: a player who plays the ball and
  //    keeps running after it is the ordinary way a carrier moves. Flagging him would make dribbling
  //    illegal.
  it('[Zero] and the passer running onto his own ball is not offside', () => {
    const { s, passer } = setUp(80);

    const events = passThenTouch(s, passer);

    expect(events.map((e) => e.kind)).not.toContain('offsideGiven');
  });

  // ⚠️ A PROFILE SWITCH, AND THE PRACTICE PITCH IS WHERE IT MATTERS. A child learning to shoot does not
  //    want a whistle every time she runs past a cone.
  it('[Zero] and a profile with offside switched off never raises it', () => {
    const { s, striker } = setUp(80);

    const events = passThenTouch(s, striker, PRACTICE_PROFILE);

    expect(events.map((e) => e.kind)).not.toContain('offsideGiven');
  });
});

describe('and the away side, which attacks the other way', () => {
  // ⚠️ EVERY GATE ABOVE USES THE HOME SIDE, AND THAT WAS A HOLE A MUTATION FOUND. Offside is measured
  //    along the direction a side ATTACKS, and the ends swap at half time - so a version that read a fixed
  //    direction off the team id would pass all nine of them and give every away offside to the wrong
  //    side, in silence. The mirror is the only thing that asks.
  function awaySetUp(strikerAt: number) {
    const s = createMatchState(MATCH_PROFILE);
    s.phase = 'live';
    const passer = firstOf(AWAY) + 9;
    const striker = firstOf(AWAY) + 10;

    for (let k = 0; k < SQUAD_SIZE; k++) {
      s.players[firstOf(AWAY) + k].p = { x: 70, y: 10 };
      s.players[firstOf(HOME) + k].p = { x: 50, y: 50 };
    }
    // Away attacks decreasing `x` in the first period, so the home keeper is the deep man at that end.
    s.players[firstOf(HOME)].p = { x: 2, y: 28 };

    s.players[passer].p = { x: 40, y: 28 };
    s.players[striker].p = { x: strikerAt, y: 28 };
    s.ball.p = { x: 40, y: 28, z: 0 };
    s.ball.v = { x: 0, y: 0, z: 0 };
    s.ball.grounded = true;
    s.possession.holder = passer;
    s.possession.lastTouch = passer;
    s.controlled[0] = passer;

    return { s, striker };
  }

  it('[Right] a man beyond the home defence is offside too', () => {
    const { s, striker } = awaySetUp(10);

    const flag = passThenTouch(s, striker).find((e) => e.kind === 'offsideGiven');

    expect(flag?.team, 'the away flag was never raised').toBe(AWAY);
    expect(s.restartTaker).toBe(HOME);
  });

  it('[Boundary] and a man level with the home defence is onside', () => {
    const { s, striker } = awaySetUp(50);

    const events = passThenTouch(s, striker);

    expect(events.map((e) => e.kind)).not.toContain('offsideGiven');
  });
});

describe('the snapshot itself', () => {
  // ⚠️ TAKEN AT THE MOMENT OF THE PASS AND NOT READ LIVE, which is the whole of what makes offside a rule
  //    a child can play to. If the line were measured when the ball arrived, a defender stepping up in
  //    the half second the pass is travelling would put a striker offside AFTER he had already committed
  //    to the run - the offence would be somebody else's movement.
  it('[Right] the line is where the defence was when the ball was played', () => {
    const { s, striker } = setUp(80);

    const passer = s.controlled[0];
    playTick(s, { tick: 0, cmds: [cmd({ verb: 'pass' })] }, DT, MATCH_PROFILE);
    s.players[passer].p = { x: 20, y: 10 };
    // The whole defence sprints past him while the ball travels. He was offside; he still is.
    for (let k = 1; k < SQUAD_SIZE; k++) s.players[firstOf(AWAY) + k].p = { x: 85, y: 50 };
    for (let t = 1; t < TRAVEL; t++) playTick(s, { tick: t, cmds: [] }, DT, MATCH_PROFILE);
    s.players[striker].p = { x: s.ball.p.x, y: s.ball.p.y };

    const events = playTick(s, { tick: TRAVEL, cmds: [] }, DT, MATCH_PROFILE);

    expect(events.map((e) => e.kind)).toContain('offsideGiven');
  });
});
