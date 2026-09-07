// SPDX-License-Identifier: AGPL-3.0-or-later
// TWO-DIMENSIONAL ARITHMETIC on plain objects. No class, no allocation policy, no cleverness.
//
// ⚠️ `Math.sqrt` IS THE ONLY LIBRARY CALL HERE, and that is the whole design constraint. IEEE-754 pins
// `sqrt` down to the last bit and pins `Math.hypot` down not at all, so a length is a sqrt of a dot
// product and never a hypot. Directions are unit vectors rather than angles for the same reason: there is
// no `atan2` available to make an angle out of one, and none is wanted.

export interface Vec2 {
  x: number;
  y: number;
}

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;

/** Squared length. Preferred wherever only a comparison is needed - it is exact and it is cheaper. */
export const len2 = (a: Vec2): number => a.x * a.x + a.y * a.y;

export const len = (a: Vec2): number => Math.sqrt(len2(a));

/** Squared distance. The form every "who is nearest" question should ask, for the same two reasons. */
export const dist2 = (a: Vec2, b: Vec2): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

/**
 * A unit vector in the same direction. A zero vector has no direction, and this returns the zero vector
 * rather than inventing one - a fabricated "facing east" would make a standing player point somewhere.
 */
export function norm(a: Vec2): Vec2 {
  const l2 = len2(a);
  if (l2 === 0) return { x: 0, y: 0 };
  const k = 1 / Math.sqrt(l2);
  return { x: a.x * k, y: a.y * k };
}

/** `a`, shortened to at most `max`. Longer vectors are scaled; shorter ones are returned untouched. */
export function clampLen(a: Vec2, max: number): Vec2 {
  const l2 = len2(a);
  if (l2 <= max * max) return { x: a.x, y: a.y };
  const k = max / Math.sqrt(l2);
  return { x: a.x * k, y: a.y * k };
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
