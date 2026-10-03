// SPDX-License-Identifier: AGPL-3.0-or-later
// THE COMPOSITION ROOT. The only module that knows every other one, and it does no thinking of its own.
//
// ⚠️ NO AUTO-BOOT AT THE BOTTOM OF THIS FILE. The 2048 measured a double boot from exactly that line -
// two canvases, two keyboard listeners, every move played twice - because the module was imported once by
// the page and once by a test. `bootar()` is called by `boot.ts` and by nobody else.

import { createGame, type Engine } from '@the-inclusionist/engine';
import { startLoop } from '@the-inclusionist/engine/core/loop.js';
import { createDeclaration } from '../declaration.ts';
import { playTick } from '../play.ts';
import { createScene, LOGICAL } from '../render/scene.ts';
import { MATCH_PROFILE, PRACTICE_PROFILE, type RulesProfile } from '../rules/profile.ts';
import type { ChargeMode } from '../input/charge.ts';
import { DICTS } from '../i18n/index.ts';
import { ACCOMMODATIONS } from '../accommodations.ts';
import { narrate, announce } from '../narration.ts';
import { CLUBS, fixtureOf } from '../teams/roster.ts';
import { CONTROLLED_BY_SEAT } from '../sim/command.ts';
import { AWAY, HOME, firstOf, teamOf } from '../sim/ids.ts';
import { createMatchState, type MatchState } from '../sim/state.ts';
import { NOBODY } from '../sim/possession.ts';
import {
  MAX_DT_FRAMES,
  MS_PER_FRAME,
  createAssistedDriver,
  createRealtimeDriver,
  createTurnDriver,
  type Driver,
} from '../drivers/driver.ts';
import { createTurnPanel } from '../ui/turn-panel.ts';
import { clockText } from '../ui/clock.ts';
import { chargeLine, hintLine, laggingLine, spotLines, youLine } from '../ui/mirror.ts';
import { attackDirOf } from '../sim/ends.ts';
import { outcomeFor, outcomeKey } from '../ui/outcome.ts';
import { crestCanvas } from '../ui/crest-canvas.ts';
import type { Command } from '../sim/command.ts';
import { createSampler } from '../input/sampler.ts';
import { PRESET } from '../input/preset.ts';
import { createSound } from '../audio/sound.ts';
import { createStorage } from '@the-inclusionist/engine/platform/storage.js';
import { codeFromKey, indexOf, loadKeymap, saveKeymap, type Keymap, type Seating } from '../input/keymap.ts';
import { createControlsPanel } from '../ui/controls-panel.ts';
import { chargeRouteFor, createAssistsPanel, DEFAULT_ASSISTS, type Assists } from '../ui/assists-panel.ts';
import { withPeriod } from '../rules/profile.ts';

export interface Booted {
  readonly motor: Engine;
  /**
   * The running world.
   *
   * ⚠️ IT IS RETURNED BECAUSE A COMPOSITION ROOT THAT HANDS BACK NOTHING CANNOT BE MEASURED. Without it,
   * "the pad reaches the engine" was gated and "the pad reaches the GAME" was not - a mutation that cut
   * the record on its way to the sampler passed every test. This is not a hook for tests to write
   * through; nothing here mutates it, and a debug panel would want exactly the same handle.
   */
  readonly state: MatchState;
  /**
   * The live keyboard.
   *
   * ⚠️ RETURNED FOR THE SAME REASON `state` IS: a remap screen can be perfect and the key can go nowhere,
   * and asserting on the SCREEN would not tell them apart. This is the object the sampler reads.
   */
  readonly keymap: (seat?: number) => Keymap;
  /**
   * Watch what is handed to the sign-language interpreter.
   *
   * ⚠️ IT EXISTS BECAUSE THE WIDGET CANNOT BE IN A TEST. VLibras is a remote script from gov.br, and a
   * gate that needed it would need the network - so what is measurable is that the game OFFERS the
   * sentence, which is the half this repository is responsible for. Whether an interpreter signs it is
   * the widget's business, and the engine's own module says so: the mode is the person's choice and the
   * widget is only one possible translator for her.
   */
  readonly onSigned: (fn: (text: string) => void) => void;
  /**
   * Which charge route this game is handing her right now.
   *
   * ⚠️ RETURNED BECAUSE IT IS AN ACCOMMODATION THAT MOVES, and the thing that moves it is the
   * accessibility bar rather than anything in this file. Without a handle, "the stepped route arrives
   * when she turns one-switch on" is a sentence no gate can check.
   */
  readonly charge: () => ChargeMode;
  /** Hold the world still, and let it go again. The engine's `pausar` and `retomar`, as this game wired them. */
  readonly pause: () => void;
  readonly resume: () => void;
  /** Where the camera is, in world pixels. See `Scene.cameraAt`. */
  readonly cameraAt: () => { readonly x: number; readonly y: number };
  /** The screen row the grass begins at. See `Scene.pitchTopOnScreen`. */
  readonly pitchTopOnScreen: () => number;
  readonly stop: () => void;
}

/**
 * Start the game in `doc`.
 *
 * Returns `null` when the shell is missing what the engine needs, and says what is missing through
 * `problems` - a game that boots half-wired into empty panels is worse than one that refuses.
 */
