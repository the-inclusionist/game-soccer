# What this game changed in the engine

**Nothing.**

Not a line of source, not a record, not a workflow, not a test. The engine was read, consumed as a
package, and left exactly as it was found.

This document exists because the 2048 needed its equivalent and because two sessions were editing the
engine repository while this game was being written — it added ADRs 0087 to 0091, rebuilt `dist-pkg`, and
changed the input layer and the contract mid-flight. An audit that says "nothing" is only worth reading if
it says what "nothing" was measured against.

## What was measured

| | |
|---|---|
| `git status` in the engine | Checked repeatedly. Every modified or untracked file belonged to the other session. |
| `npm install` | Run with `--ignore-scripts`, so the engine's `prepare` could not fire and rebuild anything there. |
| `dist-pkg/` | Read, never written. It was rebuilt at 19:34 by the other session, which is how the new input layer became available. |
| `docs/2-Architecture/adr/` | Read. `python scripts/validate-adr.py` was run once, read-only: 91 records, 91 sound, 0 with problems. |

The one file written outside this repository is `.claude/launch.json` in the parent folder, which is
git-ignored and shared by every session on this machine. One entry was **appended** (`soccer-dist`, port
8201); the ten that were there are untouched.

## What the engine is owed

Building against the engine is the only thing that measures what it actually delivers. Four defects
surfaced, and none of them is this game's to fix.

### 1. The sonar goes mono on a pitch measured in metres

`platform/audio-sonar.ts` computes the stereo pan as:

```ts
Math.max(-1, Math.min(1, (wx - pl.x) / (ctx.LOGICAL_W * 0.55)))
```

The denominator is `320 * 0.55 = 176`, and that constant assumes the topology's x-axis is in **logical
pixels**. That is true for the platformer, and vacuous for `grid` and `hotspots`, which is why it has
never been noticed. On a 90-metre pitch a team-mate ten metres to the right pans to `10/176 = 0.057` —
effectively mono.

The failure is the same class the quiz recorded as *correct and useless*: the sonar would be **correct and
inaudible**. The pan denominator wants to come from `topology()` — `PAN_PACES * unit` — rather than from
the width of the screen.

This is the most consequential of the four, and it is exactly the kind of thing a third topology preset
exists to find.

### 2. One-button mode is honoured only on the keyboard

`input/keydown.ts` releases every other held game key when a new one arrives, which is what one-button
mode means. `input/gamepad.ts`'s `pollPads` has no equivalent.

So a child in one-button mode **with a pad plugged in is not in one-button mode**, and nothing reports it.
A silent hole in pillar 2.

### 3. The two-player keyboard scheme is unusable on the target hardware

`input/keyboard.ts`'s `KB_DEFAULTS.p2[1]` binds `Numpad8/5/9/6`. A Chromebook has no numpad, and a
Chromebook is the hardware pillar 1 names.

⚠️ AND THIS GAME NOW BINDS ITS SECOND SEAT TO THE NUMPAD TOO, by the Dev's decision of 2026-09-06, which
has to be said here rather than left for somebody to notice as a contradiction. The finding stands as
written: what makes the engine's version a defect is that it is a DEFAULT a child cannot escape. Here the
remap screen reaches both keyboards, every world position of the second seat is offered on it, and the
session keys - pause and the accessibility bar - stay on `H` and `F` for the first seat, which every
keyboard has. The layout is also better where a numpad exists: a physical block under one hand, laid out
like a pad, taking nothing from the first child. The engine's fix is to make its own default rebindable,
not to change which keys it picked.

### 4. The pad wizard speaks hard-coded pt-BR

`input/gamepad.ts`'s `PADWIZ_STEPS` held literal strings — `'CIMA'`, `'PULAR'` — inside the engine. That
is against pillar 3, and against the rule `input/devices.ts` states in its own header about why it stores
keys rather than text.

