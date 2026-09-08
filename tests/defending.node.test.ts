// SPDX-License-Identifier: AGPL-3.0-or-later
// DEFENDING REACHING THE PITCH.
//
// ========================= WHERE A BALL IS ACTUALLY WON =========================
// `ai/ratings` says `defending` is "tackle window, press trigger, interception reach", and the tempting
// wire is the challenge range in `ai/brain` - how close the presser gets before going in.
//
// ⚠️ THAT WIRE IS BACKWARDS, and it is worth saying why rather than only that it was not chosen.
// `challenger` decides who has committed a FOUL; it wins nobody the ball. Making a good defender challenge
// from further out would make him give away more free kicks and take possession no more often, so the
// better a club defended the worse it would play - a rating that is not merely decorative but harmful.
//
// A ball changes hands in `sim/possession`, and it changes hands there through ONE number: how much closer
// than the carrier a challenger has to be before the carrier stops shielding it. That is the tackle
// window, in metres, at the point of action. A good defender needs less of an advantage.
import { describe, expect, it } from 'vitest';
import { createMatchState } from '../app/js/sim/state.ts';
import { MATCH_PROFILE } from '../app/js/rules/profile.ts';
import { AWAY, HOME, SQUAD_SIZE, firstOf } from '../app/js/sim/ids.ts';
import { capsBySide } from '../app/js/ai/ratings.ts';
import { resolvePossession, SHIELD_MARGIN } from '../app/js/sim/possession.ts';
import { AVERAGE, tackleMarginOf } from '../app/js/ai/ratings.ts';

const hard = { ...AVERAGE, defending: 1 };
const soft = { ...AVERAGE, defending: 0 };

/**
 * A home carrier shielding the ball with an away challenger `edge` metres closer to it than he is.
 *
 * Everybody is still, so the tick is about the margin and nothing else. Both are inside the control
 * radius, so which of them ends up with it is decided by the shield and not by reach.
 */
function duel(edge: number, away = AVERAGE) {
  const s = createMatchState(MATCH_PROFILE);
  s.phase = 'live';
  for (let k = 0; k < SQUAD_SIZE; k++) {
    s.players[firstOf(HOME) + k].p = { x: 10, y: 50 };
    s.players[firstOf(AWAY) + k].p = { x: 80, y: 50 };
  }
  const carrier = firstOf(HOME) + 9;
  const foe = firstOf(AWAY) + 5;

  s.ball.p = { x: 45, y: 28, z: 0 };
  s.ball.v = { x: 0, y: 0, z: 0 };
  s.ball.grounded = true;
  s.possession.holder = carrier;
  s.possession.lastTouch = carrier;

  s.players[carrier].p = { x: 45 - 0.6, y: 28 };
  s.players[foe].p = { x: 45 + (0.6 - edge), y: 28 };

  // ⚠️ THIRTY RESOLUTIONS, NOT THIRTY TICKS, and the difference is the whole reason this helper works.
  //    The ball is won by SUSTAINED contact now, so one tick transfers nothing and this used to play
  //    exactly one - the gates below would have gone red for the change rather than for a defect. But
  //    driving `playTick` instead moves the bodies INSIDE the tick: the cascade steers them and the
  //    dribbling touch knocks the ball, so the geometry pinned before the call is not the geometry the
  //    resolution sees, and the duel stops being the duel being asked about. Measured while chasing it:
  //    the pressure reached its threshold on tick 19 exactly as designed, and the ball did not change
  //    hands, because by then the two bodies were somewhere else.
  //
  //    It exercises BOTH halves of `defending`, which the single tick could not: the margin decides
  //    whether he is a challenger at all, and `pressureRateOf` decides how fast he gets there once he is.
  const caps = capsBySide(AVERAGE, away, MATCH_PROFILE.pace);
  for (let t = 0; t < 30; t++) resolvePossession(s, caps);
  return { s, carrier, foe };
}

describe('a challenger closer to the ball than the man on it', () => {
  // ⚠️ TWO EDGES, STRADDLING THE AVERAGE MARGIN IN BOTH DIRECTIONS - the same lesson `control` learned.
  //    A single edge would leave one half of the pair green under the mutation "every club has the same
  //    window", which is the only mutation this file exists to catch.
  const TIGHT = 0.28; // inside an average window: only a good defender takes it
  const WIDE = 0.42; // outside an average window: only a poor one fails to

  it('[Interface] the scale straddles both edges this gate uses', () => {
    expect(tackleMarginOf(1)).toBeLessThan(TIGHT);
    expect(tackleMarginOf(0.5)).toBeGreaterThan(TIGHT);
    expect(tackleMarginOf(0.5)).toBeLessThan(WIDE);
    expect(tackleMarginOf(0)).toBeGreaterThan(WIDE);
  });

  it('[Right] a hard club takes a ball an average one would not', () => {
    const { s, foe, carrier } = duel(TIGHT, hard);

    expect(s.possession.holder, 'a good defender could not win it').toBe(foe);
    expect(duel(TIGHT).s.possession.holder, 'an average one won it too').toBe(carrier);
  });

  it('[Right] and a soft one fails to take a ball an average one would', () => {
    const { s, foe, carrier } = duel(WIDE, soft);

    expect(s.possession.holder, 'a poor defender won it anyway').toBe(carrier);
    expect(duel(WIDE).s.possession.holder, 'an average one could not win it').toBe(foe);
  });

  // ⚠️ AN AVERAGE CLUB IS EXACTLY WHERE IT WAS, which is what keeps every gate that drives the simulation
  //    with no clubs describing the same world the game does.
  it('[Boundary] an average club needs exactly the margin the constant named', () => {
    expect(tackleMarginOf(0.5)).toBeCloseTo(SHIELD_MARGIN, 10);
  });
});
