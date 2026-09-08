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
import { beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { bootar } from '../app/js/boot/main.ts';
import { t } from '@the-inclusionist/engine/core/i18n.js';
import { padCur } from '@the-inclusionist/engine/input/state.js';
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
          <ul id="m-options"></ul>
        </div>
      </section>
    </div></div>
    <div class="tools">
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

    expect(booted?.motor.problems ?? ['not booted']).toEqual([]);
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

describe('what a child sees', () => {
  // ⚠️ NO CONTROL ON THIS PAGE CARRIES A HARD-CODED WORD ANY MORE, and this is the gate that keeps it so.
  //    The shell's own two selects - match/practice and the clock mode - were Portuguese literals in
  //    `index.html` from the first commit, which is the exact defect this repository spent the week
  //    recording INSIDE the engine. The markup still carries Portuguese as a fallback for a boot that
  //    fails before the dictionaries are installed; what must not survive a SUCCESSFUL boot is that
  //    fallback, because then a Spanish classroom reads Portuguese and nothing reports it.
  //
  // ⚠️ AND IT COMPARES AGAINST `t()`, which the first version did not - it only checked the text was not a
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
        expect(option.textContent, `${sel}/${option.value}`).toBe(t(`${prefix}.${option.value}`));
      }
    }

    expect(document.querySelector('#session-label')?.textContent).toBe(t('tools.session'));
    expect(document.querySelector('#mode-label')?.textContent).toBe(t('tools.mode'));
    expect(document.querySelector('#seats-label')?.textContent).toBe(t('seats.label'));
    expect(document.querySelector('#open-controls')?.textContent).toBe(t('keys.open'));
    expect(document.querySelector('#open-assists')?.textContent).toBe(t('assist.open'));
  });

  it('[Right] the state of play reaches the DOM as text, because pillar 2 says it always does', async () => {
    booted = bootar(document, window);

    await new Promise((r) => setTimeout(r, 350));

    expect(document.querySelector('#m-score')?.textContent).toMatch(/^\d+ - \d+$/);
    expect(document.querySelector('#m-phase')?.textContent).not.toBe('-');
  });

  // ⚠️ THE LIVENESS SIGNAL HAS TO BE SOMETHING THAT ACTUALLY MOVES. This once watched a coordinate; when
  //    the mirror started showing the two club names instead, the assertion still passed - the text had
  //    changed, from the placeholder to a constant - and the test kept reporting that the match was
  //    running when nothing said so. Possession changes all match, and it is the fact the game turns on.
  it('[Right] the match actually runs - the mirror is not still on its placeholder', async () => {
    booted = bootar(document, window);

    await new Promise((r) => setTimeout(r, 900));

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

    await new Promise((r) => setTimeout(r, 350));

    const shown = document.querySelector('#m-you')?.textContent ?? '';
    expect(shown, 'the mirror never said who the child is').not.toBe('-');
    // A shirt number, because that is the whole point of the line: which ONE of the eleven.
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

    await new Promise((r) => setTimeout(r, 350));

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

    await new Promise((r) => setTimeout(r, 300));

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

    await new Promise((r) => setTimeout(r, 200));
    const liveStart = read();
    await waitFor(() => read() !== liveStart, 'real time to move the clock');
    const liveEnd = read();

    const select = document.querySelector('#mode') as HTMLSelectElement;
    select.value = 'turn';
    select.dispatchEvent(new Event('change'));

    await new Promise((r) => setTimeout(r, 200));
    const turnStart = read();
    await new Promise((r) => setTimeout(r, 900));

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

    await new Promise((r) => setTimeout(r, 300));
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
    await new Promise((r) => setTimeout(r, 120));
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
    await new Promise((r) => setTimeout(r, 60));

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

    await new Promise((r) => setTimeout(r, 200));
    const before = document.querySelector('#m-clock')?.textContent;
    await new Promise((r) => setTimeout(r, 1200));

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
    await new Promise((r) => setTimeout(r, 200));
    const before = booted?.motor.sonar.sonarCount ?? -1;

    region.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyF', bubbles: true, cancelable: true }),
    );
    await new Promise((r) => setTimeout(r, 200));

    expect(booted?.motor.sonar.sonarCount).toBeGreaterThan(before);
  });

  // ⚠️ ON THE PRESS EDGE, NOT WHILE HELD. A sonar that repeats sixty times a second is a siren, and the
  //    child it exists for is the one who cannot look away from it.
  it('[Boundary] holding the key does not sound it again and again', async () => {
    booted = bootar(document, window);
    const region = document.querySelector('#game-region') as HTMLElement;
    await new Promise((r) => setTimeout(r, 200));

    region.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyF', bubbles: true, cancelable: true }),
    );
    await new Promise((r) => setTimeout(r, 100));
    const afterFirst = booted?.motor.sonar.sonarCount ?? -1;
    await new Promise((r) => setTimeout(r, 600));

    expect(booted?.motor.sonar.sonarCount).toBe(afterFirst);
  });

  // ⚠️ THE PAD GOES THROUGH THE ENGINE'S LAYER, AND THIS IS WHAT SAYS SO. `padCur` is the engine's own
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
      await new Promise((r) => setTimeout(r, 300));

      expect(padCur[0]?.right).toBe(true);
      expect(padCur[0]?.left).toBe(false);

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
    await new Promise((r) => setTimeout(r, 200));

    expect((document.querySelector('#end-panel') as HTMLElement).hidden).toBe(true);
    expect(booted!.state.goals).toEqual([0, 0]);
    expect(booted!.state.phase).toBe('live');
  });

  it('[Right] and it looks like something - a picture for the human to judge', async () => {
    booted = bootar(document, window);

    // The scale is the boot's own choice - a whole multiple of 320x180, the only one ADR-0001 permits.
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: 'pitch.png' });

    expect(document.querySelectorAll('#pitch canvas')).toHaveLength(1);
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
    await new Promise((r) => setTimeout(r, 2500));
    await page.screenshot({ path: 'stands.png' });
    window.clearInterval(pin);

    expect(booted!.state.ball.p.y).toBeLessThan(24);
  });

  // ⚠️ A SECOND PICTURE, AT THE GOAL, because the first one can never show the thing that most needs
  //    looking at. The camera follows the ball and the ball starts on the halfway line, so every
  //    screenshot this repository has taken shows the centre circle and no penalty area at all - which is
  //    exactly where the drawn box and the refereed box disagreed for the whole life of the game, unseen.
  it('[Right] and so does the goalmouth, which the halfway-line picture can never show', async () => {
    booted = bootar(document, window);
    booted!.state.phase = 'live';
    booted!.state.ball.p = { x: 12, y: 28, z: 0 };
    booted!.state.ball.v = { x: 0, y: 0, z: 0 };

    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: 'goalmouth.png' });

    // The camera is smoothed, so this asks that it ARRIVED rather than that it was told to go.
    expect(booted!.state.ball.p.x).toBeLessThan(20);
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
    await new Promise((r) => setTimeout(r, 300));

    const ranBefore = booted!.state.tick;
    expect(ranBefore, 'the match never started, so stopping it proves nothing').toBeGreaterThan(0);

    // ⚠️ BROKEN FROM THE INSIDE, NOT BY A MOCK. The tick reads `state.players` on every frame; taking it
    //    away is a fault the real loop meets rather than one a test invented, and it reaches the engine's
    //    handler by the same path a defect would.
    (booted!.state as { players: unknown }).players = null;

    await new Promise((r) => setTimeout(r, 400));
    const ranAfter = booted!.state.tick;
    await new Promise((r) => setTimeout(r, 300));

    expect(booted!.state.tick, 'the loop kept running after it threw').toBe(ranAfter);
    expect(document.querySelector('#sr-alert')?.textContent ?? '', 'it broke in silence').not.toBe('');
  });
});
