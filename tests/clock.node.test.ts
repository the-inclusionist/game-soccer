// SPDX-License-Identifier: AGPL-3.0-or-later
// THE MATCH CLOCK, AS TEXT.
//
// ⚠️ IT COUNTS TICKS, NOT MILLISECONDS. The simulation's time is ticks; converting from a wall clock here
// would introduce a second notion of "how long has this match lasted" that drifts from the first one -
// and in the assisted mode, where the world receives less wall time per tick, the two would disagree by
// design.
import { describe, expect, it } from 'vitest';
import { clockText } from '../app/js/ui/clock.ts';

describe('the clock', () => {
  it('[Zero] a match that has not started reads zero', () => {
    expect(clockText(0)).toBe('00:00');
  });

  it('[One] sixty ticks is one second', () => {
    expect(clockText(60)).toBe('00:01');
  });

  it('[Many] and sixty seconds is one minute', () => {
    expect(clockText(60 * 60)).toBe('01:00');
  });

  it('[Boundary] it pads, so the width never jumps and a reader never re-reads the whole line', () => {
    expect(clockText(60 * 9 + 60 * 60 * 5)).toBe('05:09');
  });

  it('[Boundary] a tick short of a second still reads the second below it', () => {
    expect(clockText(119)).toBe('00:01');
  });

  it('[Interface] past an hour it keeps counting minutes rather than wrapping to zero', () => {
    expect(clockText(60 * 60 * 75)).toBe('75:00');
  });
});
