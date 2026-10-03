// SPDX-License-Identifier: AGPL-3.0-or-later
// THE Z ORDER OF THIS GAME'S STAGE.
//
// ========================= WHY THIS FILE EXISTS NOW =========================
// It was `@the-inclusionist/engine/core/layers.js` until engine 11.0, which sent twenty-six modules that
// "describe a game rather than serve one" to `game-platformer` at the v9.0.0 fork point - `core/layers`
// among them. The canonical table is still readable, and this file is not the place to re-argue it:
//
//     git -C ../the-inclusionist-engine show v9.0.0:app/js/core/layers.ts
//
// ⚠️ FIVE ENTRIES CAME, AND NOT THE THIRTY. The table is a registry for a platformer's world: `FLORA_BACK`,
// `FAUNA_FRONT`, `VEHICLES`, `SCENERY_INTERACT`, `DARK_WORLD`. Copying it whole would move that vocabulary
// into a football game, which is the thing ADR-0074 and ADR-0068 section 1 exist to prevent - the same
// judgement this repository already applied to `posicoesParallax`, where the decision was ours and only the
// calculation was borrowed. What came is what `render/scene` reads, and nothing else.
//
// ⚠️ AND THE VALUES ARE THE ORIGINALS, NOT RENUMBERED. Keeping 8000/10000/15000/16000/24000 makes the
// vendoring a move rather than a change: the ORDER is what the stage depends on, and an order that arrives
// identical cannot have altered a single frame. Renumbering to 1..5 would have been tidier and would have
// made "no behaviour changed" a claim instead of an observation.
//
// 📌 The engine's own panels - the pause card, the accessibility bar, the captions, the modal scrim - are
// DOM and ordered by CSS, not by this table. That is why a game may hold these five on its own: the numbers
// here only ever compare with each other, inside this game's Pixi stage.

/**
 * The layers this game's stage uses, in the canonical values of the engine's registry (ADR-0020).
 *
 * ⚠️ `PLAYER` CARRIES AN OFFSET AT RUN TIME. `render/scene` writes `Z.PLAYER + round(y * 4)` so a body
 * further down the pitch draws in front of one further up - the depth cue a 12-pixel figure has instead of
 * perspective. The pitch is 56 m wide, so the offset reaches 224 and stays well under the 1000 that
 * separates `PLAYER` from `VFX_FRONT`. Narrowing that gap would put a near player over the front effects.
 */
export const Z = Object.freeze({
  /** The baked pitch: lines, centre circle, cut bands. */
  TILES: 8000,
  /** Effects BEHIND the bodies: the elliptical shadows under each body and under the ball. */
  VFX_BACK: 10000,
  /** The twenty-two bodies and the ball. Plus the per-row offset above. */
  PLAYER: 15000,
  /** Effects IN FRONT of the bodies: the chevron over the controlled player, juice. */
  VFX_FRONT: 16000,
  /** Anything of ours drawn over the world. The engine's own HUD row is DOM and is not this. */
  HUD: 24000,
});
