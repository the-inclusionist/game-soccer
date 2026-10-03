// SPDX-License-Identifier: AGPL-3.0-or-later
// THE BOOT, IN A REAL BROWSER. Four things that no logic test and no screenshot can see.
//
// ========================= WHY A DOUBLE BOOT IS THE FIRST GATE =========================
// The 2048 shipped one. Two canvases stacked pixel for pixel look exactly like one; two keyboard
// listeners make every move happen twice, which reads as "the controls feel wrong" rather than as a bug.
// Neither a unit test nor a picture can catch it. Counting is the only way.
//
// ========================= AND WHY `problems` IS ASSERTED EMPTY =========================
// When the shell is missing an id the engine needs, the borrowed panels open EMPTY, with no error. That
// is why `createGame` returns a list instead of throwing - and a list nobody reads is a comment.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { bootar } from '../app/js/boot/main.ts';
import { msToTicks, quiet, ticks } from './helpers/ticks.ts';
import { SQUAD_SIZE, firstOf } from '../app/js/sim/ids.ts';
import { createSettingsStore } from '@the-inclusionist/engine/core/state.js';
import { createStorage } from '@the-inclusionist/engine/platform/storage.js';
import { KEYS } from '@the-inclusionist/engine/platform/storage-keys.js';
import { GAMEPAD_STANDARD } from '@the-inclusionist/engine/input/default-bindings.js';

const SHELL = `
  <p id="sr-status" role="status" aria-live="polite"></p>
  <p id="sr-alert" role="alert" aria-live="assertive"></p>
  <main>
    <div id="stage-wrap"><div id="stage">
      <section id="game-region" tabindex="-1" aria-label="Futebol">
        <div id="pitch"></div>
        <p id="caption" aria-hidden="true"></p>
        <div id="mirror">
          <p id="m-fixture">-</p>
          <p><b id="m-score">0 - 0</b> <span id="m-clock">00:00</span></p>
          <p id="m-phase">-</p>
          <p id="m-ball">-</p>
          <p id="m-you">-</p>
          <p id="m-hint"></p>
          <ul id="m-options"></ul>
          <p id="m-charge"></p>
          <p id="m-lagging"></p>
        </div>
      </section>
    </div></div>
    <div class="tools">
      <div id="a11y-bar"></div>
      <label for="session" id="session-label">Jogo</label>
      <select id="session" aria-labelledby="session-label">
        <option value="match">Partida</option>
        <option value="practice">Treino</option>
      </select>
      <label for="mode" id="mode-label">Ritmo</label>
      <select id="mode" aria-labelledby="mode-label">
        <option value="realtime">Tempo real</option>
        <option value="assisted">Tempo real com ajuda</option>
        <option value="turn">Por lances</option>
      </select>
      <label class="tools__label" for="seats" id="seats-label">Jogadores</label>
      <select id="seats" aria-labelledby="seats-label">
        <option value="solo">1 jogador</option>
        <option value="coop">2 jogadores - mesmo time</option>
        <option value="versus">2 jogadores - um contra o outro</option>
      </select>

      <label class="tools__label" for="home-club" id="home-club-label">Seu clube</label>
      <select id="home-club" aria-labelledby="home-club-label"></select>

      <label class="tools__label" for="away-club" id="away-club-label">Adversario</label>
      <select id="away-club" aria-labelledby="away-club-label"></select>
      <button id="open-controls" type="button">Teclado</button>
      <button id="open-assists" type="button">Ajudas</button>
      <button id="open-libras" type="button" aria-pressed="false">Libras</button>
    </div>

    <!-- THE KEYBOARD, AS A SCREEN. The engine draws the rows; this game tells it what its keyboard IS,
         because the engine's own remappable table carries the platformer's eight positions and this game
         has fourteen. See app/js/ui/controls-panel.ts and docs/ENGINE-AUDIT.md. -->
    <!-- THE ADJUSTMENTS. Three limits on time, all of them already implemented and none of them reachable
         until this screen existed. WCAG 2.2.1 is paid twice here: every limit is an option, and one of
         the options in each list is that there is no limit. -->
    <div id="assist-panel" class="panel" role="dialog" aria-modal="true" aria-labelledby="assist-title" hidden>
      <h2 id="assist-title">Ajudas</h2>
      <div class="panel__row">
        <label for="assist-charge" id="assist-charge-label">Forca do chute</label>
        <select id="assist-charge" aria-labelledby="assist-charge-label" aria-describedby="assist-charge-hint"></select>
      </div>
      <p class="panel__hint" id="assist-charge-hint"></p>
      <label for="assist-grace" id="assist-grace-label">Tolerancia do acorde</label>
      <select id="assist-grace" aria-labelledby="assist-grace-label"></select>
      <div class="panel__row">
        <label for="assist-tempo" id="assist-tempo-label">Ritmo com ajuda</label>
        <select id="assist-tempo" aria-labelledby="assist-tempo-label"></select>
      </div>
      <div class="panel__row">
        <label for="assist-period" id="assist-period-label">Duracao de cada tempo</label>
        <select id="assist-period" aria-labelledby="assist-period-label"></select>
      </div>
      <div class="panel__actions">
        <button id="assist-close" type="button">Fechar</button>
      </div>
    </div>

    <div id="controls-panel" class="panel" role="dialog" aria-modal="true" aria-labelledby="ctrl-title" hidden>
      <h2 id="ctrl-title">Teclado</h2>
      <div id="ctrl-players"></div>
      <div id="ctrl-list"></div>
      <div class="panel__actions">
        <button id="ctrl-reset" type="button">Restaurar padroes</button>
        <button id="ctrl-close" type="button">Fechar</button>
      </div>
    </div>
    <div id="end-panel" role="group" aria-labelledby="end-title" hidden>
      <h2 id="end-title">-</h2><p id="end-score">-</p>
      <button id="end-again" type="button">Jogar outra vez</button>
    </div>
    <div id="turn-host"></div>
    <svg id="cvd" aria-hidden="true" width="0" height="0"></svg>
  </main>
`;

/**
 * Wait for a condition instead of for a duration.
 *
 * ⚠️ A FIXED SLEEP IS A BET ON THE MACHINE. These tests drive a real render loop, and a sleep long enough
 * on an idle laptop is too short when the node project is running beside it: one of them asserted the
 * clock had moved after 1400ms and failed only in the full suite, which is the worst kind of flake -
 * green when you look at it, red in CI. Waiting for the fact and failing on a timeout keeps the assertion
 * and drops the bet.
 */
async function waitFor(what: () => boolean, why: string, timeoutMs = 6000): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (what()) return;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error(`timed out waiting for: ${why}`);
}

let booted: ReturnType<typeof bootar> = null;

/**
 * ⚠️ TWO SURFACES WRITE THE SAME SETTING AND THAT IS BY DESIGN. Engine 10.0 removed every module-level
 * export of `core/state`; a game reads `motor.settings`, which is PER-ROOT. This file needs to set the
 * value BEFORE the root exists (several tests set it, then boot) AND AFTER (`setOneButton(true)` mid-match
 * tests the live recompute). The helper picks whichever is reachable now: the booted store if there is
 * one, else the pre-boot one, which shares the same `localStorage` backend.
 *
 * The pre-boot store writes to `localStorage`; the booted root's store reads `localStorage` on
 * construction, so a pre-boot write is inherited. In-memory the two stores drift after boot (two
 * independent instances), which is why ANY post-boot write goes through `booted.motor.settings`.
 */
const prebootSettings = createSettingsStore({
  ...createStorage(window.localStorage),
  KEYS,
});
const setOneButton = (v: boolean): void => {
  (booted?.motor.settings ?? prebootSettings).setOneButtonValue(v);
};

