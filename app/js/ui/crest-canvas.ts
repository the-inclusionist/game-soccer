// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CREST, PAINTED. The only part of a crest that needs a browser.
//
// ⚠️ IT IS `aria-hidden`, AND THAT IS NOT AN OVERSIGHT. The club's NAME is already text beside it, so a
// screen reader that also announced the badge would say the same thing twice - and a crest has no
// information a name does not. Decoration that duplicates text is noise, and noise is what makes a child
// turn the reader off.

import { CREST_SIZE, FIELD, INK, crestPixels } from '../render/crest-pixels.ts';
import type { Crest } from '../teams/clubs.ts';

const hex = (colour: number): string => `#${colour.toString(16).padStart(6, '0')}`;

/** Paint `crest` into a fresh canvas, `scale` device pixels per crest pixel. */
export function crestCanvas(doc: Document, crest: Crest, scale = 3): HTMLCanvasElement {
  const canvas = doc.createElement('canvas');
  canvas.width = CREST_SIZE * scale;
  canvas.height = CREST_SIZE * scale;
  canvas.className = 'crest';
  canvas.setAttribute('aria-hidden', 'true');

  const ctx = canvas.getContext('2d');
  if (ctx === null) return canvas;
  ctx.imageSmoothingEnabled = false;

  const grid = crestPixels(crest.charge);
  for (let y = 0; y < CREST_SIZE; y++) {
    for (let x = 0; x < CREST_SIZE; x++) {
      const cell = grid[y * CREST_SIZE + x];
      if (cell === FIELD) ctx.fillStyle = hex(crest.field);
      else if (cell === INK) ctx.fillStyle = hex(crest.ink);
      else continue;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }

  return canvas;
}
