// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ARITHMETIC GATE — a lint, not a hope.
//
// ========================= WHY THIS IS A TEST AND NOT A CONVENTION =========================
// IEEE-754 specifies `Math.sqrt` to be exactly rounded, and specifies `Math.hypot`, `Math.pow`, `Math.exp`
// and the trigonometric functions NOT AT ALL. Two conforming engines may return different last bits for
// `Math.sin(0.3)`, and so may the same engine on two processors. This simulation is being born ready for
// a network: its whole reproducibility claim is that (seed, setup, commands) determines the state, which
// a digest then checks. One `Math.hypot` in a hot path breaks that claim between a school Chromebook and
// a teacher's laptop, and it surfaces as "the replay diverges after forty seconds" with no other symptom
// and nothing in the stack trace. A convention in a header would be obeyed until somebody was in a hurry.
//
// ⚠️ ANGLES ARE UNIT VECTORS HERE, and that is the design consequence of this gate rather than a
// workaround. An eight-point heading is derived by comparison, a rotation by a stored (cos, sin) pair
// computed once outside the simulation, and a magnitude by `Math.sqrt` of a dot product.
//
// ⚠️ AND `Math.random` IS BANNED FOR A SECOND REASON. ADR-0049 says every reward is deterministic; a
// simulation that draws from an unseeded source cannot honour that, and cannot be replayed to show a
// child what happened.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const GUARDED = ['app/js/sim', 'app/js/rules', 'app/js/ai'];

const BANNED = [
  'Math.hypot',
  'Math.sin',
  'Math.cos',
  'Math.tan',
  'Math.atan',
  'Math.atan2',
  'Math.asin',
  'Math.acos',
  'Math.pow',
  'Math.exp',
  'Math.log',
  'Math.cbrt',
  'Math.random',
  'Date.now',
  'performance.now',
];

function sourcesUnder(dir: string): string[] {
  let found: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return found; // a guarded folder that does not exist yet is not a failure
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found = found.concat(sourcesUnder(full));
    else if (name.endsWith('.ts')) found.push(full);
  }
  return found;
}

/** Strip line and block comments, so a header that NAMES a banned call does not trip its own gate. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('the simulation uses only arithmetic that IEEE-754 pins down', () => {
  it('[Interface] no guarded source calls an unspecified or unseeded function', () => {
    const offences: string[] = [];

    for (const dir of GUARDED) {
      for (const file of sourcesUnder(dir)) {
        const body = code(readFileSync(file, 'utf8'));
        for (const banned of BANNED) {
          if (body.includes(banned)) offences.push(`${file}: ${banned}`);
        }
      }
    }

    expect(offences).toEqual([]);
  });

  it('[Zero] the guarded set is not empty, or the gate above proves nothing', () => {
    const all = GUARDED.flatMap(sourcesUnder);
    expect(all.length).toBeGreaterThan(0);
  });
});
