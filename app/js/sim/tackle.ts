// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT A CHALLENGE DOES WHEN IT IS NOT A FOUL.
//
// ========================= THE HALF OF DEFENDING THAT WAS NEVER BUILT =========================
// `ai/brain.challenger` answers who went in and `rules/foul.judgeTackle` answers whether it was a foul.
// Between them they cover the illegal half of defending completely - and if the challenge was FAIR,
// nothing happened at all. The defender arrived, the referee said nothing, and the carrier kept the ball.
//
// So this game has never had a tackle that wins anything. Possession changed hands only when a dribbling
// touch strayed far enough for somebody else to collect it, which is one route where football has three.
//
// ⚠️ AND IT IS WHY EIGHT COUNTS MISS AT ONCE. Against the Dev's seven-minute bands the match is short of
// goals, corners, goal kicks, fouls, yellows and offsides, and long on throw-ins. Measured at the
// crossings themselves: 100 of 101 had a body within a metre of the ball closing on it at nearly 6 m/s.
// Football's throw-in comes off a DEFLECTION, and a deflection is exactly what a tackle makes - so one
// missing behaviour explains a table that looked like eight wrong constants.
//
// ⚠️ IT KNOCKS THE BALL LOOSE RATHER THAN HANDING IT OVER, and that is the football and the point. A
// tackle squirts the ball away and both sides go after it; that scramble is where a corner comes from,
// and where a throw-in comes from when it reaches the touchline. A clean transfer of possession would
// produce neither, and would make defending feel like a vending machine.
import { NOBODY } from './possession.ts';
import { teamOf, type PlayerId } from './ids.ts';
import type { MatchState } from './state.ts';

/** Metres per second the ball leaves a fair challenge at, for a defender of average skill. */
export const KNOCK_SPEED = 6;

/**
 * How much of `KNOCK_SPEED` a defender of this quality puts on it.
 *
 * ⚠️ AVERAGE IS EXACTLY ONE, which is the rule this repository already lives by: every one of the six
 * skills is applied at the point of the ACTION, never branches the cascade, and is exactly its constant
 * at 0.5 - so a match driven with no clubs at all is the world every other gate describes.
 */
function knockGainOf(defending: number): number {
  return 0.6 + defending * 0.8;
}

/** The ball, struck away from the man it was taken from. `null` when there is nothing to win. */
export interface Knock {
  readonly id: PlayerId;
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;
}

/**
 * The ball knocked off the carrier by `who`, or `null` if he has nothing to tackle.
 *
 * ⚠️ IT DOES NOT CHECK HIS REACH, and the omission is deliberate. Whether he is close enough is already
 * decided - by `ai/brain.challenger` for the machine and by `sim/strike` for a child - and asking it a
 * second time here would put one fact in two files, which is how they drift apart.
 *
 * ⚠️ THE DIRECTION IS HIS MOMENTUM. It is football - a ball squirting off a tackle goes where the tackler
 * was going - and it is the only deterministic answer available, because ADR-0049 leaves no room for a
 * dice. A child can learn that coming in from the left puts the ball out to the right.
 */
export function tackleFor(state: MatchState, who: PlayerId, defending: number): Knock | null {
  const holder = state.possession.holder;
  if (holder === NOBODY) return null;
  if (teamOf(holder) === teamOf(who)) return null;

  const me = state.players[who];
  const speed = Math.sqrt(me.v.x * me.v.x + me.v.y * me.v.y);

  // ⚠️ A TACKLER STANDING STILL HAS NO MOMENTUM TO LEND, and a knock of nought would leave the ball where
  //    it was - which reads on screen as the tackle not happening. He puts it away along the pitch, the
  //    same way every time, because a chosen direction is reproducible and a random one is not.
  const ux = speed === 0 ? 1 : me.v.x / speed;
  const uy = speed === 0 ? 0 : me.v.y / speed;

  const power = KNOCK_SPEED * knockGainOf(defending);
  return { id: who, vx: ux * power, vy: uy * power, vz: 0 };
}
