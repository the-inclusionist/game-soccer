// SPDX-License-Identifier: AGPL-3.0-or-later
// THE STADIUM BEHIND THE PITCH, and the one number the engine's own table gets wrong for this game.
//
// ⚠️ THE ENGINE'S `PARALLAX` TABLE HAS `fy: 0` ON EVERY LAYER. That is correct for the platformer, whose
// camera barely pans vertically, and wrong for a broadcast camera whose whole character is depth panning.
// So this game supplies its own layers and uses the engine's PURE `posicoesParallax` to place them - which
// is the difference between reusing a calculation and inheriting a decision.
import { describe, expect, it } from 'vitest';
import { posicoesParallax } from '@the-inclusionist/engine/render/parallax.js';
import { STADIUM_LAYERS, crowdBands } from '../app/js/render/stadium-layers.ts';

describe('the layers', () => {
  it('[Many] three of them, from the sky to the hoardings', () => {
    expect(STADIUM_LAYERS).toHaveLength(3);
    expect(STADIUM_LAYERS.map((l) => l.key)).toEqual(['sky', 'far', 'near']);
  });

  it('[Right] a nearer layer moves MORE, which is the whole of what parallax is', () => {
    const factors = STADIUM_LAYERS.map((l) => l.factor);

    expect(factors[0]).toBeLessThan(factors[1]);
    expect(factors[1]).toBeLessThan(factors[2]);
  });

  // ⚠️ THE ROW THIS FILE EXISTS FOR.
  it('[Right] every layer pans VERTICALLY, unlike the engine table this game does not use', () => {
    for (const layer of STADIUM_LAYERS) {
      expect(layer.fy, layer.key).toBeGreaterThan(0);
    }
  });

  it('[Right] vertical movement is smaller than horizontal, or the stand slides like a lift', () => {
    for (const layer of STADIUM_LAYERS) {
      expect(layer.fy, layer.key).toBeLessThan(layer.factor);
    }
  });
});

describe('placing them', () => {
  it('[Right] moving the camera moves every layer, by different amounts', () => {
    const at0 = posicoesParallax(0, 0, STADIUM_LAYERS);
    const at100 = posicoesParallax(100, 40, STADIUM_LAYERS);

    const moved = at0.map((p, i) => Math.abs(at100[i].tileX - p.tileX));
    expect(moved[0]).toBeGreaterThan(0);
    expect(moved[2]).toBeGreaterThan(moved[0]);
  });

  // ⚠️ WCAG 2.3.3, AND IT COMES FROM THE SYSTEM RATHER THAN FROM A MENU OF OURS. A child who has asked her
  //    operating system for less motion has already answered; asking her again in our settings would be a
  //    second place for one preference to live, and the two would disagree.
  it('[Zero] under reduced motion the vertical drift stops entirely', () => {
    const moving = posicoesParallax(100, 40, STADIUM_LAYERS, false);
    const still = posicoesParallax(100, 40, STADIUM_LAYERS, true);

    expect(moving.some((p) => p.tileY !== 0)).toBe(true);
    expect(still.every((p) => p.tileY === 0)).toBe(true);
  });
});

describe('the crowd', () => {
  it('[Many] three luminance bands, and no two the same', () => {
    const bands = crowdBands(0x2b3a55);

    expect(bands).toHaveLength(3);
    expect(new Set(bands).size).toBe(3);
  });

  // ⚠️ A CROWD IS TEXTURE, NOT DETAIL. At 320x180 a face is one pixel, and a high-contrast speckle behind
  //    the pitch competes with the ball for a low-vision child's attention. The bands stay close together
  //    on purpose.
  it('[Boundary] the bands stay LOW contrast, so the crowd never competes with the ball', () => {
    const bands = crowdBands(0x2b3a55).map((c) => {
      const r = (c >> 16) & 0xff;
      const g = (c >> 8) & 0xff;
      const b = c & 0xff;
      return 0.299 * r + 0.587 * g + 0.114 * b;
    });

    expect(Math.max(...bands) - Math.min(...bands)).toBeLessThan(40);
  });

  it('[Interface] the same seed colour always gives the same bands', () => {
    expect(crowdBands(0x2b3a55)).toEqual(crowdBands(0x2b3a55));
  });
});
