// SPDX-License-Identifier: AGPL-3.0-or-later
// R1 + R2, resolved so that one press can never do two things.
//
// ========================= THE RULE, IN FIVE LINES =========================
//   1. R1 down      -> open a charge, remembering whether R2 is already held. Fires nothing.
//   2. R2 down      -> if a charge is open, mark it lofted. Otherwise ARM a switch, due in `grace` ticks.
//   3. R1 down with a switch armed -> DISCARD the armed switch, open the charge lofted.
//   4. The armed switch resolves on R2's release or on the deadline, whichever comes first.
//   5. R1 up        -> fire the through ball with its held time and its loft. Clear the charge.
//
// Every physical edge maps to AT MOST ONE output, and both guards are cleared in the same statement that
// fires. That is the whole double-fire proof, and `tests/chord.node.test.ts` walks all 24 orderings.
//
// ⚠️ ZERO GAME IMPORTS, ON PURPOSE. This module knows nothing about football, possession or a pitch: it
// takes two booleans and returns intents. If the engine ever adopts chords - and the argument for that is
// that every transport needs the same answer, including the one-switch one below - promoting this is a
// file move rather than a rewrite.

/** Ticks a solo R2 waits before committing, so a chord delivered a hair late still reads as a chord. */
export const CHORD_GRACE = 3;

export interface ChordHeld {
  readonly r1: boolean;
  readonly r2: boolean;
}

export type ChordOut =
  | { readonly kind: 'through'; readonly lofted: boolean; readonly heldTicks: number }
  | { readonly kind: 'switch'; readonly lofted: false; readonly heldTicks: 0 };

export interface Chord {
  /** Advance one tick with the current held state, and return whatever fired. */
  tick(held: ChordHeld): ChordOut[];
  /**
   * Arm the loft WITHOUT holding R2 - the route for a child who can only ever press one thing at a time.
   *
   * The engine's one-button mode releases every other held key when a new one arrives, so two buttons can
   * never be down together and a chord is structurally impossible. StickyKeys is the operating system's
   * own answer to exactly this, and it is the reason a chord may exist at all: a chord with no latched
   * equivalent puts a function out of reach of a single actuation, which is WCAG 2.1.1.
   */
  armLoft(): void;
}

export function createChord(opts: { grace: number }): Chord {
  let prev: ChordHeld = { r1: false, r2: false };
  let charging = false;
  let chargeTicks = 0;
  let lofted = false;
  let latched = false;
  let switchDueIn = -1;

  return {
    armLoft(): void {
      latched = true;
    },

    tick(held: ChordHeld): ChordOut[] {
      const out: ChordOut[] = [];
      const r1Down = held.r1 && !prev.r1;
      const r1Up = !held.r1 && prev.r1;
      const r2Down = held.r2 && !prev.r2;
      const r2Up = !held.r2 && prev.r2;

      // 3 before 1: an R1 arriving while a switch is pending is the chord a hand delivered out of order.
      if (r1Down) {
        if (switchDueIn >= 0) {
          switchDueIn = -1;
          lofted = true;
        } else {
          lofted = held.r2 || latched;
        }
        latched = false;
        charging = true;
        chargeTicks = 0;
      }

      if (r2Down) {
        if (charging) lofted = true;
        else switchDueIn = opts.grace;
      }

      // 4 - the armed switch commits on release or on the deadline, whichever is first. Both paths clear
      //     the guard in the same statement that pushes, so neither can fire twice.
      if (switchDueIn >= 0) {
        if (r2Up || switchDueIn === 0) {
          switchDueIn = -1;
          out.push({ kind: 'switch', lofted: false, heldTicks: 0 });
        } else {
          switchDueIn -= 1;
        }
      }

      // ⚠️ THE RELEASE TICK IS NOT A HELD TICK, and counting it made a five-tick hold report six. One tick
      //    of error is a whole `powerStep` at five steps, which is the difference between the pass a child
      //    aimed for and the next one up.
      if (r1Up && charging) {
        charging = false;
        out.push({ kind: 'through', lofted, heldTicks: chargeTicks });
        lofted = false;
        chargeTicks = 0;
      }

      if (charging) chargeTicks += 1;

      prev = { r1: held.r1, r2: held.r2 };
      return out;
    },
  };
}
