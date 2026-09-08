// SPDX-License-Identifier: AGPL-3.0-or-later
// KEYS INTO ACTIONS, AND ACTIONS INTO ONE COMMAND PER TICK.
//
// ========================= THE SHIM THAT WAS BUDGETED AND IS NOT NEEDED =========================
// This repository's plan budgeted a compatibility layer, because the engine's transports still spoke the
// platformer's eight verbs while `core/actions` declared fourteen. Issue #103 ran while this game was
// being written, so the tables are the engine's and this file imports them.
//
// ⚠️ THE TABLE IS NEVER COPIED. A copy is a second source for one fact and drifts the moment a child
// remaps anything - which is the whole reason `KEYBOARD_SOLO` is exported rather than described.
//
// ⚠️ AND THE MEANING IS THIS GAME'S. The engine hands over positions; which position is a short pass, and
// that `rightShoulder` plus `rightTrigger` is a lofted ball, is football and lives here (ADR-0074).

import { ACTIONS } from '@the-inclusionist/engine/core/actions.js';
import { defaultKeymap, indexOf, type Keymap } from './keymap.ts';
import { createChord, CHORD_GRACE, type Chord } from './chord.ts';
import { createCharge, type Charge, type ChargeMode } from './charge.ts';
import { FLAG_JOCKEY, FLAG_SPRINT, type Command, type Verb } from '../sim/command.ts';

export type Held = Record<string, boolean>;

/** The defaults, resolved once - the fallback for a caller with no map of its own. */
const FALLBACK: Keymap = defaultKeymap();

/**
 * Which actions these held key codes hold. A code nobody bound holds nothing, which is not an error.
 *
 * ⚠️ THE MAP IS AN ARGUMENT NOW, AND THE FIRST VERSION BUILT IT ONCE AT MODULE LOAD. That was the defect
 * underneath "the engine gives remapping for free": the table it read is the engine's FROZEN default, so
 * the remap panel could have been perfect and every key a child chose would have been ignored, with
 * nothing anywhere reporting it. A memoised index rebuilt on a version counter would be faster and would
 * put the same class of staleness back; this is one Map lookup per held key, on at most a handful of
 * keys, sixty times a second.
 */
export function heldFrom(codes: ReadonlySet<string>, map: Keymap = FALLBACK): Held {
  const held: Held = {};
  for (const action of ACTIONS) held[action] = false;
  const byCode = indexOf(map);
  for (const code of codes) {
    const action = byCode.get(code);
    if (action !== undefined) held[action] = true;
  }
  return held;
}

/**
 * Which verb each charging position produces.
 *
 * ⚠️ `action2` IS ONE ENTRY AND TWO ACTS. It says `shoot` here and becomes a tackle in the simulation when
 * the side has not got the ball - because that is a MEANING, and meaning depends on the world. An input
 * layer that read possession to decide would be the coupling ADR-0027 measured as the base engine's first
 * defect, rebuilt in a new repository.
 */
const CHARGING: Readonly<Record<string, Verb>> = Object.freeze({
  action2: 'shoot',
  action3: 'pass',
  action4: 'through',
});

/** A unit-length direction from the four direction positions. Opposites cancel; a diagonal is not longer. */
function steer(held: Held): { dx: number; dy: number } {
  const dx = (held.right ? 1 : 0) - (held.left ? 1 : 0);
  const dy = (held.down ? 1 : 0) - (held.up ? 1 : 0);
  if (dx === 0 && dy === 0) return { dx: 0, dy: 0 };
  const len = Math.sqrt(dx * dx + dy * dy);
  return { dx: dx / len, dy: dy / len };
}

export interface Sampler {
  /**
   * One tick of input, as one command.
   *
   * `pad` is the engine's own per-pad action record - `padCur[i]`, already mapped through the declared
   * table, the child's own remap and the mapping wizard. Merging it here rather than reading
   * `navigator.getGamepads()` is the difference between using the engine's input layer and building a
   * second one beside it with none of the accessibility in it.
   */
  sample(codes: ReadonlySet<string>, tick: number, pad?: Held | null): Command;
  /**
   * The step this seat's charge has reached while it is still held, or 0.
   *
   * ⚠️ IT IS HERE SO THE PAGE CAN SAY IT. A charge that only speaks when it FIRES tells a child what
   * she did after she has stopped being able to change it; the plan asks for "three of five" as she
   * holds, with a tone per step, because a power bar does not serve a child who cannot see one.
   */
  charging(): number;
}

