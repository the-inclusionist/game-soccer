// SPDX-License-Identifier: AGPL-3.0-or-later
// AN EIGHT-POINT HEADING FROM A UNIT VECTOR, by comparison alone.

import type { Heading } from '@the-inclusionist/engine/core/contract.js';
import type { Vec2 } from './vec.ts';

/**
 * `tan(67.5°)`, the half-angle of a 45-degree sector: beyond this ratio a direction is cardinal rather
 * than diagonal. Written as a literal because `Math.tan` is banned - and because a constant computed at
 * load time is a constant nobody can read.
 */
const CARDINAL_RATIO = 2.414213562373095;

/**
 * ⚠️ `y` GROWS TOWARD THE NEAR TOUCHLINE, so positive `y` is SOUTH. The screen and the pitch agree on
 * this, and a screen reader that had it backwards would send a blind child the wrong way at every
 * instruction with nothing on screen looking wrong.
 */
export function headingOf(facing: Vec2): Heading {
  const { x, y } = facing;
  if (x === 0 && y === 0) return 'none';

  const ax = x < 0 ? -x : x;
  const ay = y < 0 ? -y : y;

  if (ax > ay * CARDINAL_RATIO) return x > 0 ? 'e' : 'w';
  if (ay > ax * CARDINAL_RATIO) return y > 0 ? 's' : 'n';

  if (y > 0) return x > 0 ? 'se' : 'sw';
  return x > 0 ? 'ne' : 'nw';
}
