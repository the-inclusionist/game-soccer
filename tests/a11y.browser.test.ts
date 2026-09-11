// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ACCESSIBILITY GATE, RUN AGAINST THE GAME AS IT ACTUALLY BOOTS.
//
// ========================= WHY IT IS A TEST AND NOT ONLY A SCRIPT =========================
// The engine's shared CI has an `a11y` job that runs axe against the SERVED build, and this repository
// will turn it on. This test is not a replacement for it: it runs against the booted shell inside the
// browser project, so it fails on the developer's machine in the same second the markup breaks rather than
// on a runner minutes later. Two checks of the same thing at two distances is not duplication when the
// distances are what differ.
//
// ⚠️ AND IT HAS NO EXCLUSIONS. The engine's own axe run excludes the third-party VLibras widget, whose
// markup belongs to somebody else; this game does not load it, so nothing here is exempt. A gate with an
// exclusion nobody re-reads is how a violation becomes permanent.
import { beforeEach, describe, expect, it } from 'vitest';
// ⚠️ `axe-core` DIRECTLY, NOT `@axe-core/playwright`. The wrapper drives a Playwright `Page` object; the
// browser project runs the test INSIDE the page, so there is no `Page` to hand it - and the wrapper fails
// with `page.evaluate is not a function`, which reads like a broken test rather than the wrong tool.
import axe from 'axe-core';

// ⚠️ THE STYLESHEET IS PART OF WHAT IS BEING TESTED, and leaving it out made this gate report a violation
// the shipped page does not have: five controls failed WCAG 2.5.8 Target Size because the rule that makes
// them 44 by 44 lives in CSS. A markup-only accessibility test measures a page nobody visits - and the
// failure it invents is worse than the one it misses, because somebody will "fix" the component.
import '../app/css/game.css';
import { bootar } from '../app/js/boot/main.ts';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const violationsNow = async (): Promise<string[]> => {
  const result = await axe.run(document, { runOnly: { type: 'tag', values: TAGS } });
  return result.violations.map((v) => `${v.id} (${v.nodes.length})`);
};

const SHELL = `
  <p id="sr-status" class="sr-only" role="status" aria-live="polite"></p>
  <p id="sr-alert" class="sr-only" role="alert" aria-live="assertive"></p>
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

let booted: ReturnType<typeof bootar> = null;

beforeEach(() => {
  booted?.stop();
  booted = null;
  document.documentElement.lang = 'pt-BR';
  document.body.innerHTML = SHELL;
});


/**
 * Wait for a fact, not for a duration.
 *
 * ⚠️ EVERY FIXED SLEEP IN THIS FILE WAS A BET ON THE MACHINE, and the end-of-match one lost it: 400ms is
 * plenty of frames on an idle laptop and not enough with sixty-two other files running beside it, so the
 * panel had not been shown yet and axe audited a `hidden` subtree - which it SKIPS, so the case did not
 * even fail loudly. It failed on the assertion that the panel was open, which is the only reason the
 * flake was visible at all.
 */
async function waitFor(what: () => boolean, why: string, timeoutMs = 8000): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (what()) return;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error(`timed out waiting for: ${why}`);
}

describe('the running game', () => {
  it('[Interface] reports ZERO WCAG A and AA violations, with no exclusions at all', async () => {
    booted = bootar(document, window);
    await new Promise((r) => setTimeout(r, 400));

    expect(await violationsNow()).toEqual([]);
  });

  // ⚠️ THE PANEL HAS TO BE SHOWN TO BE AUDITED. axe skips `hidden` subtrees, so the end-of-match panel sat
  //    in the shell being reported clean without ever being looked at - the same shape of nothing as the
  //    shell that did not contain it at all. Driving the match to full time is what makes the audit real.
  it('[Interface] and the end-of-match panel is clean - it is the last thing a child reads', async () => {
    booted = bootar(document, window);
    booted!.state.goals = [2, 1];
    booted!.state.phase = 'fullTime';
    await waitFor(() => !(document.querySelector('#end-panel') as HTMLElement).hidden, 'the end panel');

    expect((document.querySelector('#end-panel') as HTMLElement).hidden, 'the panel is actually shown').toBe(false);
    expect(await violationsNow()).toEqual([]);
  });

  // ⚠️ OPENED, FOR THE SAME REASON THE END PANEL IS. A dialog audited while `hidden` is a dialog axe never
  //    looked at - and this one is where a child with a hand that does not reach `U` and `I` goes FIRST.
  it('[Interface] and the remap screen is clean - it is the first screen some children need', async () => {
    booted = bootar(document, window);
    (document.querySelector('#open-controls') as HTMLButtonElement).click();
    await waitFor(() => !(document.querySelector('#controls-panel') as HTMLElement).hidden, 'the remap screen');

    expect((document.querySelector('#controls-panel') as HTMLElement).hidden, 'the screen is open').toBe(false);
    expect(await violationsNow()).toEqual([]);
  });

  // ⚠️ WITH TWO SEATS THE SCREEN GROWS CONTROLS IT DOES NOT HAVE WITH ONE - a toggle per keyboard, built
  //    by this game rather than by the engine. Auditing only the one-seat screen would audit the half
  //    this repository did not write.
  it('[Interface] and the remap screen is clean with two keyboards on it too', async () => {
    booted = bootar(document, window);
    const seats = document.querySelector('#seats') as HTMLSelectElement;
    seats.value = 'coop';
    seats.dispatchEvent(new Event('change'));
    (document.querySelector('#open-controls') as HTMLButtonElement).click();
    await waitFor(
      () => document.querySelectorAll('#ctrl-players button[data-seat]').length === 2,
      'both keyboard choosers',
    );

    expect(document.querySelectorAll('#ctrl-players button[data-seat]').length, 'the chooser is there').toBe(2);
    expect(await violationsNow()).toEqual([]);
  });

  // ⚠️ THE CLUB LISTS ARE BUILT BY THIS GAME AT BOOT, from twelve dictionary keys, with the opponent's own
  //    entry DISABLED - three things axe has an opinion about and none of which exist in the markup the
  //    other cases audit.
  it('[Interface] and the club choosers are clean, built and populated', async () => {
    booted = bootar(document, window);
    await waitFor(() => document.querySelectorAll('#home-club option').length > 8, 'the club lists');

    expect(document.querySelectorAll('#home-club option').length, 'the lists were built').toBeGreaterThan(8);
    expect(await violationsNow()).toEqual([]);
  });

  // ⚠️ THE ASSISTANCES SCREEN IS THE ONE A GROWN-UP OPENS ON BEHALF OF A CHILD WHO CANNOT USE THE DEFAULTS,
  //    which makes auditing it while `hidden` the least useful place to save time.
  it('[Interface] and the assistances screen is clean, open, with its lists built', async () => {
    booted = bootar(document, window);
    (document.querySelector('#open-assists') as HTMLButtonElement).click();
    await waitFor(() => !(document.querySelector('#assist-panel') as HTMLElement).hidden, 'the assistances screen');

    expect((document.querySelector('#assist-panel') as HTMLElement).hidden, 'the screen is open').toBe(false);
    expect(document.querySelectorAll('#assist-charge option').length, 'the lists were built').toBe(3);
    expect(await violationsNow()).toEqual([]);
  });

  it('[Interface] and the turn panel is clean too - it is the interface a child plays through', async () => {
    booted = bootar(document, window);
    const select = document.querySelector('#mode') as HTMLSelectElement;
    select.value = 'turn';
    select.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 400));

    expect(await violationsNow()).toEqual([]);
  });
});