export function bootar(doc: Document = document, win: Window = window): Booted | null {
  // ⚠️ THE STORE IS AN INSTANCE NOW, not a namespace. Engine 10.0 removed every module-level export of
  //    `platform/storage` in favour of `createStorage(backend)` - a game builds its own, so a test can
  //    pass a memory backend without touching `localStorage`. The `win` injected into `bootar` is the
  //    browser's window in a page and the test's window in a gate - `win.localStorage` picks the right
  //    one on its own.
  const store = createStorage(win.localStorage ?? null);

  const pitch = doc.querySelector<HTMLElement>('#pitch');
  if (pitch === null) return null;


  // ⚠️ CHANGING THE SESSION RESTARTS THE MATCH, and that is honest rather than lazy. A practice pitch has
  //    a different squad on it and a different owner of the clock - `tick` is the one contract field that
  //    is DATA and not a function, so the engine captured it when the declaration was built. Mutating the
  //    world underneath a declaration that still says `clock` would leave the accessibility stack
  //    describing a game that no longer exists.
  const sessionValue = (): string => doc.querySelector<HTMLSelectElement>('#session')?.value ?? 'match';
  /** The rules of the chosen SESSION, before the chosen length is applied on top. */
  const baseProfile = (): RulesProfile => (sessionValue() === 'practice' ? PRACTICE_PROFILE : MATCH_PROFILE);
  let profile: RulesProfile = MATCH_PROFILE;
  let state = createMatchState(profile);
  state.phase = 'live';

  /**
   * Start the match again under whatever the rules are now.
   *
   * ⚠️ THE SAME OBJECT, REFILLED. The drivers, the turn panel and the declaration all hold this reference,
   * and handing them a new one would leave three of them describing the match that just ended.
   */
  const restartMatch = (): void => {
    const fresh = createMatchState(profile);
    fresh.phase = 'live';
    Object.assign(state, fresh);
  };

  // ⚠️ TWO CLUBS SHE CHOSE, and this used to be `makeFixture(1)` - one hard-coded seed, the same two clubs
  //    for every child in every classroom, for ever. The choice is not decoration: a child playing as a
  //    club she picked is playing, and a child watching two clubs somebody else picked is watching.
  //
  // ⚠️ AND THE LUMA GUARANTEE SURVIVED THE CHOICE BY MOVING. The generator used to RETRY until two kits
  //    separated; a child does not retry, she picks the two she likes. So a club keeps its identity and
  //    the FIXTURE decides the dress - the visitor changes kit when the home side's does not read against
  //    it, which is what football does. All 132 pairings are gated in `tests/roster.node.test.ts`.
  let picked: [number, number] = [0, 1];
  let fixture = fixtureOf(picked[0], picked[1]);
  // ⚠️ THE CHOSEN CLUBS' OWN RATINGS, and this line read `{ 0: AVERAGE, 1: AVERAGE }` until now - so the
  //    whole of `ai/ratings` was written, gated by a monotonicity test, applied at the point of action,
  //    and REACHED BY NOTHING. Twelve clubs were twelve palettes. It is the fourth time in this
  //    repository: a module that is right, a gate that is right, and no wire between them.
  //
  // ⚠️ AND NO CLUB IS STRONGER THAN ANOTHER - the six add up to the same total for every one of them, so a
  //    child who picks a badge she likes has chosen a STYLE and not a handicap.
  let skills = { 0: CLUBS[picked[0]].ratings, 1: CLUBS[picked[1]].ratings };

  // ⚠️ THESE TWO SIT ABOVE `createGame` AND THE ORDER IS LOAD-BEARING SINCE ENGINE 8.0. The declaration's
  //    `holdsAtOnce` reads the live charge route, and `createGame` now INVOKES the declaration during boot
  //    to check conformance - so a closure over a `let` declared further down threw
  //    `Cannot access 'assists' before initialization` and took all 122 browser gates with it. TypeScript
  //    cannot see it: the read is inside a closure, so it is legal to the compiler and fatal at run time.
  //    Nothing called this port before, because the field did not exist before.
  let chosenCharge: ChargeMode | null = null;
  // ⚠️ THE ROUTE IS CHOSEN AFTER `createGame`, NOT HERE, and the one-line reason is that the setting it
  //    reads lives on the root: engine 10.0 emptied `core/state` of bindings and `motor.settings.oneButton`
  //    is the read now. The route is set immediately below the `createGame` call, before the first frame, so
  //    a child already in one-switch mode still never sees a frame of the hold route.
  let assists: Assists = { ...DEFAULT_ASSISTS };

  /**
   * The root's translator, reachable from a closure the declaration keeps.
   *
   * ⚠️ THIS INDIRECTION EXISTS BECAUSE THE DECLARATION IS AN ARGUMENT TO `createGame`, so `motor` does
   * not exist while it is being built: `t: (key) => motor.t(key)` is a block-scoped read before declaration
   * and TypeScript refuses it outright (TS2448), which is the compiler being right rather than pedantic.
   *
   * ⚠️ AND THE FALLBACK IS UNREACHABLE, MEASURED RATHER THAN HOPED. `createGame` DOES invoke the
   * declaration during boot - this file records the frame that cost 122 browser gates when `holdsAtOnce`
   * closed over a `let` declared further down - so the question is whether any boot-time check CALLS `t`.
   * Read in the engine: the nine `FIELD_CHECKS` of `core/contract` are shape checks, and `readerProblems`,
   * the only one that looks at `nameAt` and `objectiveOf`, asks `typeof d[f] === 'function'` and never
   * invokes them. So nothing resolves a word until the first drawing, which is after the line below.
   * If a future engine does resolve one at boot, the symptom is a raw key seen once - not a crash.
   */
  let translate: (key: string, params?: Record<string, string | number>) => string = (key) => key;

  const motor = createGame({
    declaration: createDeclaration({
      state: () => state,
      profile: () => profile,
      ourTeam: () => HOME,
      controlledBy: (seat) => CONTROLLED_BY_SEAT[seat],
      t: (key) => translate(key),
      // ⚠️ READ LIVE, NEVER CAPTURED. `holdsAtOnce` is how many fingers this game asks for, and the
      //    stepped charge route removes one of them - so a captured value would report the hardest route
      //    to a child who had already chosen the easiest, which is the accommodation being announced
      //    backwards. `assists` is reassigned by the panel below; this closure reads whatever is current.
      charge: () => assists.charge,
    }),
    host: {
      doc,
      win,
      cvdHost: doc.querySelector('#cvd'),
      // ⚠️ THE ACCESSIBILITY BAR, ON THE FIRST SCREEN. Blind mode, TTS, high contrast and Libras all
      //    existed here and all four were reachable only AFTER the match began. Engine 8.0 reports the
      //    missing host as a conformance problem, and it is right to: the child who needs blind mode to
      //    read the screen is the child who cannot find the button that starts the game.
      a11yBarHost: doc.querySelector('#a11y-bar'),
    },
    /**
     * WHAT THE PAUSE CARD'S ITEMS DO IN THIS GAME — and today that is exactly one of them.
     *
     * ⚠️ ONE ENTRY IS NOT A STUB, IT IS THE HONEST TABLE. ADR-0106 §5 forbids a dead button and the engine
     * enforces it: `itensQueAccionam` hides what the game does not answer for, so an absent entry is a
     * hidden item rather than a broken one. Measured before this line existed, `resume` itself was
     * hidden - so the card opened with no way off it but the START button, and a child navigating by
     * screen reader was read a menu with its own exit missing.
     *
     * ⚠️ AND `resume` IS THE ONE THE ENGINE LEANS ON. `entrarNaBarra` calls `acts.resume?.()` to leave the
     * card before it hands the directional to the accessibility bar, which is item 7 of ADR-0044.
     *
     * ⚠️ THE OTHER SIX OF ADR-0044'S ROOT LIST ARE DECISIONS AND NOT OMISSIONS, and they are named so the
     * next person decides rather than discovers. Measured from the mounted card: `acessibilidade`,
     * `options` and `pmback` the engine actions itself (`ITENS_DA_ENGINE`). That leaves `addplayer` -
     * this game changes seats through a selector that RESTARTS the match, which is not what a child
     * pressing "add player" mid-match expects; `ajuda`, which would need a help screen that does not
     * exist; `print`, a screenshot this game has no route to; and `quit`, which has nowhere to go,
     * because there is no title scene and a "quit" that restarts the match is a different verb wearing
     * the word.
     *
     * ⚠️ READ LIVE AND NOT CAPTURED, for the reason `ui/pause-icons` gives: a game's table changes during
     * a match - a "quit" that only works after the first half - and freezing it at boot has already
     * broken a case inside the engine.
     */
    getPauseActs: () => ({ resume: () => resume() }),
    /**
     * ⚠️ THE ENGINE OWNS WHEN THE CARD OPENS, THE GAME OWNS WHETHER THE WORLD MOVES. ADR-0144 §2 and
     * its symmetry a few hundred lines above: `createGame` opens its card on START (ADR-0122), then asks
     * the game to freeze; we hide our card and ask the game to resume. The engine calls this with
     * `'paused'` or `'playing'`; the game sets its own flag and the driver reads it on the next frame.
     *
     * ⚠️ AND IT IS WHAT CLOSES THE SIX-ERROR CHAIN FROM 11.0. Removing our `initGamepad` cut the
     * `pausar`/`retomar` callbacks the engine used to call for us. Without this, the engine's own card
     * opens on START and the world keeps playing underneath - the exact defect `tests/boot.browser`
     * «START pauses the world through the engine» caught at 39-vs-24 ticks.
     */
    setPhase: (p) => { paused = p === 'paused'; },
    // ========================= ⚠️ AND TWO ACCESSIBILITY ICONS ARE MISSING FROM THIS GAME =========================
    // 📏 Measured 2026-09-11 with the card open: `PAUSE_ICONS` declares TEN and the bar mounts EIGHT -
    // blind, tts, libras, tea, altmove, face, eyes, voice. The two absent are `contrast` (🌗) and `cvd`
    // (🚥). So a child who needs high contrast, or colour-vision correction, has no button for either, and
    // `motor.problems` is EMPTY - nothing reports it.
    //
    // `iconesQueAccionam` mounts an icon only for a game that declares it can write that axis, and that
    // rule is right: an icon that does not action is worse than an icon fewer. Engine 9.0.0 opened the two
    // doors - `setTemaDoJogador` and `setCorrecaoDoJogador` - and neither is supplied here.
    //
    // ⚠️ AND THEY CANNOT HONESTLY BE SUPPLIED ONE AT A TIME, which is the reason this is a note and not a
    // line of code. `render/viz-axes.aplicacao()` returns BOTH halves in one object, and its own doc says
    // why: «enquanto eram um campo, aplicar um apagava o outro». A game that answers for the correction
    // axis and not the theme invites exactly that bug back - a child in `hc7` who changes her colour
    // correction would lose her contrast.
    //
    // ⚠️ AND THE TWO AXES ARE NOT THE SAME SIZE OF WORK, which is the whole of what a decision needs:
    //   · CORRECTION is a CSS filter the engine already builds. `#cvd` holds six filters after boot
    //     (`cvd-fix-protan` and friends), `filtroChave` names the one a state needs, `cssFilterFor`
    //     composes it, `alcanceDoModo` says how far it reaches - and the engine's own rule is that a
    //     correction must reach the MENUS too, because it exists for a child to read. Nothing here has to
    //     be invented; it has to be held per seat and forwarded.
    //   · CONTRAST is three repainted palettes - `hc3`, `hc45`, `hc7` are the 3:1, 4.5:1 and 7:1 ratios -
    //     applied to the kits, the pitch and the crests. That is real render work against a MEASURABLE
    //     target, and this repository already owns the machinery for it: `teams/clubs` keeps `LUMA_GAP`
    //     and a luminance comparison for exactly this kind of question.
    //
    // So what is owed is a decision about the contrast axis, and then both writers land together.
    // `docs/ENGINE-AUDIT.md` records the measurement; this note records why it is not a one-liner.
    //
    // ========================= ⚠️ AND `setPauseActor` IS DELIBERATELY NOT SUPPLIED =========================
    // It is the fourth field 9.0.0 added and the one a reader will most reasonably think is missing here,
    // since this game plainly has two seats. It is not missing; it is unreachable, and the reason is worth
    // a paragraph so nobody wires it for symmetry.
    //
    // The engine's own note says the field exists so that «a criança do SEGUNDO assento» can remap through
    // the pause card, and that `problems` pushes a line when a game declares more than one player without
    // it. 📏 This game declares NO `players` at all, so the engine sees one, reports nothing, and loses
    // nothing - and declaring them would not be an improvement:
    //
    //   · the sampler reads OUR map and only ours - `createSampler({ keymap: () => keymaps[seat] })` - and
    //     `keymaps` is loaded by `loadKeymap` from this game's own storage key, `kJogo('soccer', 'keymap')`
    //     and `keymap.duo1`;
    //   · nothing in `app/` reads the engine's live table at runtime. Declaring `players` would mount a
    //     SECOND remap route that edits a table this game never consults, so a child who remapped there
    //     would change nothing and be told nothing. That is worse than one route;
    //   · and the second seat is already reachable: `ui/controls-panel` offers every one of the fourteen
    //     positions for both seats, which `docs/ENGINE-AUDIT.md` finding 3 records as the reason this game
    //     may bind its own numpad where the engine's default cannot.
    //
    // ⚠️ AND `semAtorDePausa` IS NOT DECLARED EITHER, which is the honest reading rather than the tidy one.
    // The engine's note calls declaring it «aceitar a perda em vez de a corrigir» - and there is no loss to
    // accept here, because there is no second player declared to lose anything. Declaring a decline for a
    // capability nobody asked this game for would be a false statement in the other direction.
    // The words of every surface the engine draws for this game, in the three languages.
    dictionaries: DICTS,
    // ⚠️ ADR-0085: the fourteen positions as this game's words - so the help screen, the remap screen and
    //    the voice command reader all name buttons in football's vocabulary instead of in the engine's.
    preset: PRESET,
    // ⚠️ REQUIRED AND COMPLETE (ADR-0153). See `app/js/accommodations.ts` for the eleven this game
    //    offers, the seven it refuses, and why the refusals are two different kinds of "no".
    accommodations: ACCOMMODATIONS,
    // ⚠️ ONE PLAYER DECLARED, so the engine's gamepad reader has a seat to put a pad on. Measured
    //    2026-10-02: `tests/boot.browser`'s START-pause gate stayed red at 38-vs-24 ticks even with
    //    `setPhase` wired, because with no `players` the engine's `takeSeat` found no free slot, the pad
    //    stayed `f.owner < 0`, `playRound` was never reached, and `startForSeat` never called `setPhase`.
    //    An empty keyscheme is honest here: this game reads the keyboard through its own
    //    `region.addEventListener`, not through the engine's keyboard runtime, so the engine's keyboard
    //    scheme is unused BY US - the field has to be present (the type requires it) and empty.
    players: [{ ctrl: {} as never }],
    declines: {
      // ⚠️ `semAssistenteDePad` WAS DECLARED HERE AND ENGINE 11.0 REMOVED THE FIELD, so the decline is gone
      //    rather than renamed. ADR-0231's reason, in the engine's own words beside the interface: «the wizard
      //    is accessibility the engine offers to every game, and the engine's accessibility is not declinable»
      //    (ADR-0122). We were declining a mapping wizard for the second seat on the grounds that this game
      //    binds its own numpad - which `docs/ENGINE-AUDIT.md` finding 3 still records as true - but the two
      //    were never the same claim: owning a keyboard table is not a reason a child may not be offered a pad.
      //    Nothing replaces it, and nothing is lost: the wizard now mounts for every game, this one included.
      // ⚠️ DECLINED, AND DECLINING IS THE HONEST ANSWER RATHER THAN THE CONVENIENT ONE. Engine 8.0
      //    names this game as one of three in the catalogue with no neural voice and nothing saying so,
      //    and it is right that the silence was the defect. But the line it asks for names a provider that
      //    drags `onnxruntime-web` in as a non-optional peer - 135.4 MB in the node_modules of every
      //    consumer - and this repository already measured the other end of the same cost: the build is
      //    16 MB and 13.9 of them are that speech runtime, which the running page never even requests.
      //    consumer - and that half of the argument still holds in 8.0.0: the port still names the same
      //    provider import.
      // ⚠️ AND HALF OF IT WENT STALE BETWEEN THE RELEASE CANDIDATE AND THE FINAL, so it is corrected
      //    here rather than left standing. 8.0.0 downloads the heavy assets at RUN TIME into the browser
      //    cache, in the background, one at a time - so the 1 MiB precache budget is no longer what stands
      //    in the way, and the sentence that said it was is withdrawn. What replaces it is a bigger
      //    number pointed at a worse place: the four voices are ~241 MB over a school's wifi, on the
      //    hardware pillar 1 names. That makes adopting them MORE consequential, not less.
      // ⚠️ SO THIS RECORDS WHAT IS ALREADY TRUE, AND IT IS NOT A DECISION TO KEEP IT TRUE. A child who
      //    cannot read gets the system voice, and on a school Chromebook that may not exist in Portuguese
      //    - the engine's own sentence, and it is about our audience exactly. Adopting the voice is a
      //    decision with a 135 MB and an offline-budget consequence, and it belongs to the Dev.
      noNeuralVoice: true,
    },
  });

  // The root exists from here, so the two things that had to wait for it are done before anything draws.
  translate = motor.t;
  assists = { ...assists, charge: chargeRouteFor(motor.settings.oneButton, chosenCharge) };

  for (const problem of motor.problems) console.warn('[shell]', problem);

  // The world is a whole multiple of 320x180, because ADR-0001 allows no other scale.
  const k = Math.max(1, Math.floor(Math.min(win.innerWidth / LOGICAL.w, win.innerHeight / LOGICAL.h)));
  pitch.style.width = `${LOGICAL.w * k}px`;
  pitch.style.height = `${LOGICAL.h * k}px`;

  const scene = createScene(pitch, fixture);
  (scene.app.view as HTMLCanvasElement).style.width = `${LOGICAL.w * k}px`;
  (scene.app.view as HTMLCanvasElement).style.height = `${LOGICAL.h * k}px`;

  // ⚠️ THE LISTENER GOES ON THE WORLD, NOT ON `window`. The engine's own menus listen in capture phase on
  //    the document, and a game listening globally would take keys out from under a dialog - or lose them
  //    to one. `#game-region` is the element the declaration names as the world, and it is where a key
  //    pressed AT THE GAME arrives.
  const region = doc.querySelector<HTMLElement>('#game-region');
  const down = new Set<string>();

  // ⚠️ THE KEYBOARD IS A LIVE OBJECT, NOT THE ENGINE'S FROZEN TABLE. `KEYBOARD_SOLO` declares the fourteen
  //    positions and cannot be changed; the engine's changeable table has rows for eight. This game's map
  //    is born from the first, persisted by itself, and is what both the sampler and the swallow test
  //    below consult - so a key a child moves actually moves. `app/js/input/keymap.ts` says why.
  //
  // ⚠️ TWO SEATS SHARE ONE KEYBOARD BY HALVES, and the halves are a different pair of tables rather than
  //    the solo one split - because the solo defaults hand ONE child both `WASD` and the arrows, and the
  //    arrows are the only movement block a second child can reach without leaning across the first.
  //    `tests/seating.node.test.ts` is where "not one key in common" is measured.
  let seating: Seating = 1;
  const keymaps: Keymap[] = [loadKeymap(store, 0, 1), loadKeymap(store, 1, 2)];

  /**
   * Does this key belong to ANY seat that is playing?
   *
   * ⚠️ ANY, NOT THE FIRST. The two seats' maps share no key, so the first seat's map answers `false` for
   * every key the second child presses - and the arrows would have been dropped before reaching the
   * sampler, leaving her with a body, a marker, a keyboard half and no way to move.
   *
   * ⚠️ AND IT IS ASKED OF THE LIVE MAPS, so a key just rebound is collected and swallowed too, instead of
   * the browser continuing to act on it while the game also does.
   */
  const belongsToAGame = (code: string): boolean =>
    keymaps.slice(0, seating).some((m) => indexOf(m).has(code));

  // ⚠️ THE PHYSICAL KEY, OR THE BEST NAME FOR IT WHEN THE EVENT CARRIES NONE. `code` is the right thing
  //    to read and this is not a retreat from it - it is layout-independent and it is what both of the
  //    engine's keyboard tables are keyed by. But an event with an EMPTY code is recognised by nothing
  //    here, so it is also SWALLOWED by nothing: the child gets neither her control nor an explanation,
  //    and the page quietly keeps the keystroke. `codeFromKey` asks the live map which physical key that
  //    `key` could only have been, and refuses when more than one answer is bound.
  // ⚠️ AND WHETHER REAL ASSISTIVE TECHNOLOGY PRODUCES SUCH AN EVENT IS UNMEASURED. Seen once, in a
  //    browser automation harness driving somebody else's game. It is a floor, not a fix.
  const codeOf = (ev: KeyboardEvent): string =>
    ev.code !== '' && ev.code !== undefined ? ev.code : (codeFromKey(ev.key, belongsToAGame) ?? '');

  region?.addEventListener('keydown', (e) => {
    const ev = e as KeyboardEvent;
    const code = codeOf(ev);
    if (!belongsToAGame(code)) return;
    down.add(code);
    // Only keys the game actually reads are swallowed. A blanket preventDefault would take Tab away from
    // a child navigating with it, which is the one key she must never lose.
    ev.preventDefault();
  });
  region?.addEventListener('keyup', (e) => {
    const ev = e as KeyboardEvent;
    // ⚠️ THE SAME RESOLUTION ON THE WAY UP, or a key that arrived by the fallback would never be let go
    //    of - held for the rest of the match, with her body running in one direction for ever.
    const code = codeOf(ev);
    if (belongsToAGame(code)) down.delete(code);
  });
  // A held key with the window unfocused would stay held forever, so the world lets go when it does.
  win.addEventListener('blur', () => down.clear());
  region?.addEventListener('pointerdown', () => region.focus());
  region?.focus();

  // ⚠️ ONE SAMPLER PER SEAT, and it must be so: a sampler remembers which diamond position opened the
  //    charge that is now open, so a shared one would fire the first child's verb when the second let go.
  // ⚠️ EVERY ONE OF THESE WAS ALREADY IMPLEMENTED AND UNREACHABLE. `createSampler` took a charge mode and
  //    was never given one, so `latch-stepped` - the only route with no timing in it at all - could not be
  //    chosen; the assisted driver's tempo was hard-coded at 0.5; the half was frozen at ten minutes. The
  //    README listed the stepped route as done, which was true of the module and false of the game.
  // ⚠️ THE ONE-SWITCH CHILD IS HANDED THE ROUTE WITH NO CLOCK IN IT, without an adult knowing to pick
  //    it. The plan asks for `latch-stepped` as the default whenever one-switch or scanning is on, and
  //    nothing read the setting - so she was handed `hold`, a route whose whole mechanic is keeping a key
  //    down, which is exactly what one-switch mode means she cannot do. `ui/assists-panel` carries the
  //    reasoning; this line is the wire, and `chosen` stays null until she picks something, so her own
  //    choice always wins over the accommodation.
  const makeSampler = (seat: number) =>
    createSampler({ seat, chargeMode: assists.charge as ChargeMode, grace: assists.grace, keymap: () => keymaps[seat] });
  let samplers = [makeSampler(0)];

  // ⚠️ THE PAD GOES THROUGH THE ENGINE, and the alternative was tempting and wrong. Reading
  //    `navigator.getGamepads()` here would have been thirty lines instead of thirty stubs - and it would
  //    have bypassed the declared binding table, the child's own remap, the mapping wizard that asks for
  //    each button by the GAME'S word for it, the per-player assignment and the one-button mode. Not a
  //    shortcut to the same place: a second input layer with none of the accessibility in it.
  //
  // ⚠️ AND MOST OF WHAT IT ASKS FOR, THIS GAME HONESTLY HAS NOT. No attract mode, no on-screen touch pad,
  //    no per-screen pause menu, no modal dialogs, nobody to join mid-match and nobody to respawn. Each
  //    stub below DECLARES an absence rather than pretending at one, which is the same posture
  //    `createGame`'s `declines` takes - the engine simply has no such field here yet.
  // ⚠️ ONE RECORD PER SEAT FOR THE ENGINE'S MOVE TOGGLE, and the honesty about it is the point. The
  //    engine resolves the toggle PER TRANSPORT and writes the answer here, so a child who turns it on
  //    with a pad in her hands gets the pad's setting and not the keyboard's - which is the defect 8.0
  //    measured and closed. Storing it needs these two fields and nothing else.
  //
  // ⚠️ AND `walkDir` HAS NO READER IN THIS GAME, which was written here as a missing WIRE and is not one.
  //    📏 Measured 2026-09-11 against the installed engine: `walkDir` appears in four places in the whole
  //    of `dist-pkg`, three of them comments, and the one line of code that touches it is
  //    `input/latch-sync.js:27` - `p.walkDir = 0`, which runs only when the toggle FALLS.
  //
  //    ⚠️ SO THE ENGINE ONLY EVER CLEARS IT. Nothing anywhere sets it to a direction. A reader added here
  //    would consult a field that is always zero, do nothing, and pass any gate that asked whether the
  //    toggle was honoured - which is the same no-op trap that `ai/brain`'s receiver filter carries a note
  //    about, and it is worth catching twice.
  //
  //    ⚠️ WHAT IS ACTUALLY MISSING IS THE FEATURE. The engine owns the SETTING - it resolves the toggle per
  //    transport, stores the child's choice and clears the direction when she turns it off - and leaves the
  //    behaviour to the game, because what "keep walking" means is different in a platformer and in
  //    football. `seguraTeclas()` answering true means the option is OFFERED, so today a child who turns it
  //    on is offered a control that remembers her choice and changes nothing.
  //
  //    ⚠️ AND IT IS ADR-0013 GROUND, so the semantics are a decision and not a detail. A child who cannot
  //    hold a key down is the person this exists for. The shapes available, none of them invented here:
  //      · press a direction to start walking it, press the SAME direction to stop - the name's own reading;
  //      · press a direction to start, press any OTHER direction to turn, and a separate action to stop;
  //      · latch only the LAST held direction, so releasing the key keeps the body going until a new press.
  //    They differ in what a child has to be able to do, which is the whole question, and picking one by
  //    taste at the end of a working day is how an accessibility feature ends up serving nobody.

  /**
   * Is the world held still?
   *
   * ⚠️ DECLARED HERE AND NOT BESIDE THE DRIVERS, four hundred lines further down, and the reason is a
   * defect this file has already paid for once. `charge: () => assists.charge` closed over a `let`
   * declared eighty lines below it, `createGame` invoked the declaration during boot, and the temporal
   * dead zone took all one hundred and twenty-two browser gates at once. `pausar` is only called when a
   * child asks - so a late `let` would probably survive - and "probably" is what that outage was made of.
   */
  /** What `motor.settings.oneButton` was last frame, so a change can be noticed rather than polled into a rebuild. */
  let oneButtonWas = motor.settings.oneButton;
  let paused = false;
  /**
   * Hold the world still AND show the card, because a frozen screen with nothing on it is not a pause.
   *
   * ⚠️ THE CARD WAS ALREADY MOUNTED AND NOBODY EVER OPENED IT. `createGame` falls back to `#game-region`
   * when no `pauseHost` is declared - `o.host.pauseHost ?? $('#game-region')` - so `#vp-pause-0` has been
   * in this game's DOM from the first boot, hidden, with fifteen items in it. An earlier note here said
   * the card was never mounted at all, which was wrong and is corrected where it stood.
   *
   * ⚠️ AND `mostrar` IS ALSO WHAT APPLIES ADR-0106 §5. Its own doc says it "refaz os itens - o §5 avaliado
   * no instante em que ela abre", so the no-dead-buttons filtering runs when the card opens and not
   * before. Opening it is therefore the step that makes `getPauseActs` mean anything - which is why the
   * table below is supplied in the same breath.
   */
  const pause = (): void => {
    paused = true;
    motor.pause.show(0);
    // ⚠️ AND NOTHING IS FOCUSED ON PURPOSE, which is the opposite of what stood here for an hour. This
    //    card does not use the browser's focus at all: `ui/menu-nav.navPause` says so in its own words -
    //    «este menu não usa foco do navegador - seleciona por classe, porque é desenhado dentro da tela do
    //    jogador» - and it carries the selection in `.pm-sel`, falling back to the first item when there
    //    is none. A `menuFocus` call here gave the card a SECOND notion of "current": the pad moved
    //    `.pm-sel` while the browser's focus sat on whichever item got focused first, and a child hearing
    //    both would have no way to know which one was real.
  };
  const resume = (): void => {
    paused = false;
    motor.pause.hide(0);
  };


  // ⚠️ THE SONAR IS THE POINT OF `targetsOf`, AND NOTHING WAS CALLING IT. The declaration answers "where
  //    can I put the ball next" and the engine turns that into spatial audio - but a game has to ask. The
  //    platformer asks on a held button; here it is `select`, which ADR-0085 keeps for SESSION functions
  //    and which this game leaves otherwise unused: "where is everything" is about the session, not about
  //    the world.
  let sonarWasDown = false;
  const askSonar = (): void => {
    const focus = motor.declaration.focusOf(0);
    if (focus === null) return;
    // ⚠️ NO `viz` SINCE ENGINE 8.0. The sonar used to be handed the render-mode TABLE and walk it with
    //    `pl.viz`; it is handed the ANSWER now, by a port the engine's own boot fills. Passing a render
    //    mode here was this game answering a question it has no business answering.
    motor.sonar.sonar({ i: 0, x: focus.at.x, y: focus.at.y });
  };

  // ⚠️ SOUND IS A CHANNEL, NOT A GARNISH, and until now this game had none at all. A sentence read by a
  //    screen reader arrives AFTER the event and takes a second to say; a tone arrives ON the tick, which
  //    is what lets a child react before she is told what happened. The caption beside it is the same
  //    information for a child who cannot hear the tone - and the engine plays it BEFORE checking whether
  //    sound is on, so a machine with the speakers dead still delivers half the feature.
  //
  // ⚠️ AND THE MIXER IS THE ENGINE'S. Its categories are what the child's own audio menu switches, its
  //    master gain is what the hearing-loss filter hangs off, and a game that opened its own
  //    `AudioContext` would be loud in exactly the settings where she turned everything down.
  // ⚠️ THE MIXER IS NO LONGER INITIALISED HERE, and the line that did it is gone rather than renamed.
  //    Engine 10.0 removed every module-level export of `platform/audio` in favour of `createAudio({...})`,
  //    and under `createGame` the root has already built one: `motor.audio`. Calling an initialiser a second
  //    time was never the risk - having a SECOND mixer is, because the child's audio menu, the hearing-loss
  //    filter and the master gain all hang off the root's instance, and a game with its own would be loud in
  //    exactly the settings where she turned everything down.
  const captionHost = doc.querySelector<HTMLElement>('#caption');
  // A caption that never clears is a lie about the present: "Goal for you!" would still be on the screen
  // ten minutes later. Each new caption cancels the last one's timer, so a burst does not blank the line
  // early.
  let captionTimer = 0;
  /**
   * Write one line for eyes that cannot hear.
   *
   * ⚠️ IT IS A NAMED FUNCTION BECAUSE TWO THINGS WRITE TO IT, and the ORDER between them is the feature.
   * The earcon's caption is a label - "Ball out of play"; the narration is a sentence that names the side
   * and the spot. Both land in the SAME TASK, so the browser paints once and a child only ever reads the
   * last value: the earcon's caption is the FALLBACK that shows when nothing narrates, and the sentence
   * is what she actually reads. Reversed, she would get the label every time and nothing would look wrong
   * - not in a screenshot, not in a `MutationObserver`, which cannot see the intermediate value either.
   */
  const showCaption = (text: string): void => {
    if (captionHost === null) return;
    captionHost.textContent = text;
    win.clearTimeout(captionTimer);
    captionTimer = win.setTimeout(() => {
      captionHost.textContent = '';
    }, 2600);
  };

  const sound = createSound({
    t: motor.t,
    ensureAC: () => motor.audio.ensureAC(),
    catNode: (cat: string) => motor.audio.catNode(cat),
    audioOut: () => motor.audio.audioOut(),
    noiseHit: (mat: string) => motor.audio.noiseHit(mat),
    tone: (f: number, d: number, ty?: OscillatorType, w?: number, v?: number) => motor.audio.tone(f, d, ty, w, v),
    // Read every time: a child changes these from the engine's audio menu mid-match, and a value captured
    // at boot would answer with whatever was true before she touched anything.
    soundOn: () => motor.audio.soundOn,
    volume: () => motor.audio.volume,
    // ⚠️ AND THIS ONE GAINED A SECOND WAY TO BE TRUE, which is a repair and not a rename. It read
    //    `engineState.captionsOn` - the captions SETTING alone. `motor.deafMode.captionsOn()` is the setting
    //    OR deaf mode being on, which is the engine's own definition of "does this sound get its caption
    //    now": a child in deaf mode who never found the captions switch used to get silent earcons and no
    //    line, and nothing anywhere reported it.
    captionsOn: () => motor.deafMode.captionsOn(),
    caption: showCaption,
  });

  // ⚠️ THE REMAP SCREEN THE ENGINE HAS AND THIS GAME HAD NEVER OPENED. It is the control a child with a
  //    hand that does not reach `U` and `I` needs before she needs anything else, and "the engine gives it
  //    for free" turned out to be true of a game with eight positions. `ui/controls-panel.ts` is what makes
  //    it true of one with fourteen.
  // ⚠️ THE LAST TWO HARD-CODED SELECTS. Every other control on this page has had its words resolved from
  //    the dictionaries since it was built; these two came from the first commit and were still Portuguese
  //    literals in `index.html`, which is the exact defect this repository has been recording INSIDE the
  //    engine all week. The markup keeps the Portuguese as a fallback for a boot that fails before this
  //    line - a control with no words at all is worse than one with the wrong ones.
  for (const [id, key] of [
    ['#session-label', 'tools.session'],
    ['#mode-label', 'tools.mode'],
  ] as const) {
    const el = doc.querySelector<HTMLElement>(id);
    if (el !== null) el.textContent = motor.t(key);
  }
  for (const [sel, prefix] of [
    ['#session option', 'tools.session'],
    ['#mode option', 'tools.mode'],
  ] as const) {
    for (const option of doc.querySelectorAll<HTMLOptionElement>(sel)) {
      option.textContent = motor.t(`${prefix}.${option.value}`);
    }
  }

  const seatsLabel = doc.querySelector<HTMLElement>('#seats-label');
  if (seatsLabel !== null) seatsLabel.textContent = motor.t('seats.label');
  for (const option of doc.querySelectorAll<HTMLOptionElement>('#seats option')) {
    option.textContent = motor.t(`seats.${option.value}`);
  }

  const openLabel = doc.querySelector<HTMLElement>('#open-controls');
  if (openLabel !== null) openLabel.textContent = motor.t('keys.open');
  const ctrlTitle = doc.querySelector<HTMLElement>('#kb-title');
  if (ctrlTitle !== null) ctrlTitle.textContent = motor.t('keys.title');
  const ctrlReset = doc.querySelector<HTMLElement>('#ctrl-reset');
  if (ctrlReset !== null) ctrlReset.textContent = motor.t('keys.reset');
  const ctrlClose = doc.querySelector<HTMLElement>('#kb-close');
  if (ctrlClose !== null) ctrlClose.textContent = motor.t('keys.close');

  const controls = createControlsPanel({
    doc,
    maps: () => keymaps,
    seats: () => seating,
    words: () => PRESET,
    t: (key: string, params?: Record<string, string | number>) => motor.t(key, params),
    srSay: motor.say,
    srAlert: motor.alert,
    // ⚠️ THE SEATING GOES IN, and leaving it out was a real defect rather than a tidiness one: the solo
    //    map and the two-seat pair are kept in different places precisely so one cannot overwrite the
    //    other, and a save that always wrote the solo key would have done exactly that - a child remaps
    //    while a friend is playing, and comes back alone to a keyboard she never chose.
    persist: (m, seat) => saveKeymap(store, m, seat, seating),
  });

  const assistsOpen = doc.querySelector<HTMLElement>('#open-assists');
  if (assistsOpen !== null) assistsOpen.textContent = motor.t('assist.open');
  for (const [id, key] of [
    ['#assist-title', 'assist.title'],
    ['#assist-charge-label', 'assist.charge'],
    ['#assist-tempo-label', 'assist.tempo'],
    ['#assist-period-label', 'assist.period'],
    ['#assist-close', 'assist.close'],
  ] as const) {
    const el = doc.querySelector<HTMLElement>(id);
    if (el !== null) el.textContent = motor.t(key);
  }

  const assistsPanel = createAssistsPanel({
    doc,
    t: (key: string, params?: Record<string, string | number>) => motor.t(key, params),
    current: () => assists,
    onChange: (next) => {
      const paceChanged = next.tempo !== assists.tempo;
      const periodChanged = next.period !== assists.period;
      // She has chosen, so her choice outranks the one-switch default from here on.
      chosenCharge = next.charge as ChargeMode;
      assists = next;

      // The charge route lives inside each sampler, so the seats are rebuilt. A sampler remembers which
      // position opened the charge that is open; switching route under it would leave that memory
      // describing a charge made under rules that no longer apply.
      applySeating();

      // ⚠️ THE ASSISTED DRIVER IS REPLACED, NOT ADJUSTED. `tempo` is read once into the accumulator's own
      //    closure, so writing a field on the existing driver would leave the old pace running - which a
      //    child reports as "it did nothing" and nobody can reproduce.
      if (paceChanged) assisted = createAssistedDriver(state, source, { tempo: assists.tempo, tick: advanceOne });

      // ⚠️ AND THE LENGTH OF A HALF RESTARTS THE MATCH rather than shortening the one being played. A
      //    clock that moved its own finish line mid-match would be exactly the timing behaviour 2.2.1
      //    exists to forbid, arriving through the menu that exists to satisfy it.
      if (periodChanged) {
        profile = withPeriod(baseProfile(), assists.period);
        restartMatch();
      }
    },
  });

  // ⚠️ ON THE DOCUMENT AND IN CAPTURE, which is the one place in this game that listens globally - and the
  //    exception has a reason the world listener does not. While a key is being captured, focus is on a
  //    button INSIDE the dialog, so a listener on `#game-region` never sees the key the child pressed. It
  //    consumes nothing unless the screen is open and something is being captured.
  const routeToPanel = (e: Event): void => {
      const key = e as KeyboardEvent;
    if (controls?.handleKeydown(key) === true || assistsPanel?.handleKeydown(key) === true) {
      e.stopPropagation();
    }
  };
  doc.addEventListener('keydown', routeToPanel, true);

  // ⚠️ LIBRAS IS A MODE, NOT A WIDGET, and that distinction is the engine's and it is right. `toggleLibras`
  //    flips a state that is the CHILD'S CHOICE and persists it, then makes a best-effort attempt to wake
  //    the VLibras widget if one happens to be loaded - and its own comment says failing there must not
  //    stop the mode turning on. So this control works with no widget, no network and no gov.br, which is
  //    also why it can be gated at all.
  //
  // ⚠️ AND THE STATE IS OURS RATHER THAN READ FROM THE WIDGET'S GEOMETRY, which the engine records as a
  //    defect it already had: the widget moved itself out of the game's markup, the detector answered
  //    "open" for ever, the layout reserved 380px for an interpreter that was not there, and the toggle
  //    could not turn it off.
  const librasBtn = doc.querySelector<HTMLButtonElement>('#open-libras');
  const paintLibras = (): void => {
    if (librasBtn === null) return;
    librasBtn.textContent = motor.t('libras.open');
    librasBtn.setAttribute('aria-pressed', motor.deafMode.isOn() ? 'true' : 'false');
  };
  librasBtn?.addEventListener('click', () => {
    motor.deafMode.toggle();
    paintLibras();
  });
  paintLibras();

  let signed: ((text: string) => void) | null = null;

  // ⚠️ THE NARRATION IS WIRED TO THE TICK, NOT TO THE RENDERER. A sentence a child hears must not depend
  //    on a frame being drawn: at a low frame rate, or with the tab in the background, the events would
  //    pile up and arrive as a burst or not at all.
  //
  // ⚠️ AND A COMMITTED COMMAND OUTLIVES ONE TICK. In the turn mode the child decides once and the burst
  //    runs many ticks; handing the simulation her command on the first tick and an empty one after would
  //    make the decision she took apply for a sixtieth of a second.
  let pending: Command | null = null;
  const source = (t2: number): readonly Command[] => {
    // A committed decision outlives one tick: in the turn mode the child decides once and the burst runs
    // many ticks, so handing the simulation her command on the first and an empty one after would make the
    // choice she took apply for a sixtieth of a second.
    if (pending !== null) return [{ ...pending, tick: t2 }];
    // ⚠️ THE SAME `down` SET FOR BOTH SEATS, AND THAT IS CORRECT. One keyboard produces one set of held
    //    codes; which seat a code belongs to is answered by that seat's own map, which is exactly why the
    //    two maps are gated as sharing no key at all. The pad is seat-indexed because a pad is a device
    //    per child, which a keyboard is not.
    return samplers.map((s2, seat) => s2.sample(down, t2, motor.input.padCur[seat] ?? null));
  };

  const advanceOne = (st: typeof state, fr: { tick: number; cmds: readonly Command[] }, dt: number) => {
    for (const event of playTick(st, fr, dt, profile, skills)) {
      // The tone first, then the sentence: the ear needs the alert before the explanation, and a screen
      // reader takes a second to get through "the ball went out for a throw-in to Campo".
      sound.forEvent(event, HOME);
      const sentence = narrate(event, { period: st.period, us: HOME, t: (k) => motor.t(k) });
      if (announce(event).urgent) motor.alert(sentence);
      else motor.say(sentence);

      // ⚠️ AND THE SAME SENTENCE FOR A CHILD WHO CANNOT HEAR IT. `srSay` and `srAlert` are LIVE REGIONS,
      //    read by a screen reader - which a deaf child does not use. Until this line the whole narration
      //    reached a blind child and reached nobody else, while the visible line carried only the seven
      //    earcon words. It is not a second announcement: `#caption` is `aria-hidden`, because a second
      //    live region would say every goal twice and cut the first announcement in half.
      //
      // ⚠️ HONOURING THE SAME SWITCH the engine already owns, and for the same reason the earcons do: a
      //    game that captioned its sounds and ignored the preference for its sentences would hand a child
      //    a control that half works.
      if (motor.deafMode.captionsOn()) showCaption(sentence);

      // ⚠️ THE SAME SENTENCE AGAIN, for a child who reads neither a live region nor a caption line. Three
      //    channels carrying ONE sentence is the point: the reader for a blind child, the caption for a
      //    deaf one who reads Portuguese, and the interpreter for a deaf one whose first language is
      //    Libras - which is a different person, and the one this game reached last.
      if (motor.deafMode.isOn()) {
        // ⚠️ `vlibrasSay(sentence)` STOOD HERE AND ENGINE 11.0 REMOVED IT, which is a change of owner
        //    rather than a loss of channel. `libras.say` and `libras.tick` are gone because «the interpreter
        //    answers the sonar, not announcements» (ADR-0234): the engine's deaf mode now signs what the
        //    sonar found, on its own clock, so a game that also pushed its sentences at the interpreter
        //    would be signing the same event twice from two schedules.
        //
        //    ⚠️ AND THIS GAME'S OWN SINK STAYS, because it is not the engine's. `signed` is the seam
        //    `onSigned` hands to a gate, and `tests/libras.browser` is what reads it: the assertion that a
        //    narrated sentence reaches a signing channel at all is ours to keep making.
        signed?.(sentence);
      }
    }
  };

  const fixtureLine = doc.querySelector<HTMLElement>('#m-fixture');
  const sessionTitle = (): string =>
    profile === PRACTICE_PROFILE
      ? motor.t('hud.practice')
      : `${motor.t(fixture.home.nameKey)} x ${motor.t(fixture.away.nameKey)}`;
  const paintFixtureLine = (): void => {
    if (fixtureLine === null) return;
    fixtureLine.replaceChildren();
    if (profile === PRACTICE_PROFILE) {
      fixtureLine.append(sessionTitle());
      return;
    }
    // Badge, name, badge, name - the crests are decoration beside text that already says who is playing.
    fixtureLine.append(
      crestCanvas(doc, fixture.home.crest),
      ` ${motor.t(fixture.home.nameKey)} x `,
      crestCanvas(doc, fixture.away.crest),
      ` ${motor.t(fixture.away.nameKey)}`,
    );
  };
  paintFixtureLine();

  // ⚠️ THE CHOOSERS ARE BUILT HERE AND NOT WRITTEN INTO THE MARKUP, because a club's name is a dictionary
  //    KEY and the option text has to be resolved in the child's language at the point of use - twelve
  //    hard-coded Portuguese `<option>`s would be the same defect this repository has been finding inside
  //    the engine all week.
  const clubSelects: Record<'home' | 'away', HTMLSelectElement | null> = {
    home: doc.querySelector<HTMLSelectElement>('#home-club'),
    away: doc.querySelector<HTMLSelectElement>('#away-club'),
  };
  const homeLabel = doc.querySelector<HTMLElement>('#home-club-label');
  if (homeLabel !== null) homeLabel.textContent = motor.t('clubs.yours');
  const awayLabel = doc.querySelector<HTMLElement>('#away-club-label');
  if (awayLabel !== null) awayLabel.textContent = motor.t('clubs.theirs');

  /**
   * Redraw both lists.
   *
   * ⚠️ THE CLUB THE OTHER SIDE HAS IS DISABLED, NOT MISSING. `fixtureOf` throws on a club playing itself,
   * deliberately - a fixture that quietly substituted an opponent would leave the screen saying one thing
   * and the pitch showing another. So the impossible choice must not be offerable; and a DISABLED option
   * is announced as disabled, where a removed one would read as the club having vanished.
   */
  const paintClubLists = (): void => {
    for (const side of ['home', 'away'] as const) {
      const select = clubSelects[side];
      if (select === null) continue;
      const mine = side === 'home' ? picked[0] : picked[1];
      const theirs = side === 'home' ? picked[1] : picked[0];
      select.replaceChildren();
      for (const [i, club] of CLUBS.entries()) {
        const option = doc.createElement('option');
        option.value = String(i);
        option.textContent = motor.t(club.nameKey);
        option.disabled = i === theirs;
        select.append(option);
      }
      select.value = String(mine);
    }
  };

  const chooseClub = (side: 'home' | 'away', index: number): void => {
    const other = side === 'home' ? picked[1] : picked[0];
    // A `<select>` can be given any value by script, and a disabled option does not stop that - so the
    // guard lives here rather than in the markup.
    if (index === other || index < 0 || index >= CLUBS.length) {
      paintClubLists();
      return;
    }
    picked = side === 'home' ? [index, other] : [other, index];
    fixture = fixtureOf(picked[0], picked[1]);
    // Rebuilt with the fixture: a side that changed club and kept the last one's ratings would be
    // wearing one badge and playing as another.
    skills = { 0: CLUBS[picked[0]].ratings, 1: CLUBS[picked[1]].ratings };

    // ⚠️ THE MATCH RESTARTS, and changing shirts mid-play was the alternative. A score carried across a
    //    change of club is a score belonging to a club that is not on the pitch any more.
    restartMatch();
    applySeating();

    scene.setFixture(fixture);
    paintClubLists();
    paintFixtureLine();
  };

  for (const side of ['home', 'away'] as const) {
    clubSelects[side]?.addEventListener('change', () => {
      chooseClub(side, Number(clubSelects[side]?.value ?? '0'));
    });
  }
  paintClubLists();

  // The three clock modes over ONE simulation. Which one is running changes who calls `step` and when,
  // and nothing else - which is the claim `tests/drivers.node.test.ts` measures.
  const panelHost = doc.querySelector<HTMLElement>('#turn-host');
  const panel =
    panelHost === null
      ? null
      : createTurnPanel({
          host: panelHost,
          doc,
          t: (key, params) => motor.t(key, params),
          onCommit: (cmd) => {
            pending = cmd;
            turn?.commit();
            pending = null;
          },
        });

  const turn = createTurnDriver(state, source, { ceiling: 45, tick: advanceOne });
  // ⚠️ THE ASSISTED DRIVER IS REBUILT WHEN THE PACE CHANGES, and it has to be: `tempo` is read once, into
  //    the accumulator's own closure. Mutating a field on the driver would have been the smaller change
  //    and would have left the old pace running until the next tick boundary, which is the sort of thing a
  //    child reports as "it did not do anything" and nobody can reproduce.
  let assisted = createAssistedDriver(state, source, { tempo: assists.tempo, tick: advanceOne });
  const drivers = (): Record<string, Driver> => ({
    realtime: createRealtimeDriver(state, source, advanceOne),
    assisted,
    turn,
  });
  const realtime = createRealtimeDriver(state, source, advanceOne);
  const driverFor = (name: string): Driver | undefined =>
    name === 'assisted' ? assisted : name === 'turn' ? turn : name === 'realtime' ? realtime : undefined;
  void drivers;
  let mode = 'realtime';

  const modeSelect = doc.querySelector<HTMLSelectElement>('#mode');
  modeSelect?.addEventListener('change', () => {
    mode = modeSelect.value;
  });

  // ⚠️ THE SEATS ARE CHOSEN OUTSIDE THE WORLD, beside the clock mode and for the same reason: it is a
  //    decision an adult takes BEFORE a child starts, and a choice buried in a pause menu is a choice
  //    that does not exist for the teacher setting up a room.
  //
  // ⚠️ AND CO-OP IS THE DEFAULT ORDER, WITH 1v1 AFTER IT. The Dev decided it and ADR-0006 is why: two
  //    children on the same side against the CPU is a game with no loser in the room. A contest inside one
  //    match is allowed and it is not what a classroom should have to opt OUT of.
  const seatSelect = doc.querySelector<HTMLSelectElement>('#seats');
  const applySeating = (): void => {
    const chosen = seatSelect?.value ?? 'solo';
    seating = chosen === 'solo' ? 1 : 2;

    // The FIRST seat's map is refilled rather than replaced: the remap screen and the key-swallowing
    // listener both hold this exact object, and handing them a new one would leave both editing the
    // keyboard that was in use a moment ago.
    Object.assign(keymaps[0], loadKeymap(store, 0, seating));
    keymaps[1] = loadKeymap(store, 1, 2);

    samplers = [];
    for (let seat = 0; seat < seating; seat++) samplers.push(makeSampler(seat));

    // ⚠️ THE SECOND SEAT'S BODY MOVES SIDES, and nothing else about the match does. In co-op both seats
    //    drive home forwards; in a contest the second child drives an away one, and `nextControlled`
    //    keeps her there by construction because it only ever offers bodies of her own side.
    state.controlled[1] = chosen === 'versus' ? firstOf(AWAY) + 9 : CONTROLLED_BY_SEAT[1];

    // The remap screen may be open on the keyboard that just stopped existing.
    controls?.refresh();
  };
  seatSelect?.addEventListener('change', applySeating);
  applySeating();

  const sessionSelect = doc.querySelector<HTMLSelectElement>('#session');
  sessionSelect?.addEventListener('change', () => {
    profile = withPeriod(baseProfile(), assists.period);
    restartMatch();
    paintFixtureLine();
  });

  // ⚠️ THE PANEL IS SHOWN BY THE PHASE, NOT BY THE EVENT. An event is seen once; if the tick that carried
  //    it was dropped - a hitch, a background tab - the match would end with nothing on screen. A phase is
  //    a fact that is still true on the next frame.
  const endPanel = doc.querySelector<HTMLElement>('#end-panel');
  const endTitle = doc.querySelector<HTMLElement>('#end-title');
  const endScore = doc.querySelector<HTMLElement>('#end-score');
  const endAgain = doc.querySelector<HTMLButtonElement>('#end-again');
  let endShown = false;

  const showEnd = (): void => {
    if (endPanel === null || endShown) return;
    endShown = true;
    const outcome = outcomeFor(state.goals, HOME);
    if (endTitle !== null) endTitle.textContent = motor.t(outcomeKey(outcome));
    if (endScore !== null) {
      endScore.textContent = `${motor.t(fixture.home.nameKey)} ${state.goals[0]} - ${state.goals[1]} ${motor.t(fixture.away.nameKey)}`;
    }
    endPanel.hidden = false;
    endAgain?.focus();
    // The same sound whoever won. What is being marked is that a child finished a match, which is true of
    // the one who lost 3-0 - and ADR-0049 leaves room to celebrate growth and none to celebrate beating
    // somebody.
    sound.matchComplete();
  };

  endAgain?.addEventListener('click', () => {
    restartMatch();
    endShown = false;
    if (endPanel !== null) endPanel.hidden = true;
    region?.focus();
  });

  const mirror = {
    clock: doc.querySelector<HTMLElement>('#m-clock'),
    score: doc.querySelector<HTMLElement>('#m-score'),
    phase: doc.querySelector<HTMLElement>('#m-phase'),
    ball: doc.querySelector<HTMLElement>('#m-ball'),
    you: doc.querySelector<HTMLElement>('#m-you'),
    hint: doc.querySelector<HTMLElement>('#m-hint'),
    options: doc.querySelector<HTMLElement>('#m-options'),
    lagging: doc.querySelector<HTMLElement>('#m-lagging'),
    charge: doc.querySelector<HTMLElement>('#m-charge'),
  };
  // ⚠️ THE STEP SHE IS ON, WHILE SHE IS STILL ON IT. The plan asks for a countable power - "three of
  //    five" - with a tone per step, because a bar does not serve a child who cannot see one. It was
  //    built as a `powerStep`, gated hard, offered in three routes and shown to NOBODY: the only
  //    strength on the screen lived in the turn panel, which is the one mode where she is not holding a
  //    key down. In real time she held it, got no bar, no count and no tone, and let go blind.
  let chargeWas = 0;
  // A list of four short phrases with no name on it is four phrases about nothing. The other mirror lines
  // carry their own subject in the words; this one cannot, so the list says what it is a list OF.
  //
  // ⚠️ AND THE NAME IS DELIBERATELY GENERIC, which was found by WATCHING A MATCH and not by reading the
  //    code. `targetsOf` answers three different questions depending on the state - go and get the loose
  //    ball, run into this space, or put the pass here - and the first label written here said "where the
  //    ball can go", which is true only of the third. On screen it sat over a line reading "twenty-two
  //    paces to your right" while the ball was LOOSE and that spot WAS the ball. Every gate was green:
  //    the wire gate asks that the label is not empty, and no gate can ask whether a sentence is true of
  //    a situation it does not name.
  mirror.options?.setAttribute('aria-label', motor.t('hud.spot.label'));
  // ⚠️ REWRITTEN ONLY WHEN IT CHANGES. This runs sixty times a second, and rebuilding four list items on
  //    every frame is DOM churn a school tablet pays for - pillar 1 is the dominant constraint here, not
  //    an afterthought. Comparing the joined text is one string compare against several allocations.
  let optionsWere = '';

  // ⚠️ THE PIXI TICKER IS THE CLOCK, and `startLoop` reads `deltaTime` off it. Handing the engine a
  //    hand-rolled `requestAnimationFrame` shim would mean maintaining a second clock that has to agree
  //    with the renderer's - and the two would disagree on the first tab switch.
  startLoop(
    scene.app.ticker,
    (dtFrames: number) => {
      // In the turn mode `advance` runs nothing at all - by design, not by omission. Time passing is not
      // what moves that match; a committed decision is.
      // On the PRESS edge, not while held: a sonar that repeats sixty times a second is a siren.
      // Polled once per frame, before anything reads it - the engine writes into `motor.input.padCur` from here.
      // The engine's loop hook. It decides nothing any more - the mode is our state - but the widget's
      // own bookkeeping still expects to be ticked.
      // ⚠️ `vlTick()` WAS CALLED HERE EVERY FRAME AND 11.0 REMOVED IT. The engine drives its own
      //    interpreter now; a game ticking it was the shape of the old widget, which had to be woken.

      // ⚠️ THE POSITION, AND FROM EVERY SEATED KEYBOARD. `select` is where ADR-0085 puts session functions,
      //    so hard-coding `KeyF` meant a child who moved the key lost the sonar with no way back to it -
      //    and reading only the first seat's map meant the second child's `select` did nothing at all.
      //    Asking every seated keyboard is also what keeps the FIRST seat's `F` working for the session
      //    on a machine with no numpad, where the second seat's own key does not exist.
      const sonarDown = keymaps
        .slice(0, seating)
        .some((m) => (m.select ?? []).some((code) => down.has(code)));
      if (sonarDown && !sonarWasDown) askSonar();
      sonarWasDown = sonarDown;

      // ⚠️ ASSIGNED EVERY FRAME AND NOT ON THE EDGE, because the driver a frame uses is not always the
      //    same object: `assisted` is REBUILT when the child changes the pace, and an edge-time write
      //    would have landed on the instance she just replaced. One assignment a frame costs nothing and
      //    cannot go stale.
      // ⚠️ THE ONE-SWITCH SETTING IS READ EVERY FRAME, because it is a LIVE BINDING the accessibility bar
      //    writes and `bootar` read it exactly once. `ui/assists-panel` records that a child in one-switch
      //    mode used to be handed `hold` - the route whose whole mechanic is keeping a key down - and that
      //    reading the setting at boot fixed it. It fixed the child who arrives already in one-switch
      //    mode; the ☝️ icon on the bar means the moment she ASKS for it is after boot, which was the one
      //    moment the route did not change.
      //
      // ⚠️ AND A CHOSEN ROUTE STILL WINS, which `chargeRouteFor` enforces and this line must not bypass:
      //    an accommodation that refuses to be overridden is a second barrier wearing the first one's
      //    clothes. `chosenCharge` is null until she picks one in the panel.
      if (motor.settings.oneButton !== oneButtonWas) {
        oneButtonWas = motor.settings.oneButton;
        assists = { ...assists, charge: chargeRouteFor(motor.settings.oneButton, chosenCharge) };
      }
      const driving = driverFor(mode);
      if (driving !== undefined) {
        driving.paused = paused;
        driving.advance(dtFrames * MS_PER_FRAME);
      }
      panel?.render(state, 0, mode === 'turn' ? state.controlled[0] : undefined);
      // ⚠️ THE LIVE `controlled`, NOT THE INITIAL VALUE. This read `CONTROLLED_BY_SEAT` - the frozen pair
      //    the match STARTS on - so from the first time a child pressed switch, the marker stayed over the
      //    body she had left. The panel had the same bug, one line up.
      scene.draw(state, seating === 1 ? [state.controlled[0]] : state.controlled);
      if (mirror.score !== null) mirror.score.textContent = `${state.goals[0]} - ${state.goals[1]}`;
      if (mirror.clock !== null) mirror.clock.textContent = clockText(state.tick);
      if (state.phase === 'fullTime') showEnd();
      // The mirror speaks WORDS, not field names. `throwIn` is an identifier; "lateral" is what happened.
      if (mirror.phase !== null) mirror.phase.textContent = motor.t(`hud.phase.${state.phase}`);
      // ⚠️ WHOSE BALL IT IS, and not where it is in metres. A coordinate is a number a sighted child
      //    already has from the screen and a blind one cannot use; possession is the fact the game turns
      //    on, it changes constantly, and it is the thing a text mirror is for.
      if (mirror.ball !== null) {
        const holder = state.possession.holder;
        mirror.ball.textContent =
          holder === NOBODY
            ? motor.t('hud.ball.loose')
            : motor.t('hud.ball.with', { club: motor.t(teamOf(holder) === HOME ? fixture.home.nameKey : fixture.away.nameKey) });
      }
      // ⚠️ WHICH OF THE ELEVEN SHE IS DRIVING, which until now existed ONLY as a five-pixel wedge over a
      //    head. Every other line of this mirror has a second route to a child who cannot see - the score
      //    is an earcon too, the phase is narrated too - and this one had none, so `hud.ball.with` could
      //    say her club had the ball while she had no way of learning it was at her own feet.
      //
      //    ⚠️ ONE LINE PER SEAT, LABELLED, and joined by the seat's own name rather than by a sentence
      //    built out of two dictionary halves. With two children on one keyboard an unlabelled line is a
      //    line that belongs to nobody.
      // ⚠️ THE SONAR, IN WORDS, FOR A CHILD WHO CANNOT USE THE SONAR. `targetsOf` is the half of the
      //    contract the spatial audio uses, and spatial audio needs ears - so the single most useful
      //    thing this game knows reached a deaf-blind child on a braille display through no channel at
      //    all. The SAME spots are asked for here, never worked out a second time.
      if (mirror.options !== null) {
        const me = state.controlled[0];
        const lines = spotLines(state.players[me].p, motor.declaration.targetsOf(0), attackDirOf(HOME, state.period), motor.t);
        const joined = lines.join('\u0000');
        if (joined !== optionsWere) {
          optionsWere = joined;
          mirror.options.replaceChildren(
            ...lines.map((line) => {
              const li = doc.createElement('li');
              li.className = 'mirror__line';
              li.textContent = line;
              return li;
            }),
          );
        }
      }
      // ⚠️ A TONE PER STEP, AND ONLY WHEN IT CHANGES. A cue that repeats sixty times a second is a
      //    siren; one that sounds as the count goes up is a staircase she can hear, which is what makes
      //    "wait for five" a thing she can do without watching anything.
      // ⚠️ AND WHETHER THE MACHINE IS KEEPING UP. `drivers/driver` counted the thrown-away wall time
      //    and its own header said the number was surfaced; nothing read it. On a school tablet - the
      //    hardware pillar 1 names - a stutter is indistinguishable from a lull if you cannot see, and
      //    from your own mistake if you can.
      if (mirror.lagging !== null) {
        const said = laggingLine(driverFor(mode)?.droppedMs ?? 0, motor.t);
        if (mirror.lagging.textContent !== said) mirror.lagging.textContent = said;
      }
      const step = samplers[0]?.charging() ?? 0;
      if (step !== chargeWas) {
        if (step > chargeWas) sound.chargeStep();
        chargeWas = step;
        if (mirror.charge !== null) mirror.charge.textContent = chargeLine(step, motor.t);
      }
      if (mirror.you !== null) {
        const seated = state.controlled.slice(0, seating);
        mirror.you.textContent = seated
          .map((who, seat) =>
            seating === 1 ? youLine(state, who, motor.t) : `${motor.t('keys.seat', { n: seat + 1 })}: ${youLine(state, who, motor.t)}`,
          )
          .join(' - ');
      }
      // ⚠️ THE LINE THAT MAKES THE MARK REACHABLE WITHOUT EYES. The hollow chevron over another body is
      //    the one channel a blind child cannot have, so this sentence is not a caption for the picture -
      //    it IS the hinted switch, for her. Written here rather than only in `ui/mirror`, because eight
      //    modules in this repository have been right, gated and connected to nothing.
      // ⚠️ A KICK SHE PRESSED EARLY, GOING OUT NOW. The instant was the world's and not hers - she
      //    pressed half a second ago and the ball arrived this tick - so it owes a sound and a caption.
      //    An unexplained action teaches her the game does things on its own, which is worse than the
      //    dropped press it replaces: a dropped press only teaches her to press later.
      if (state.heldKickFired[0] === 1) sound.heldKick();

      if (mirror.hint !== null) {
        mirror.hint.textContent = state.controlled
          .slice(0, seating)
          .map((_, seat) => hintLine(state, seat, motor.t))
          .filter((line) => line !== '')
          .join(' - ');
      }
    },
    MAX_DT_FRAMES,
    // ⚠️ THE ENGINE'S ANNOUNCEMENT AND NOT THIS GAME'S, and the line it replaces was worse than nothing
    //    in one specific way. It was `aoFalhar: (err) => motor.alert(String(err))`, so the alert region
    //    received a DEVELOPER'S ERROR STRING: measured, a blind child heard "TypeError: Cannot read
    //    properties of null" and a sighted child saw nothing at all.
    //
    // ⚠️ AND THE ENGINE OWNS THIS BY DESIGN, which its own doc states: «VEM DA ENGINE E NÃO DE CADA JOGO
    //    porque a mensagem é a mesma em todos e o canal (leitor de tela + narração + o que se VÊ) é
    //    infraestrutura». ADR-0054 calls the half that was missing the one that matters - «criança cega
    //    não vê tela congelada» - because without an announcement blind mode cannot tell "it froze" from
    //    "it is thinking", and silence is identical in both.
    //
    //    It is DELIVERED and not installed: a game that builds the loop without passing this still STOPS,
    //    because stopping is not optional. What it loses is saying so.
    // ⚠️ `speed` IS NEW AND REQUIRED IN 11.0, AND PASSING IT CHANGES BEHAVIOUR ON PURPOSE. ADR-0180's
    //    game speed - the child's own 100%..50% - reached every other surface and never reached this loop,
    //    because the loop used to read the settings store by import and this game never passed a port. The
    //    engine made it required for exactly that reason: «an optional port defaulting to 100% would ignore
    //    the child's choice in every game that forgot it - silently».
    //
    //    ⚠️ AND IT IS NOT THE SAME DIAL AS THE PACE ASSIST, which is why both multiply and neither is
    //    a duplicate. `speed` is an engine-wide accommodation set in the child's own menu; the assisted
    //    driver's `tempo` is this game's clock mode, chosen per match in the assists panel. A child who
    //    slowed the engine AND picked the gentle pace asked for both.
    { speed: motor.gameSpeed, onFailure: motor.onFailure },
  );
  scene.app.ticker.start();

  return {
    motor,
    state,
    keymap: (seat = 0) => keymaps[seat] ?? keymaps[0],
    onSigned: (fn) => {
      signed = fn;
    },
    /**
     * The two doors the engine was handed, returned for the same reason `state` and `keymap` are.
     *
     * ⚠️ THE ENGINE OWNS WHEN THESE ARE CALLED and this game owns what they do. A gate cannot press a
     * pad's start button through the whole input layer without rebuilding it; what it can do is hold the
     * very functions the engine was given and ask whether they stop the world. Anything less would gate
     * a private copy and leave the pair that is actually wired unmeasured.
     */
    charge: () => assists.charge,
    pause,
    resume,
    cameraAt: () => scene.cameraAt(),
    pitchTopOnScreen: () => scene.pitchTopOnScreen(),
    stop: () => {
      scene.app.ticker.stop();
      scene.destroy();
      // ⚠️ BOTH DOCUMENT LISTENERS COME OFF, and neither is symmetry for its own sake. They are the only
      //    two things this game puts on the document rather than on its own world, so they are the only
      //    two that outlive the canvas: a page that boots twice - the engine's demo host swaps games
      //    without reloading - would otherwise end up with two focus traps arguing over the Tab key and
      //    two routers feeding one dead panel.
      doc.removeEventListener('keydown', routeToPanel, true);
      controls?.destroy();
      assistsPanel?.destroy();
      // ⚠️ AND THE ENGINE'S OWN LISTENERS COME OFF TOO, which is what engine 10.0 formalised as
      //    `Engine.dispose`. The engine installs several `win.addEventListener('keydown', ..., true)` in
      //    capture (menu-nav, focus-trap, shell, pause-by-select, pause-by-start) and a pad-polling rAF,
      //    none of which this file can enumerate without reaching into the engine. Measured 2026-10-02:
      //    without this line a second boot's gamepad poll races the first's, two capture-phase menu-nav
      //    listeners both consume keys, and `tests/boot.browser` had the sonar test fail in-suite while
      //    passing alone - the pollution signature. The call is new to this file; `Booted.stop` already
      //    stops THIS game's state, now it also stops the engine's.
      motor.dispose();
    },
  };
}
