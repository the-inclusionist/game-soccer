// SPDX-License-Identifier: AGPL-3.0-or-later
// WHICH SHIRT EACH BODY WEARS.
//
// A pure function from a fixture and a player id to a colour, so the renderer holds no table of its own.
// The renderer having its own kit colours is how a pitch ends up with a home side in one colour and a HUD
// crest in another - two sources for one fact, disagreeing the first time either changes.
import { describe, expect, it } from 'vitest';
import { kitFor } from '../app/js/teams/kits.ts';
import { fixtureOf } from '../app/js/teams/roster.ts';
import { SQUAD_SIZE } from '../app/js/sim/ids.ts';

const fx = fixtureOf(0, 3);

describe('kits', () => {
  it('[Right] an outfielder wears his club colour', () => {
    expect(kitFor(fx, 5)).toBe(fx.home.kit);
    expect(kitFor(fx, SQUAD_SIZE + 5)).toBe(fx.away.kit);
  });

  it('[One] the keeper is index zero of his squad, and wears the keeper colour', () => {
    expect(kitFor(fx, 0)).toBe(fx.home.keeperKit);
    expect(kitFor(fx, SQUAD_SIZE)).toBe(fx.away.keeperKit);
  });

  it('[Many] every one of the twenty-two gets a colour, and no colour is undefined', () => {
    for (let id = 0; id < SQUAD_SIZE * 2; id++) {
      expect(Number.isInteger(kitFor(fx, id)), `player ${id}`).toBe(true);
    }
  });

  // ⚠️ THE PROPERTY THE WHOLE PALETTE EXISTS FOR, asserted where it is actually consumed rather than only
  //    where it is generated. A generator that separates and a renderer that ignores it would both pass
  //    their own tests.
  it('[Boundary] the four colours a pitch shows are four DIFFERENT colours', () => {
    const shown = new Set([
      kitFor(fx, 0),
      kitFor(fx, 5),
      kitFor(fx, SQUAD_SIZE),
      kitFor(fx, SQUAD_SIZE + 5),
    ]);

    expect(shown.size).toBe(4);
  });
});