/** A key and a button both count: a child may steer with one hand and act with the other. */
function merge(a: Held, b: Held | null | undefined): Held {
  if (b === null || b === undefined) return a;
  const out: Held = {};
  for (const action of ACTIONS) out[action] = a[action] || b[action] === true;
  return out;
}

/**
 * A sampler for one seat.
 *
 * ⚠️ IT IS A FACTORY AND HOLDS ITS OWN STATE, and the first draft of this file did not - it kept the
 * charging position in a module variable. Two seats would then have shared one memory of what was being
 * charged, so the second child's release would have fired the first child's verb; and a value living
 * outside any state is a value no digest can see and no replay can reproduce.
 */
export function createSampler(opts: {
  /** Ticks of tolerance on the R1+R2 chord; `0` removes the reinterpretation. See `ui/assists-panel`. */
  readonly grace?: number;
  seat: number;
  chargeMode?: ChargeMode;
  /**
   * The live keyboard, asked fresh every tick.
   *
   * ⚠️ A FUNCTION AND NOT A VALUE, for the same reason `soundOn` is one: a child remaps a key from a panel
   * that is open WHILE this sampler exists, and a map captured at construction would answer with the
   * keyboard she had before she changed it. Absent = the engine's declared defaults.
   */
  keymap?: () => Keymap;
}): Sampler {
  // ⚠️ THE GRACE COMES FROM THE CHILD NOW, and it did not until 2026-09-07. `createChord` has taken it
  //    since the day it was written and this line handed it the constant - the tenth time this repository
  //    has found a module that was right, gated, and given no choice by its only caller. It is a TIME
  //    LIMIT: those ticks decide whether R2 switches player at once or waits to see whether R1 follows,
  //    which is a window a child has to hit, and WCAG 2.2.1 governs windows a child has to hit.
  const chord: Chord = createChord({ grace: opts.grace ?? CHORD_GRACE });
  const charge: Charge = createCharge({ mode: opts.chargeMode ?? 'hold' });

  /**
   * Which diamond position opened the charge that is now open.
   *
   * ⚠️ REMEMBERED BECAUSE THE VERB IS DECIDED ON RELEASE, and on release nothing is held any more. Reading
   * the held state at that moment answers "none" and turns every shot into the default.
   */
  let charging: string | null = null;

  return {
    charging: () => charge.charging(),

    sample(codes: ReadonlySet<string>, tick: number, pad?: Held | null): Command {
      const held = merge(heldFrom(codes, opts.keymap?.() ?? FALLBACK), pad);
      const { dx, dy } = steer(held);
      const sprint = held.action1 || held.leftTrigger;
      const jockey = held.leftShoulder;

      let verb: Verb = 'none';
      let power = 0;

      // The chord first: it is the act built from two positions, and losing it to a simpler one would make
      // the harder input the less reliable one.
      for (const out of chord.tick({ r1: held.rightShoulder, r2: held.rightTrigger })) {
        if (out.kind === 'switch') {
          verb = 'switch';
        } else {
          verb = out.lofted ? 'lob' : 'through';
          const t = out.heldTicks / 45;
          power = t > 1 ? 1 : t;
        }
      }

      if (verb === 'none') {
        // One charge serves the three diamond positions: only one of them is meant at a time, and a charge
        // each would let a child holding two produce two acts from one intention.
        const nowCharging = Object.keys(CHARGING).find((a) => held[a]) ?? null;
        if (nowCharging !== null) charging = nowCharging;

        for (const out of charge.tick(nowCharging !== null)) {
          verb = CHARGING[charging ?? 'action3'] ?? 'pass';
          power = out.power;
          charging = null;
        }
      }

      const flags = (sprint ? FLAG_SPRINT : 0) | (jockey ? FLAG_JOCKEY : 0);
      return { tick, seat: opts.seat, dx, dy, verb, power, flags };
    },
  };
}