// ========================= 🔴 THE LANGUAGE IS PINNED, AND IT WAS NOT =========================
// CI ran this repository for the first time ever on 2026-09-08 and five cases in this file failed with
// `expected 'Practice' to be 'Treino'` and `expected 'You won!' to be 'Você ganhou!'`. Nothing was broken:
// the runner's `navigator.language` is `en-US`, the engine's `pickDefault()` reads it when nothing is
// stored, and the game came up in English. On the Dev's machine it is pt-BR, so the file had been asserting
// the MACHINE for as long as it existed.
//
// 📌 PINNED RATHER THAN COMPARED THROUGH `booted!.motor.t()`, and the difference matters: `booted!.motor.t('title.practice')` on both
// sides would measure the round trip through one table, and the two halves would move together. A literal
// pins the string a child actually reads — it just has to be the string of a KNOWN language, which is what
// storing the key does. It is the same fix the engine took for its own boot-language defect the same day.
const LANG_KEY = 'incl_lang';
let langAntes: string | null = null;

beforeAll(() => {
  langAntes = localStorage.getItem(LANG_KEY);
  localStorage.setItem(LANG_KEY, 'pt');
});
afterAll(() => {
  if (langAntes === null) localStorage.removeItem(LANG_KEY);
  else localStorage.setItem(LANG_KEY, langAntes);
});

beforeEach(() => {
  booted?.stop();
  booted = null;
  document.body.innerHTML = SHELL;
});

describe('the shell and the engine', () => {
  // ⚠️ COUNTED INSIDE THE WORLD, not across the document. The page legitimately holds other canvases now -
  //    the two club badges - and a gate that counted all of them would have to be loosened every time the
  //    HUD gained a picture, which is how a gate stops gating. What must never be two is the GAME canvas,
  //    and `#pitch` is exactly where a second boot would put one.
  it('[Interface] the boot mounts EXACTLY one game canvas', () => {
    booted = bootar(document, window);

    expect(booted).not.toBeNull();
    expect(document.querySelectorAll('#pitch canvas')).toHaveLength(1);
  });

  it('[Interface] the engine finds every id it needs - `problems` is empty', () => {
    booted = bootar(document, window);

    // ⚠️ ONE PROBLEM IS KEPT AND IT IS NAMED, which is why this reads differently from `toEqual([])`.
    //    Engine 11.0's sonar reads «text on the screen» (ADR-0234); our world is a <canvas>, so the engine
    //    returns the line that says so — and its own words say the fix is not the game's: «a contract
    //    field for a game to hand the engine its screen's text is a decision the Dev has not taken». We
    //    cannot fix an engine finding that is open; what we can do is let it through named, so a
    //    regression we COULD fix - a missing id, a missing stylesheet - still fails this gate.
    const CANVAS_SONAR_PROBLEM = 'the sonar cannot read';
    const seen = booted?.motor.problems ?? ['not booted'];
    const unexpected = seen.filter((p) => !p.startsWith(CANVAS_SONAR_PROBLEM));

    expect(unexpected, 'an engine finding this game can fix').toEqual([]);
  });

  it('[Zero] a shell with no world element refuses to boot rather than half-booting', () => {
    document.body.innerHTML = '<p id="sr-status"></p><p id="sr-alert"></p>';

    expect(bootar(document, window)).toBeNull();
    expect(document.querySelectorAll('#pitch canvas')).toHaveLength(0);
  });

  it('[Interface] the canvas is scaled by a WHOLE number - ADR-0001 allows no other', () => {
    booted = bootar(document, window);
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;

    const shown = parseFloat(canvas.style.width);
    expect(canvas.width).toBe(320);
    expect(shown % 320).toBe(0);
  });
});

// ========================= ⚠️ THE PAUSE, AND IT COULD NOT BE ENGAGED =========================
// `drivers/driver` declares `paused` and `advance()` reads it - `if (driver.paused) return 0` - and nothing
// in this repository ever wrote it. A pause that cannot be engaged, which is this project's eleventh
// instance of a thing that is right with no wire and the first one that is ours rather than the engine's.
//
// ⚠️ AND THE DOOR IS THE ENGINE'S, WHICH IS WHY IT IS RETURNED. `initGamepad` takes `pausar` and `retomar`
// and calls them when a child asks; a test cannot press a pad's start button through the engine's whole
// input layer without rebuilding it. What it CAN do is hold the very functions the engine was handed and
// ask whether they stop the world - which is the claim, and the same reason `Booted` already returns the
// state and the keymap: a composition root that hands back nothing cannot be measured.
// ========================= ⚠️ THE ACCOMMODATION ARRIVED AT BOOT AND NEVER AGAIN =========================
// `ui/assists-panel`'s own header records the defect and its fix: «IT WAS NOT WIRED UNTIL 2026-09-07.
// Nothing in the composition root read the setting, so a child in one-switch mode was handed `hold` - a
// route whose whole mechanic is keeping a key down, which is exactly what one-switch mode means she cannot
// do.»
//
// ⚠️ AND THE FIX READ THE SETTING ONCE. `chargeRouteFor(oneButton, chosen)` is called in `bootar` and
// nowhere else, and `core/state.oneButton` is a LIVE BINDING the accessibility bar writes through
// `setOneButtonValue`. The ☝️ icon is mounted on the bar in this game, so the moment a child actually
// turns one-switch mode on is, by definition, AFTER boot - and that is the one moment the route did not
// change. She asked for the accommodation and kept the route she cannot use.
//
// ⚠️ AND A CHOSEN ROUTE STILL WINS, which is the same file's other rule: «AND IT IS A DEFAULT, NEVER A
// LOCK. A chosen route wins: an accommodation that refuses to be overridden is a second barrier wearing
// the first one's clothes.»
describe('one-switch mode, turned on mid-match', () => {
  it('[Right] changes the charge route, because that is when a child asks for it', async () => {
    setOneButton(false);
    booted = bootar(document, window);
    await ticks(booted, 5);

    expect(booted!.charge(), 'the default route is not what boot handed her').toBe('hold');

    setOneButton(true);
    await ticks(booted, 5);

    expect(booted!.charge(), 'she turned one-switch on and kept the route that needs a held key')
      .toBe('latch-stepped');
  });

  // ⚠️ [Zero] AND HER OWN CHOICE OUTRANKS THE ACCOMMODATION, which is the rule `ui/assists-panel` states
  //    in the strongest words it uses: «AND IT IS A DEFAULT, NEVER A LOCK. A chosen route wins: an
  //    accommodation that refuses to be overridden is a second barrier wearing the first one's clothes.»
  //
  //    📏 IT WAS UNGATED ON THIS PATH, which is how it was found: making the mid-match recompute pass
  //    `null` instead of her choice broke NOTHING in the whole browser project - 155 gates green while the
  //    rule the panel calls a barrier was being ignored. `chargeRouteFor` enforces it and the recompute
  //    could quietly bypass it.
  it('[Zero] but a route she chose herself is not overridden by it', async () => {
    setOneButton(false);
    booted = bootar(document, window);
    await ticks(booted, 5);

    // She picks the timed route deliberately - neither the default nor the one-switch answer.
    (document.querySelector('#open-assists') as HTMLButtonElement).click();
    const select = document.querySelector('#assist-charge') as HTMLSelectElement;
    select.value = 'latch-timed';
    select.dispatchEvent(new Event('change'));
    await ticks(booted, 5);

    expect(booted!.charge(), 'the panel did not apply her choice').toBe('latch-timed');

    setOneButton(true);
    await ticks(booted, 5);

    expect(booted!.charge(), 'the accommodation overrode the route she chose').toBe('latch-timed');
  });

  it('[Zero] and turning it off again gives the default back', async () => {
    setOneButton(true);
    booted = bootar(document, window);
    await ticks(booted, 5);
    expect(booted!.charge()).toBe('latch-stepped');

    setOneButton(false);
    await ticks(booted, 5);

    expect(booted!.charge()).toBe('hold');
  });
});

