// SPDX-License-Identifier: AGPL-3.0-or-later
// R1 + R2, AND THE PROOF THAT ONE PRESS CANNOT DO TWO THINGS.
//
// ========================= THE PROBLEM, IN ONE SENTENCE =========================
// R2 alone switches player; R1 + R2 is a lofted through ball. So the R2 of the chord must NOT also switch
// player - and a child who means both at once will not deliver them on the same tick.
//
// ========================= THE RULE =========================
// R1 is the anchor. R2 is a modifier while an R1 charge is open. R2's own verb is DEFERRED by a short
// grace window and CANCELLED if R1 arrives inside it.
//
// ⚠️ AND A CHORD IS IMPOSSIBLE FOR A ONE-SWITCH CHILD, so it must never be the only route. The engine's
// one-button mode releases every other held key when a new one arrives; two buttons can never be down
// together. The answer is a LATCHED modifier - one actuation arms "lofted", the next through ball spends
// it - which is StickyKeys, the operating system's own precedent for exactly this problem.
import { describe, expect, it } from 'vitest';
import { CHORD_GRACE, createChord, type ChordOut } from '../app/js/input/chord.ts';

/** Feed a script of edges, one per tick, and collect everything that fired. */
function play(script: ReadonlyArray<Partial<{ r1: boolean; r2: boolean }>>, grace = CHORD_GRACE) {
  const chord = createChord({ grace });
  const fired: ChordOut[] = [];
  let held = { r1: false, r2: false };

  for (const step of script) {
    held = { r1: step.r1 ?? held.r1, r2: step.r2 ?? held.r2 };
    for (const out of chord.tick(held)) fired.push(out);
  }
  return fired;
}

const kinds = (out: ChordOut[]) => out.map((o) => o.kind);

describe('the chord', () => {
  it('[Zero] nothing held, nothing fires', () => {
    expect(play([{}, {}, {}])).toEqual([]);
  });

  it('[One] R1 alone, pressed and released, is a grounded through ball', () => {
    const out = play([{ r1: true }, {}, {}, { r1: false }]);

    expect(kinds(out)).toEqual(['through']);
    expect(out[0].lofted).toBe(false);
  });

  it('[One] R2 alone, pressed and released, switches player - once', () => {
    expect(kinds(play([{ r2: true }, { r2: false }, {}, {}, {}, {}]))).toEqual(['switch']);
  });

  it('[Right] R1 then R2 is a LOFTED through ball, and never a switch', () => {
    const out = play([{ r1: true }, { r2: true }, {}, { r1: false, r2: false }, {}, {}, {}, {}]);

    expect(kinds(out)).toEqual(['through']);
    expect(out[0].lofted).toBe(true);
  });

  // ⚠️ THE ONE A CHILD ACTUALLY PERFORMS. Meaning "both at once" and delivering R2 twenty milliseconds
  //    early is not a mistake to punish; it is what hands do.
  it('[Right] R2 then R1 INSIDE the grace window cancels the switch and lofts the ball', () => {
    const out = play([{ r2: true }, { r1: true }, {}, { r1: false, r2: false }, {}, {}, {}, {}]);

    expect(kinds(out)).toEqual(['through']);
    expect(out[0].lofted).toBe(true);
  });

  it('[Boundary] R2 then R1 AFTER the window is two deliberate acts, in order', () => {
    const late: Partial<{ r1: boolean; r2: boolean }>[] = [{ r2: true }, { r2: false }];
    for (let i = 0; i < CHORD_GRACE + 2; i++) late.push({});
    late.push({ r1: true }, {}, { r1: false });

    expect(kinds(play(late))).toEqual(['switch', 'through']);
  });

  it('[Boundary] with the window at zero the reinterpretation is off entirely', () => {
    const out = play([{ r2: true }, { r1: true }, {}, { r1: false, r2: false }, {}], 0);

    expect(kinds(out)).toContain('switch');
  });

  // ⚠️ THE DOUBLE-FIRE PROOF. Every ordering of the four edges, and the invariant that matters: no single
  //    R2 press ever produces BOTH a switch and a lofted ball.
  it('[Many] over every ordering of the four edges, one press never does two things', () => {
    const edges = ['r1down', 'r1up', 'r2down', 'r2up'] as const;
    const orders: string[][] = [];
    const permute = (rest: readonly string[], acc: string[]) => {
      if (rest.length === 0) return void orders.push(acc);
      for (let i = 0; i < rest.length; i++) {
        permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, rest[i]]);
      }
    };
    permute(edges, []);
    expect(orders).toHaveLength(24);

    for (const order of orders) {
      const script: Partial<{ r1: boolean; r2: boolean }>[] = [];
      for (const edge of order) {
        if (edge === 'r1down') script.push({ r1: true });
        if (edge === 'r1up') script.push({ r1: false });
        if (edge === 'r2down') script.push({ r2: true });
        if (edge === 'r2up') script.push({ r2: false });
      }
      for (let i = 0; i < CHORD_GRACE + 2; i++) script.push({});

      const out = play(script);
      const label = order.join('>');

      expect(out.filter((o) => o.kind === 'through').length, label).toBeLessThanOrEqual(1);
      expect(out.filter((o) => o.kind === 'switch').length, label).toBeLessThanOrEqual(1);
      const lofted = out.some((o) => o.kind === 'through' && o.lofted);
      const switched = out.some((o) => o.kind === 'switch');
      expect(lofted && switched, `${label} did both`).toBe(false);
    }
  });

  it('[Right] the loft is STICKY - letting R2 go mid-charge still lofts it', () => {
    const out = play([{ r1: true }, { r2: true }, { r2: false }, {}, { r1: false }]);

    expect(out[0].lofted).toBe(true);
  });

  it('[Interface] a charge reports how long it was held, which is what power is made of', () => {
    const out = play([{ r1: true }, {}, {}, {}, {}, { r1: false }]);

    expect(out[0].heldTicks).toBe(5);
  });
});

describe('the one-switch route', () => {
  // ⚠️ A CHORD WITH NO LATCHED EQUIVALENT IS A CONFORMANCE FAILURE. One actuation arms the modifier; the
  //    next through ball spends it. Every function stays reachable by single actuations - WCAG 2.1.1.
  it('[Right] arming the latch lofts the next through ball without R2 ever being held', () => {
    const chord = createChord({ grace: CHORD_GRACE });
    chord.armLoft();

    const fired: ChordOut[] = [];
    for (const held of [{ r1: true, r2: false }, { r1: false, r2: false }]) {
      for (const out of chord.tick(held)) fired.push(out);
    }

    expect(fired[0].lofted).toBe(true);
  });

  it('[Zero] and the latch is SPENT - the ball after it is grounded again', () => {
    const chord = createChord({ grace: CHORD_GRACE });
    chord.armLoft();

    const fired: ChordOut[] = [];
    const script = [
      { r1: true, r2: false },
      { r1: false, r2: false },
      { r1: true, r2: false },
      { r1: false, r2: false },
    ];
    for (const held of script) for (const out of chord.tick(held)) fired.push(out);

    expect(fired.map((f) => f.lofted)).toEqual([true, false]);
  });
});
