// SPDX-License-Identifier: AGPL-3.0-or-later
// FICTIONAL CLUBS, AND THE ONE RULE THAT IS NOT AESTHETIC.
//
// ========================= WHY THE CLUBS ARE INVENTED =========================
// The reference game ships forty-eight national sides with their kits and crests. Federation crests and
// World Cup marks are third-party trademarks, and the ratings and palettes are that project's creative
// data. These clubs are school and municipio sides that do not exist, generated from a seed, so the
// Municipio holds title to the whole of what it owns.
//
// ========================= AND WHY LUMA SEPARATION IS A GATE =========================
// Two kits a child cannot tell apart is not a taste problem: it is a child who cannot play. Hue is not
// enough - red and green are a classic pair that a colour-blind child sees as one - so what is asserted
// is LUMA, which survives every kind of colour vision. The palette regenerates until it passes, which
// makes "the two teams are distinguishable" a property of the generator rather than of a lucky seed.
import { describe, expect, it } from 'vitest';
import { LUMA_GAP, colourAt, crestOf, lumaOf } from '../app/js/teams/clubs.ts';
import { createRng } from '@the-inclusionist/engine/core/rng.js';

// ⚠️ THE SEEDED-FIXTURE BLOCK THAT USED TO BE HERE IS GONE WITH `makeFixture`, and that is the record
// rather than an omission. It generated two clubs together and RETRIED until their kits separated, which
// was the right answer while nobody chose the clubs. The moment a child picks both sides there is no seed
// left to retry, so identity and dress were split apart - and its five-hundred-seed gates became a walk
// of ALL 132 ordered pairings in `tests/roster.node.test.ts`, which is a stronger claim than a sample.
//
// The generator was then product code kept alive only by its own tests. It was deleted rather than left
// behind a green gate.

describe('luma', () => {
  it('[Boundary] black is nothing and white is everything', () => {
    expect(lumaOf(0x000000)).toBe(0);
    expect(lumaOf(0xffffff)).toBeCloseTo(255, 0);
  });

  // ⚠️ THE REASON IT IS LUMA AND NOT HUE. A colour-blind child sees this pair as one colour, and a hue
  //    check would call them different. Luma is what survives every kind of colour vision.
  it('[Right] a red and a green of the same brightness are NOT separated', () => {
    expect(Math.abs(lumaOf(0xc00000) - lumaOf(0x006a00))).toBeLessThan(LUMA_GAP);
  });

  // ⚠️ THE PROPERTY THE FIRST IMPLEMENTATION QUIETLY BROKE. It scaled a saturated colour UP to reach a
  //    bright target, which clips whichever channel passes 255 and returns something dimmer than asked -
  //    so the four brightness bands were not four bands, and 361 of 500 fixtures failed the keeper gate.
  //    Asserting the achieved brightness is what turns "four bands" from an intention into a fact.
  it('[Boundary] a generated colour lands on the brightness it was asked for, in both directions', () => {
    for (const target of [20, 96, 158, 240]) {
      for (let seed = 0; seed < 60; seed++) {
        const rng = createRng(seed);
        const c = colourAt(rng.rnd, target);
        expect(Math.abs(lumaOf(c) - target), `target ${target} seed ${seed}`).toBeLessThan(1.5);
      }
    }
  });

  it('[Right] green is brighter than blue at the same channel value, as the eye reports', () => {
    expect(lumaOf(0x00ff00)).toBeGreaterThan(lumaOf(0x0000ff));
  });
});

describe('the crest', () => {
  it('[Interface] it is a DESCRIPTION, not a canvas - pure, testable, and rasterised elsewhere', () => {
    const crest = crestOf(11);

    expect(typeof crest.charge).toBe('string');
    expect(Number.isInteger(crest.field)).toBe(true);
    expect(Number.isInteger(crest.ink)).toBe(true);
  });

  it('[Interface] the same seed is the same crest', () => {
    expect(crestOf(11)).toEqual(crestOf(11));
  });

  it('[Many] every crest uses one of the six charges, and all six are reachable', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed++) seen.add(crestOf(seed).charge);

    expect(seen.size).toBe(6);
  });

  // A crest a child cannot read is a badge-shaped smudge at eight pixels.
  it('[Many] the charge always separates in luma from the field it sits on', () => {
    for (let seed = 0; seed < 200; seed++) {
      const crest = crestOf(seed);
      expect(Math.abs(lumaOf(crest.field) - lumaOf(crest.ink)), `seed ${seed}`).toBeGreaterThanOrEqual(
        LUMA_GAP,
      );
    }
  });
});
