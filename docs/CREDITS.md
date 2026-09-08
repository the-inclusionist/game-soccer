# Credits

## The genre

Association football is a sport, not a work: nobody owns its rules, and this game implements them.

## The reference implementation

[modelence/open-soccer](https://github.com/modelence/open-soccer) — an arcade browser football game
built on the Modelence framework — was read **as a feature description** while planning this repository:
its README, and the list of file names in its tree.

⚠️ **It carries no licence file and no licence declaration, which means all rights reserved.** No line of
its code, no team, no rating, no palette and no asset is inherited here. Credit is due for the idea of a
browser football game at this scope, and it is given here.

⚠️ **THE PROVENANCE SENTENCE CHANGED ON 2026-09-08, AND THE OLD ONE IS QUOTED HERE RATHER THAN
DELETED.** It read: *"Its source is not read by anyone writing this game, and the feature parity list was
built from prose alone."* That was true when written and stayed true through every line of this game. On
2026-09-08 the Dev asked for the reference to be STUDIED - not to be copied, but to learn which problems
it had met and how it had answered them - and the arrangement made for that is set out below. The
sentence is replaced because it would otherwise become false, and a provenance claim that has quietly
stopped being true is worse than no claim at all.

### The clean-room arrangement, 2026-09-08

The reading and the writing were put in different heads, which is the standard answer to exactly this
problem:

- A **separate analyst** cloned the repository outside this tree, read it, wrote a report, and deleted
  the clone. It copied no file out of it.
- The **report is the only thing that crossed**, and it was written under a stated contract: no code, no
  pseudocode, no identifiers of any kind, no file or directory names, no numeric constants, no data, and
  no quoted prose. It carries what a feature IS, what problem it answers, the CLASS of answer chosen, and
  what that costs - the level at which an idea travels and an expression does not.
- The report was **audited against that contract before it was read for content**: zero code blocks, and
  every number in it is either a public fact, one of ours, or generic hardware.
- **The report is not in this repository** and will not be, by the Dev's decision. It is working
  material.
- **Nobody who writes this game has read the reference's source**, which is the part of the original
  sentence that still holds and is the part that matters.

Ideas, methods, mechanics and the rules of football are not protected by copyright; expression is. The
arrangement above exists so that only the first kind crosses, and so that the claim can be checked rather
than trusted.

### How that was verified, on 2026-09-07

The absence is checked rather than assumed, because "no licence" is a claim about somebody else's rights
and an unchecked one is worth nothing:

- The **full file tree** was listed through the API. There is no `LICENSE`, `LICENCE` or `COPYING` at any
  path.
- The **`package.json` was read whole**. It declares no `license` field, and says `"name": "sandbox"` and
  `"private": true`.
- The repository's own **API metadata** reports `license: null`.

⚠️ **AND ON 2026-09-08 IT WAS CHECKED AGAINST THE WORKING TREE INSTEAD OF THE API**, which is the
stronger form of the same claim: a clone was walked in full and searched case-insensitively for `licen*`
and `copying*` at every depth, with **zero matches**, and its `package.json` was parsed rather than read -
the `license` key is `undefined`, not an empty string. An API can be wrong about a repository; a checkout
is the repository. The finding is unchanged, and it is now first-hand.
- The README's licence section says *"See the repository for license details"*, which points back at a
  repository that carries none.

⚠️ **AND THE FRAMEWORK'S LICENCE IS NOT THE GAME'S.** `modelence/modelence` - the full-stack framework
the game is built on - is **Apache 2.0** (`LICENSE.md`, "Copyright (c) 2025 Modelence, Inc."), and that
was checked because it is the obvious place to look next. It licences the FRAMEWORK: the code a consumer
imports. It does not licence works built with it, any more than React's licence covers the sites written
in React. A permissive licence that did that would put every consumer's product under it, which is not
what any of them do or claim to do.

⚠️ **THIS IS VERIFIED ABSENCE, NOT AN ACCESS ERROR.** A registry that answers "not found" because a
request lacked authorisation is not a registry that holds nothing, and this repository has been misled by
that before. Here the whole tree came back and was read; the absence is in the data, not in a failure to
reach it.

## The engine

[the-inclusionist/the-inclusionist-engine](https://github.com/the-inclusionist/the-inclusionist-engine)
— AGPL-3.0-or-later — supplies the boot order, the accessibility stack (screen reader, spatial sonar,
high contrast by semantic role, scanning, Libras), offline TTS, i18n, the scene stack, the camera maths
and the fourteen abstract input actions.

## Fonts

Vendored by the engine and copied at build time; see the engine's `docs/CREDITS.md` and
`docs/LICENSES.md`.
