// SPDX-License-Identifier: AGPL-3.0-or-later
// THE METRIC OF THE WORLD, frozen in one place.
//
// ========================= METRES AND SECONDS, NOT TILES AND NOT PIXELS =========================
// The engine's `TILE = 16` is a constant of a tile grid, and there is no tile grid here: a pitch is a
// continuous space with bodies on it. Pixels are a fact about RENDERING and live in `project.ts` alone,
// so that changing how the game is drawn cannot change how it is played.
//
// ========================= WHY A PACE IS A UNIT =========================
// `PACE_M` is not a scale factor. The engine's `distance(topology, a, b)` divides by the topology's
// `unit` and its own comment says the result is "how many steps, not how many pixels" - so `unit` is
// literally the thing the narration counts in. A blind child needs "the ball is eight paces to your
// right"; she does not need 6.4 metres and she certainly does not need 51 pixels. Declaring the pitch
// with `unit: PACE_M` makes `distance()` return paces, and the screen reader adds no arithmetic of its
// own.

/** The pitch, arcade-shrunk from the real 105x68. `x` runs along it, `y` across it. Metres. */
export const PITCH = Object.freeze({ length: 90, width: 56 });

/** One pace. The unit the topology is declared in, and therefore the unit the sonar speaks in. */
export const PACE_M = 1.5;

/** The goal mouth. `height` is what a lofted ball has to clear, so it is a simulation number. */
export const GOAL = Object.freeze({ width: 7.0, height: 2.44 });

/**
 * Ball tuning.
 *
 * `gravity` is 14 and not 9.81 deliberately: at a real gravity an arcade-speed lob hangs long enough to
 * read as floating, and at 320x180 a ball that hangs is a ball whose height nobody can judge. The number
 * is chosen for legibility, and legibility is the pillar-1 constraint wearing a different hat.
 */
export const BALL = Object.freeze({
  /**
   * Metres. A real ball is 0.11m, and the number is here because the LAWS need it: a ball is out only
   * when it has WHOLLY crossed the line. Treating the ball as a point moves every line by one radius -
   * a goal given a hair early, a throw-in given a hair late - and nobody can see eleven centimetres at
   * 320x180, so the error never gets reported as a bug. It just makes the game feel arbitrary.
   */
  radius: 0.11,
  gravity: 14,
  /** Per second, applied to all three axes while airborne. */
  airDrag: 0.35,
  /** How much upward speed survives a bounce. */
  restitution: 0.55,
  /** How much ground speed survives a bounce. */
  bounceGrip: 0.75,
  /** Below this upward speed a bouncing ball is declared settled, and `z` snaps exactly to zero. */
  settleSpeed: 0.6,
  /** Per second, applied to a rolling ball. */
  rollDrag: 1.6,
  /** Below this ground speed a rolling ball stops exactly, rather than creeping forever. */
  stopSpeed: 0.15,
  /** No kick in football moves a ball faster than this, and an unclamped one breaks the collision step. */
  maxSpeed: 34,
});
