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
  type MatchState,
} from '../app/js/sim/state.ts';
import { digest } from '../app/js/sim/digest.ts';
import { PITCH } from '../app/js/sim/units.ts';
import { PHASES } from '../app/js/rules/phase.ts';

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

  // ⚠️ AND THIS IS THE HONEST HALF, which the count above is not. Sixteen of the twenty-two fields had a
  //    NAME in `covered` and no behaviour anywhere: six were gated - `ball`, `players`, `possession`,
  //    `offsidePasser`, `offsideMask` and `lastKick`, the last two written the day they arrived - and the
  //    rest were a claim. Measured 2026-09-11 by deleting the row for `pressure`, then `tookRestart`, then
  //    `heldKickFired[0]`: each was caught by exactly ONE gate out of 902, and it was the golden hash.
  //
  // ⚠️ THE PERTURBATIONS ARE RELATIVE - `+ 1` on the value the state already holds - so no entry can rot
  //    into a no-op by coinciding with a default somebody changed later. An absolute `s.tick = 7` against a
  //    field that starts at 7 is a gate that cannot fail, and this list is long enough that one silently
  //    doing nothing would never be noticed by eye.
  const PERTURBATIONS: ReadonlyArray<readonly [string, (s: MatchState) => void]> = [
    ['tick', (s) => { s.tick += 1; }],
    ['phase', (s) => { s.phase = PHASES[(PHASES.indexOf(s.phase) + 1) % PHASES.length]; }],
    ['period', (s) => { s.period += 1; }],
    ['goals[0]', (s) => { s.goals[0] += 1; }],
    ['goals[1]', (s) => { s.goals[1] += 1; }],
    ['restartTaker', (s) => { s.restartTaker += 1; }],
    ['onPitch[0]', (s) => { s.onPitch = [s.onPitch[0] + 1, s.onPitch[1]]; }],
    ['onPitch[1]', (s) => { s.onPitch = [s.onPitch[0], s.onPitch[1] + 1]; }],
    ['controlled[0]', (s) => { s.controlled[0] += 1; }],
    ['controlled[1]', (s) => { s.controlled[1] += 1; }],
    ['hinted[0]', (s) => { s.hinted[0] += 1; }],
    ['hinted[1]', (s) => { s.hinted[1] += 1; }],
    ['pendingVerb[0]', (s) => { s.pendingVerb[0] += 1; }],
    ['pendingVerb[1]', (s) => { s.pendingVerb[1] += 1; }],
    ['pendingUntil[0]', (s) => { s.pendingUntil[0] += 1; }],
    ['pendingUntil[1]', (s) => { s.pendingUntil[1] += 1; }],
    ['heldKickFired[0]', (s) => { s.heldKickFired[0] += 1; }],
    ['heldKickFired[1]', (s) => { s.heldKickFired[1] += 1; }],
    ['offsidePasser', (s) => { s.offsidePasser += 1; }],
    ['offsideMask', (s) => { s.offsideMask += 1; }],
    ['tookRestart', (s) => { s.tookRestart += 1; }],
    ['lastStruck', (s) => { s.lastStruck += 1; }],
    ['lastKick', (s) => { s.lastKick += 1; }],
    ['pressure', (s) => { s.pressure += 1; }],
    ['pressedBy', (s) => { s.pressedBy += 1; }],
  ];

  // ⚠️ THE LENGTH IS THE HALF THAT CATCHES THE NEXT AUTHOR. A row added to `SCALAR_FIELDS` with no
  //    perturbation beside it fails here, which is the same service `covered` does for the state's own
  //    shape - and unlike `covered`, satisfying this one requires writing a behaviour, not a name.
  it('[Interface] every scalar row has a perturbation, and every perturbation moves the hash', () => {
    // ⚠️ THE BEHAVIOUR IS ASSERTED BEFORE THE LENGTH, and the first draft had it the other way round. A
    //    deleted row makes BOTH fail, and whichever runs first is the message the next author reads:
    //    `expected [...] to have a length of 24 but got 25` says a number moved, while
    //    `changing pressure alone did not move the hash` says which field the world stopped hashing.
    //    Same redness, and only one of the two is a diagnosis.
    for (const [name, change] of PERTURBATIONS) {
      const before = createMatchState();
      const after = createMatchState();
      change(after);

      expect(digest(after), `changing ${name} alone did not move the hash`).not.toBe(digest(before));
    }

    expect(PERTURBATIONS).toHaveLength(SCALAR_FIELDS.length);
  });

  // ⚠️ AND THE OTHER SEVENTEEN ROWS, for the same reason. `ball`, `players` and `possession` were three of
  //    the six gated names, but gated COARSELY - moving the ball changes the hash, which says nothing about
  //    whether the hash can see the ball's HEIGHT, or a body's facing, or who touched it last. Seven ball
  //    rows, eight body rows and two possession rows, and a coarse gate covers all seventeen with one
  //    assertion that any one of them satisfies alone.
  //
  // ⚠️ THE BODY ROWS ARE PERTURBED ON A BODY IN THE MIDDLE OF THE SQUAD, not on player zero. The digest
  //    walks every body, so a row read from the wrong index would still move the hash when body zero moved;
  //    picking one that is neither first nor last is the cheapest guard against a row that happens to be
  //    right for the body a test chose.
  const DEEP: ReadonlyArray<readonly [string, (s: MatchState) => void]> = [
    ['ball.p.x', (s) => { s.ball.p.x += 1; }],
    ['ball.p.y', (s) => { s.ball.p.y += 1; }],
    ['ball.p.z', (s) => { s.ball.p.z += 1; }],
    ['ball.v.x', (s) => { s.ball.v.x += 1; }],
    ['ball.v.y', (s) => { s.ball.v.y += 1; }],
    ['ball.v.z', (s) => { s.ball.v.z += 1; }],
    ['ball.grounded', (s) => { s.ball.grounded = !s.ball.grounded; }],
    ['players[7].p.x', (s) => { s.players[7].p.x += 1; }],
    ['players[7].p.y', (s) => { s.players[7].p.y += 1; }],
    ['players[7].v.x', (s) => { s.players[7].v.x += 1; }],
    ['players[7].v.y', (s) => { s.players[7].v.y += 1; }],
    ['players[7].facing.x', (s) => { s.players[7].facing.x += 1; }],
    ['players[7].facing.y', (s) => { s.players[7].facing.y += 1; }],
    ['players[7].target.x', (s) => { s.players[7].target.x += 1; }],
    ['players[7].target.y', (s) => { s.players[7].target.y += 1; }],
    ['possession.holder', (s) => { s.possession.holder += 1; }],
    ['possession.lastTouch', (s) => { s.possession.lastTouch += 1; }],
  ];

  it('[Interface] and every ball, body and possession row moves the hash on its own', () => {
    for (const [name, change] of DEEP) {
      const before = createMatchState();
      const after = createMatchState();
      change(after);

      expect(digest(after), `changing ${name} alone did not move the hash`).not.toBe(digest(before));
    }

    expect(DEEP).toHaveLength(BALL_FIELDS.length + BODY_FIELDS.length + POSSESSION_FIELDS.length);
  });

  it('[Interface] the hash is a 32-bit unsigned integer, so it survives being written down', () => {
    const h = digest(createMatchState());

    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});
