// SPDX-License-Identifier: AGPL-3.0-or-later
// THE WORDS. The engine owns fourteen positions and no meanings; this file supplies the meanings.
//
// ⚠️ A FACTORY AND NOT A CONSTANT, and the reason is mechanical. `ActionWord.label` is a plain string, so
// a preset built at module scope with `t()` would FREEZE THE LANGUAGE AT IMPORT TIME - the engine's
// dictionary is a `let` that `setLocale` reassigns, and whoever read it before the switch never sees the
// switch. The engine's own `input/devices` documents exactly this defect in its header and stores keys
// rather than text for the same reason. Here the whole preset is rebuilt at the point of use.

import type { ActionPreset } from '@the-inclusionist/engine/core/actions.js';

/** The positions that stay unnamed: they are about the session, not the world (ADR-0085 section 2). */
export const SYSTEM_POSITIONS: readonly string[] = Object.freeze(['start', 'select']);

/**
 * Football's twelve world verbs.
 *
 * The mapping is the Dev's, position by position: the diamond carries sprint, strike, short pass and long
 * ball; the left trigger doubles the sprint for a hand that reaches it more easily; the left shoulder
 * jockeys; the right shoulder plays the through ball and, with the right trigger, lofts it; the right
 * trigger alone switches player.
 */
export function buildPreset(t: (key: string) => string): ActionPreset {
  return {
    up: { label: t('act.up'), hint: t('act.up.hint') },
    down: { label: t('act.down'), hint: t('act.down.hint') },
    left: { label: t('act.left'), hint: t('act.left.hint') },
    right: { label: t('act.right'), hint: t('act.right.hint') },

    action1: { label: t('act.sprint'), hint: t('act.sprint.hint') },
    action2: { label: t('act.strike'), hint: t('act.strike.hint') },
    action3: { label: t('act.shortPass'), hint: t('act.shortPass.hint') },
    action4: { label: t('act.longBall'), hint: t('act.longBall.hint') },

    leftShoulder: { label: t('act.jockey'), hint: t('act.jockey.hint') },
    // The same verb as `action1`. The hint NAMES the alias, so a screen-reader child does not meet two
    // identical rows on the remap screen with nothing to tell them apart.
    leftTrigger: { label: t('act.sprint'), hint: t('act.sprintAlias.hint') },
    rightShoulder: { label: t('act.throughBall'), hint: t('act.throughBall.hint') },
    rightTrigger: { label: t('act.switchPlayer'), hint: t('act.switchPlayer.hint') },
  };
}
