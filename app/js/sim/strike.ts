// SPDX-License-Identifier: AGPL-3.0-or-later
// A VERB, TURNED INTO A BALL. And the one place "shoot or tackle?" is answered.
//
// ⚠️ THE CONTEXT LIVES HERE, NOT IN THE INPUT LAYER. `action2` is a shot with the ball and a tackle
// without it - a MEANING, and meaning depends on the world. An input layer that read possession to decide
// would be the coupling ADR-0027 measured as the base engine's first defect, rebuilt in a new repository.
// What crosses the boundary is intent; what turns intent into an act is this file.
//
// ⚠️ AND THE POWER ARRIVES ALREADY INTEGRATED. This never sees a held button, which is exactly what lets
// one simulation serve real time, assisted time, and the turn-based mode where a child picks the number.

import type { Command } from './command.ts';
import { SQUAD_SIZE, firstOf, teamOf, type PlayerId, type TeamId } from './ids.ts';
import { NOBODY } from './possession.ts';
import type { MatchState } from './state.ts';
import { BALL, GOAL, PITCH } from './units.ts';
import { onPitch } from './squads.ts';
import { dist2, type Vec2 } from './vec.ts';

export interface Strike {
  readonly id: PlayerId;
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;
}

/** Metres per second at full power, per verb. A shot is the hardest thing a foot does. */
const SPEED = Object.freeze({ shoot: 30, pass: 16, through: 24, lob: 22, tackle: 9 });

/** The slowest any struck ball may be. A pass that does not travel is a pass a child cannot use. */
const FLOOR = 6;

/** Metres. How far ahead of a team-mate a through ball is played. */
const THROUGH_LEAD = 12;

/** Metres per second of lift on a lofted ball. */
const LOB_LIFT = 6;

/** Metres. How close a tackler must be to reach the ball at all. */
const TACKLE_REACH = 1.4;

const dirOf = (team: TeamId, period: number): 1 | -1 =>
  (team === 0) === (period === 1) ? 1 : -1;

const goalOf = (team: TeamId, period: number): Vec2 => ({
  x: dirOf(team, period) === 1 ? PITCH.length : 0,
  y: PITCH.width / 2,
});

/** The nearest team-mate who is not the carrier. `null` when there is nobody - a real answer, not a crash. */
function nearestMate(state: MatchState, me: PlayerId): Vec2 | null {
  const first = firstOf(teamOf(me));
  let best: Vec2 | null = null;
  let bestD2 = Infinity;

  for (let k = 0; k < SQUAD_SIZE; k++) {
    const id = first + k;
    if (id === me || !onPitch(state, id)) continue;
    const d2 = dist2(state.players[id].p, state.players[me].p);
    if (d2 < bestD2) {
      bestD2 = d2;
      best = state.players[id].p;
    }
  }

  return best;
}

/** A velocity of `speed` toward `to`, from the ball. Zero-length is answered upfield, never with a NaN. */
function toward(from: Vec2, to: Vec2, speed: number, dir: 1 | -1): [number, number] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d === 0) return [dir * speed, 0];
  return [(dx / d) * speed, (dy / d) * speed];
}

/**
 * What this command does to the ball, or `null` for "nothing".
 *
 * `who` is the body the seat is driving. A command from a seat driving nobody, or a verb from a body that
 * cannot reach the ball, is not an error: it is a thing that did not happen.
 */
/**
 * The ball as a seat's command leaves it, or `null` if that command strikes nothing.
 *
 * ⚠️ `aimError` IS RADIANS AND NOT A RATING, so this file imports nothing from `ai/`: the layering runs
 * sim below rules below ai, and `shotErrorOf` lives at the top of it. The caller knows the clubs.
 *
 * ⚠️ AND WITHOUT IT A CHILD'S SHOT WENT DEAD CENTRE, EVERY TIME. The machine's shot is scattered by its
 * club's `shooting`; hers was not scattered at all. Measured over six five-minute matches with a scripted
 * child playing: fourteen goals, ALL of them struck from 18.3 to 23.0 metres - median 22.4, the very edge
 * of the range where an ordinary club had just been made to miss - and her matches finished 5-0 and 4-0.
 *
 * It is the mirror of a defect this repository already fixed, which is what made it hard to see: fouls
 * used to be judged for a command from a seat and for nothing else, so a law applied to one half of the
 * pitch and the half was HERS. This was the same shape with the sign flipped.
 */
export function strikeFor(
  state: MatchState,
  cmd: Command,
  who: PlayerId | undefined,
  aimError = 0,
): Strike | null {
  if (who === undefined || state.players[who] === undefined) return null;
  if (cmd.verb === 'none' || cmd.verb === 'switch') return null;

  const team = teamOf(who);
  const dir = dirOf(team, state.period);
  const ball = { x: state.ball.p.x, y: state.ball.p.y };
  const holder = state.possession.holder;
  const mine = holder !== NOBODY && teamOf(holder) === team;

  if (cmd.verb === 'tackle') {
    // Only against somebody who HAS it, only close enough to reach it, and never against your own side.
    if (holder === NOBODY || teamOf(holder) === team) return null;
    if (dist2(state.players[who].p, ball) > TACKLE_REACH * TACKLE_REACH) return null;
    const [vx, vy] = toward(ball, goalOf(team, state.period), SPEED.tackle, dir);
    return { id: who, vx, vy, vz: 0 };
  }

  // Every other verb needs the ball, and it needs it to be OURS - a shot from a player whose side lost it
  // a tick ago is the ball being kicked by somebody who is not near it.
  if (!mine || holder !== who) return null;

  const power = cmd.power < 0 ? 0 : cmd.power > 1 ? 1 : cmd.power;
  const full = SPEED[cmd.verb];
  const speed = Math.max(FLOOR, FLOOR + (full - FLOOR) * power);

  if (cmd.verb === 'shoot') {
    const [vx, vy] = toward(ball, goalOf(team, state.period), speed, dir);
    // ⚠️ LEANED BY THE SHIRT NUMBER, exactly as `ai/brain` leans the machine's. The same club in the same
    //    position takes the same shot for ever, so a child can learn that her number nine pulls it left -
    //    and could learn nothing at all from a dice. ADR-0049.
    const lean = who % 2 === 0 ? aimError : -aimError;
    return { id: who, vx: vx - vy * lean, vy: vy + vx * lean, vz: 0 };
  }

  const mate = nearestMate(state, who);
  const aim: Vec2 =
    mate === null
      ? { x: ball.x + dir * 20, y: ball.y }
      : cmd.verb === 'pass'
        ? mate
        : { x: mate.x + dir * THROUGH_LEAD, y: mate.y };

  const [vx, vy] = toward(ball, aim, speed, dir);
  return { id: who, vx, vy, vz: cmd.verb === 'lob' ? LOB_LIFT : 0 };
}

/** Apply a strike: the ball leaves the foot and possession is released. */
export function applyStrike(state: MatchState, strike: Strike): void {
  const s2 = strike.vx * strike.vx + strike.vy * strike.vy + strike.vz * strike.vz;
  const max = BALL.maxSpeed;
  const k = s2 > max * max ? max / Math.sqrt(s2) : 1;

  state.ball.v = { x: strike.vx * k, y: strike.vy * k, z: strike.vz * k };
  state.ball.grounded = strike.vz === 0;
  state.possession.holder = NOBODY;
  state.possession.lastTouch = strike.id;
}

export { GOAL };
