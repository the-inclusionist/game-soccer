# Soccer

Association football for Brazilian public schools, built on
[The Inclusionist engine](https://github.com/the-inclusionist/the-inclusionist-engine) - accessible
first, at the engine's 320x180 pixel grid, offline as a PWA.

> **Playable, and not finished.** A match plays itself, a child can play it with a keyboard or through a
> panel of buttons, and the rules are refereed. What is missing is listed under *Still owed*.
>
> The sentence that stood here first said the repository held no product code at all, and removing it was
> part of the commit that made it false (ADR-0067 section 3).

## State

| | |
|---|---|
| Done - the simulation | `app/js/sim/` - a fixed 60Hz step in metres and seconds, a ball with a third axis, dribbling by touches rather than glue, and a digest that stands for the whole world at a tick. |
| Done - replay | `app/js/sim/recorder.ts` - a match is `(version, setup, commands)`. A recording from another simulation version is REFUSED, not run into a different match in silence. |
| Done - the assistances | `app/js/ui/assists-panel.ts` - the shot-power route (**hold**, press-twice, or **one press one step**, which has no timing in it at all), the assisted pace, and the length of a half **including none**. All three were implemented, gated and **unreachable**: the composition root passed no charge mode, hard-coded the tempo at 0.5 and froze the half at ten minutes. WCAG 2.2.1 is paid twice here - every limit is an option, and one option in each list is that there is no limit. |
| Done - three clocks, one simulation | `app/js/drivers/` - real time, real time at reduced tempo, and turn based. **The same command stream through any of them produces the same digest trail**, which is the gate that makes them one game rather than three. |
| Done - the referee | `app/js/rules/` - kickoff, throw-in, corner, goal kick, offside, half and full time, as a transition table that is DATA. Practice is the same referee with the out-of-play rows switched off. ⚠️ **`offside` stood in this list for weeks while no match could produce one** - the arithmetic was written and gated, and nothing ever called it. The row was true of `rules/` and false of the game, which is exactly the claim this table exists to avoid making. |
| Done - the declaration | `app/js/declaration.ts` - the eight fields of `core/contract` for a `continuous` topology in METRES with a PACE as the unit. **The engine's third preset ever**, after `hotspots` (quiz) and `grid` (2048). |
| Done - the AI | `app/js/ai/` - 22 agents on a staggered budget of about four decisions per tick, one designated presser per side, and six skill ratings applied at the point of ACTION so a weak side and a strong one run the same code. |
| Done - club ratings | Six numbers per club, applied at the point of ACTION, and **the six add up to the same total for every club** - a child picks the badge she likes, and if that badge carried a worse team she would be punished for choosing on looks. ⚠️ **They reached NOTHING until the AI could pass.** `think` took them and did `void skills`; `passErrorOf`, `capsFor` and `controlRadiusOf` were imported by no module at all. The claim "every club is a side" was true of the roster and false of the match, and it stood in this table for a day. Three of the six now bite: passing scatters a pass, shooting leans a shot off the middle of the mouth, and pace sets a body's top speed and acceleration - each of them imported by nothing at all until the day it was wired, and each of them gated beforehand by a test that called the function directly and would have stayed green with every caller deleted. **Control, defending and composure still reach nothing.** |
| Done - choosing the clubs | `app/js/teams/roster.ts` - twelve clubs a child picks between, replacing one hard-coded seed. **The luma rule survived the choice by moving**: a club keeps its name, crest and first-choice kit, and the visitor changes kit when the home side's does not read against it - which is what football does. All **132 ordered pairings** are walked, not sampled. The opponent's own entry is disabled rather than silently swapped. |
| Done - the screen | `app/js/render/` - PixiJS at 320x180, a pseudo-3D broadcast camera, shadows, procedural kits from generated club palettes, integer pixels in both the camera and every sprite, and **players with heads, arms and two legs** that stride as they run. The figure is a plan of CELLS, so "it has arms and legs" is a gate and not a matter of taste; the outline is derived from the shape, where it used to be a rectangle drawn behind four stacked blocks. |
| Done - two seats | `app/js/input/keymap.ts` + `app/js/render/marker-pixels.ts` - two children on one keyboard, **co-operative by default**, with a contest as the option after it. The two halves of the keyboard share **not one key** (gated). Player one is the letters (`WASD` + `UIJK` + `7 Y 8 O`); **player two is the arrows and the numpad** (`8 5 6 9`, `/ 7 * +`, `1` and `0`) - the Dev's scheme, and the same layout `docs/ENGINE-AUDIT.md` finding 3 criticises as an engine DEFAULT: the difference is that a child here can rebind it, and the first seat keeps the session keys on letters every keyboard has. And the two markers differ in **shape** as well as colour - a gate rejects "the same wedge, one pixel lower". The remap screen offers **both keyboards**, one toggle each, and restoring the defaults restores only the one being edited - resetting the child who did not ask would be taking her keys away for somebody else's mistake. Both markers **have now been seen together in a captured frame**, on the two central players: a yellow wedge and a white double bar. |
| Done - remapping | `app/js/input/keymap.ts` + `app/js/ui/controls-panel.ts` - the engine's remap screen, opened by this game and wired to a keyboard it can actually change. The engine has **two** keyboard tables and they were never reconciled: the fourteen positions are FROZEN and the changeable one has eight rows. This game supplies the live map, and repairs three defects from the outside - see the audit. |
| Done - controls | `app/js/input/` - the engine's fourteen positions, the `R1+R2` chord with its latched one-switch equivalent, and three charge routes the assistances screen can actually select. ⚠️ Until that screen existed this row claimed the stepped route as done while nothing could choose it - true of the module, false of the game. |
| Done - captions | `#caption` carries the NARRATED SENTENCE, not only the earcon label. Until it did, the whole narration reached a blind child through the live regions and reached **nobody else** - a deaf child read seven words where the sentence named the side and the spot. It is `aria-hidden` on purpose: the reader already had it, and a second live region would say every goal twice. |
| Done - sound | `app/js/audio/` - seven earcons through the engine's own mixer, told from the seat the child is in: scoring and conceding are different tones, and every one of them carries a **caption**, which the engine shows BEFORE it checks whether sound is on. The decisions live in a pure module so they are measured in the node project - a browser test could only ever assert that a function was called. |
| Done - i18n | pt-BR, en and neutral es through the engine's `registerDict()`, with a gate that the codes are exactly the ones the engine asks for. Every control on the page - both shell selects included - is compared against `t()` by a gate, because "it says something" is not the claim and "it says what the dictionary says" is. |
| Done - a11y gate | `tests/a11y.browser.test.ts` runs axe-core against the RUNNING game with the stylesheet loaded and **zero exclusions**, including the end-of-match panel with the panel actually SHOWN - axe skips a `hidden` subtree, so a panel audited while hidden is a panel not audited. `tests/shell-drift.browser.test.ts` is what keeps the audited markup level with `app/index.html`: three copies of the shell had already drifted, and the gate reported zero violations for a page that did not contain the end panel. Proven able to fail. |
| Done - the stadium | Three parallax layers with real vertical drift, because the engine's own table carries `fy: 0` on all three. Two separate things had to be fixed before they could be seen. **The alignment**: `generateTexture` crops to the graphics' bounds, so the pitch texture began at the grass and a sprite at (0,0) put world row 36 on screen row 0 - covering the band left clear for the stands and putting the whole pitch 36px above where `project()` says it is. **The framing**: the camera aimed 12px above the ball, which sits it at `camY = 84` on the halfway line and covers the band anyway - so proving the pixels worked meant holding the ball against the far touchline, which no match does. It aims 58px above now: **the ball sits low in frame and the far stand fills the top of it**, which is what a televised match looks like. ⚠️ Stands and the whole pitch cannot both be in one frame at 320x180 - 180 rows, 34 of stand, a pitch 280 tall - so a frame with stands is a frame looking ACROSS at the far side. Gated on the alignment and on the far half, from a fresh boot, because the camera's dead zone makes the boundary hysteretic. |
| Done - the CI a11y flag | `.github/workflows/ci.yml` carries `a11y: true`. It was `false` because nobody had watched it pass; the condition written in that file was met in this order - build, the exact sequence `game-ci.yml` runs, `0 violations`, and then **proof it can fail**. The first attempt at that proof did NOT fail, correctly: emptying a button stayed green because the game fills that text from the dictionary at boot. Stripping `lang` from `<html>` is a defect the runtime cannot repair, and it came back red. |
| Done - offline (pillar 8) | `app/js/pwa/precache.ts` + `scripts/build-sw.mjs` + a manifest with an SVG icon. **The plan was measured, not reasoned**: the build is 16 MB and 13.9 of them are the speech runtime `createGame` imports unconditionally and this game never calls - the running page never even requests it. Reading the network log says a match needs SIX files; the precache is those plus the three dictionaries, because a language that needs the network is not offered. **730 KiB against a 1 MiB budget that the build enforces** and that is deliberately smaller than the file it exists to exclude. Verified by stopping the server and reloading: the document, the script, the CSS and the fonts came from the cache and the game booted. ⚠️ The render loop could not be watched offline - this pane keeps the tab hidden, so `requestAnimationFrame` never fires. |
| Done - Libras | `ui/vlibras` through a toggle, and the narration offered to the interpreter as a THIRD channel - the reader for a blind child, the caption for a deaf one who reads Portuguese, the interpreter for a deaf one whose first language is Libras, who is a different person and the one this game reached last. **The mode is the child's choice and the widget is one possible translator**: it turns on with no widget, no network and no gov.br, which is why it is gated at all. ⚠️ **Two costs, both measured.** The widget is cross-origin, so it does not survive the service worker - it is the only part of this game that stops working with the wifi down. And it costs the axe gate its "not one exclusion": it ships a CRITICAL `image-alt` on two images nobody here writes, now excluded by selector. **The exclusion does not fix it for anybody** - it stops the gate reporting a defect this repository cannot repair, and the images are still in the page. |
| Still owed - the shape of a match | `tests/full-match.node.test.ts` plays a whole match with nobody driving, and it is the only gate that ever reaches half time. It found a **wedge** (`periodExpired` named no taker, so the match stopped for ever) - fixed. It found that **the ball never went out of play**: `decideKick` cleared for a keeper, shot inside 22m, and returned null for everything else, so outfield players **dribbled for ever**. One missing BEHAVIOUR, not three missing rules - and with the pass in, a match now produces 28 throw-ins where it produced none. It found a SECOND wedge: **a penalty was never taken**, because `penalty` was missing from the seam's list of stopped phases, so the world kept running under a referee who only speaks while play is live - the ball rolled to x=95.9 on a 90m pitch and the match never ended. That list is derived from the phase table now, so a phase nobody teaches the seam about freezes the world instead of running lawless. Corners and goal kicks arrived with a shot that can miss; **offside** arrived when the flag was finally wired - `rules/offside` was gated hard and called by nothing that played the match, the sixth module here that was right with no wire. It found a THIRD wedge, and the first that was never about cards: two of six fixtures ran out of ticks at a throw-in with eleven men each on the pitch, because the cascade sends whoever is nearest a LOOSE ball and at a dead ball that is as likely to be an opponent. ⚠️ **And the gate itself was wrong.** It played ONE fixture, so "corners and goal kicks happen" was measuring which clubs came first in the list - three of the other five produce neither. It plays a slate of six now, which is what found both of the wedges above. ⚠️ Still owed: **cards are far too many** - three to eight red cards a match against football's one in ten matches, and a side finishing reduced to six. Teaching the presser to contain fixes the cards outright and was tried twice: before the pass it stopped play resuming, and after it produced a match with **no goals at all** at every distance from 1.1m to 3.0m. A defender who holds his ground is never beaten, so containing has to end in a challenge sometimes - and choosing when is a session about defending, not a constant. |
| Done - fouls, cards, penalties | `rules/foul` + `rules/cards` - a challenge that misses the ball and finds a player, graded by CLOSING speed so a card is a rule a child can learn rather than weather. A red takes the player OFF, through the one function that answers "is he playing", so the AI, the offside line and the renderer inherit it without knowing cards exist. A penalty is its own phase, on a spot the pitch now paints - and being its own phase is what broke it: it was missing from the seam's list of phases that stop play, so the first penalty ever awarded left the world running under no laws and the match never ended. **And the machine is judged by the same function she is** - until it was, a law applied to one half of the pitch and the half was hers. |

**Verified**: `npm run validate` green - typecheck clean, **727 assertions** across the node and browser, plus **three requirements stated and not met** (`it.todo`)
projects, and the build passing. Every gate was born red with a confirmed mutation before its green
counted.

## Which record declares it

The address `the-inclusionist/game-soccer` follows ADR-0082 (a game repository is named `game-<slug>` and
mirrors its package) and ADR-0083 (a game is born in its own repository and consumes the engine as a
package - no game is built inside the engine to be extracted later).

WARNING: **A game repository holds no `adr/` folder and never will** (ADR-0068 section 5). The records -
the ten non-negotiable pillars, the accessibility contract, the licence posture - live in the engine and
are inherited. This repository states only what is its own.

## What this game gave back to the engine

A consumer is worth more than its own screen: it is the only thing that measures what an engine actually
delivers. This one is the **third topology preset** ADR-0030 was waiting for - the quiz gave `hotspots`, a
list with no space at all; the 2048 gave `grid`, where distance is counted in cells; this gives
`continuous`, where distance is metres and the narration counts in paces. Eight things were found by
building against it:

| Found here | What it means |
|---|---|
| `platform/audio-sonar`'s `panFor` divides by `LOGICAL_W * 0.55`. That constant assumes the topology's x-axis is in logical PIXELS - true for the platformer, vacuous for `grid` and `hotspots`. On a 90-metre pitch a team-mate ten metres to the right pans to 0.057, which is mono. | The sonar would have been *correct and inaudible* - the same class of failure the quiz recorded as "correct and useless". The pan denominator wants to come from `topology()`. |
| `oneButton` is honoured only on the keyboard path; `pollPads` has no equivalent. | A child in one-button mode with a pad plugged in is not in one-button mode. A silent hole in pillar 2. |
| `KB_DEFAULTS.p2[1]` binds `Numpad8/5/9/6`. | Unusable on a Chromebook, which is the hardware pillar 1 names. |
| `PADWIZ_STEPS` held hard-coded pt-BR string literals inside the engine. | Against pillar 3, and against the rule `input/devices.ts` states in its own header. |
| An earcon is ONE oscillator held at ONE frequency: `SfxDef` is `{t, f, d}` with no ramp. | "A goal rises and a concession falls" cannot be written at all, so the only contrast a cue can carry is high-against-low. It is enough to tell apart and it is less than the information the moment holds. The earcon wants an optional target frequency. |
| **Two keyboard tables, never reconciled.** The fourteen positions live in a FROZEN `KEYBOARD_SOLO` that nothing inside the engine imports; the loaded, saved and remapped `kb` has rows for eight. | "Remapping comes free from the engine" is true of a game with eight positions. Every consumer with more will write this game's `input/keymap.ts` again. The biggest of the eight. |
| The remap screen's `aria-label` is built from `ACT_LABEL`, the platformer's eight words. | **Measured**: six of twelve buttons announced `Alterar tecla de undefined do Jogador 1` while showing "Conter" on the screen. An `aria-label` overrides the visible text, so this is worse than none. Issue #106 fixed the visible label and not this one. |
| A key can be bound to two positions in ONE scheme - `keyUsedByOther` excludes the scheme being edited by reference, so in a one-player game it can never fire. | The intermittent double action `default-bindings` says its conformance check exists to catch. The checker exists; the screen does not call it. |

Five records are drafted and await the Dev: the address, the line ADR-0006 needs between a compulsion loop
and a contest, chords as derived slots, holding as a magnitude, and a slot with a range.

Nothing in the engine was changed to build this game - not a line, not a record, not a workflow. What was
read, what was measured, and what the engine is owed are in [docs/ENGINE-AUDIT.md](docs/ENGINE-AUDIT.md).

## Origin, and what is deliberately not inherited

The feature set is measured against [modelence/open-soccer](https://github.com/modelence/open-soccer), a
browser football game. **That repository carries no licence at all**, which means all rights reserved.

WARNING: **No line of its code and no item of its data is inherited.** The features were read from its
README and from the list of file names in its tree; its source is not read by anyone writing this game.
The rules of a game are not protected by copyright; an implementation is. A clean reimplementation is the
only way the Municipio holds title to the whole of what it owns (`docs/LICENSES.md`), and it is the same
move the 2048 made with the MIT descendants of Threes! and the chess made with `3D-Hartwig-chess-set` -
with the difference that here there was no permissive licence to decline, only one to respect.

Credit is due and given regardless - see [docs/CREDITS.md](docs/CREDITS.md).

Three things of the reference game are deliberately **absent**:

| Not here | Why |
|---|---|
| The 48 World Cup nations, with their kits and crests | Federation crests and World Cup marks are third-party trademarks. The clubs here are fictional school and municipio sides, generated from a seed, with palettes whose luma separation is guaranteed by construction - and with **ratings that are equal in total and different in shape**, where the reference game's nations are frankly better and worse than each other. |
| A persisted best score, a career, progression between matches | ADR-0037: there is no save, and the Inclusionist stores nothing about a child. A match lives and dies with the session. |
| ~~Fouls, cards and penalties~~ | **No longer absent.** This row claimed they were not in the reference feature list; that was my reading of it and my decision, and writing it beside two genuine third-party-rights exclusions gave it a weight it never had. The Dev reverted it on 2026-09-07. |

## Deviations, written down rather than buried

- **Two seats share one screen, and pillar 7 permits it.** The pillar forbids *splitting* the screen - at
  320x180 that halves the usable resolution - and requires N viewports for multiplayer. Two children
  watching the *same whole pitch* is the opposite of a split screen. The default two-seat mode is
  **co-operative**: both seats on the same side against the CPU.
  The two seatings keep separate keyboards on disk, because they have different defaults: a child who remaps while a friend plays would otherwise come back alone to a keyboard she never chose.
- **The clock is three modes, not one.** The 2048 satisfied WCAG 2.2.1 (Timing Adjustable) *by
  construction* with `tick: 'player'`. Real-time football cannot, so the three modes are how this game
  pays that criterion: turn-based satisfies it by construction, assisted satisfies it by adjustment, and
  pure real time exists because an adult can choose it with the other two beside it.
- **2.5.1 is cited by analogy and says so.** A gamepad chord is not a pointer gesture. What governs
  literally is 2.1.1, 2.1.2 and 2.2.1, and the difference is marked rather than claimed away.

## Licence

Code: **AGPL-3.0-or-later** ([LICENSE](LICENSE)). All art here is procedural, which is program: no image
file is under version control, only the function that paints. Economic ownership belongs to the
**Municipio** - the reasoning is in [docs/LICENSES.md](docs/LICENSES.md).
