// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CAMERA THAT FOLLOWS THE BALL, clamped to the world.
//
// ========================= WHY THIS FILE EXISTS NOW =========================
// It was `@the-inclusionist/engine/render/camera.js` until engine 11.0, which sent twenty-six modules that
// "describe a game rather than serve one" to `game-platformer` at the v9.0.0 fork point. The original, in
// Portuguese, is readable at the tag and is the reference for any question about behaviour:
//
//     git -C ../the-inclusionist-engine show v9.0.0:app/js/render/camera.ts
//
// ⚠️ WHAT CAME IS WHAT THIS GAME READS: `createCamera` (`criarCamera`) and `follow` (`seguir`), plus the
// clamp the follow needs. `pular`, `quadro`, `redimensionar`, `tremer` and `enquadrar` did not come - a
// `git grep` of this repository finds no caller for any of them, and four unused methods carried along for
// symmetry are four things a reader has to rule out. They are one `git show` away if a caller ever appears.
//
// ⚠️ AND THE NAMES ARE ENGLISH, which makes this a translation and not a copy. Everything that lands in
// this repository is born in English; pt-BR lives only in the i18n dictionaries. The engine made the same
// rename in its own tree (`criarCamera` -> `createCamera`), so keeping the Portuguese here would have been a
// regression against both rules at once. The arithmetic is unchanged, identifier for identifier.
//
// ⚠️ THE DEAD ZONE IS KEPT EVEN THOUGH THIS GAME PASSES NONE. `render/scene` builds the camera with no third
// argument and smooths the target itself, by interpolation, before handing it over - so the zone is `{0,0}`
// and `correction` reduces to "go to the target". It stays because removing it would change the SHAPE the
// scene's call compiles against for no gain, and because a broadcast camera is exactly the consumer a dead
// zone was written for: the day the lead term is replaced by a zone, the arithmetic is already here.

/** A size in world pixels — the world's, or the screen's. */
export interface Size {
  readonly w: number;
  readonly h: number;
}

/** Where the camera is, in world pixels. The scene negates it onto the container's position. */
export interface Camera {
  readonly camX: number;
  readonly camY: number;
}

/** How far the target may drift from the centre before the camera moves at all. */
export interface DeadZone {
  readonly w: number;
  readonly h: number;
}

export interface CameraObj {
  /** Where it is now, without moving it. */
  readonly base: Camera;
  /** Walks the camera toward the target and returns where it landed. */
  follow(targetX: number, targetY: number): Camera;
}

/**
 * Keeps the camera inside the world.
 *
 * ⚠️ THE FAR EDGE IS CAPPED FIRST AND THE NEAR EDGE LAST, and the order is what makes a small world safe.
 * The inner `Math.min` caps the origin at `world - screen`, which goes NEGATIVE when the world is narrower
 * than the viewport; the outer `Math.max(0, …)` is what pulls it back to zero. Reversed, a half-pitch would
 * scroll off its own left edge - and a world smaller than the screen is not hypothetical here, because the
 * practice profile is half a pitch.
 */
export function clampToWorld(cam: Camera, world: Size, screen: Size): Camera {
  return {
    camX: Math.max(0, Math.min(cam.camX, world.w - screen.w)),
    camY: Math.max(0, Math.min(cam.camY, world.h - screen.h)),
  };
}

/**
 * A camera that follows a target, clamped to the world, with an optional dead zone.
 *
 * The correction walks the MINIMUM: with a zone, the target lands on the zone's edge rather than at the
 * centre of the screen, so a target drifting inside the zone moves the camera not at all.
 */
export function createCamera(world: Size, screen: Size, zone: DeadZone = { w: 0, h: 0 }): CameraObj {
  let base: Camera = { camX: 0, camY: 0 };

  const correction = (target: number, cam: number, screenSide: number, zoneSide: number): number => {
    const half = Math.max(0, zoneSide) / 2;
    // The target's distance from the CENTRE of the screen, not from the camera's origin.
    const d = target - (cam + screenSide / 2);
    if (Math.abs(d) <= half) return 0;
    return d - Math.sign(d) * half;
  };

  return {
    get base() {
      return base;
    },
    follow(targetX, targetY) {
      base = clampToWorld(
        {
          camX: base.camX + correction(targetX, base.camX, screen.w, zone.w),
          camY: base.camY + correction(targetY, base.camY, screen.h, zone.h),
        },
        world,
        screen,
      );
      return base;
    },
  };
}
