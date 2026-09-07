// SPDX-License-Identifier: AGPL-3.0-or-later
// A FOUL BECOMES A RESTART, AND ONE OF THEM IS A PENALTY.
//
// ⚠️ THE TRANSITION TABLE IS DATA, AND THAT IS WHY THIS IS CHEAP. Adding two events and one phase is four
// rows, and the table can then be WALKED: every phase reachable, every phase with a way out, no duplicate
// answer to one event. A `switch` would have taken the same four cases and given nothing back.
import { describe, expect, it } from 'vitest';
import { EVENTS, PHASES, TRANSITIONS, nextPhase } from '../app/js/rules/phase.ts';
import { MATCH_PROFILE, PRACTICE_PROFILE } from '../app/js/rules/profile.ts';
import { PENALTY_SPOT, PITCH } from '../app/js/sim/units.ts';
import { restartSpot } from '../app/js/rules/restart.ts';
import { AWAY, HOME } from '../app/js/sim/ids.ts';

describe('the phases a foul opens', () => {
  it('[Interface] a penalty is a phase of its own, not a free kick in a different place', () => {
    expect(PHASES).toContain('penalty');
  });

  it('[Interface] and the referee has words for both', () => {
    expect(EVENTS).toContain('foulGiven');
    expect(EVENTS).toContain('penaltyGiven');
  });

  it('[Right] a foul in open play gives a free kick', () => {
    expect(nextPhase('live', 'foulGiven', MATCH_PROFILE)).toBe('freeKick');
  });

  it('[Right] a foul in the box gives a penalty', () => {
    expect(nextPhase('live', 'penaltyGiven', MATCH_PROFILE)).toBe('penalty');
  });

  it('[Right] and a penalty is taken, which puts the ball back in play', () => {
    expect(nextPhase('penalty', 'restartTaken', MATCH_PROFILE)).toBe('live');
  });

  // ⚠️ A PRACTICE PITCH HAS NO REFEREE. The same table with a row switched off, not a second table.
  it('[Zero] neither happens on a practice pitch', () => {
    expect(nextPhase('live', 'foulGiven', PRACTICE_PROFILE)).toBeNull();
    expect(nextPhase('live', 'penaltyGiven', PRACTICE_PROFILE)).toBeNull();
  });

  it('[Zero] a goal cannot be reached from a penalty by anything but scoring one', () => {
    expect(nextPhase('penalty', 'crossedTouchline', MATCH_PROFILE)).toBeNull();
  });
});

describe('the table still holds together', () => {
  // The properties `rules/phase` was written to make checkable, re-asked now that it has grown.
  it('[Interface] every phase has a way out', () => {
    for (const phase of PHASES) {
      if (phase === 'fullTime') continue; // the one end there is
      expect(TRANSITIONS.some((t) => t.from === phase), phase).toBe(true);
    }
  });

  it('[Interface] every phase is reachable', () => {
    for (const phase of PHASES) {
      if (phase === 'preMatch') continue; // where a match begins
      expect(TRANSITIONS.some((t) => t.to === phase), phase).toBe(true);
    }
  });

  it('[Zero] no phase answers one event twice', () => {
    const seen = new Set<string>();
    for (const t of TRANSITIONS) {
      const key = `${t.from}/${t.on}/${t.needs}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
  });
});

describe('where a restart from a foul is taken', () => {
  // ⚠️ `event.team` IS THE SIDE THE EVENT IS ABOUT - who scored, who gets the throw-in - and that
  //    convention is already written at the top of `rules/events`. A penalty is ABOUT the side awarded it,
  //    so the spot is at the goal the OTHER side is defending. Reading it the other way round would put
  //    every penalty at the wrong end, and it would look like a fault in the camera.
  const penaltyTo = (team: 0 | 1, period: number) =>
    restartSpot({ kind: 'penaltyGiven', team, at: { x: 3, y: 20 } }, period);

  it('[Right] a foul in open play is taken exactly where it happened', () => {
    const at = restartSpot({ kind: 'foulGiven', team: HOME, at: { x: 33, y: 12 } }, 1);

    expect(at.x).toBeCloseTo(33, 6);
    expect(at.y).toBeCloseTo(12, 6);
  });

  it('[Right] a penalty is on the spot, whatever the foul happened', () => {
    const at = penaltyTo(HOME, 1);

    expect(at.y).toBeCloseTo(PITCH.width / 2, 6);
    expect(at.x).not.toBeCloseTo(3, 1);
  });

  // Home defends x = 0 in the first period, so a penalty AWARDED TO home is at the far end.
  it('[Right] at the goal the other side is defending', () => {
    expect(penaltyTo(HOME, 1).x).toBeCloseTo(PITCH.length - PENALTY_SPOT, 6);
    expect(penaltyTo(AWAY, 1).x).toBeCloseTo(PENALTY_SPOT, 6);
  });

  // ⚠️ AND IT SWAPS AT HALF TIME, like everything else that names an end. A spot that did not swap would
  //    put every second-half penalty at the wrong goal.
  it('[Right] and the ends swap after half time', () => {
    expect(penaltyTo(HOME, 2).x).toBeCloseTo(PENALTY_SPOT, 6);
    expect(penaltyTo(AWAY, 2).x).toBeCloseTo(PITCH.length - PENALTY_SPOT, 6);
  });

  it('[Boundary] the spot is on the pitch and in the half it belongs to', () => {
    expect(PENALTY_SPOT).toBeGreaterThan(0);
    expect(PENALTY_SPOT).toBeLessThan(PITCH.length / 2);
  });
});
