// SPDX-License-Identifier: AGPL-3.0-or-later
// COMPOSURE REACHING THE PITCH - the sixth of six, and the last one that reached nothing.
//
// ========================= WHAT "THE SAFE OPTION" IS, HERE =========================
// `ai/ratings` calls `composure` "how often the safe option is taken", and in this game a carrier has
// exactly one safe option: let the ball go before somebody takes it off him. `decideKick` already has the
// decision - he passes when an opponent is inside `PRESSED_AT` - so composure is WHEN, and nothing else in
// that function changes.
//
// A composed side plays the ball while the defender is still three metres away. A nervous one holds it
// until he is on top of him, which is when a tackle is a tackle and a pass is a hopeful ball.
//
// ⚠️ AND IT IS THE ONLY ONE OF THE SIX A CHILD CAN HEAR RATHER THAN SEE. The sonar names her passing
// options, and a composed side offers them to her a stride earlier - which is the difference between a
// choice she can make and one she is told about after it has gone.
import { describe, expect, it } from 'vitest';
import { createMatchState } from '../app/js/sim/state.ts';
import { MATCH_PROFILE } from '../app/js/rules/profile.ts';
import { AWAY, HOME, SQUAD_SIZE, firstOf } from '../app/js/sim/ids.ts';
import { decideKick } from '../app/js/ai/brain.ts';
import { AVERAGE, pressedAtOf } from '../app/js/ai/ratings.ts';

const calm = { ...AVERAGE, composure: 1 };
const nervous = { ...AVERAGE, composure: 0 };

/**
 * A home carrier in his own half with a team-mate to pass to and one opponent `gap` metres away.
 *
 * Out of shooting range on purpose: `decideKick` offers a shot before it offers a pass, so a carrier
 * anywhere near the goal answers a different question from the one this file asks.
 */
function pressed(gap: number, home = AVERAGE) {
  const s = createMatchState(MATCH_PROFILE);
  s.phase = 'live';
  for (let k = 0; k < SQUAD_SIZE; k++) {
    s.players[firstOf(HOME) + k].p = { x: 10, y: 52 };
    s.players[firstOf(AWAY) + k].p = { x: 10, y: 4 };
  }

  const carrier = firstOf(HOME) + 9;
  const mate = firstOf(HOME) + 10;
  const foe = firstOf(AWAY) + 5;

  s.players[carrier].p = { x: 30, y: 28 };
  s.players[mate].p = { x: 42, y: 28 };
  s.players[foe].p = { x: 30 + gap, y: 28 };
  s.ball.p = { x: 30, y: 28, z: 0 };
  s.ball.v = { x: 0, y: 0, z: 0 };
  s.ball.grounded = true;
  s.possession.holder = carrier;
  s.possession.lastTouch = carrier;

  return decideKick(s, MATCH_PROFILE.playable, { 0: home, 1: AVERAGE });
}

describe('a carrier with a defender coming', () => {
  // ⚠️ TWO GAPS STRADDLING THE AVERAGE TRIGGER, for the third time in three ratings. One gap leaves half
  //    the pair green under "every club lets go at 2.6", which is the only mutation this file is for.
  const EARLY = 3.0; // only a composed side has let go by here
  const LATE = 2.2; // only a nervous side is still holding it here

  it('[Interface] the scale straddles both gaps this gate uses', () => {
    expect(pressedAtOf(1)).toBeGreaterThan(EARLY);
    expect(pressedAtOf(0.5)).toBeLessThan(EARLY);
    expect(pressedAtOf(0.5)).toBeGreaterThan(LATE);
    expect(pressedAtOf(0)).toBeLessThan(LATE);
  });

  it('[Right] a composed club has played it while an average one is still dribbling', () => {
    expect(pressed(EARLY, calm), 'a composed side held on to it').not.toBeNull();
    expect(pressed(EARLY), 'an average side let go just as early').toBeNull();
  });

  it('[Right] and a nervous one is still dribbling where an average club has played it', () => {
    expect(pressed(LATE, nervous), 'a nervous side let go anyway').toBeNull();
    expect(pressed(LATE), 'an average side held on to it').not.toBeNull();
  });

  // ⚠️ AND AN AVERAGE CLUB TRIGGERS AT EXACTLY THE NUMBER THE CONSTANT NAMED. `PRESSED_AT` was 2.6 and is
  //    now gone, so the literal is written HERE rather than compared against a copy of itself - a gate
  //    that reads the value through the same table the code does moves with it and never fails.
  it('[Boundary] an average club lets go at 2.6 metres, which is where the constant was', () => {
    expect(pressedAtOf(0.5)).toBeCloseTo(2.6, 10);
  });

  // ⚠️ AND WITH NOBODY NEAR HIM HE KEEPS IT, whoever he plays for. A carrier who passed whenever a pass
  //    existed would produce a match of nothing but passing, and dribbling is half of what a child watches
  //    for - so composure moves the trigger and never removes it.
  it('[Zero] nobody within thirty metres and even the calmest club dribbles', () => {
    expect(pressed(30, calm)).toBeNull();
  });
});
