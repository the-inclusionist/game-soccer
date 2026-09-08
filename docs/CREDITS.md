# Credits

## The genre

Association football is a sport, not a work: nobody owns its rules, and this game implements them.

## The reference implementation

[modelence/open-soccer](https://github.com/modelence/open-soccer) — an arcade browser football game
built on the Modelence framework — was read **as a feature description** while planning this repository:
its README, and the list of file names in its tree.

⚠️ **It carries no licence file and no licence declaration, which means all rights reserved.** No line of
its code, no team, no rating, no palette and no asset is inherited here. Its source is not read by anyone
writing this game, and the feature parity list was built from prose alone. Credit is due for the idea of
a browser football game at this scope, and it is given here.

### How that was verified, on 2026-09-07

The absence is checked rather than assumed, because "no licence" is a claim about somebody else's rights
and an unchecked one is worth nothing:

- The **full file tree** was listed through the API. There is no `LICENSE`, `LICENCE` or `COPYING` at any
  path.
- The **`package.json` was read whole**. It declares no `license` field, and says `"name": "sandbox"` and
  `"private": true`.
- The repository's own **API metadata** reports `license: null`.
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
