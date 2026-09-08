# Soccer

Association football for Brazilian public schools, built on
[The Inclusionist engine](https://github.com/the-inclusionist/the-inclusionist-engine) - accessible
first, at the engine's 320x180 pixel grid, offline as a PWA.

> **Playable, and not finished.** A match plays itself, a child can play it with a keyboard or through a
> panel of buttons, and the rules are refereed. Nothing is listed as owed any more; what is left is two match counts still off football's, measured and written down rather than rounded away, and three design deviations each with a row of its own.
>
> The sentence that stood here first said the repository held no product code at all, and removing it was
> part of the commit that made it false (ADR-0067 section 3).

## State

| | |
|---|---|
| Done - the simulation | `app/js/sim/` - a fixed 60Hz step in metres and seconds, a ball with a third axis, dribbling by touches rather than glue, and a digest that stands for the whole world at a tick. |
| Done - replay | `app/js/sim/recorder.ts` - a match is `(version, setup, commands)`. A recording from another simulation version is REFUSED, not run into a different match in silence. ⚠️ **And a GOLDEN one, which is the half that was missing.** This row said replay was done for weeks, and it was - but a recording and its replay are the SAME BUILD, so a change to the AI rewrites both together and the gate goes on passing while the game becomes a different game. Measured: `thinksThisTick` was replaced with `return true`, **deleting the AI budget outright** so that twenty-two agents re-decide every tick instead of one in six, and of 738 gates the only two that went red were the two that ask the schedule module what it returns. Every behavioural gate stayed green. `tests/golden-match` plays a **whole ninety-second match across half time** and pins nine digests and a readable summary - it catches the budget deletion in the first ten seconds, and catches `PASS_OVERRUN` moving in its fourth decimal place. ⚠️ **A red there is a QUESTION, not a defect**: it says the match is no longer the match it was, and it cannot say the new one is worse, because no number in it was chosen for being right. Re-blessing is a decision that owes a sentence in the commit message, and the summary beside the trail exists to make that sentence writable. |
| Done - the assistances | `app/js/ui/assists-panel.ts` - the shot-power route (**hold**, press-twice, or **one press one step**, which has no timing in it at all), the assisted pace, and the length of a half **including none**. All three were implemented, gated and **unreachable**: the composition root passed no charge mode, hard-coded the tempo at 0.5 and froze the half at ten minutes. WCAG 2.2.1 is paid twice here - every limit is an option, and one option in each list is that there is no limit. |
| Done - three clocks, one simulation | `app/js/drivers/` - real time, real time at reduced tempo, and turn based. **The same command stream through any of them produces the same digest trail**, which is the gate that makes them one game rather than three. |
| Done - the referee | `app/js/rules/` - kickoff, throw-in, corner, goal kick, offside, half and full time, as a transition table that is DATA. Practice is the same referee with the out-of-play rows switched off. ⚠️ **`offside` stood in this list for weeks while no match could produce one** - the arithmetic was written and gated, and nothing ever called it. The row was true of `rules/` and false of the game, which is exactly the claim this table exists to avoid making. |
| Done - the declaration | `app/js/declaration.ts` - the eight fields of `core/contract` for a `continuous` topology in METRES with a PACE as the unit. **The engine's third preset ever**, after `hotspots` (quiz) and `grid` (2048). |
| Done - the AI | `app/js/ai/` - 22 agents on a staggered budget of about four decisions per tick, one designated presser per side, and six skill ratings applied at the point of ACTION so a weak side and a strong one run the same code. |
| Done - club ratings | Six numbers per club, applied at the point of ACTION, and **the six add up to the same total for every club** - a child picks the badge she likes, and if that badge carried a worse team she would be punished for choosing on looks. ⚠️ **They reached NOTHING until the AI could pass.** `think` took them and did `void skills`; `passErrorOf`, `capsFor` and `controlRadiusOf` were imported by no module at all. The claim "every club is a side" was true of the roster and false of the match, and it stood in this table for a day. **All six now bite**, and every one of them was imported by nothing at all until the day it was wired - each gated beforehand by a test that called the function directly and would have stayed green with every caller deleted. Passing scatters a pass; shooting leans a shot off the middle of the mouth; pace sets a body's top speed and acceleration; control sets how far the ball strays before a dribbler loses it; defending sets how much closer than the carrier a challenger must be to take it; composure sets when the carrier lets it go. ⚠️ **`defending`'s obvious wire was backwards** and is recorded as such: spending it on the challenge range would have made a good defender give away more free kicks and win the ball no more often, because `challenger` decides who committed a FOUL and wins nobody the ball. None of the six branches the cascade, and each is exactly its constant at 0.5 - so a match driven with no clubs at all is the world every other gate describes. |
| Done - choosing the clubs | `app/js/teams/roster.ts` - twelve clubs a child picks between, replacing one hard-coded seed. **The luma rule survived the choice by moving**: a club keeps its name, crest and first-choice kit, and the visitor changes kit when the home side's does not read against it - which is what football does. All **132 ordered pairings** are walked, not sampled. The opponent's own entry is disabled rather than silently swapped. |
| Done - the screen | `app/js/render/` - PixiJS at 320x180, a pseudo-3D broadcast camera, shadows, procedural kits from generated club palettes, integer pixels in both the camera and every sprite, and **players with heads, arms and two legs** that stride as they run. The figure is a plan of CELLS, so "it has arms and legs" is a gate and not a matter of taste; the outline is derived from the shape, where it used to be a rectangle drawn behind four stacked blocks. |
| Done - two seats | `app/js/input/keymap.ts` + `app/js/render/marker-pixels.ts` - two children on one keyboard, **co-operative by default**, with a contest as the option after it. The two halves of the keyboard share **not one key** (gated). Player one is the letters (`WASD` + `UIJK` + `7 Y 8 O`); **player two is the arrows and the numpad** (`8 5 6 9`, `/ 7 * +`, `1` and `0`) - the Dev's scheme, and the same layout `docs/ENGINE-AUDIT.md` finding 3 criticises as an engine DEFAULT: the difference is that a child here can rebind it, and the first seat keeps the session keys on letters every keyboard has. And the two markers differ in **shape** as well as colour - a gate rejects "the same wedge, one pixel lower". The remap screen offers **both keyboards**, one toggle each, and restoring the defaults restores only the one being edited - resetting the child who did not ask would be taking her keys away for somebody else's mistake. Both markers **have now been seen together in a captured frame**, on the two central players: a yellow wedge and a white double bar. |
| Done - remapping | `app/js/input/keymap.ts` + `app/js/ui/controls-panel.ts` - the engine's remap screen, opened by this game and wired to a keyboard it can actually change. The engine has **two** keyboard tables and they were never reconciled: the fourteen positions are FROZEN and the changeable one has eight rows. This game supplies the live map, and repairs three defects from the outside - see the audit. |
| Done - controls | `app/js/input/` - the engine's fourteen positions, the `R1+R2` chord with its latched one-switch equivalent, and three charge routes the assistances screen can actually select. ⚠️ Until that screen existed this row claimed the stepped route as done while nothing could choose it - true of the module, false of the game. |
| Done - captions | `#caption` carries the NARRATED SENTENCE, not only the earcon label. Until it did, the whole narration reached a blind child through the live regions and reached **nobody else** - a deaf child read seven words where the sentence named the side and the spot. It is `aria-hidden` on purpose: the reader already had it, and a second live region would say every goal twice. |
| Done - the state mirror | `app/index.html`'s `#mirror` + `app/js/ui/mirror.ts` - the match as real DOM text: the fixture, the score, the clock, the phase, whose ball it is, and **which of the eleven she is driving**. ⚠️ That last line was missing, and it was the only one of the six with no second route to a child who cannot see - the score is also an earcon and the phase is also narrated, while "you are number 7" was a **five-pixel wedge over a head and nothing else**. So `hud.ball.with` could tell her that her club had the ball while she had no way of learning it was at her own feet, which is the difference between following a match and playing one. It is four whole sentences and not two clauses joined - a keeper is told he is the keeper, because he is a different game - and a **sent-off player is reported gone rather than named**, through `onPitch`, the one function that answers "is he playing". The sentence is chosen in a PURE module so the node project can measure what it SAYS; the wire into the page is gated separately in `tests/boot.browser`, because the unit gate would go on passing with the wire cut - which is how eight modules here were right, gated and connected to nothing. Both gates were watched red first. ⚠️ **It cannot be seen in this pane**: the preview keeps the tab hidden, so `requestAnimationFrame` never fires and every live line sits on its placeholder - the same limit the offline row records. The wire is proved in a real Chromium by the browser gate, which goes red when the wire is cut. ⚠️ **And where the ball could go next**, which completes the plan's list for this module. `declaration.targetsOf` already answers it - at most four places, each actionable this instant, never the ten team-mates that would make a sonar beep ten times and say nothing - and this asks for the SAME spots rather than working them out again, because one fact in two files is two facts that drift. It is **the sonar in words, for the child the sonar cannot reach**: spatial audio needs ears, and a deaf-blind child on a braille display had the DOM and nothing else. A `<ul>` and not a sentence, so a reader announces "list, three items" and lets her step through them, and it is rewritten only when the text changes - sixty rebuilds a second of four list items is DOM churn a school tablet pays for. ⚠️ **Her left, not the screen's**: ends swap at half time, so a spot at a fixed `y` is on her left in one half and her right in the other, and the direction is multiplied by the way she is attacking. Finding that rule written **five separate times** - `ai/brain`, `narration`, `rules/offside`, `sim/contain` and `declaration`, three of them spelled differently - is what produced `sim/ends`: they all agreed, which is the point rather than the defence, because nothing made them. The digest and full-match gates passed unchanged, which is what says the behaviour did not move. ⚠️ **Two defects came out of watching one match run**, which is why looking is not optional. The list's label said "where the ball can go" - true only when the ball is at her feet, and on screen it sat over "twenty-two paces to your right" while the ball was LOOSE and that spot WAS the ball; `targetsOf` answers three different questions and a label that names one lies in the other two. Every gate was green, because the wire gate asks that the label is not empty and no gate can ask whether a sentence is TRUE of a situation it does not name. |
| Done - sound | `app/js/audio/` - seven earcons through the engine's own mixer, told from the seat the child is in: scoring and conceding are different tones, and every one of them carries a **caption**, which the engine shows BEFORE it checks whether sound is on. The decisions live in a pure module so they are measured in the node project - a browser test could only ever assert that a function was called. |
| Done - i18n | pt-BR, en and neutral es through the engine's `registerDict()`, with a gate that the codes are exactly the ones the engine asks for. Every control on the page - both shell selects included - is compared against `t()` by a gate, because "it says something" is not the claim and "it says what the dictionary says" is. |
| Done - a11y gate | `tests/a11y.browser.test.ts` runs axe-core against the RUNNING game with the stylesheet loaded and **zero exclusions**, including the end-of-match panel with the panel actually SHOWN - axe skips a `hidden` subtree, so a panel audited while hidden is a panel not audited. `tests/shell-drift.browser.test.ts` is what keeps the audited markup level with `app/index.html`: three copies of the shell had already drifted, and the gate reported zero violations for a page that did not contain the end panel. Proven able to fail. |
| Done - the stadium | Three parallax layers with real vertical drift, because the engine's own table carries `fy: 0` on all three. Two separate things had to be fixed before they could be seen. **The alignment**: `generateTexture` crops to the graphics' bounds, so the pitch texture began at the grass and a sprite at (0,0) put world row 36 on screen row 0 - covering the band left clear for the stands and putting the whole pitch 36px above where `project()` says it is. **The framing**: the camera aimed 12px above the ball, which sits it at `camY = 84` on the halfway line and covers the band anyway - so proving the pixels worked meant holding the ball against the far touchline, which no match does. It aims 58px above now: **the ball sits low in frame and the far stand fills the top of it**, which is what a televised match looks like. ⚠️ Stands and the whole pitch cannot both be in one frame at 320x180 - 180 rows, 34 of stand, a pitch 280 tall - so a frame with stands is a frame looking ACROSS at the far side. Gated on the alignment and on the far half, from a fresh boot, because the camera's dead zone makes the boundary hysteretic. |
| Done - the CI a11y flag | `.github/workflows/ci.yml` carries `a11y: true`. It was `false` because nobody had watched it pass; the condition written in that file was met in this order - build, the exact sequence `game-ci.yml` runs, `0 violations`, and then **proof it can fail**. The first attempt at that proof did NOT fail, correctly: emptying a button stayed green because the game fills that text from the dictionary at boot. Stripping `lang` from `<html>` is a defect the runtime cannot repair, and it came back red. |
| Done - offline (pillar 8) | `app/js/pwa/precache.ts` + `scripts/build-sw.mjs` + a manifest with an SVG icon. **The plan was measured, not reasoned**: the build is 16 MB and 13.9 of them are the speech runtime `createGame` imports unconditionally and this game never calls - the running page never even requests it. Reading the network log says a match needs SIX files; the precache is those plus the three dictionaries, because a language that needs the network is not offered. **730 KiB against a 1 MiB budget that the build enforces** and that is deliberately smaller than the file it exists to exclude. Verified by stopping the server and reloading: the document, the script, the CSS and the fonts came from the cache and the game booted. ⚠️ The render loop could not be watched offline - this pane keeps the tab hidden, so `requestAnimationFrame` never fires. |
| Done - Libras | `ui/vlibras` through a toggle, and the narration offered to the interpreter as a THIRD channel - the reader for a blind child, the caption for a deaf one who reads Portuguese, the interpreter for a deaf one whose first language is Libras, who is a different person and the one this game reached last. **The mode is the child's choice and the widget is one possible translator**: it turns on with no widget, no network and no gov.br, which is why it is gated at all. ⚠️ **Two costs, both measured.** The widget is cross-origin, so it does not survive the service worker - it is the only part of this game that stops working with the wifi down. And it costs the axe gate its "not one exclusion": it ships a CRITICAL `image-alt` on two images nobody here writes, now excluded by selector. **The exclusion does not fix it for anybody** - it stops the gate reporting a defect this repository cannot repair, and the images are still in the page. |
| Done - the shape of a match | `tests/full-match.node.test.ts` plays a whole match with nobody driving, and it is the only gate that ever reaches half time. **What it found, and what it still owes, is a section of its own: [The shape of a match](#the-shape-of-a-match).** |
| Done - fouls, cards, penalties | `rules/foul` + `rules/cards` - a challenge that misses the ball and finds a player, graded by CLOSING speed so a card is a rule a child can learn rather than weather. A red takes the player OFF, through the one function that answers "is he playing", so the AI, the offside line and the renderer inherit it without knowing cards exist. A penalty is its own phase, on a spot the pitch now paints - and being its own phase is what broke it: it was missing from the seam's list of phases that stop play, so the first penalty ever awarded left the world running under no laws and the match never ended. Severity is what the tackler BROUGHT to the contact - his own speed at the man, capped by the speed the gap was closing at - and not the relative speed of two bodies, which booked a defender for standing still while somebody ran into him. **And the machine is judged by the same function she is** - until it was, a law applied to one half of the pitch and the half was hers. |

**Verified**: `npm run validate` green - typecheck clean, **911 gates** across the node and browser projects, and **not one `it.todo` left**: the last of them - corners often enough to count on - became a gate on 2026-09-07, and it asks for a corner in EVERY fixture of the slate rather than one across six
projects, and the build passing. Every gate was born red with a confirmed mutation before its green
counted.

## The shape of a match

`tests/full-match.node.test.ts` plays whole matches with nobody driving, and it is the only gate that ever
reaches half time. Almost everything below was found by it rather than reasoned out, and the failures are
kept because a defect that is written down is a defect that stops being re-made.

### Three wedges, each of which stopped a match for ever

- **`periodExpired` named no taker**, so the match stopped and never restarted.
- **A penalty was never taken**: `penalty` was missing from the seam's list of phases that stop play, so
  the world kept running under a referee who only speaks while play is live - the ball rolled to x=95.9 on
  a 90m pitch and the match never ended. That list is derived from the phase table now, so a phase nobody
  teaches the seam about freezes the world instead of running lawless.
- **A throw-in nobody could take.** Two of six fixtures ran out of ticks at a restart with eleven men each
  still on the pitch, so it was never about cards: the cascade sends whoever is nearest a LOOSE ball, and
  at a dead ball that is as likely to be an opponent - who is not taking this throw.

⚠️ **And the gate itself was wrong.** It played ONE fixture, so "corners and goal kicks happen" was
measuring which clubs came first in the list - three of the other five produce neither. It plays a slate
of six now, which is what found both of the wedges above.

### The ball never went out of play

`decideKick` cleared for a keeper, shot inside 22m, and returned null for everything else, so outfield
players **dribbled for ever**. One missing BEHAVIOUR, not three missing rules - and with the pass in, a
match produced throw-ins where it had produced none. **Offside** arrived the same way: `rules/offside` was
gated hard and called by nothing that played a match, the sixth module here that was right with no wire.

### Cards, and a diagnosis this README carried for weeks

It said the cause was structural - that the machine can only challenge at or above the reckless speed -
and owed a session about defending. Two attempts had moved the presser and both failed.

The defect was in the MEASUREMENT. Severity was graded on the plain relative speed of two bodies, while
`rules/foul`'s own comment promised that a player standing still whom somebody runs into has not committed
anything, which a subtraction cannot deliver. Measured over three whole matches, every foul was graded on
a closing speed with a median of 7.2 while no body in this game can exceed 7.2: those numbers were two
players running at each other. Grading on what the tackler BROUGHT took red cards across six matches from
**31 to 3**, and nothing about defending changed.

The rate then took two more findings. Both thresholds were still calibrated against the quantity `wentIn`
replaced, so severity is now a share of the tackler's **own top speed** - which is also the only fair
version, because a fixed threshold in metres books a quick club more often than a slow one for the
identical act. And raising the card line raised the CHALLENGE line with it, because they were one number,
so the machine nearly stopped fouling. Two questions, two numbers. Red cards across six: **31 to 3 to 1**.

⚠️ **A third attempt at the presser was measured and dropped**: slowing his ARRIVAL rather than moving
where he stands does bring him under the card line, and it costs him the ball.

### Corners, and a keeper who could not save

That count walked 5, 1, 5, 2, 1, 0 over a day of AI changes none of which were about corners; a `> 0`
assertion on it was a coin. There was no save model at all - a keeper is a body and a body takes the ball
inside its control radius, so a shot was binary and a keeper who never spills never concedes a corner.
`sim/save` gives him a reach wider than his hands: what he can touch but not hold he tips wider and
slower, keeping its forward direction and turning it outward from the middle of his goal.

⚠️ **The first version could not produce a corner either**: it pushed the ball straight out from the
goal's centre, which is the one direction guaranteed to keep it in play. The unit gates passed, because
they asserted the behaviour I had written rather than the behaviour football has.

### Throw-ins, and a restart that put the ball straight back out

The median gap between a restart being TAKEN and the ball going out again was **four ticks**: the ball is
placed ON the touchline, the taker walks out to it from inside, and the dribbling touch uses his own
velocity - so the first thing he did with it was put it back over. It survived every gate here because
they all asked whether play RESUMED, and it did, perfectly, hundreds of times a match. Football had both
fixes written already: a restart is played INTO the pitch, and **Law 15** forbids the taker touching it
again until somebody else has.

What found the rest was counting bodies: every crossing had **exactly two** within five metres - the
carrier and one opponent, never a swarm - and most came within a second of a restart. The ten-yard
keep-out was applied ONCE, when the ball was placed, and the cascade then walked the other side's presser
straight back onto it. A referee holds the ten yards until the ball is gone; now so does this.

⚠️ A general rule was tried first and reverted - "nobody can control a ball leaving them faster than
they can run" is true of football and false of this game, because a dribble knocks the ball ahead at
1.25x the carrier's speed. And teaching the presser to CONTAIN was tried three times and reverted three
times: a defender who holds his ground is never beaten, and a match of those had no goals in it at all.

### The frozen ball, and the numbers it invalidated

A keeper's parry marked the ball `grounded` without putting it on the turf. That flag routes the physics,
the grounded branch is the rolling one and has no gravity in it, so the ball froze in mid-air at 1.2m -
exactly `MAX_CONTROL_HEIGHT`, so unreachable - and the match ran to full time around it. Measured before
the fix: a real ninety-minute match produced events in the first minute and at half time and NOWHERE else.

⚠️ **Every per-ninety-minute figure quoted here or in that day's commit messages was an
extrapolation** from ten-minute matches that were themselves mostly frozen. The Dev asked what had reduced
the numbers; the answer was that nothing had, and the reduction was the freeze arriving sooner. No rate in
this game may be extrapolated across lengths, and none is.

### And a weakness the fixes uncovered

**Two sides with identical ratings never score at all** - 108,000 ticks, no goals - because the away shape
is the home shape rotated half a turn and the simulation has no randomness in it. Any difference breaks
the mirror, and `fixtureOf` refuses a club playing itself, so no fixture can reach it.

### Where the counts stand

**The game is the five-minute school match** - two halves of two and a half, the middle of the three
International Superstar Soccer offered - and it is measured against the Dev's own bands for a match of
that length, not against football's ninety minutes. Reading football's per-match counts as the target cost
days: forty throw-ins belong to an hour and a half, and a ninety-minute mode was tuned for two of those
days before anybody noticed that **no composition root had ever offered it**, so no child could reach it.

⚠️ **The standing counts are not repeated here.** They live in `tests/full-match`, which RUNS them,
with the bands and the Dev's decisions beside them. A number written into a second file is a number that
drifts, and every figure this section used to carry had.

⚠️ **The bands are measured with somebody PLAYING**, which was an open question and is now a
measurement: a scripted child driving one of the eleven triples the balls into the box and the goals and
halves the throw-ins. The empty-chair match is a floor, not the product.

⚠️ **What is still short is settled rather than owed.** Corners and goal kicks are the far side of a
trade taken deliberately - a shot that misses becomes a goal kick and a shot on target becomes a save, a
rebound and a corner, so the two are bought with goals one for one, and a children's game keeps the goals.
Three separate attempts at them are recorded where each lever lives: the shot error in `ai/ratings`, a
turn off the shin in `sim/block`, a longer shooting range in `ai/brain`. The offsides went to nought the
day a forward learned to stop at the last defender, and a gambling forward built to bring them back sold
three counts for a third of one.

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
- **Two players may stand inside each other, and that is measured rather than overlooked.** Every pair of
  the twenty-two, every tick, over a whole match: the closest two ever got was **0.000 m - exactly the
  same point** - and **21,160 of 36,000 ticks (58.8%)** had at least one pair inside 0.8 m. The fix was
  built with seven gates and wired: it works, taking the closest pair to 0.532 m, and it takes a
  ninety-minute match from 4.5 goals to **0.33**. A match with a third of a goal in it is a worse game
  than one with overlapping sprites, and body contact is not in the parity list. Reverted, with the whole
  table and the next measurement to take written into `sim/step` where the wire would go. ⚠️ It is not
  chaos: nudging one player's kickoff spot by 1 cm and 2 cm left every count identical, so those numbers
  are a signal. ⚠️ And the plan's `broadphase` is not what it needed - 22 bodies are 231 pairs, and the
  measurements walked 36,000 ticks of them in seconds.
- **2.5.1 is cited by analogy and says so.** A gamepad chord is not a pointer gesture. What governs
  literally is 2.1.1, 2.1.2 and 2.2.1, and the difference is marked rather than claimed away.

## Licence

Code: **AGPL-3.0-or-later** ([LICENSE](LICENSE)). All art here is procedural, which is program: no image
file is under version control, only the function that paints. Economic ownership belongs to the
**Municipio** - the reasoning is in [docs/LICENSES.md](docs/LICENSES.md).
