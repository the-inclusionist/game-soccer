// SPDX-License-Identifier: AGPL-3.0-or-later
// ONE NUMBER THAT STANDS FOR THE WHOLE WORLD.
//
// ========================= THREE JOBS, ONE FUNCTION =========================
// 1. The golden master: a recorded match must hash the same next month, or something changed.
// 2. The proof that the clock modes are ONE simulation: the same commands through the real-time driver
//    and through the turn-based driver must produce the same trail of hashes.
// 3. The desync detector the future netcode needs, which is why "born network-ready" costs nothing extra:
//    it is the same code, written for the tests.
//
// ========================= WHY IT HASHES RAW BITS AND NEVER ROUNDS =========================
// Quantising to, say, four decimal places before hashing would make the digest agree while the states
// disagree - which hides exactly the drift it exists to catch. A millimetre of divergence per tick is
// invisible for a minute and decisive after ten, and a detector that only fires once the match is already
// unrecognisable is not a detector.
//
// FNV-1a over the eight bytes of every float64, in a field order the state module declares. Not a
// cryptographic hash and not trying to be: this defends against accident, not against an adversary.

import {
  BALL_FIELDS,
  BODY_FIELDS,
  POSSESSION_FIELDS,
  SCALAR_FIELDS,
  type MatchState,
} from './state.ts';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const scratch = new DataView(new ArrayBuffer(8));

function mixByte(hash: number, byte: number): number {
  // `Math.imul` is exact 32-bit integer multiplication, and is not one of the unspecified functions the
  // arithmetic gate bans - it is defined bit for bit by the language.
  return Math.imul(hash ^ byte, FNV_PRIME);
}

/**
 * Fold one number into the hash by its EIGHT BYTES, not by its decimal text.
 *
 * ⚠️ `-0` and `+0` have different bits and would hash differently, which would make a ball that stopped
 * from the left hash differently from one that stopped from the right - a difference no rule in football
 * can observe. It is normalised away here, and it is the only normalisation allowed.
 */
function mixNumber(hash: number, value: number): number {
  scratch.setFloat64(0, value === 0 ? 0 : value);
  let h = hash;
  for (let i = 0; i < 8; i++) h = mixByte(h, scratch.getUint8(i));
  return h;
}

/** The state's hash, as an unsigned 32-bit integer. */
export function digest(state: MatchState): number {
  let h = FNV_OFFSET;

  for (const field of SCALAR_FIELDS) h = mixNumber(h, field(state));
  for (const field of BALL_FIELDS) h = mixNumber(h, field(state.ball));
  for (const body of state.players) {
    for (const field of BODY_FIELDS) h = mixNumber(h, field(body));
  }
  for (const field of POSSESSION_FIELDS) h = mixNumber(h, field(state.possession));

  return h >>> 0;
}