describe('the pause', () => {
  it('[Right] the door the engine was given stops the world, and opens it again', async () => {
    booted = bootar(document, window);
    await ticks(booted, 5);

    booted!.pause();
    const at = booted!.state.tick;
    // ⚠️ WALL CLOCK, because the claim is that nothing happens. `ticks()` here would wait for a tick that
    //    is not coming and fail its own timeout, which is this assertion inverted.
    await quiet(250);

    expect(booted!.state.tick, 'the world kept running through the pause').toBe(at);

    booted!.resume();
    await ticks(booted, 5);

    expect(booted!.state.tick, 'the world never came back').toBeGreaterThan(at);
  });

  // ========================= ⚠️ AND THE GATE ABOVE MISSED A TRAP THIS ONE CATCHES =========================
  // Wiring the two doors and leaving `menuDePausa` answering a hard-coded `false` makes the pause
  // INESCAPABLE, and the gate above cannot see it because it calls the doors directly instead of going
  // through the pad.
  //
  // `input/gamepad.js` asks two questions and branches on the PAIR: `const rodando = ctx.mundoRodando(),
  // pausado = ctx.menuDePausa()`. If neither is true it treats the game as a TITLE SCREEN and hands the
  // directional to `navTitle` - "o comportamento seguro" for a scene it does not recognise. So a world
  // that is paused while `menuDePausa` says no is a world the engine believes is a title screen, and
  // START never reaches `retomar`.
  //
  // ⚠️ SO THE TWO ANSWERS ARE ONE FACT AND HAVE TO MOVE TOGETHER. This game has no pause CARD yet, and
  // the engine's question is behavioural rather than descriptive - it routes START and the directional by
  // it - so "the pause is open" and "the world is held" are the same answer here.
  it('[Right] START pauses through the engine, and START pauses no further - it resumes', async () => {
    const original = navigator.getGamepads;
    const startBtn = GAMEPAD_STANDARD.start as number;
    let held = false;
    const buttons = (): unknown[] =>
      Array.from({ length: 17 }, (_, i) => ({ pressed: held && i === startBtn, value: 0 }));
    (navigator as unknown as { getGamepads: () => unknown[] }).getGamepads = () => [
      { id: 'fake standard pad', index: 0, mapping: 'standard', buttons: buttons(), axes: [0, 0, 0, 0] },
    ];

    try {
      booted = bootar(document, window);
      await ticks(booted, 5);

      // One clean edge: down, polled, up. The engine acts on the EDGE, not on the hold.
      held = true;
      await waitFor(() => booted!.state.tick === booted!.state.tick, 'a poll');
      await quiet(120);
      held = false;
      await quiet(120);

      const at = booted!.state.tick;
      await quiet(250);
      expect(booted!.state.tick, 'START did not pause the world through the engine').toBe(at);

      // And the same button again has to bring it back, which is the half the pair decides.
      held = true;
      await quiet(120);
      held = false;
      await ticks(booted, 5);

      expect(booted!.state.tick, 'START paused and could never resume').toBeGreaterThan(at);
    } finally {
      (navigator as unknown as { getGamepads: typeof original }).getGamepads = original;
    }
  });

  // ========================= ⚠️ AND A FROZEN SCREEN WITH NOTHING ON IT IS NOT A PAUSE =========================
  // The card is mounted already - `createGame` falls back to `#game-region` when no `pauseHost` is
  // declared, so `#vp-pause-0` has been in this game's DOM all along, hidden, with fifteen items in it.
  // What was missing was anybody revealing it: holding the world still and showing nothing leaves a child
  // looking at a stopped game with no menu, no explanation and nothing said to a child who cannot see it.
  //
  // `Engine.pausa.mostrar(i)` is the door, and its own doc says it "refaz os itens - o §5 avaliado no
  // instante em que ela abre": the no-dead-buttons rule of ADR-0106 §5 is applied when the card opens, so
  // revealing it is also what makes the item filtering run.
  it('[Right] pausing reveals the card the engine mounted, and resuming hides it again', async () => {
    booted = bootar(document, window);
    await ticks(booted, 5);
    const card = document.querySelector('#vp-pause-0') as HTMLElement | null;

    expect(card, 'the engine mounted no pause card to reveal').not.toBeNull();
    expect(card!.hidden, 'the card was already open before anything paused').toBe(true);

    booted!.pause();
    expect(card!.hidden, 'the world stopped and nothing was shown').toBe(false);

    booted!.resume();
    expect(card!.hidden, 'the card stayed over a running game').toBe(true);
  });

  // ========================= ⚠️ AND "CONTINUE" HAS TO CONTINUE =========================
  // ADR-0106 §5 forbids a dead button and the engine enforces it, but only for items a game DECLARES it
  // cannot action: the dispatch is `const fn = acts[act]; if (fn) fn();`, so an item with no entry is a
  // button that swallows the press in silence. For a child using a screen reader the menu read out an
  // option that does not exist.
  //
  // `resume` is the one item this game can action without anybody deciding anything, and it is also the
  // one the engine's own note calls load-bearing: `entrarNaBarra` calls `acts.resume?.()` to leave the
  // card before handing the directional to the accessibility bar.
  it('[Right] the Continue item on the card actually continues', async () => {
    booted = bootar(document, window);
    await ticks(booted, 5);

    booted!.pause();
    const at = booted!.state.tick;
    const card = document.querySelector('#vp-pause-0') as HTMLElement;
    const item = card.querySelector('[data-act="resume"]') as HTMLButtonElement | null;

    expect(item, 'the card has no Continue item to press').not.toBeNull();
    expect(item!.hidden, 'Continue was hidden, so this game declared it cannot resume').toBe(false);

    item!.click();

    expect(card.hidden, 'pressing Continue left the card open').toBe(true);
    await ticks(booted, 5);
    expect(booted!.state.tick, 'pressing Continue did not restart the world').toBeGreaterThan(at);
  });

  // ========================= ⚠️ AND A CARD SHE CANNOT MOVE THROUGH IS HALF A CARD =========================
  // Making the card OPEN was today's work; making it navigable is the other half, and the stubs that made
  // it unreachable were honest while it never opened. `initGamepad` is handed `getPauseMenu` and `navPause`
  // and this game answered `() => null` and `() => {}` - so a child on a pad met a card she could leave
  // only with START and could not step through at all.
  //
  // ⚠️ AND THE ENGINE NAMED THE FIX WHERE IT MOUNTS THE CARD: «O ID É O QUE A PRÓPRIA ENGINE PROCURA, logo
  // abaixo, no `getPauseMenu`. Montar sem o pôr deixaria o laço tão aberto como estava.» It sets
  // `#vp-pause-0` for this, and `motor.nav` carries `navPause`, `navDialog` and `sharedDialogOpen` ready
  // to be handed back.
  // ========================= ⚠️ AND THIS GATE WATCHED THE WRONG THING TWICE =========================
  // It asked whether `document.activeElement` moved, and reported that the directional did not work.
  // It does. `ui/menu-nav.navPause` says why in its own words: «este menu não usa foco do navegador -
  // seleciona por classe, porque é desenhado dentro da tela do jogador». It moves `.pm-sel`, never the
  // browser's focus, so a gate on focus can only ever report a working feature as broken.
  //
  // 📏 MEASURED with a fake standard pad and one `down` edge: `.pm-sel` moved to `acessibilidade` and
  // `#sr-status` read "♿ Acessibilidade, 2 de 7" - the position and total item 3 of ADR-0044 asks for,
  // spoken, because this menu announces its own moves (nothing else can: no focus, no
  // `aria-activedescendant`, no live region of its own).
  //
  // So the claim is the SELECTION and the announcement, which is what a child actually gets.
  it('[Right] the directional steps through the card, and the new item is spoken', async () => {
    const original = navigator.getGamepads;
    const downBtn = GAMEPAD_STANDARD.down as number;
    let held = false;
    (navigator as unknown as { getGamepads: () => unknown[] }).getGamepads = () => [
      {
        id: 'fake standard pad',
        index: 0,
        mapping: 'standard',
        buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: held && i === downBtn, value: 0 })),
        axes: [0, 0, 0, 0],
      },
    ];

    try {
      booted = bootar(document, window);
      await ticks(booted, 5);
      booted!.pause();

      const card = document.querySelector('#vp-pause-0') as HTMLElement;
      expect(card.hidden, 'the card did not open, so stepping through it proves nothing').toBe(false);
      const items = card.querySelectorAll('.pause-menu:not([hidden]) .pm-btn').length;
      expect(items, 'the card offered nothing to step through').toBeGreaterThan(1);

      held = true;
      await quiet(150);
      held = false;
      await quiet(150);

      const sel = card.querySelector('.pm-sel') as HTMLElement | null;
      expect(sel, 'the directional selected nothing at all').not.toBeNull();
      // ⚠️ AND IT IS SPOKEN, which is the half no picture and no focus assertion could show. A menu that
      //    moves in silence is a menu a blind child cannot use, and this one has no other channel.
      const said = document.querySelector('#sr-status')?.textContent ?? '';
      expect(said, 'the new item was selected in silence').not.toBe('');
      expect(said, 'the announcement does not say where she is in the list').toMatch(/\d+\D+\d+/);
    } finally {
      (navigator as unknown as { getGamepads: typeof original }).getGamepads = original;
    }
  });

  // ⚠️ [Zero] AND PAUSING TWICE IS NOT A TOGGLE, which is worth one assertion because the engine calls
  //    these on edges it owns and a child holding a button can produce two of the same edge.
  it('[Zero] pausing an already paused world leaves it paused', async () => {
    booted = bootar(document, window);
    await ticks(booted, 5);

    booted!.pause();
    booted!.pause();
    const at = booted!.state.tick;
    await quiet(250);

    expect(booted!.state.tick).toBe(at);
  });
});

