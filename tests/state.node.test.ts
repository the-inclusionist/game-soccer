// SPDX-License-Identifier: AGPL-3.0-or-later
// THE MATCH STATE, and the digest that makes it checkable.
//
// ========================= WHY A DIGEST EXISTS BEFORE A SCREEN DOES =========================
// A digest is one number that stands for the whole world at a tick. It is the golden-master test (a
// recorded match must hash the same next month), it is the desync detector the future netcode needs, and
// it is the only way to assert "these two clock modes are ONE simulation" without comparing 22 bodies by
// hand. Building it first is what makes every later change cheap to verify: one number, or a regression.
//
// ⚠️ IT MUST NOT QUANTISE. Rounding the floats before hashing would hide exactly the drift the digest
// exists to catch - a millimetre of divergence per tick is invisible for a minute and decisive after ten.
import { describe, expect, it } from 'vitest';
import { AWAY, HOME, SQUAD_SIZE, teamOf } from '../app/js/sim/ids.ts';
import {
  BALL_FIELDS,
  BODY_FIELDS,
  POSSESSION_FIELDS,
  SCALAR_FIELDS,
  createMatchState,
} from '../app/js/sim/state.ts';
import { digest } from '../app/js/sim/digest.ts';
import { PITCH } from '../app/js/sim/units.ts';

describe('a match at kickoff', () => {
  it('[Many] puts twenty-two players on the pitch, eleven a side', () => {
    const s = createMatchState();

    expect(s.players).toHaveLength(SQUAD_SIZE * 2);
    expect(s.players.filter((_, i) => teamOf(i) === HOME)).toHaveLength(SQUAD_SIZE);
    expect(s.players.filter((_, i) => teamOf(i) === AWAY)).toHaveLength(SQUAD_SIZE);
  });

  it('[Boundary] every player starts inside the pitch, and nobody starts on top of anybody', () => {
    const s = createMatchState();

    for (const p of s.players) {
      expect(p.p.x).toBeGreaterThanOrEqual(0);
      expect(p.p.x).toBeLessThanOrEqual(PITCH.length);
      expect(p.p.y).toBeGreaterThanOrEqual(0);
      expect(p.p.y).toBeLessThanOrEqual(PITCH.width);
    }

    const seen = new Set(s.players.map((p) => `${p.p.x},${p.p.y}`));
    expect(seen.size).toBe(s.players.length);
  });

  it('[One] puts the ball on the centre spot', () => {
    const s = createMatchState();

    expect(s.ball.p).toEqual({ x: PITCH.length / 2, y: PITCH.width / 2, z: 0 });
  });
});

