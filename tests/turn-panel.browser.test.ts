// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PANEL A CHILD PLAYS THROUGH.
//
// ⚠️ THE CLAIM UNDER TEST IS THAT THE WHOLE GAME IS OPERABLE WITH NO PIXELS. That is not something a
// screenshot can show and not something a logic test can reach: it needs real focus, real buttons and
// real accessible names, so it lives in the browser project.
import { beforeEach, describe, expect, it } from 'vitest';
import { createTurnPanel } from '../app/js/ui/turn-panel.ts';
import { createMatchState } from '../app/js/sim/state.ts';
import { SQUAD_SIZE } from '../app/js/sim/ids.ts';
import { en } from '../app/js/i18n/en.ts';
import type { Command } from '../app/js/sim/command.ts';

const t = (key: string, params?: Record<string, string | number>) => {
  const raw = (en as Record<string, string>)[key] ?? key;
  if (params === undefined) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ''));
};

function carrying(who: number) {
  const s = createMatchState();
  s.phase = 'live';
  for (const p of s.players) p.p = { x: 5, y: 50 };
  s.ball.p = { x: 60, y: 28, z: 0 };
  s.players[who].p = { x: 60, y: 28 };
  s.possession.holder = who;
  return s;
}

let committed: Command[] = [];
let host: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div id="host"></div>';
  host = document.querySelector('#host') as HTMLElement;
  committed = [];
});

const panelFor = () =>
  createTurnPanel({ host, doc: document, t, onCommit: (c) => committed.push(c) });

describe('the turn panel', () => {
  it('[Interface] every control is a real button with a real name', () => {
    panelFor().render(carrying(9), 0, 9);

    const buttons = [...host.querySelectorAll('button')];
    expect(buttons.length).toBeGreaterThan(10);
    for (const b of buttons) expect(b.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('[Interface] the panel is grouped and its sections are named, so a reader can navigate it', () => {
    panelFor().render(carrying(9), 0, 9);

    expect(host.querySelector('[role="group"]')).not.toBeNull();
    const legends = [...host.querySelectorAll('legend')].map((l) => l.textContent);
    expect(legends).toContain('Aim');
    expect(legends).toContain('Do');
  });

  // ⚠️ COUNTABLE, NOT A BAR. The legend SAYS the number, so a child who cannot see it can hear it.
  it('[Right] the strength is announced as a count, and the count follows what she pressed', () => {
    const panel = panelFor();
    panel.render(carrying(9), 0, 9);

    const five = [...host.querySelectorAll('button')].find((b) => b.textContent === '5');
    five?.click();

    expect([...host.querySelectorAll('legend')].map((l) => l.textContent)).toContain(
      'Strength: 5 of 5',
    );
  });

  it('[Right] pressing an act commits a command carrying the aim and the strength she chose', () => {
    const panel = panelFor();
    panel.render(carrying(9), 0, 9);
    const buttons = [...host.querySelectorAll('button')];

    buttons.find((b) => b.textContent === 'Left')?.click();
    buttons.find((b) => b.textContent === '5')?.click();
    buttons.find((b) => b.textContent === 'Short pass')?.click();

    expect(committed).toHaveLength(1);
    expect(committed[0].verb).toBe('pass');
    expect(committed[0].power).toBe(1);
    expect(committed[0].dx).toBe(-1);
  });

  it('[Boundary] the lowest strength is a real command, never a zero-power one', () => {
    const panel = panelFor();
    panel.render(carrying(9), 0, 9);
    const buttons = [...host.querySelectorAll('button')];

    buttons.find((b) => b.textContent === '1')?.click();
    buttons.find((b) => b.textContent === 'Short pass')?.click();

    expect(committed[0].power).toBe(0);
  });

  it('[Zero] with nothing to decide the panel is hidden, not empty and focusable', () => {
    const s = carrying(SQUAD_SIZE + 4);
    const panel = panelFor();

    panel.render(s, 0, undefined);

    const root = host.querySelector('.turn-panel') as HTMLElement;
    expect(root.hidden).toBe(true);
    expect(host.querySelectorAll('button')).toHaveLength(0);
  });

  it('[Right] without the ball, the acts on offer change with the world', () => {
    const s = carrying(SQUAD_SIZE + 4);
    s.players[9].p = { x: 60.4, y: 28 };

    panelFor().render(s, 0, 9);

    const labels = [...host.querySelectorAll('button')].map((b) => b.textContent);
    expect(labels).toContain('Switch player');
    expect(labels).not.toContain('Short pass');
  });

  it('[Interface] every button is reachable by keyboard, in the order it is read', () => {
    panelFor().render(carrying(9), 0, 9);

    for (const b of host.querySelectorAll('button')) {
      (b as HTMLButtonElement).focus();
      expect(document.activeElement).toBe(b);
    }
  });
});