describe('what a child sees', () => {
  // ⚠️ NO CONTROL ON THIS PAGE CARRIES A HARD-CODED WORD ANY MORE, and this is the gate that keeps it so.
  //    The shell's own two selects - match/practice and the clock mode - were Portuguese literals in
  //    `index.html` from the first commit, which is the exact defect this repository spent the week
  //    recording INSIDE the engine. The markup still carries Portuguese as a fallback for a boot that
  //    fails before the dictionaries are installed; what must not survive a SUCCESSFUL boot is that
  //    fallback, because then a Spanish classroom reads Portuguese and nothing reports it.
  //
  // ⚠️ AND IT COMPARES AGAINST `booted!.motor.t()`, which the first version did not - it only checked the text was not a
  //    raw key and not empty, and stayed green with every option rewritten to the string "MUT". "It says
  //    something" is not the claim; "it says what the dictionary says" is.
  it('[Interface] every control gets its words from the dictionaries, not from the markup', () => {
    booted = bootar(document, window);

    for (const [sel, prefix] of [
      ['#session', 'tools.session'],
      ['#mode', 'tools.mode'],
      ['#seats', 'seats'],
    ] as const) {
      for (const option of document.querySelectorAll<HTMLOptionElement>(`${sel} option`)) {
        expect(option.textContent, `${sel}/${option.value}`).toBe(booted!.motor.t(`${prefix}.${option.value}`));
      }
    }

    expect(document.querySelector('#session-label')?.textContent).toBe(booted!.motor.t('tools.session'));
    expect(document.querySelector('#mode-label')?.textContent).toBe(booted!.motor.t('tools.mode'));
    expect(document.querySelector('#seats-label')?.textContent).toBe(booted!.motor.t('seats.label'));
    expect(document.querySelector('#open-controls')?.textContent).toBe(booted!.motor.t('keys.open'));
    expect(document.querySelector('#open-assists')?.textContent).toBe(booted!.motor.t('assist.open'));
  });

  it('[Right] the state of play reaches the DOM as text, because pillar 2 says it always does', async () => {
    booted = bootar(document, window);

    await ticks(booted, msToTicks(350));

    expect(document.querySelector('#m-score')?.textContent).toMatch(/^\d+ - \d+$/);
    expect(document.querySelector('#m-phase')?.textContent).not.toBe('-');
  });

  // ⚠️ THE LIVENESS SIGNAL HAS TO BE SOMETHING THAT ACTUALLY MOVES. This once watched a coordinate; when
  //    the mirror started showing the two club names instead, the assertion still passed - the text had
  //    changed, from the placeholder to a constant - and the test kept reporting that the match was
  //    running when nothing said so. Possession changes all match, and it is the fact the game turns on.
  it('[Right] the match actually runs - the mirror is not still on its placeholder', async () => {
    booted = bootar(document, window);

    await ticks(booted, msToTicks(900));

    const shown = document.querySelector('#m-ball')?.textContent ?? '';
    expect(shown).not.toBe('-');
    expect(shown.length).toBeGreaterThan(1);
    expect(document.querySelector('#m-fixture')?.textContent).toMatch(/ x /);
  });

  // ⚠️ AND THE ONE FACT THAT USED TO LIVE ONLY IN PIXELS. Which of the eleven she is driving was a
  //    five-pixel wedge over a head and nothing else - no earcon, no narration, no line here - so a child
  //    who could not see the screen could hear that her club had the ball and could not learn whether it
  //    was at her own feet.
  //
  //    ⚠️ ASKED OF THE PAGE AND NOT OF `youLine`. `tests/mirror` measures what the sentence SAYS, and it
  //    would go on passing with this wire cut: eight modules in this repository have been right, gated
  //    and connected to nothing, and the gate that would have caught each of them is this one.
  it('[Right] and which player she is driving, which lived only in pixels before', async () => {
    booted = bootar(document, window);

    await ticks(booted, msToTicks(350));

    const shown = document.querySelector('#m-you')?.textContent ?? '';
    expect(shown, 'the mirror never said who the child is').not.toBe('-');
    // A shirt number, because that is the whole point of the line: which ONE of the eleven.
    expect(shown, `no shirt number in "${shown}"`).toMatch(/\d/);
  });

  // ⚠️ THE NUMBER ON THE PITCH AND THE NUMBER IN THE MIRROR ARE THE SAME NUMBER, and that is the whole
  //    gate. Pillar 2 says text lives in the DOM and it does - `#m-you` has said "you are number 7" since
  //    before there were pixels for it - so the tag over her head is a DUPLICATE and never the only copy.
  //    A duplicate that can disagree is worse than no duplicate: whichever one she reads, the other is
  //    lying, and she has no way to know which.
  //
  // ⚠️ THE PIXELS CANNOT BE READ FROM A TEST, so this asks the next best question: whether both come
  //    from the same body. A second lookup of the controlled index inside the renderer would compile,
  //    run, and drift the first time the two were read on different ticks.
  it('[Right] the shirt number drawn on the pitch is the one the mirror names', async () => {
    booted = bootar(document, window);
    await ticks(booted, msToTicks(350));

    const shown = document.querySelector('#m-you')?.textContent ?? '';
    const shirt = (booted!.state.controlled[0] % 11) + 1;

    expect(shown, `the mirror says "${shown}" but she is driving shirt ${shirt}`).toContain(String(shirt));
  });

  // ⚠️ A KEY EVENT WITH NO PHYSICAL CODE STILL REACHES THE GAME. `code` is the right thing to read and
  //    this does not stop reading it; the floor is for the case where it arrives EMPTY, which today is
  //    recognised by nothing and therefore swallowed by nothing - the child gets neither her control nor
  //    an explanation, and the page keeps the keystroke.
  // ⚠️ WHETHER REAL ASSISTIVE TECHNOLOGY PRODUCES SUCH AN EVENT IS UNMEASURED, and the header of
  //    `input/keymap.codeFromKey` says so. This gate measures the floor, not the hazard.
  it('[Right] a key event carrying no code still moves her body, and is swallowed', async () => {
    booted = bootar(document, window);
    await ticks(booted, msToTicks(200));

    const region = document.querySelector('#game-region') as HTMLElement;
    const up = booted!.keymap().up[0];
    const key = up.startsWith('Key') ? up.slice(3).toLowerCase() : up;

    const ev = new KeyboardEvent('keydown', { key, code: '', bubbles: true, cancelable: true });
    region.dispatchEvent(ev);

    expect(ev.defaultPrevented, `a "${key}" with no code was not claimed by the game`).toBe(true);

    region.dispatchEvent(new KeyboardEvent('keyup', { key, code: '', bubbles: true, cancelable: true }));
  });

  // ⚠️ AND IT MUST NOT SWALLOW MORE THAN IT PLAYS, which is the assertion that stops the floor becoming
  //    a trapdoor. Tab is the key a child navigating the page cannot lose, and a fallback that claimed
  //    every keystroke would take it - silently, and only from the child using the keyboard to get around.
  it('[Boundary] but a key the game does not bind is left to the page', async () => {
    booted = bootar(document, window);
    await ticks(booted, msToTicks(200));

    const region = document.querySelector('#game-region') as HTMLElement;
    const ev = new KeyboardEvent('keydown', { key: 'Tab', code: '', bubbles: true, cancelable: true });
    region.dispatchEvent(ev);

    expect(ev.defaultPrevented, 'the game swallowed Tab, which a child needs to navigate').toBe(false);
  });

  // ⚠️ AND WHO A PRESS OF SWITCH WOULD HAND HER, which on screen is a hollow chevron over another body
  //    and for a blind child is only this line. The mark is the one channel she cannot have, so the
  //    sentence is not a caption beside the picture - it IS the hinted switch, for her.
  //
  // ⚠️ AND THE UNIT GATE WOULD PASS WITH THIS WIRE CUT, which is why this exists separately.
  //    `ui/mirror.hintLine` is measured in the node project against a state built by hand; nothing there
  //    can tell whether the composition root ever asks it. That is the shape eight modules in this
  //    repository already had - and it was nearly nine: the first frame captured after this landed had no
  //    chevron visible anywhere in it, and it took a probe to establish that the sprite was drawn and the
  //    hinted body simply happened to be outside a twenty-metre window.
  it('[Right] and who a press of switch would hand her', async () => {
    booted = bootar(document, window);

    await ticks(booted, msToTicks(350));

    const shown = document.querySelector('#m-hint')?.textContent ?? '';
    expect(shown, 'the mirror never said who a switch would give her').not.toBe('');
    // A shirt number, for the same reason the line above needs one: which ONE of the eleven.
    expect(shown, `no shirt number in "${shown}"`).toMatch(/\d/);
  });

  // ⚠️ AND WHERE SHE COULD PUT THE BALL, which the sonar already answers - for a child who can hear it.
  //    Spatial audio needs ears, and a deaf-blind child on a braille display has the DOM and nothing
  //    else, so the most useful thing this game knows was reaching her through no channel at all.
  //
  //    ⚠️ A LIST, BECAUSE A SCREEN READER ANNOUNCES ONE. "List, three items" and then step through them
  //    is what she is doing with it; four phrases run into one sentence is a paragraph she has to parse.
  it('[Right] and where the ball could go next, as a list a screen reader can step through', async () => {
    booted = bootar(document, window);

    await ticks(booted, msToTicks(350));

    const list = document.querySelector('#m-options');
    expect(list, 'the options list is not in the page').not.toBeNull();
    expect(list?.getAttribute('aria-label'), 'a list of phrases with no name is phrases about nothing')
      .toBeTruthy();
    expect(list?.querySelectorAll('li').length, 'the mirror never listed an option').toBeGreaterThan(0);
  });

  // ⚠️ NOT A GATE - A LOOK. Nothing here can assert that twenty-two twelve-pixel figures READ, and
  //    pretending otherwise with a pixel-diff would be a test that fails on every deliberate change and
  //    passes on every ugly one. The picture is for a person, and the plan says this is the point where a
  //    person has to see it.
  // ⚠️ THE MODE IS A CHOICE MADE BEFORE PLAYING, not one buried in a pause menu. It decides whether this
  //    game has a time limit at all, so a child who needs the turn mode must be able to reach it without
  //    first surviving the real-time one.
  it('[Right] the clock mode is a labelled control, reachable before the match starts', async () => {
    booted = bootar(document, window);
    const select = document.querySelector('#mode') as HTMLSelectElement;

    expect(select).not.toBeNull();
    select.focus();
    expect(document.activeElement).toBe(select);
    expect([...select.options].map((o) => o.value)).toEqual(['realtime', 'assisted', 'turn']);
  });

  it('[Zero] in real time the turn panel stays hidden - it is not a second interface always on', async () => {
    booted = bootar(document, window);

    await ticks(booted, msToTicks(300));

    const panel = document.querySelector('.turn-panel') as HTMLElement;
    expect(panel.hidden).toBe(true);
  });

  // ⚠️ AND IN THE TURN MODE THE CLOCK STOPS MATTERING - asserted as a CROSS-CHECK, because "this text did
  //    not change in four hundred milliseconds" is true of a stopped match and of a quiet one alike. The
  //    same window is watched in real time first: if the world does not move there either, the test is
  //    measuring nothing and says so by failing.
  it('[Cross-check] real time moves the world in a window where the turn mode does not', async () => {
    booted = bootar(document, window);
    // The clock advances every tick, so it separates a stopped match from a quiet one.
    const read = () => document.querySelector('#m-clock')?.textContent ?? '';

    await ticks(booted, msToTicks(200));
    const liveStart = read();
    await waitFor(() => read() !== liveStart, 'real time to move the clock');
    const liveEnd = read();

    const select = document.querySelector('#mode') as HTMLSelectElement;
    select.value = 'turn';
    select.dispatchEvent(new Event('change'));

    // ⚠️ WALL CLOCK FROM HERE, because the claim is that the world does NOT move. `ticks()` would wait
    //    for a tick that is never coming and fail its own timeout, which is this assertion inverted.
    await quiet(200);
    const turnStart = read();
    await quiet(900);

    expect(liveEnd, 'real time did not move; the assertion below would prove nothing').not.toBe(
      liveStart,
    );
    expect(read()).toBe(turnStart);
    expect((document.querySelector('.turn-panel') as HTMLElement).hidden).toBe(false);
  });

  // ⚠️ THE CLAIM THE WHOLE TURN MODE RESTS ON: in a match with no clock, what moves the world is a
  //    decision. Without this the previous test would be satisfied by a match that never moves at all -
  //    which is a stopped game, not an accessible one.
  it('[Right] committing a decision is what advances a clockless match', async () => {
    booted = bootar(document, window);
    const select = document.querySelector('#mode') as HTMLSelectElement;
    select.value = 'turn';
    select.dispatchEvent(new Event('change'));

    // Wall clock: in the turn mode nothing advances until a decision is committed.
    await quiet(300);
    const before = document.querySelector('#m-clock')?.textContent ?? '';

    // Two decisions, because ONE burst is forty-five ticks - three quarters of a second - and the clock
    // reads whole seconds. A single commit changing nothing on the face is correct behaviour, not a bug,
    // and a test that demanded otherwise would be demanding the clock lie.
    const press = () => {
      const acts = [...document.querySelectorAll('.turn-panel fieldset')].pop();
      const act = acts?.querySelector('button') as HTMLButtonElement | null;
      expect(act, 'the panel offered nothing to press').not.toBeNull();
      act?.click();
    };

    press();
    // Wall clock, and for the PANEL rather than for the world: this gap lets the turn panel rebuild
    // between two presses. In a clockless match the world moves only on a commit, so waiting for a tick
    // here would be waiting for the thing the second press is about to cause.
    await quiet(120);
    press();
    await waitFor(
      () => (document.querySelector('#m-clock')?.textContent ?? before) !== before,
      'a committed decision to advance the clock',
    );

    expect(document.querySelector('#m-clock')?.textContent).not.toBe(before);
  });

  // ⚠️ A PRACTICE SESSION HAS TO BE REACHABLE, or the profile is code nobody can run. And it must ANNOUNCE
  //    itself: a child who chose to practise and got a match with the whistle switched off has been given
  //    something she did not ask for, with nothing on screen to say so.
  it('[Right] choosing practice restarts the session and says which one is running', async () => {
    booted = bootar(document, window);
    const session = document.querySelector('#session') as HTMLSelectElement;

    // ⚠️ LET THE MATCH RUN FIRST. Asserting a clock at zero right after boot is true whether the world was
    //    restarted or not - a mutation that changed only the LABEL passed that version of this test. The
    //    clock has to have moved before the switch, or "back to zero" means nothing.
    await waitFor(
      () => (document.querySelector('#m-clock')?.textContent ?? '00:00') !== '00:00',
      'the match clock to leave zero',
    );
    const asMatch = document.querySelector('#m-fixture')?.textContent ?? '';
    const ranFor = document.querySelector('#m-clock')?.textContent ?? '';

    session.value = 'practice';
    session.dispatchEvent(new Event('change'));
    await ticks(booted, msToTicks(60));

    expect(asMatch).toMatch(/ x /);
    expect(ranFor, 'the match never ran, so the reset below proves nothing').not.toBe('00:00');
    expect(document.querySelector('#m-fixture')?.textContent).toBe('Treino');
    expect(document.querySelector('#m-clock')?.textContent).toBe('00:00');
  });

  it('[Right] and the practice pitch keeps playing - a restart is not a freeze', async () => {
    booted = bootar(document, window);
    const session = document.querySelector('#session') as HTMLSelectElement;
    session.value = 'practice';
    session.dispatchEvent(new Event('change'));

    await ticks(booted, msToTicks(200));
    const before = document.querySelector('#m-clock')?.textContent;
    await ticks(booted, msToTicks(1200));

    expect(document.querySelector('#m-clock')?.textContent).not.toBe(before);
  });

  // ⚠️ THE BADGE IS DECORATION AND THE NAME IS THE INFORMATION. A screen reader that announced both would
  //    say the same thing twice, and a crest carries nothing a name does not - so the canvas is hidden
  //    from the accessibility tree and the text beside it is not.
  it('[Right] each club shows a badge beside its name, and the badge is hidden from a reader', () => {
    booted = bootar(document, window);
    const line = document.querySelector('#m-fixture') as HTMLElement;

    const badges = [...line.querySelectorAll('canvas')];
    expect(badges).toHaveLength(2);
    for (const b of badges) expect(b.getAttribute('aria-hidden')).toBe('true');
    expect(line.textContent).toMatch(/ x /);
  });

  it('[Right] the two badges are different pictures, or a child cannot tell the clubs apart', () => {
    booted = bootar(document, window);
    const badges = [...document.querySelectorAll('#m-fixture canvas')] as HTMLCanvasElement[];

    const pixels = badges.map((b) => b.toDataURL());
    expect(pixels[0]).not.toBe(pixels[1]);
  });

  it('[Zero] a practice session has no fixture, so it shows no badges', () => {
    booted = bootar(document, window);
    const session = document.querySelector('#session') as HTMLSelectElement;

    session.value = 'practice';
    session.dispatchEvent(new Event('change'));

    expect(document.querySelectorAll('#m-fixture canvas')).toHaveLength(0);
    expect(document.querySelector('#m-fixture')?.textContent).toBe('Treino');
  });

  // ⚠️ THE PLACE THE LISTENER SITS IS THE TEST, and a bubbling event from inside the world cannot see the
  //    difference - it reaches `window` too, so a mutation that moved the listener there passed. A key
  //    pressed OUTSIDE the world is the only thing that separates them. It matters because the engine's
  //    menus listen in capture phase on the document: a game listening globally would take keys out from
  //    under a dialog, or lose them to one.
  it('[Boundary] a key pressed outside the world belongs to the page, and is left alone', () => {
    booted = bootar(document, window);

    const outside = new KeyboardEvent('keydown', { code: 'KeyK', bubbles: true, cancelable: true });
    document.body.dispatchEvent(outside);

    expect(outside.defaultPrevented).toBe(false);
  });

  // ⚠️ WHAT A BROWSER TEST CAN HONESTLY PROVE ABOUT THE KEYBOARD IS THAT THE LISTENER IS WIRED TO THE
  //    WORLD - the key was read, at the right element. That a key MOVES a player is deterministic and is
  //    proved in the node project, where it can be asserted on a position instead of inferred from a clock
  //    that would have advanced anyway.
  it('[Right] a bound key is swallowed, and a key the game does not read is left alone', () => {
    booted = bootar(document, window);
    const region = document.querySelector('#game-region') as HTMLElement;

    const bound = new KeyboardEvent('keydown', { code: 'KeyK', bubbles: true, cancelable: true });
    const free = new KeyboardEvent('keydown', { code: 'Tab', bubbles: true, cancelable: true });
    region.dispatchEvent(bound);
    region.dispatchEvent(free);

    expect(bound.defaultPrevented).toBe(true);
    // ⚠️ TAB IS THE ONE KEY A CHILD MUST NEVER LOSE. A blanket preventDefault would take navigation away
    //    from whoever moves through the page with it, which is the population this engine exists for.
    expect(free.defaultPrevented).toBe(false);
  });

  // ⚠️ THE SONAR IS WHAT `targetsOf` IS FOR, and until this gate existed nothing in this game called it.
  //    The declaration answered "where can I put the ball" beautifully and the answer reached nobody: a
  //    blind child would have had a contract full of information and no way to ask for it. The engine
  //    counts its own soundings, which is the only observable that does not require listening.
  it('[Right] asking for the sonar actually sounds it', async () => {
    booted = bootar(document, window);
    const region = document.querySelector('#game-region') as HTMLElement;
    await ticks(booted, msToTicks(200));
    const before = booted?.motor.sonar.sonarCount ?? -1;

    region.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyF', bubbles: true, cancelable: true }),
    );
    // ⚠️ WALL-CLOCK, NOT TICKS, because `KeyF` is now `select` AND `select` opens the pause card in engine
    //    11.0: pressing F pauses the world, state.tick stops advancing, `ticks()` times out while the sonar
    //    is firing on its own. Measured 2026-10-02 - the sonar did sound; the wait was the thing listening
    //    on the wrong channel. `quiet(200)` listens on the wall, which keeps ticking under pause.
    await quiet(200);

    expect(booted?.motor.sonar.sonarCount).toBeGreaterThan(before);
  });

  // ⚠️ ON THE PRESS EDGE, NOT WHILE HELD. A sonar that repeats sixty times a second is a siren, and the
  //    child it exists for is the one who cannot look away from it.
  it('[Boundary] holding the key does not sound it again and again', async () => {
    booted = bootar(document, window);
    const region = document.querySelector('#game-region') as HTMLElement;
    await ticks(booted, msToTicks(200));

    region.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyF', bubbles: true, cancelable: true }),
    );
    // ⚠️ WALL-CLOCK FOR THE SAME REASON AS THE PREVIOUS GATE: F pauses, state.tick stops. The test still
    //    measures what it must - that holding F does not sound the sonar twice - because the sonarCount is a
    //    monotonic counter and the second reading, 600 ms LATER by the wall, catches a repeat if one happened.
    await quiet(100);
    const afterFirst = booted?.motor.sonar.sonarCount ?? -1;
    await quiet(600);

    expect(booted?.motor.sonar.sonarCount).toBe(afterFirst);
  });

  // ⚠️ THE PAD GOES THROUGH THE ENGINE'S LAYER, AND THIS IS WHAT SAYS SO. `booted!.motor.input.padCur` is the engine's own
  //    per-pad record, written by its `pollPads` after the declared table, the child's remap and the
  //    mapping wizard have had their say. If this game read `navigator.getGamepads()` itself the record
  //    would stay empty and the game would still appear to work - with none of that accessibility in it.
  it('[Right] a button held on a standard pad reaches the engine input layer', async () => {
    const original = navigator.getGamepads;
    // Button 15 is `right` in the engine's own `GAMEPAD_STANDARD`; the table is imported, never restated.
    const pressed = GAMEPAD_STANDARD.right as number;
    const buttons = Array.from({ length: 17 }, (_, i) => ({ pressed: i === pressed, value: 0 }));
    (navigator as unknown as { getGamepads: () => unknown[] }).getGamepads = () => [
      { id: 'fake standard pad', index: 0, mapping: 'standard', buttons, axes: [0, 0, 0, 0] },
    ];

    try {
      booted = bootar(document, window);
      // 🔴 WAIT FOR THE POLL, NOT FOR THE CLOCK. This was `setTimeout(300)`, and it failed the first time
      //    CI ever ran this repository: on a shared two-core runner the engine had not polled the pad yet,
      //    so `booted!.motor.input.padCur[0]` was still undefined and the assertion read `expected undefined to be true`.
      //    ⚠️ A fixed sleep asserts the SPEED of the machine, and the fix is not a bigger number — the next
      //    slower runner would need a bigger one still. `waitFor` is already this file's answer, used four
      //    lines below for the second half of this very case; it just had not been used for the first.
      await waitFor(() => booted!.motor.input.padCur[0]?.right === true, 'the engine to poll the pad it was given');

      expect(booted!.motor.input.padCur[0]?.right).toBe(true);
      expect(booted!.motor.input.padCur[0]?.left).toBe(false);

      // ⚠️ AND IT REACHES THE GAME, not only the engine. Without this second half, a mutation that cut the
      //    record on its way to the sampler passed every test: the pad was read, mapped, and dropped.
      const who = booted!.state.controlled[0];
      const startX = booted!.state.players[who].p.x;
      await waitFor(
        () => booted!.state.players[who].p.x > startX + 1,
        'the pad to move the body it drives',
      );
      expect(booted!.state.players[who].p.x).toBeGreaterThan(startX + 1);
    } finally {
      (navigator as unknown as { getGamepads: typeof original }).getGamepads = original;
    }
  });

  // ⚠️ THE SOUND HAS A VISIBLE HALF, AND THIS IS THE ONLY HALF A TEST CAN SEE. Nothing here can hear a
  //    tone; what it can check is that the caption - the same information for a child who cannot hear the
  //    tone - actually reaches the screen when something happens.
  it('[Right] a goal writes a caption, which is the sound for a child who cannot hear it', async () => {
    booted = bootar(document, window);
    // Wholly beyond the goal line, between the posts and under the bar: `judgeBall` calls that a goal.
    booted!.state.phase = 'live';
    booted!.state.ball.p = { x: 91, y: 28, z: 0 };

    await waitFor(
      () => (document.querySelector('#caption') as HTMLElement).textContent !== '',
      'the caption of the goal to appear',
    );

    expect((document.querySelector('#caption') as HTMLElement).textContent).toMatch(/[A-Za-z]/);
  });

  // ⚠️ AND IT IS NOT A LIVE REGION, which is the mistake this gate exists to stop. The same goal already
  //    reaches a screen reader through `#sr-alert` as a whole sentence; a caption that ALSO announced
  //    itself would say everything twice, and an assertive one would cut the sentence off halfway. The
  //    caption is for eyes that cannot hear - `aria-hidden` is the feature, not an oversight.
  it('[Zero] the caption is invisible to a screen reader, which already got the sentence', () => {
    booted = bootar(document, window);
    const caption = document.querySelector('#caption') as HTMLElement;

    expect(caption.getAttribute('aria-hidden')).toBe('true');
    expect(caption.getAttribute('aria-live')).toBeNull();
    expect(caption.getAttribute('role')).toBeNull();
  });

  // ⚠️ SHOWN BY THE PHASE, NOT BY THE EVENT. An event is seen once: if the tick carrying it were dropped -
  //    a hitch, a backgrounded tab - the match would end with nothing on screen at all. A phase is still
  //    true on the next frame, which is what makes it safe to render from.
  it('[Right] the final whistle puts a readable result on the screen', async () => {
    booted = bootar(document, window);
    booted!.state.goals = [3, 1];
    booted!.state.phase = 'fullTime';

    await waitFor(
      () => !(document.querySelector('#end-panel') as HTMLElement).hidden,
      'the end panel to appear',
    );

    const panel = document.querySelector('#end-panel') as HTMLElement;
    expect(panel.hidden).toBe(false);
    expect(document.querySelector('#end-title')?.textContent).toBe('Você ganhou!');
    expect(document.querySelector('#end-score')?.textContent).toMatch(/3 - 1/);
  });

  it('[Right] and it tells the truth when she lost, rather than softening it', async () => {
    booted = bootar(document, window);
    booted!.state.goals = [0, 2];
    booted!.state.phase = 'fullTime';

    await waitFor(
      () => document.querySelector('#end-title')?.textContent !== '-',
      'the result to be written',
    );

    expect(document.querySelector('#end-title')?.textContent).toBe('Eles ganharam');
  });

  // ⚠️ THE FOCUS GOES TO THE BUTTON. A result a keyboard-only child has to hunt for is a result she does
  //    not get, and the panel is the only thing on screen that can be acted on.
  it('[Interface] the way to play again takes focus, so nobody has to find it', async () => {
    booted = bootar(document, window);
    booted!.state.phase = 'fullTime';

    await waitFor(
      () => document.activeElement === document.querySelector('#end-again'),
      'focus to move to the way out',
    );

    expect(document.activeElement).toBe(document.querySelector('#end-again'));
  });

  it('[Right] playing again clears the panel and starts a match from zero', async () => {
    booted = bootar(document, window);
    booted!.state.goals = [1, 4];
    booted!.state.phase = 'fullTime';
    await waitFor(
      () => !(document.querySelector('#end-panel') as HTMLElement).hidden,
      'the end panel to appear',
    );

    (document.querySelector('#end-again') as HTMLButtonElement).click();
    await ticks(booted, msToTicks(200));

    expect((document.querySelector('#end-panel') as HTMLElement).hidden).toBe(true);
    expect(booted!.state.goals).toEqual([0, 0]);
    expect(booted!.state.phase).toBe('live');
  });

  // ⚠️ AND IT ASSERTS WHAT THE PICTURE MUST CONTAIN, which it did not until 2026-09-07. It checked that
  //    there was exactly one canvas - a fact about the DOM, not about the photograph - so a shot that
  //    quietly became one team on an empty pitch would have gone unnoticed for ever.
  //
  //    That is not hypothetical. This is the picture that showed BOTH KITS side by side and disproved a
  //    defect somebody was about to report from the goalmouth shot, which had seven home defenders in it
  //    and no visitor. A screenshot with no assertion about its content is a file that ages without
  //    anybody noticing, and the one that ages worst is the one people trust.
  it('[Right] and it looks like something - a picture for the human to judge', async () => {
    booted = bootar(document, window);

    // The scale is the boot's own choice - a whole multiple of 320x180, the only one ADR-0001 permits.
    await ticks(booted, msToTicks(1500));
    await page.screenshot({ path: 'pitch.png' });

    expect(document.querySelectorAll('#pitch canvas')).toHaveLength(1);

    // The camera is on the ball, which starts on the halfway line, so the frame is the middle of the
    // pitch. Both sides have to be standing in it or the picture cannot show that the kits read apart.
    const inFrame = (team: 0 | 1) => {
      let n = 0;
      for (let k = 0; k < SQUAD_SIZE; k++) {
        const p = booted!.state.players[firstOf(team) + k].p;
        if (p.x > 20 && p.x < 70) n += 1;
      }
      return n;
    };
    expect(inFrame(0), 'no home player is in the picture').toBeGreaterThan(1);
    expect(inFrame(1), 'no away player is in the picture, so it cannot show two kits').toBeGreaterThan(1);
  });

  // ⚠️ THE THIRD PICTURE, AND THE ONE THE README HAS BEEN ADMITTING IT DID NOT HAVE. `stadium-layers` has
  //    been built, gated on its maths and on reduced motion, and NEVER SEEN: the stands sit in screen
  //    space at rows 10 to 44, and the camera only reaches the top of the world when the ball is near the
  //    FAR touchline. Every screenshot this repository has taken had the ball around the middle, where the
  //    camera clamps well below them - so "not yet seen in a captured frame" was true for months and the
  //    fix was to put the ball somewhere else.
  it('[Right] and the stands, which no picture here has ever shown', async () => {
    booted = bootar(document, window);
    booted!.state.phase = 'live';

    // ⚠️ PINNED EVERY FRAME, not placed once. The camera follows the BALL and twenty-two players take it
    //    away within a tick; a ball placed and left drifts back toward the middle, the camera follows it,
    //    and the picture is of the halfway line again - which is how this went unseen for months.
    const pin = window.setInterval(() => {
      if (booted === null) return;
      booted.state.ball.p = { x: 45, y: 18, z: 0 };
      booted.state.ball.v = { x: 0, y: 0, z: 0 };
    }, 8);
    await ticks(booted, msToTicks(2500));
    await page.screenshot({ path: 'stands.png' });
    window.clearInterval(pin);

    expect(booted!.state.ball.p.y).toBeLessThan(24);
  });

  // ⚠️ A SECOND PICTURE, AT THE GOAL, because the first one can never show the thing that most needs
  //    looking at. The camera follows the ball and the ball starts on the halfway line, so every
  //    screenshot this repository has taken shows the centre circle and no penalty area at all - which is
  //    exactly where the drawn box and the refereed box disagreed for the whole life of the game, unseen.
  //    ⚠️ AND IT HAS TO RUN LONG ENOUGH FOR THE OTHER SIDE TO ARRIVE. The first version placed the ball
  //    and waited a second and a half, which showed a box with SEVEN HOME DEFENDERS in it and not one
  //    visitor - the away side starts in its own half and forty metres takes longer than that to cover.
  //    The picture read as though both teams wore the same kit, and it took the halfway-line shot to
  //    prove they do not. A photograph of a moment nobody plays is worth what it costs to take.
  it('[Right] and so does the goalmouth, which the halfway-line picture can never show', async () => {
    booted = bootar(document, window);
    booted!.state.phase = 'live';

    // Pinned every few milliseconds, like the stands shot: a ball placed once and left drifts back to the
    // middle within a tick, the camera follows it, and the picture is of the centre circle again.
    const pin = window.setInterval(() => {
      if (booted === null) return;
      booted.state.ball.p = { x: 12, y: 28, z: 0 };
      booted.state.ball.v = { x: 0, y: 0, z: 0 };
    }, 8);
    await ticks(booted, msToTicks(4000));
    await page.screenshot({ path: 'goalmouth.png' });
    window.clearInterval(pin);

    // The camera is smoothed, so this asks that it ARRIVED rather than that it was told to go.
    expect(booted!.state.ball.p.x).toBeLessThan(20);

    // ⚠️ AND THAT BOTH SIDES ARE IN THE PICTURE, which is the whole reason the wait is four seconds.
    //    Without this the shot silently goes back to being one team in an empty box the day somebody
    //    shortens the wait.
    const near = (team: 0 | 1) => {
      let n = 0;
      for (let k = 0; k < SQUAD_SIZE; k++) {
        const p = booted!.state.players[firstOf(team) + k].p;
        if (p.x < 30) n += 1;
      }
      return n;
    };
    expect(near(0), 'no home player in the goalmouth shot').toBeGreaterThan(0);
    expect(near(1), 'the away side never arrived, so the picture is one team').toBeGreaterThan(0);
  });
});