describe('the digest', () => {
  it('[Right] two states built the same way hash the same', () => {
    expect(digest(createMatchState())).toBe(digest(createMatchState()));
  });

  it('[Boundary] one millimetre of difference in one body changes the hash', () => {
    const a = createMatchState();
    const b = createMatchState();
    b.players[7].p.x += 0.001;

    expect(digest(b)).not.toBe(digest(a));
  });

  // ⚠️ POSSESSION IS STATE, SO IT IS IN THE HASH. Two worlds identical in every position but differing
  //    in who has the ball are two different matches, and a digest that could not tell them apart would
  //    call a stolen ball "no divergence" - which is the one thing a desync detector must never do.
  it('[Boundary] a change of possession alone changes the hash', () => {
    const a = createMatchState();
    const b = createMatchState();
    b.possession.holder = 4;

    expect(digest(b)).not.toBe(digest(a));
  });

  it('[Boundary] a change of LAST TOUCH alone changes the hash, because a corner depends on it', () => {
    const a = createMatchState();
    const b = createMatchState();
    b.possession.lastTouch = 19;

    expect(digest(b)).not.toBe(digest(a));
  });

  // ⚠️ AND THE OFFSIDE SNAPSHOT IS STATE FOR THE SAME REASON POSSESSION IS. It is armed on one tick and
  //    read on another, so two worlds identical in every position can be one flag apart - and the side
  //    that gets the free kick depends on which of the two you are in.
  it('[Boundary] an armed offside flag alone changes the hash', () => {
    const a = createMatchState();
    const b = createMatchState();
    b.offsidePasser = 9;

    expect(digest(b)).not.toBe(digest(a));
  });

  it('[Boundary] and so does WHO it flags, which is the half that decides the offence', () => {
    const a = createMatchState();
    a.offsidePasser = 9;
    const b = createMatchState();
    b.offsidePasser = 9;
    b.offsideMask = 1 << 10;

    expect(digest(b)).not.toBe(digest(a));
  });

  // ⚠️ AND THE LIST ABOVE IS A CLAIM THAT NEEDS A BEHAVIOUR BEHIND IT. Naming a field in `covered`
  //    satisfies the gate below whether or not a row was ever added, so the field that just arrived gets
  //    the same treatment the offside snapshot does: change it alone, and the hash must move.
  it('[Boundary] who last deliberately kicked it alone changes the hash', () => {
    const a = createMatchState();
    const b = createMatchState();
    b.lastKick = 7;

    expect(digest(b)).not.toBe(digest(a));
  });

  // ⚠️ THE GATE THAT CATCHES THE NEXT FIELD SOMEBODY ADDS. A comment asking future authors to remember
  //    the digest is a comment; this fails the build. A `MatchState` grows a field, nobody adds a row to
  //    the field lists, and from that day the digest silently stops covering part of the world - the
  //    golden replay still passes, the cross-check gate still passes, and both are now lying.
  it('[Interface] every field of a match state is covered by the digest', () => {
    const covered = new Set(['tick', 'ball', 'players', 'possession', 'phase', 'period', 'goals', 'restartTaker', 'onPitch', 'controlled', 'cards', 'offsidePasser', 'offsideMask', 'tookRestart', 'lastStruck', 'lastKick', 'pressure', 'pressedBy', 'hinted', 'pendingVerb', 'pendingUntil', 'heldKickFired']);
    const actual = Object.keys(createMatchState());

    expect(actual.filter((k) => !covered.has(k))).toEqual([]);
    expect([...covered].filter((k) => !actual.includes(k))).toEqual([]);
  });

  // ⚠️ THE GATE ABOVE CATCHES ONE DIRECTION AND THIS ONE CATCHES THE OTHER. `covered` catches a state
  //    field that ARRIVES with no digest row - the direction somebody thought about. Nothing caught a row
  //    that LEAVES while the field stays, and that direction is worse: the field is still in `covered`, so
  //    the list above stays green while the digest quietly stops seeing part of the world.
  //
  // ⚠️ MEASURED 2026-09-11, by deleting the row for `pressure`, then `tookRestart`, then `heldKickFired[0]`
  //    and running the whole node project each time. Every one was caught by exactly ONE gate out of 902,
  //    and it was `golden-match` - the hash. That is the trap, not the safety net: a golden hash is
  //    re-blessed on purpose whenever the game changes, and the digest is at once the future network's
  //    desync detector AND the golden replay's own premise. The one gate standing between a lost row and a
  //    silent divergence is the very number the loss corrupts, so on the day it is legitimately re-blessed
  //    the missing row rides along and nothing anywhere says so again.
  //
  // ⚠️ SIXTEEN OF THE TWENTY-TWO FIELDS HAVE NO BEHAVIOUR GATE. Six do - `ball`, `players`, `possession`,
  //    `offsidePasser`, `offsideMask` and `lastKick`, the last two written the day they arrived. Pinning
  //    the lengths is not a substitute for the other sixteen; it is the cheap half that makes a DELETION
  //    impossible to land quietly, and the per-field behaviour gates remain the honest half.
  //
  // ⚠️ AND A PINNED NUMBER IS THE RIGHT INSTRUMENT HERE, which is not true of most pinned numbers in this
  //    repository. A count of rows is a STRUCTURAL fact, not a measurement of a played match: it changes
  //    only when an author deliberately adds or removes a row, and then updating it is the point - the
  //    diff makes the author say out loud that the world's hash now covers something different. What must
  //    never be pinned is an observation the game produces, because that reddens on a legitimate retune,
  //    gets re-blessed, and carries regressions through in the re-blessing.
  it('[Interface] and no row can leave the digest without somebody saying so', () => {
    expect(SCALAR_FIELDS.length, 'a scalar row was added or removed').toBe(25);
    expect(BALL_FIELDS.length, 'a ball row was added or removed').toBe(7);
    expect(BODY_FIELDS.length, 'a body row was added or removed').toBe(8);
    expect(POSSESSION_FIELDS.length, 'a possession row was added or removed').toBe(2);
  });

  it('[Interface] the hash is a 32-bit unsigned integer, so it survives being written down', () => {
    const h = digest(createMatchState());

    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});
