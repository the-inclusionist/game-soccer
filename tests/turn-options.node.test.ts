// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT THE CHILD MAY CHOOSE, WHEN THE MATCH IS WAITING FOR HER.
//
// ========================= WHY THE TURN MODE IS NOT A LESSER GAME =========================
// The turn-based clock is how this game pays WCAG 2.2.1 by construction rather than by adjustment: there
// is no clock to adjust, so there is nothing to time. But that only holds if the child can reach the SAME
// acts a real-time player reaches - otherwise the accommodation is a weaker game wearing the same name.
// So the options offered here are the verbs the simulation accepts, filtered only by what the world makes
// possible, never by what would be easier to render.
//
// ⚠️ AND POWER IS A NUMBER SHE PICKS. That is the whole reason `Command.power` arrives already integrated:
// real time integrates a hold, and here she chooses from the same five steps. Same simulation, same
// reachable outcomes, no timing anywhere.
import { describe, expect, it } from 'vitest';
import { turnOptionsFor } from '../app/js/ui/turn-options.ts';
import { createMatchState } from '../app/js/sim/state.ts';
import { SQUAD_SIZE } from '../app/js/sim/ids.ts';
import { NOBODY } from '../app/js/sim/possession.ts';
import { STEPS } from '../app/js/input/charge.ts';

function withBall(who: number) {
  const s = createMatchState();
  s.phase = 'live';
  for (const p of s.players) p.p = { x: 5, y: 50 };
  s.ball.p = { x: 60, y: 28, z: 0 };
  s.players[who].p = { x: 60, y: 28 };
  s.possession.holder = who;
  return s;
}

const verbs = (state: ReturnType<typeof createMatchState>, who: number) =>
  turnOptionsFor(state, who).verbs.map((v) => v.verb);

describe('with the ball at my feet', () => {
  it('[Many] every way of moving it is on offer', () => {
    expect(verbs(withBall(9), 9).sort()).toEqual(['lob', 'pass', 'shoot', 'through']);
  });

  it('[Zero] and tackling is not, because there is nobody to tackle', () => {
    expect(verbs(withBall(9), 9)).not.toContain('tackle');
  });

  it('[Interface] every option carries a label KEY, never a word - the panel resolves it', () => {
    for (const option of turnOptionsFor(withBall(9), 9).verbs) {
      expect(option.labelKey).toMatch(/^act\./);
    }
  });
});

describe('without it', () => {
  it('[Right] the choices are to tackle and to switch player', () => {
    const s = withBall(SQUAD_SIZE + 4);
    s.players[9].p = { x: 60.4, y: 28 };

    expect(verbs(s, 9).sort()).toEqual(['switch', 'tackle']);
  });

  it('[Zero] out of reach, tackling drops off and only switching is left', () => {
    const s = withBall(SQUAD_SIZE + 4);
    s.players[9].p = { x: 5, y: 5 };

    expect(verbs(s, 9)).toEqual(['switch']);
  });

  it('[Right] with the ball loose, chasing it is not a verb - it is just moving', () => {
    const s = withBall(9);
    s.possession.holder = NOBODY;

    expect(verbs(s, 9)).not.toContain('shoot');
  });
});

describe('power', () => {
  it('[Many] the same five steps a hold reaches, and no more', () => {
    const opts = turnOptionsFor(withBall(9), 9);

    expect(opts.powerSteps).toEqual([1, 2, 3, 4, 5]);
    expect(opts.powerSteps).toHaveLength(STEPS);
  });

  // ⚠️ NO TIMER ANYWHERE IN THIS SHAPE. There is nothing here that expires, which is what makes WCAG 2.2.1
  //    satisfied by construction: a criterion about time limits, met by having none.
  it('[Zero] nothing in the options has a deadline attached', () => {
    const opts = turnOptionsFor(withBall(9), 9);

    expect(JSON.stringify(opts)).not.toMatch(/deadline|expires|timeout|ticks/i);
  });
});

describe('directions', () => {
  it('[Many] all eight, so a child is never told she may only go four ways', () => {
    expect(turnOptionsFor(withBall(9), 9).directions).toHaveLength(8);
  });

  it('[Interface] each direction is a unit-ish vector the simulation can consume as it stands', () => {
    for (const d of turnOptionsFor(withBall(9), 9).directions) {
      const len = Math.sqrt(d.dx * d.dx + d.dy * d.dy);
      expect(len).toBeGreaterThan(0.9);
      expect(len).toBeLessThan(1.1);
    }
  });
});

describe('when the match is not waiting for anybody', () => {
  it('[Zero] a seat driving nobody is offered nothing, and that is not an error', () => {
    expect(turnOptionsFor(withBall(9), undefined).verbs).toEqual([]);
  });
});
