// SPDX-License-Identifier: AGPL-3.0-or-later
// HOW A MATCH ENDED, from the point of view of the child playing it.
//
// ⚠️ FROM HER SIDE, NOT FROM THE SCOREBOARD. "2-1" is a fact about the match; "you won" is the fact she
// needs, and the two are the same only for the home side. A panel that read the score and hard-coded
// which column was hers would be right until somebody sat in the away seat.
//
// ⚠️ AND A DRAW IS A RESULT, NOT AN ABSENCE. ADR-0049 says the only celebration is growth: a game that
// treated a draw as a failure to win would be teaching the opposite of that, in the one moment the child
// is definitely reading.
import { describe, expect, it } from 'vitest';
import { outcomeFor, outcomeKey } from '../app/js/ui/outcome.ts';
import { AWAY, HOME } from '../app/js/sim/ids.ts';

describe('the result', () => {
  it('[Right] ahead is a win, behind is a loss, level is a draw', () => {
    expect(outcomeFor([2, 1], HOME)).toBe('win');
    expect(outcomeFor([1, 2], HOME)).toBe('loss');
    expect(outcomeFor([1, 1], HOME)).toBe('draw');
  });

  it('[Right] and the same score reads the other way from the other side', () => {
    expect(outcomeFor([2, 1], AWAY)).toBe('loss');
    expect(outcomeFor([1, 2], AWAY)).toBe('win');
  });

  it('[Zero] nil-nil is a draw and not a nothing', () => {
    expect(outcomeFor([0, 0], HOME)).toBe('draw');
  });

  it('[Interface] every outcome has its own dictionary key, so none falls back to a default', () => {
    const keys = new Set([
      outcomeKey(outcomeFor([2, 1], HOME)),
      outcomeKey(outcomeFor([1, 2], HOME)),
      outcomeKey(outcomeFor([1, 1], HOME)),
    ]);

    expect(keys.size).toBe(3);
    for (const k of keys) expect(k).toMatch(/^end\./);
  });
});
