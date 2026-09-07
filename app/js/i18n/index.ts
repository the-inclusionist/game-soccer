// SPDX-License-Identifier: AGPL-3.0-or-later
// THE THREE DICTIONARIES, and the floor is three (ADR-0010 pillar 3).
//
// ⚠️ pt-BR IS THE ONLY PLACE PORTUGUESE APPEARS IN THIS REPOSITORY. Code, comments, documentation and
// commit messages are English; the languages a child reads live here and nowhere else.
//
// They reach the engine through `registerDict`, which exists BECAUSE of a downstream game: locales used to
// arrive through an `import.meta.glob` resolved in the engine's own build, against the engine's own
// folder, so a game outside that repository had no way to register its own strings. The chess had paid
// for that with a second i18n system of 383 lines.

import { en } from './en.ts';
import { es } from './es.ts';
import { pt } from './pt.ts';

/**
 * ⚠️ THE CODES ARE THE ENGINE'S, NOT BCP-47 TAGS, and getting that wrong put `club.campo x club.leste` on
 * screen with no error anywhere. `t()` falls back to the key, so a dictionary registered under `pt-BR`
 * when the engine asks for `pt` is a dictionary that exists and is never consulted. The engine keeps
 * region out of the code on purpose - `bcp47()` adds it back only where a browser API needs it - and
 * `availableLocales()` is the list, so the gate below compares against that rather than against a copy.
 */
export const DICTS = Object.freeze({ pt, en, es });

export type Key = keyof typeof en;

/** Register every dictionary with the engine. Called once, at boot. */
export function installDicts(register: (code: string, entries: Record<string, string>) => void): void {
  for (const [code, entries] of Object.entries(DICTS)) {
    register(code, entries as unknown as Record<string, string>);
  }
}