*(Issue #103 landed while this was being written and may have addressed part of this; the observation is
recorded as it was made, and should be re-read against the engine's current state before being acted on.)*

### 5. An earcon cannot rise or fall

`platform/audio-earcons.ts` reads an `SfxDef` of `{ t, f, d }` and plays one oscillator held at ONE
frequency for `d` seconds. There is no ramp, so a cue cannot go anywhere.

For this game that lands on the one sound that must not be got wrong. Scoring and conceding have to be
distinguishable by ear alone — a blind child hears the room react and needs to know which way it went
before the narration reaches her — and the obvious design, a figure that rises for hers and falls for
theirs, cannot be expressed. What is left is high-and-long against low-and-short, which is
distinguishable and is less information than the moment carries.

The shape of the fix is small: an optional second frequency on `SfxDef`, ramped to over the duration.
`doorSound` in the same file already does exactly that with
`frequency.exponentialRampToValueAtTime` — so the capability is present in the module and is not
reachable from the table. Written here as a finding rather than a patch, because the table shape is the
engine's to change.

⚠️ And the thing the engine got RIGHT in the same file is worth recording beside it, because it is the
kind of ordering a game reimplementing "just an oscillator" would drop without noticing: `sfx()` shows
the caption **before** it checks `getSoundOn()`. A deaf child gets the information with the speakers
dead. That single line ordering is why this game calls the engine's earcons instead of writing thirty
lines of Web Audio of its own.

### 6. There are two keyboard tables, and they were never reconciled

This is the largest of the eight, and it is the one that made "keyboard remapping comes free from the
engine" only half true.

| | |
|---|---|
| `input/default-bindings.ts` -> `KEYBOARD_SOLO` | Keyed by the **fourteen** positions ADR-0085 declared. Frozen. Imported by **nothing inside the engine** - a search finds it only in this game. |
| `input/keyboard.ts` -> `kb` | The one that is loaded, saved, remapped and read at runtime. Its schemes carry the platformer's **eight** positions: `left/right/up/down/action1..4`. There is no row for a shoulder, a trigger, `start` or `select`. |

So a consumer gets the right vocabulary with no way to change it, or a changeable table with no
vocabulary for ten of the things it does. `ui/settings-controls` renders its rows from the game's own
`acoesDoJogo()` (issue #106 did that part) and then reads and writes every one of them through `kbFor`,
which lands in the eight-row scheme - so ten rows would render with no key beside them and a remap would
write into a scheme nothing reads.

⚠️ RE-CHECKED AGAINST ENGINE 7.0.1 ON 2026-09-07, because the engine shipped ADR-0096 - *"the two-player
keyboard is the same geometry twice"* - which lands on exactly this ground. The finding **stands in full**:

| | |
|---|---|
| `KEYBOARD_DUO` was added to `input/default-bindings` | Two schemes of FOURTEEN, with a cross-table check. Good, and it is `Object.freeze`d and read by **nothing inside the engine** - the same shape as `KEYBOARD_SOLO`. |
| `input/keyboard.ts` | Still carries schemes of EIGHT: `left/right/up/down/action1..4`, no shoulder, no trigger. It is still the only table that is loaded, saved and remapped. |

So the engine now has *two* frozen fourteen-position tables and one remappable eight-position one. That is
a better answer to "what should two children's keyboards be" and not yet an answer to "how does a child
change fourteen of them". A consumer on 7.0.1 can delete this game's second-seat TABLE and still needs the
module around it.

⚠️ AND THIS GAME IS PINNED TO `^6.36.1` WHILE NPM SERVES 7.0.1 - a caret does not cross a major, so the
upgrade is a decision and not a `npm update`. Written here rather than taken.

What this game did about it, and why it is not a fix: `app/js/input/keymap.ts` is a live fourteen-position
map, born from `KEYBOARD_SOLO` and persisted under `kJogo('soccer', 'keymap')`, handed to the engine's
panel through the ports it already exposes. The panel is genuinely reusable - its header says the map must
never be indexed directly, and that discipline is what made this possible. But every consumer with more
than eight positions will write the same file.

### 7. The remap screen announces the platformer's words, or nothing

`ACT_LABEL` in `ui/settings-controls.ts` maps eight positions to eight i18n keys - `action1` to
`'act.run'`, `action2` to `'act.jump'` - and the render builds each button's accessible name from it,
as `t('ctrl.changeKeyAria', { acao: t(ACT_LABEL[a]), n: player + 1 })`.

The **visible** label was moved to `ctx.acoesDoJogo()` by issue #106. The **aria-label** was not moved
with it, and an `aria-label` OVERRIDES the visible text for a screen reader. Measured in this game before
the repair went in:

> `Alterar tecla de undefined do Jogador 1`

...on six of twelve buttons, while a sighted child read "Conter" on the same row. The other six announce
this game's controls with the platformer's words. That is worse than having no `aria-label` at all, and
it is invisible from inside the engine, because the platformer is the one consumer for which the table is
correct.

The same module writes two more strings as Portuguese literals: `'Pressione...'` into the button being
changed, and a whole sentence into `#ctrl-players`. Both are against pillar 3, on the screen a child opens
**because** she cannot use the default controls.

`app/js/ui/controls-panel.ts` repairs all three from the outside. The repair depends on listener
registration order on one element, which is defined behaviour and is still a thing a consumer should not
have to know.

### 8. A key can be bound to two positions in the same scheme

`settings-controls` writes `capture.mapRef[capture.action] = [e.code]` and guards it with
`keyUsedByOther(code, mapRef, schemes)` - which excludes `mapRef` **by reference**. In a one-player game
`schemesFor()` returns exactly that one scheme, so the guard can never fire: a child who moves `W` onto
jockey keeps `W` on "move up" as well, and holds both for the rest of the match.

`input/default-bindings.ts` already has the checker, and its own header names this exact failure - the
two actions fire together, and the child sees an intermittent double action nobody can reproduce on
purpose. The checker exists. The remap screen does not call it.

⚠️ MEASURED AGAIN WITH TWO SEATS, and the shape of it is worth recording. Once this game answers
`getNumPlayers()` with 2 and `kbFor(i)` with a map per seat, the guard starts working *for the
cross-seat case*: a key the other child owns is refused, correctly, without taking her old one away.
So the guard is not broken - it is **unreachable for one player**, which is the configuration every
one-child game runs in. The fix is a same-scheme check beside the other-scheme one, and
`default-bindings`'s own conformance function already is that check.

## What is drafted and not written

Five records, in this session's scratchpad, awaiting the Dev:

1. **The address** — `the-inclusionist/game-soccer`, under ADR-0082, with no exception needed.
2. **The line ADR-0006 needs** — what it forbids is the compulsion loop, not the contest inside one match.
   It also regularises `game-chess`, which has been competitive since before the question was asked.
3. **Chords** — a derived slot, and no chord without a latched equivalent.
4. **Charge** — holding is a magnitude, and every hold owes a route with no holding and no timing.
5. **Analog range** — a slot may have a range, and the deadzone stops being one number for everybody.

⚠️ None carries a number. The engine's index moved from ADR-0086 to ADR-0091 during this session, so a
number chosen in advance is a collision waiting. Each draft says to take it at write time, after
`git log --oneline -5` and `python scripts/validate-adr.py docs/2-Architecture/adr`.
