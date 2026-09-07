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
import { createMatchState } from '../app/js/sim/state.ts';
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

  // ⚠️ THE GATE THAT CATCHES THE NEXT FIELD SOMEBODY ADDS. A comment asking future authors to remember
  //    the digest is a comment; this fails the build. A `MatchState` grows a field, nobody adds a row to
  //    the field lists, and from that day the digest silently stops covering part of the world - the
  //    golden replay still passes, the cross-check gate still passes, and both are now lying.
  it('[Interface] every field of a match state is covered by the digest', () => {
    const covered = new Set(['tick', 'ball', 'players', 'possession', 'phase', 'period', 'goals', 'restartTaker', 'onPitch', 'controlled', 'cards']);
    const actual = Object.keys(createMatchState());

    expect(actual.filter((k) => !covered.has(k))).toEqual([]);
    expect([...covered].filter((k) => !actual.includes(k))).toEqual([]);
  });

  it('[Interface] the hash is a 32-bit unsigned integer, so it survives being written down', () => {
    const h = digest(createMatchState());

    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});
