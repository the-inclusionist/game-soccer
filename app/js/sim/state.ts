// SPDX-License-Identifier: AGPL-3.0-or-later
// THE WORLD AT A TICK. Plain values only - no functions, no class instances, no references to anything
// outside itself, so that the whole state can be hashed, copied and compared.

import { createBall, type Ball, type Vec3 } from './ball.ts';
import { SQUAD_SIZE, type PlayerId } from './ids.ts';
import { createPossession, type Possession } from './possession.ts';
import { PHASES, type MatchPhase } from '../rules/phase.ts';
import { PITCH } from './units.ts';

export interface Body {
  /** Metres. Outfield bodies have no height, so `p` is two-dimensional and `z` lives on the ball. */
  p: { x: number; y: number };
  v: { x: number; y: number };
  /** A unit vector. Never an angle: see the arithmetic gate. */
  facing: { x: number; y: number };
  /**
   * Where this body has decided to go.
   *
   * ⚠️ IT LIVES IN THE STATE ON PURPOSE. An agent decides every sixth tick and steers toward the decision
   * on every tick, so the decision has to survive between them - and a cache held outside the state would
   * be state the digest cannot see and a replay cannot reproduce.
   */
  target: { x: number; y: number };
}

export interface MatchState {
  tick: number;
  ball: Ball;
  players: Body[];
  possession: Possession;
  phase: MatchPhase;
  /** 1 or 2. Ends swap between them, so every narrated direction must derive from this. */
  period: number;
  /** Indexed by `TeamId`. An array rather than two fields, so the digest walks it in one loop. */
  goals: [number, number];
  /**
   * Which side is owed the restart, or `-1` for none.
   *
   * ⚠️ IT IS STATE AND NOT A DERIVATION. `lastTouch` says who put the ball out, but by the time the throw
   * is taken somebody else has touched it - the taker himself - and the fact would be gone. A restart
   * that forgets whose it is gets taken by whoever gets there first, which is not football.
   */
  restartTaker: number;
  /** How many of each squad are on the pitch. See `sim/squads`. */
  onPitch: readonly [number, number];
  /**
   * Which body each seat is driving.
   *
   * ⚠️ IT WAS A FROZEN CONSTANT UNTIL `switch` EXISTED, and `sim/command` said so in its own comment: "a
   * constant only until `switch` exists... when it lands, this table becomes state and this constant
   * becomes its initial value." A replay has to replay a switch, so where the seats are pointing is part
   * of the world and not a fact the boot keeps beside it.
   */
  controlled: [number, number];
  /**
   * A card per player: 0, `YELLOW`, `RED`. Indexed by `PlayerId`, dense, one entry for every body in both
   * squads whether they are playing or not.
   *
   * ⚠️ IT IS STATE AND NOT A LIST OF EVENTS. "Who has been booked" is asked on every tick by
   * `squads.onPitch`, and deriving it by replaying a list of cards would put a loop over the match's
   * history inside the hottest question in the simulation.
   *
   * ⚠️ AND A DENSE ARRAY RATHER THAN A MAP, for the same reason `goals` is an array: the digest walks
   * it in one loop, and a map's iteration order is a thing that would have to be pinned by hand.
   */
  cards: number[];
}

/**
 * The 4-4-2 a side lines up in, normalised: `x` runs from its OWN goal line (0) to the halfway line (1),
 * `y` across the pitch (0..1). Normalised because the away side is the same eleven numbers rotated, and
 * because a formation that slides with the ball later multiplies these rather than replacing them.
 */
const KICKOFF_SHAPE: ReadonlyArray<readonly [number, number]> = Object.freeze([
  [0.03, 0.5], // keeper, and it is index 0 of the squad so `isKeeper` stays a comparison
  [0.2, 0.18],
  [0.2, 0.39],
  [0.2, 0.61],
  [0.2, 0.82],
  [0.33, 0.18],
  [0.33, 0.39],
  [0.33, 0.61],
  [0.33, 0.82],
  [0.45, 0.42],
  [0.45, 0.58],
]);

