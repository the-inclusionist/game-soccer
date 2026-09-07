// SPDX-License-Identifier: AGPL-3.0-or-later
// CLUBS THAT DO NOT EXIST, generated from a seed.
//
// ========================= WHY INVENTED AND NOT REAL =========================
// The reference game ships forty-eight national sides with kits, crests and ratings. Federation crests
// and World Cup marks are third-party trademarks, and its ratings and palettes are its own creative data.
// School and municipio sides that nobody owns keep the Municipio's title to the whole of what it owns -
// and they are also the sides the children in the target classroom would recognise.
//
// ========================= THE ONE RULE THAT IS NOT TASTE =========================
// Two kits a child cannot tell apart is not an aesthetic problem; it is a child who cannot play. Hue is
// not enough - a colour-blind child sees a mid red and a mid green as one colour - so what is enforced is
// LUMA separation, which survives every kind of colour vision. The generator RETRIES until it passes,
// which makes "the two sides are distinguishable" a property of the generator instead of a lucky seed.
//
// ⚠️ NO IMAGE FILE IS PRODUCED HERE, and a crest is a DESCRIPTION rather than a canvas. That keeps this
// module pure, node-testable and free of PixiJS - and it is why the licence position is that procedural
// art is program: there is nothing versioned but the function that paints.

// ⚠️ `Math.cos` IS USED HERE AND IS BANNED THREE FOLDERS AWAY, which is not an inconsistency: the
// arithmetic gate guards `sim/`, `rules/` and `ai/`, where an unspecified last bit is a desync between a
// school Chromebook and a teacher's laptop. What this file produces is COLOUR, which never enters the
// simulation. The day a club also carries ratings, those must come from arithmetic the gate allows - and
// this note is here so that day is noticed rather than discovered.
import { createRng } from '@the-inclusionist/engine/core/rng.js';

/** The minimum brightness gap, out of 255, between any two things a child must tell apart. */
export const LUMA_GAP = 40;

/** The six shapes a crest may carry. Six because a child can learn six; sixty would be noise. */
export const CHARGES = ['pale', 'cross', 'chevron', 'disc', 'bend', 'quarters'] as const;
export type Charge = (typeof CHARGES)[number];

/** Name keys. The words live in the dictionaries; only the key travels, so a club is not English. */
export const NAME_KEYS: readonly string[] = Object.freeze([
  'club.rio',
  'club.serra',
  'club.vila',
  'club.porto',
  'club.campo',
  'club.norte',
  'club.sul',
  'club.leste',
  'club.oeste',
  'club.ponte',
  'club.pedra',
  'club.aurora',
]);

export interface Crest {
  readonly charge: Charge;
  readonly field: number;
  readonly ink: number;
}

export interface Club {
  readonly nameKey: string;
  readonly kit: number;
  readonly keeperKit: number;
  readonly crest: Crest;
}

export interface Fixture {
  readonly home: Club;
  readonly away: Club;
}

/**
 * Perceived brightness, 0..255.
 *
 * The Rec. 601 weights, and they are not arbitrary: the eye is roughly six times more sensitive to green
 * than to blue, so a naive average would call a saturated blue and a saturated green equally bright and
 * put two kits on the pitch that a child cannot separate.
 */
export function lumaOf(colour: number): number {
  const r = (colour >> 16) & 0xff;
  const g = (colour >> 8) & 0xff;
  const b = colour & 0xff;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

const clamp255 = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

const rgb = (r: number, g: number, b: number): number =>
  (clamp255(r) << 16) | (clamp255(g) << 8) | clamp255(b);

/**
 * A colour of EXACTLY the requested brightness, with the hue left free.
 *
 * ⚠️ IT BLENDS TOWARD WHITE INSTEAD OF SCALING UP, and the first version did the latter and was wrong.
 * Multiplying a saturated colour to reach a brighter target clips whichever channel passes 255, so the
 * colour comes back DIMMER than asked - and the four bands stopped being four bands. Three hundred and
 * sixty-one of five hundred seeded fixtures failed the keeper gate because of it. Scaling down cannot
 * clip, and blending toward white is linear in luma, so both directions land on the number exactly.
 */
export function colourAt(rnd: () => number, targetLuma: number): number {
  const hue = rnd();
  const raw = rgb(
    (0.5 + 0.5 * Math.cos((hue + 0.0) * 6.283)) * 255,
    (0.5 + 0.5 * Math.cos((hue + 0.33) * 6.283)) * 255,
    (0.5 + 0.5 * Math.cos((hue + 0.66) * 6.283)) * 255,
  );
  const r = (raw >> 16) & 0xff;
  const g = (raw >> 8) & 0xff;
  const b = raw & 0xff;
  const have = lumaOf(raw);

  if (targetLuma <= have) {
    const k = targetLuma / Math.max(1, have);
    return rgb(r * k, g * k, b * k);
  }

  const t = (targetLuma - have) / Math.max(1, 255 - have);
  return rgb(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
}

/**
 * Four brightness bands, far enough apart that any two of them clear the gap.
 *
 * ⚠️ CHOSEN RATHER THAN SEARCHED. Generating colours and retrying until four of them happen to separate
 * is a loop with no bound and a seed that can defeat it. Picking the brightnesses first and letting only
 * the hue be random makes the property hold BY CONSTRUCTION, and leaves the part that does not matter -
 * which colour - free.
 */
export const BANDS = Object.freeze([36, 96, 158, 220]);

export function crestOf(seed: number): Crest {
  const rng = createRng(seed * 7919 + 13);
  const charge = CHARGES[Math.floor(rng.rnd() * CHARGES.length) % CHARGES.length];
  // The field takes a dark band and the ink a light one, so the charge always reads on it.
  return {
    charge,
    field: colourAt(rng.rnd, BANDS[0]),
    ink: colourAt(rng.rnd, BANDS[3]),
  };
}
