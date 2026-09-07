// SPDX-License-Identifier: AGPL-3.0-or-later
// THE COMPOSITION ROOT. The only module that knows every other one, and it does no thinking of its own.
//
// ⚠️ NO AUTO-BOOT AT THE BOTTOM OF THIS FILE. The 2048 measured a double boot from exactly that line -
// two canvases, two keyboard listeners, every move played twice - because the module was imported once by
// the page and once by a test. `bootar()` is called by `boot.ts` and by nobody else.

import { createGame, type Engine } from '@the-inclusionist/engine';
import { registerDict, t } from '@the-inclusionist/engine/core/i18n.js';
import { startLoop } from '@the-inclusionist/engine/core/loop.js';
import { srAlert, srSay } from '@the-inclusionist/engine/core/a11y-sr.js';
import { createDeclaration } from '../declaration.ts';
import { playTick } from '../play.ts';
import { createScene, LOGICAL } from '../render/scene.ts';
import { MATCH_PROFILE, PRACTICE_PROFILE, type RulesProfile } from '../rules/profile.ts';
import type { ChargeMode } from '../input/charge.ts';
import { installDicts } from '../i18n/index.ts';
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
import { outcomeFor, outcomeKey } from '../ui/outcome.ts';
import { crestCanvas } from '../ui/crest-canvas.ts';
import type { Command } from '../sim/command.ts';
import { createSampler } from '../input/sampler.ts';
import { initGamepad } from '@the-inclusionist/engine/input/gamepad.js';
import { padCur } from '@the-inclusionist/engine/input/state.js';
import { buildPreset } from '../input/preset.ts';
import * as mixer from '@the-inclusionist/engine/platform/audio.js';
import * as engineState from '@the-inclusionist/engine/core/state.js';
import { toggleLibras, vlibrasOpen, vlibrasSay, vlTick } from '@the-inclusionist/engine/ui/vlibras.js';
import { createSound } from '../audio/sound.ts';
import * as store from '@the-inclusionist/engine/platform/storage.js';
import { indexOf, loadKeymap, saveKeymap, type Keymap, type Seating } from '../input/keymap.ts';
import { createControlsPanel } from '../ui/controls-panel.ts';
import { createAssistsPanel, DEFAULT_ASSISTS, type Assists } from '../ui/assists-panel.ts';
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
  /** Where the camera is, in world pixels. See `Scene.cameraAt`. */
  readonly cameraAt: () => { readonly x: number; readonly y: number };
  readonly stop: () => void;
}

/**
 * Start the game in `doc`.
 *
 * Returns `null` when the shell is missing what the engine needs, and says what is missing through
 * `problems` - a game that boots half-wired into empty panels is worse than one that refuses.
 */
