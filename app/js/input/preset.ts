// SPDX-License-Identifier: AGPL-3.0-or-later
// THE WORDS. The engine owns fourteen positions and no meanings; this file supplies the meanings.
//
// ========================= IT WAS A FACTORY, AND 11.0 REMOVED THE REASON =========================
// ⚠️ THE OLD HEADER IS QUOTED RATHER THAN DELETED, because its reasoning is what the engine went on to fix:
// «A FACTORY AND NOT A CONSTANT, and the reason is mechanical. `ActionWord.label` is a plain string, so a
// preset built at module scope with `t()` would FREEZE THE LANGUAGE AT IMPORT TIME - the engine's dictionary
// is a `let` that `setLocale` reassigns, and whoever read it before the switch never sees the switch.»
//
// In 11.0 an `ActionPreset` holds `ActionKeys` - `labelKey`, `hintKey` - and the engine resolves them at every
// drawing, never keeping the result (ADR-0232 D3 erratum). So the freeze this file was shaped around cannot
// happen: there is no resolved text here to go stale. A constant is now the honest shape, and the `t` this
// function used to take is gone rather than unused - a parameter nobody reads is a claim nobody checks.
import type { ActionPreset } from '@the-inclusionist/engine/core/actions.js';

/** The positions that stay unnamed: they are about the session, not the world (ADR-0085 section 2). */
export const SYSTEM_POSITIONS: readonly string[] = Object.freeze(['start', 'select']);

/**
 * Football's twelve world verbs, as the KEYS of their words.
 *
 * The mapping is the Dev's, position by position: the diamond carries sprint, strike, short pass and long
 * ball; the left trigger doubles the sprint for a hand that reaches it more easily; the left shoulder
 * jockeys; the right shoulder plays the through ball and, with the right trigger, lofts it; the right
 * trigger alone switches player.
 */
export const PRESET: ActionPreset = Object.freeze({
  up: { labelKey: 'act.up', hintKey: 'act.up.hint' },
  down: { labelKey: 'act.down', hintKey: 'act.down.hint' },
  left: { labelKey: 'act.left', hintKey: 'act.left.hint' },
  right: { labelKey: 'act.right', hintKey: 'act.right.hint' },

  action1: { labelKey: 'act.sprint', hintKey: 'act.sprint.hint' },
  action2: { labelKey: 'act.strike', hintKey: 'act.strike.hint' },
  action3: { labelKey: 'act.shortPass', hintKey: 'act.shortPass.hint' },
  action4: { labelKey: 'act.longBall', hintKey: 'act.longBall.hint' },

  leftShoulder: { labelKey: 'act.jockey', hintKey: 'act.jockey.hint' },
  // The same verb as `action1`. The hint NAMES the alias, so a screen-reader child does not meet two
  // identical rows on the remap screen with nothing to tell them apart.
  leftTrigger: { labelKey: 'act.sprint', hintKey: 'act.sprintAlias.hint' },
  rightShoulder: { labelKey: 'act.throughBall', hintKey: 'act.throughBall.hint' },
  rightTrigger: { labelKey: 'act.switchPlayer', hintKey: 'act.switchPlayer.hint' },
});
