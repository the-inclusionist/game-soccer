// SPDX-License-Identifier: AGPL-3.0-or-later
// READ THE SOURCE TREE ONCE, THE SAME WAY, FOR EVERY GATE THAT ASKS ABSENCE OF IT.
//
// ⚠️ WALKED RATHER THAN GLOBBED, and that is a defect this project has paid for. A pattern of
// `app/js/**` + `*.ts` skips the files in the ROOT of the tree - which here are `declaration.ts`,
// `narration.ts`, `play.ts` and `project.ts` - and returns a shorter list with no error at all. A gate
// that silently stops looking at four files is worse than no gate.
//
// ⚠️ AND IT LIVES HERE BECAUSE THE SECOND CALLER ARRIVED. `tests/cartridge-shape` wrote this walk for the
// absence gates that protect the cartridge conformance, and the i18n gate needs exactly the same list. Two
// copies of a tree walk is two answers to "what is the source of this game", and the day one of them
// learns about a new directory the other keeps reporting the old tree - green, and looking at less.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Every `.ts` under `dir`, including the ones at its top level. */
export function sourcesUnder(dir: string): string[] {
  let found: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return found;
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found = found.concat(sourcesUnder(full));
    else if (name.endsWith('.ts')) found.push(full);
  }
  return found;
}

/** Strip line and block comments, so a header that NAMES a forbidden thing does not trip its own gate. */
export function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** The comment-free body of one source file. */
export const bodyOf = (file: string): string => code(readFileSync(file, 'utf8'));