export function bootar(doc: Document = document, win: Window = window): Booted | null {
  const pitch = doc.querySelector<HTMLElement>('#pitch');
  if (pitch === null) return null;

  installDicts(registerDict);

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

  const motor = createGame({
    declaration: createDeclaration({
      state: () => state,
      profile: () => profile,
      ourTeam: () => HOME,
      controlledBy: (seat) => CONTROLLED_BY_SEAT[seat],
      t: (key) => t(key),
    }),
    host: { doc, win, cvdHost: doc.querySelector('#cvd') },
    declines: { semAssistenteDePad: true },
  });

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

  region?.addEventListener('keydown', (e) => {
    const ev = e as KeyboardEvent;
    if (!belongsToAGame(ev.code)) return;
    down.add(ev.code);
    // Only keys the game actually reads are swallowed. A blanket preventDefault would take Tab away from
    // a child navigating with it, which is the one key she must never lose.
    ev.preventDefault();
  });
  region?.addEventListener('keyup', (e) => {
    const ev = e as KeyboardEvent;
    if (belongsToAGame(ev.code)) down.delete(ev.code);
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
  let assists: Assists = DEFAULT_ASSISTS;
  const makeSampler = (seat: number) =>
    createSampler({ seat, chargeMode: assists.charge as ChargeMode, keymap: () => keymaps[seat] });
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
  const noElement = (): HTMLElement | null => null;
  const words = buildPreset((key: string) => t(key));
  const gamepad = initGamepad({
    getGamepads: () => (win.navigator.getGamepads ? win.navigator.getGamepads() : []),
    $: (sel: string) => doc.querySelector(sel),
    rotuloDaAcao: (action: string) => words[action as keyof typeof words]?.label ?? null,
    srSay,
    srAlert,
    frontOverlay: () => {},
    mundoRodando: () => true,
    menuDePausa: () => false,
    pausar: () => {},
    retomar: () => {},
    isAttractActive: () => false,
    stopAttract: () => {},
    isTouchMode: () => false,
    hideTouchControls: () => {},
    getPlayers: () => [{ pad: 0 }],
    getNumPlayers: () => 1,
    navTitle: () => {},
    naBarraDe: () => false,
    navBar: () => {},
    sharedDialogOpen: noElement,
    navDialog: () => {},
    getPauseMenu: noElement,
    navPause: () => {},
    setPauseActor: () => {},
    modalInput: () => {},
    hasModal: () => false,
    joinPlayer: () => false,
    respawnPlayer: () => {},
    clearWaitingBadge: () => {},
    spriteBase: '',
  } as never);

  // ⚠️ THE SONAR IS THE POINT OF `targetsOf`, AND NOTHING WAS CALLING IT. The declaration answers "where
  //    can I put the ball next" and the engine turns that into spatial audio - but a game has to ask. The
  //    platformer asks on a held button; here it is `select`, which ADR-0085 keeps for SESSION functions
  //    and which this game leaves otherwise unused: "where is everything" is about the session, not about
  //    the world.
  let sonarWasDown = false;
  const askSonar = (): void => {
    const focus = motor.declaration.focusOf(0);
    if (focus === null) return;
    motor.sonar.sonar({ i: 0, x: focus.at.x, y: focus.at.y, viz: 'normal' });
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
  mixer.initAudioMixer();
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
    ensureAC: () => mixer.ensureAC(),
    catNode: (cat: string) => mixer.catNode(cat),
    audioOut: () => mixer.audioOut(),
    noiseHit: (mat: string) => mixer.noiseHit(mat),
    tone: (f: number, d: number, ty?: OscillatorType, w?: number, v?: number) => mixer.tone(f, d, ty, w, v),
    // Read every time: a child changes these from the engine's audio menu mid-match, and a value captured
    // at boot would answer with whatever was true before she touched anything.
    soundOn: () => mixer.soundOn,
    volume: () => mixer.volume,
    captionsOn: () => engineState.captionsOn,
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
    if (el !== null) el.textContent = t(key);
  }
  for (const [sel, prefix] of [
    ['#session option', 'tools.session'],
    ['#mode option', 'tools.mode'],
  ] as const) {
    for (const option of doc.querySelectorAll<HTMLOptionElement>(sel)) {
      option.textContent = t(`${prefix}.${option.value}`);
    }
  }

  const seatsLabel = doc.querySelector<HTMLElement>('#seats-label');
  if (seatsLabel !== null) seatsLabel.textContent = t('seats.label');
  for (const option of doc.querySelectorAll<HTMLOptionElement>('#seats option')) {
    option.textContent = t(`seats.${option.value}`);
  }

  const openLabel = doc.querySelector<HTMLElement>('#open-controls');
  if (openLabel !== null) openLabel.textContent = t('keys.open');
  const ctrlTitle = doc.querySelector<HTMLElement>('#ctrl-title');
  if (ctrlTitle !== null) ctrlTitle.textContent = t('keys.title');
  const ctrlReset = doc.querySelector<HTMLElement>('#ctrl-reset');
  if (ctrlReset !== null) ctrlReset.textContent = t('keys.reset');
  const ctrlClose = doc.querySelector<HTMLElement>('#ctrl-close');
  if (ctrlClose !== null) ctrlClose.textContent = t('keys.close');

  const controls = createControlsPanel({
    doc,
    maps: () => keymaps,
    seats: () => seating,
    words: () => buildPreset((key: string) => t(key)),
    t: (key: string, params?: Record<string, string | number>) => t(key, params),
    srSay,
    srAlert,
    // ⚠️ THE SEATING GOES IN, and leaving it out was a real defect rather than a tidiness one: the solo
    //    map and the two-seat pair are kept in different places precisely so one cannot overwrite the
    //    other, and a save that always wrote the solo key would have done exactly that - a child remaps
    //    while a friend is playing, and comes back alone to a keyboard she never chose.
    persist: (m, seat) => saveKeymap(store, m, seat, seating),
  });

  const assistsOpen = doc.querySelector<HTMLElement>('#open-assists');
  if (assistsOpen !== null) assistsOpen.textContent = t('assist.open');
  for (const [id, key] of [
    ['#assist-title', 'assist.title'],
    ['#assist-charge-label', 'assist.charge'],
    ['#assist-tempo-label', 'assist.tempo'],
    ['#assist-period-label', 'assist.period'],
    ['#assist-close', 'assist.close'],
  ] as const) {
    const el = doc.querySelector<HTMLElement>(id);
    if (el !== null) el.textContent = t(key);
  }

  const assistsPanel = createAssistsPanel({
    doc,
    t: (key: string, params?: Record<string, string | number>) => t(key, params),
    current: () => assists,
    onChange: (next) => {
      const paceChanged = next.tempo !== assists.tempo;
      const periodChanged = next.period !== assists.period;
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
    librasBtn.textContent = t('libras.open');
    librasBtn.setAttribute('aria-pressed', vlibrasOpen() ? 'true' : 'false');
  };
  librasBtn?.addEventListener('click', () => {
    toggleLibras();
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
    return samplers.map((s2, seat) => s2.sample(down, t2, padCur[seat] ?? null));
  };

  const advanceOne = (st: typeof state, fr: { tick: number; cmds: readonly Command[] }, dt: number) => {
    for (const event of playTick(st, fr, dt, profile, skills)) {
      // The tone first, then the sentence: the ear needs the alert before the explanation, and a screen
      // reader takes a second to get through "the ball went out for a throw-in to Campo".
      sound.forEvent(event, HOME);
      const sentence = narrate(event, { period: st.period, us: HOME, t: (k) => t(k) });
      if (announce(event).urgent) srAlert(sentence);
      else srSay(sentence);

      // ⚠️ AND THE SAME SENTENCE FOR A CHILD WHO CANNOT HEAR IT. `srSay` and `srAlert` are LIVE REGIONS,
      //    read by a screen reader - which a deaf child does not use. Until this line the whole narration
      //    reached a blind child and reached nobody else, while the visible line carried only the seven
      //    earcon words. It is not a second announcement: `#caption` is `aria-hidden`, because a second
      //    live region would say every goal twice and cut the first announcement in half.
      //
      // ⚠️ HONOURING THE SAME SWITCH the engine already owns, and for the same reason the earcons do: a
      //    game that captioned its sounds and ignored the preference for its sentences would hand a child
      //    a control that half works.
      if (engineState.captionsOn) showCaption(sentence);

      // ⚠️ THE SAME SENTENCE AGAIN, for a child who reads neither a live region nor a caption line. Three
      //    channels carrying ONE sentence is the point: the reader for a blind child, the caption for a
      //    deaf one who reads Portuguese, and the interpreter for a deaf one whose first language is
      //    Libras - which is a different person, and the one this game reached last.
      if (vlibrasOpen()) {
        vlibrasSay(sentence);
        signed?.(sentence);
      }
    }
  };

  const fixtureLine = doc.querySelector<HTMLElement>('#m-fixture');
  const sessionTitle = (): string =>
    profile === PRACTICE_PROFILE
      ? t('hud.practice')
      : `${t(fixture.home.nameKey)} x ${t(fixture.away.nameKey)}`;
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
      ` ${t(fixture.home.nameKey)} x `,
      crestCanvas(doc, fixture.away.crest),
      ` ${t(fixture.away.nameKey)}`,
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
  if (homeLabel !== null) homeLabel.textContent = t('clubs.yours');
  const awayLabel = doc.querySelector<HTMLElement>('#away-club-label');
  if (awayLabel !== null) awayLabel.textContent = t('clubs.theirs');

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
        option.textContent = t(club.nameKey);
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
          t: (key, params) => t(key, params),
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
    if (endTitle !== null) endTitle.textContent = t(outcomeKey(outcome));
    if (endScore !== null) {
      endScore.textContent = `${t(fixture.home.nameKey)} ${state.goals[0]} - ${state.goals[1]} ${t(fixture.away.nameKey)}`;
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
  };

  // ⚠️ THE PIXI TICKER IS THE CLOCK, and `startLoop` reads `deltaTime` off it. Handing the engine a
  //    hand-rolled `requestAnimationFrame` shim would mean maintaining a second clock that has to agree
  //    with the renderer's - and the two would disagree on the first tab switch.
  startLoop(
    scene.app.ticker,
    (dtFrames: number) => {
      // In the turn mode `advance` runs nothing at all - by design, not by omission. Time passing is not
      // what moves that match; a committed decision is.
      // On the PRESS edge, not while held: a sonar that repeats sixty times a second is a siren.
      // Polled once per frame, before anything reads it - the engine writes into `padCur` from here.
      gamepad.pollPads();
      // The engine's loop hook. It decides nothing any more - the mode is our state - but the widget's
      // own bookkeeping still expects to be ticked.
      vlTick();

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

      driverFor(mode)?.advance(dtFrames * MS_PER_FRAME);
      panel?.render(state, 0, mode === 'turn' ? state.controlled[0] : undefined);
      // ⚠️ THE LIVE `controlled`, NOT THE INITIAL VALUE. This read `CONTROLLED_BY_SEAT` - the frozen pair
      //    the match STARTS on - so from the first time a child pressed switch, the marker stayed over the
      //    body she had left. The panel had the same bug, one line up.
      scene.draw(state, seating === 1 ? [state.controlled[0]] : state.controlled);
      if (mirror.score !== null) mirror.score.textContent = `${state.goals[0]} - ${state.goals[1]}`;
      if (mirror.clock !== null) mirror.clock.textContent = clockText(state.tick);
      if (state.phase === 'fullTime') showEnd();
      // The mirror speaks WORDS, not field names. `throwIn` is an identifier; "lateral" is what happened.
      if (mirror.phase !== null) mirror.phase.textContent = t(`hud.phase.${state.phase}`);
      // ⚠️ WHOSE BALL IT IS, and not where it is in metres. A coordinate is a number a sighted child
      //    already has from the screen and a blind one cannot use; possession is the fact the game turns
      //    on, it changes constantly, and it is the thing a text mirror is for.
      if (mirror.ball !== null) {
        const holder = state.possession.holder;
        mirror.ball.textContent =
          holder === NOBODY
            ? t('hud.ball.loose')
            : t('hud.ball.with', { club: t(teamOf(holder) === HOME ? fixture.home.nameKey : fixture.away.nameKey) });
      }
    },
    MAX_DT_FRAMES,
    { aoFalhar: (err: unknown) => srAlert(String(err)) },
  );
  scene.app.ticker.start();

  return {
    motor,
    state,
    keymap: (seat = 0) => keymaps[seat] ?? keymaps[0],
    onSigned: (fn) => {
      signed = fn;
    },
    cameraAt: () => scene.cameraAt(),
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
    },
  };
}
