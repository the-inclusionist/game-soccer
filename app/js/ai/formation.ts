// SPDX-License-Identifier: AGPL-3.0-or-later
// WHERE HOME IS. A shape as data, and four multiplies that make it look like football.
//
// ========================= THE SHAPE IS NORMALISED, AND THAT IS THE WHOLE TRICK =========================
// The anchors run from a side's OWN goal line (0) to the halfway line (1), across the pitch (0..1). Two
// things fall out of that for free: the away side is the same eleven numbers rotated half a turn, and a
// team plan can stretch the shape - push the line up, squeeze the width - by multiplying rather than by
// storing a second table. A formation stored in metres would need one table per side and one per plan.
//
// ⚠️ AND THE BALL PULL IS WHY IT READS AS A TEAM. Eleven bodies holding fixed positions look like
// statues; the same eleven sliding a quarter of the way toward the ball look like a side keeping its
// shape. It costs one lerp per agent, no branches, and it is the single cheapest thing in this file.

import { SQUAD_SIZE } from '../sim/ids.ts';
import { PITCH } from '../sim/units.ts';
import { clamp, type Vec2 } from '../sim/vec.ts';

/** How far the shape slides toward the ball. A quarter: enough to be a team, not enough to be a swarm. */
export const BALL_PULL = 0.25;

/**
 * A 4-4-2, normalised. Index 0 is the keeper, because `isKeeper` is then a comparison and not a flag.
 * `x` is depth from the side's own goal line; `y` is across the pitch.
 */
export const FORMATION_442: ReadonlyArray<readonly [number, number]> = Object.freeze([
  [0.03, 0.5],
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

export interface TeamPlan {
  readonly mode: 'attack' | 'defend' | 'transition';
  /** Multiplies the shape's depth. Above 1 is a high line; below 1 sits deep. */
  readonly lineHeight: number;
  /** Multiplies the shape's spread about the middle of the pitch. */
  readonly width: number;
  /** The ONE player allowed to chase the carrier. `-1` when nobody is pressing. */
  readonly presserId: number;
}

/**
 * Where a body should be standing, in metres.
 *
 * `dir` is +1 when the side attacks increasing `x`. The away side is the same shape ROTATED - both axes
 * flipped - rather than mirrored on `x` alone, because mirroring one axis would leave both right backs on
 * the same touchline, which is not what a pitch looks like.
 */
export function homeSpot(
  squadIndex: number,
  plan: TeamPlan,
  dir: 1 | -1,
  ball: Vec2,
  playable: { readonly length: number; readonly width: number } = PITCH,
): Vec2 {
  const [depth, across] = FORMATION_442[squadIndex % SQUAD_SIZE];

  // Stretch the shape by the plan, about the middle of the pitch for width.
  const stretchedDepth = clamp(depth * plan.lineHeight, 0, 0.95);
  const stretchedAcross = clamp(0.5 + (across - 0.5) * plan.width, 0, 1);

  // Place it on the side of the pitch this team defends, then slide toward the ball.
  // ⚠️ THE SHAPE IS LAID OUT ON THE AREA IN PLAY, NOT ON THE PAINTED PITCH. On a practice half that is
  //    what keeps eleven bodies inside the training area instead of spreading over a pitch nobody is
  //    using - and it is why `playable` is a real field rather than a claim the declaration makes alone.
  const ownX =
    dir === 1
      ? stretchedDepth * playable.length
      : playable.length - stretchedDepth * playable.length;
  const ownY =
    dir === 1
      ? stretchedAcross * playable.width
      : playable.width - stretchedAcross * playable.width;

  return {
    x: clamp(ownX + (ball.x - ownX) * BALL_PULL, 0, playable.length),
    y: clamp(ownY + (ball.y - ownY) * BALL_PULL, 0, playable.width),
  };
}