const STILL = (): { x: number; y: number } => ({ x: 0, y: 0 });

/**
 * A match at kickoff.
 *
 * ⚠️ THE AWAY SIDE IS A ROTATION, NOT A MIRROR. Reflecting `x` alone would leave the two number 2s on the
 * same touchline, which is not how a pitch looks; rotating the shape by half a turn puts each side's
 * right back on its own right. It also guarantees no two bodies share a position, which is a precondition
 * of the contact step rather than a nicety.
 */
export function createMatchState(
  profile: { readonly squads: readonly [number, number] } = { squads: [SQUAD_SIZE, SQUAD_SIZE] },
): MatchState {
  const players: Body[] = [];

  for (let i = 0; i < SQUAD_SIZE * 2; i++) {
    const [nx, ny] = KICKOFF_SHAPE[i % SQUAD_SIZE];
    const home = i < SQUAD_SIZE;
    const x = home ? nx * PITCH.length : PITCH.length - nx * PITCH.length;
    const y = home ? ny * PITCH.width : PITCH.width - ny * PITCH.width;
    players.push({
      p: { x, y },
      v: STILL(),
      facing: { x: home ? 1 : -1, y: 0 },
      target: { x, y },
    });
  }

  return {
    tick: 0,
    ball: createBall({ x: PITCH.length / 2, y: PITCH.width / 2 }),
    players,
    possession: createPossession(),
    phase: 'preMatch',
    period: 1,
    goals: [0, 0],
    restartTaker: -1,
    onPitch: [profile.squads[0], profile.squads[1]],
    controlled: [9, 10],
    // Both squads, always - a body that is not playing can still have been sent off, and an array that
    // only covered the players on the pitch would change length when somebody left it.
    cards: new Array(SQUAD_SIZE * 2).fill(0),
  };
}

/** The order the digest walks a body in. Exported so the hash and the state cannot drift apart. */
/**
 * The order the digest walks the scalar half of the state in.
 *
 * ⚠️ `phase` IS A STRING AND ENTERS AS ITS INDEX. Hashing the characters would work and would also make
 * the hash depend on how a phase is SPELLED - renaming `goalKick` would invalidate every recording for a
 * reason that has nothing to do with football. The index is the identity; the name is a label.
 */
export const SCALAR_FIELDS: ReadonlyArray<(s: MatchState) => number> = Object.freeze([
  (s) => s.tick,
  (s) => PHASES.indexOf(s.phase),
  (s) => s.period,
  (s) => s.goals[0],
  (s) => s.goals[1],
  (s) => s.restartTaker,
  (s) => s.onPitch[0],
  (s) => s.onPitch[1],
  (s) => s.controlled[0],
  (s) => s.controlled[1],
]);

export const BODY_FIELDS: ReadonlyArray<(b: Body) => number> = Object.freeze([
  (b) => b.p.x,
  (b) => b.p.y,
  (b) => b.v.x,
  (b) => b.v.y,
  (b) => b.facing.x,
  (b) => b.facing.y,
  (b) => b.target.x,
  (b) => b.target.y,
]);

/**
 * The order the digest walks possession in.
 *
 * ⚠️ IT IS HERE AND NOT IN THE DIGEST because the state module is the one that knows what a state is
 * made of. A field added to `MatchState` without a row here would be invisible to the hash, and the
 * digest would report "no divergence" about a world that had diverged.
 */
export const POSSESSION_FIELDS: ReadonlyArray<(p: Possession) => number> = Object.freeze([
  (p) => p.holder,
  (p) => p.lastTouch,
]);

/** The order the digest walks the ball in. */
export const BALL_FIELDS: ReadonlyArray<(b: Ball) => number> = Object.freeze([
  (b) => b.p.x,
  (b) => b.p.y,
  (b) => b.p.z,
  (b) => b.v.x,
  (b) => b.v.y,
  (b) => b.v.z,
  (b) => (b.grounded ? 1 : 0),
]);

export type { Ball, MatchPhase, PlayerId, Possession, Vec3 };
