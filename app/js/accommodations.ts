// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT THIS GAME CAN ACCOMMODATE, and what it honestly cannot.
//
// ========================= WHY THIS FILE IS MANDATORY =========================
// Engine 11.0 makes `CreateGameOptions.accommodations` required and COMPLETE (ADR-0153): every
// `GAME_KEYED` accommodation gets the keys of this game's word for it, or an explicit `false`. The engine's
// own reason, beside the type: a partial map lets SILENCE answer, and silence decides for the child - it
// would mount a wheelchair in chess, or hide one from a platformer, with nothing anywhere to say which. So
// a missing key is not "no"; it is a malformed declaration, and the boot refuses it.
//
// ⚠️ THE KEYS, NOT THE WORDS, so a row follows a language change. That is the same rule `input/preset`
// records and the same erratum behind it (ADR-0232 D3): text resolved once at import freezes the language,
// and the engine resolves these at every drawing instead.
//
// ⚠️ ELEVEN OFFERED AND SEVEN REFUSED, and the eleven each name the code that gives them a subject. An
// accommodation whose row exists and whose dial does nothing is worse than one that is absent: a child
// spends the one thing she has least of - patience with a setting that lies.
//
// ⚠️ AND THE `hintKey`S ARE NOT WRITTEN YET, which is a stated gap and not an oversight. `AccommodationKeys`
// makes the hint optional; it is the sentence the engine's footer explains the row with (`CLAUDE.md` §4), so
// it is eleven sentences of product text in three languages. The labels below are deliberately literal and
// are the Dev's to correct; writing eleven explanations in his voice before he has read the labels would be
// inventing the harder half of the content on the strength of the easier half.
import type { AccommodationAnswers } from '@the-inclusionist/engine/core/accommodations.js';

export const ACCOMMODATIONS: AccommodationAnswers = Object.freeze({
  /* ───────────────────────── the eleven football has a subject for ───────────────────────── */

  /** `render/scene`: `SMOOTH`, `LEAD_SECONDS` and `VERTICAL_GAIN` - the broadcast camera's lead and easing. */
  cameraSway: { labelKey: 'accom.cameraSway' },

  /** `ui/mirror.hintLine` and `state.hinted`: what the game offers to say about the next touch. */
  hints: { labelKey: 'accom.hints' },

  /** `input/charge` and the buffered strike: how long a charge may run and how late a press still counts. */
  timingWindow: { labelKey: 'accom.timingWindow' },

  /** `ui/assists-panel`: the assisted pass and shot, which aim for the child. */
  aimAssist: { labelKey: 'accom.aimAssist' },

  /** The `latch-stepped` and `latch-timed` charge routes, where a second press replaces holding. */
  repeatedInput: { labelKey: 'accom.repeatedInput' },

  /** `ai/plan`: the pressing intensity of the team plan, and the designated presser. */
  intensity: { labelKey: 'accom.intensity' },

  /** `render/scene`: the stride is driven by distance travelled, so this is the figures' own motion. */
  reducedCharacterMotion: { labelKey: 'accom.characterMotion' },

  /** `render/kit-atlas`: the 1 px outline baked into every figure, which separates it from the grass. */
  contrastOutlines: { labelKey: 'accom.contrastOutlines' },

  /** `render/markers`: the chevron over the player this seat controls, one colour per seat. */
  ownerColors: { labelKey: 'accom.ownerColors' },

  /** `sim/contact`: the control radius and the contact distance - how near a touch has to be. */
  detectionLeniency: { labelKey: 'accom.detectionLeniency' },

  /** `ai/ratings` and `rules/profile`: the six team numbers and the rules profile, together. */
  easyMode: { labelKey: 'accom.easyMode' },

  /* ───────────────────────── the seven with nothing to adjust ─────────────────────────
   *
   * ⚠️ TWO DIFFERENT REASONS, AND THE DISTINCTION IS WORTH KEEPING. The first four have no subject on a
   * football pitch at all; the last three would need an activity this game does not have. Both answer
   * `false`, but only the second group could ever change - a reading activity in a football game is a
   * design decision somebody could take, while a suit of cards is not.
   */

  /** No wheelchair subject: every body on the pitch runs, and a chair is not a kit option. */
  wheelchairMode: false,
  /** No cane: the sonar is how this game is played without sight, and it has its own spacing. */
  caneSpacing: false,
  /** No pieces: the twenty-two figures are a squad, and no set of them is swappable. */
  pieceSets: false,
  /** No suits: there are two kits, and their separation is `ownerColors` and the luma gap. */
  distinguishableSuits: false,

  /** No reading activity: this game has no words to grade. */
  lexicalDifficulty: false,
  /** Nothing to highlight word by word, for the same reason. */
  wordHighlight: false,
  /** No paced text: the caption line is a sentence per event, not a passage that advances. */
  textPace: false,
});