// ========================= AND WHEN IT BREAKS, SHE IS TOLD =========================
// ADR-0054 says a loop that throws must STOP and must SAY SO, and `bootar` wires it: `aoFalhar` sends the
// error to `srAlert`. Nothing proved it. The handler was written, passed to the engine, and never once
// exercised - which is the ninth time in this repository that a thing was right and unwitnessed, and the
// worst place for it: a crash is exactly the moment a child cannot ask anybody what happened.
//
// ⚠️ A FROZEN CANVAS IS INDISTINGUISHABLE FROM A DULL MOMENT if you cannot see it. A sighted child sees
// the players stop; a blind one hears silence, which is also what a throw-in sounds like. The alert is
// the whole of the difference.
describe('when a frame throws', () => {
  it('[Right] the loop stops and the child is told', async () => {
    booted = bootar(document, window);
    await ticks(booted, msToTicks(300));

    const ranBefore = booted!.state.tick;
    expect(ranBefore, 'the match never started, so stopping it proves nothing').toBeGreaterThan(0);

    // ⚠️ BROKEN FROM THE INSIDE, NOT BY A MOCK. The tick reads `state.players` on every frame; taking it
    //    away is a fault the real loop meets rather than one a test invented, and it reaches the engine's
    //    handler by the same path a defect would.
    (booted!.state as { players: unknown }).players = null;

    // Wall clock: the loop has just been made to throw, so waiting for a tick would wait for ever.
    await quiet(400);
    const ranAfter = booted!.state.tick;
    await quiet(300);

    expect(booted!.state.tick, 'the loop kept running after it threw').toBe(ranAfter);
    const said = document.querySelector('#sr-alert')?.textContent ?? '';
    expect(said, 'it broke in silence').not.toBe('');

    // ⚠️ AND WHAT IT SAYS HAS TO BE A SENTENCE, NOT THE ERROR. This game used to pass its own handler -
    //    `aoFalhar: (err) => srAlert(String(err))` - so the alert region received a developer's error
    //    string: a blind child heard "TypeError: Cannot read properties of null" and a sighted one saw
    //    nothing at all. The engine owns this announcement by design, and its own doc says why: the
    //    message is the same in every game and the channel - screen reader, narration and what is SEEN -
    //    is infrastructure. ADR-0054 calls the missing half the one that matters, because a blind child
    //    does not see a frozen screen and silence reads the same as thinking.
    expect(said, 'the alert is a raw error object, not something a child can use').not.toMatch(/Error|TypeError|null|undefined/);
  });
});
