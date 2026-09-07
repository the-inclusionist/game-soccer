// SPDX-License-Identifier: AGPL-3.0-or-later
// EIGHT DIRECTIONS, BY COMPARISON. No `Math.atan2`, and the absence is the design.
//
// The arithmetic gate bans the trigonometric functions because IEEE-754 does not pin them down, so an
// angle is not available and none is wanted: a facing is a unit vector, and an eight-point heading falls
// out of two comparisons against a constant. `tan(67.5°) = 1 + sqrt(2)` is computed once, here, as a
// literal - the boundary between "mostly east" and "north-east".
//
// ⚠️ `y` GROWS TOWARD THE NEAR TOUCHLINE, which is DOWN the screen, so positive `y` is SOUTH. Getting this
// backwards would make the screen reader send a blind child the wrong way at every instruction, and
// nothing on screen would look wrong.
import { describe, expect, it } from 'vitest';
import { headingOf } from '../app/js/sim/heading.ts';

describe('the heading of a facing', () => {
  it('[Zero] a body that is not facing anywhere has no heading', () => {
    expect(headingOf({ x: 0, y: 0 })).toBe('none');
  });

  it('[One] the four cardinals', () => {
    expect(headingOf({ x: 1, y: 0 })).toBe('e');
    expect(headingOf({ x: -1, y: 0 })).toBe('w');
    expect(headingOf({ x: 0, y: -1 })).toBe('n');
    expect(headingOf({ x: 0, y: 1 })).toBe('s');
  });

  it('[Many] the four diagonals', () => {
    expect(headingOf({ x: 1, y: 1 })).toBe('se');
    expect(headingOf({ x: 1, y: -1 })).toBe('ne');
    expect(headingOf({ x: -1, y: 1 })).toBe('sw');
    expect(headingOf({ x: -1, y: -1 })).toBe('nw');
  });

  it('[Boundary] just inside the diagonal band is diagonal; just outside is cardinal', () => {
    expect(headingOf({ x: 1, y: 0.5 })).toBe('se');
    expect(headingOf({ x: 1, y: 0.3 })).toBe('e');
  });

  it('[Interface] the length of the vector never matters, only its direction', () => {
    expect(headingOf({ x: 0.001, y: 0 })).toBe('e');
    expect(headingOf({ x: 900, y: 0 })).toBe('e');
  });
});
