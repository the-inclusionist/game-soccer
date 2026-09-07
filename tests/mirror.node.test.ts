// SPDX-License-Identifier: AGPL-3.0-or-later
// WHICH PLAYER SHE IS DRIVING, AS TEXT.
//
// ========================= THE ONE FACT THAT LIVED ONLY IN PIXELS =========================
// The mirror already publishes the fixture, the score, the clock, the phase and whose ball it is - five
// facts a child gets without seeing the screen. It did NOT publish which of the eleven she is driving,
// and that one is different from the other five: the score is also spoken by an earcon and the phase is
// also narrated, but "you are number 7" existed ONLY as a five-pixel wedge over a head.
//
// So a blind child could hear that her side had the ball and could not tell whether it was at her feet.
// That is pillar 2 - text always in the DOM - and it is in the plan's own module list, `quem voce
// controla`, which is where this was found.
//
// ⚠️ AND THE SENTENCE IS DECIDED HERE, IN A PURE MODULE, so it is measured in the node project. A browser
// test could only ever assert that a function was called; this asserts what it says. The same split the
// earcon captions use, and for the same reason.
import { describe, expect, it } from 'vitest';
import { youLine } from '../app/js/ui/mirror.ts';
import { createMatchState } from '../app/js/sim/state.ts';
import { NOBODY } from '../app/js/sim/possession.ts';
import { RED } from '../app/js/rules/cards.ts';

/** A dictionary that hands back what it was asked for, so a gate can see the KEY and the params. */
const echo = (key: string, params?: Record<string, string | number>): string =>
  params === undefined ? key : `${key} ${JSON.stringify(params)}`;

function live(holder: number = NOBODY) {
  const s = createMatchState();
  s.phase = 'live';
  s.possession.holder = holder;
  return s;
}

describe('the line that says who you are', () => {
  it('[Right] it names the number on his shirt', () => {
    expect(youLine(live(), 6, echo)).toBe('hud.you.shirt {"shirt":7}');
  });

  // ⚠️ THE FACT THE OTHER FIVE LINES CANNOT GIVE HER. `hud.ball.with` says the CLUB has it, which is true
  //    of ten team-mates as well as of her. Whether it is at her own feet is what she acts on.
  it('[Right] and says so when the ball is at his feet', () => {
    expect(youLine(live(6), 6, echo)).toBe('hud.you.shirtBall {"shirt":7}');
  });

  it('[Zero] but not when a team-mate has it', () => {
    expect(youLine(live(5), 6, echo)).toBe('hud.you.shirt {"shirt":7}');
  });

  it('[Zero] nor when nobody does', () => {
    expect(youLine(live(NOBODY), 6, echo)).toBe('hud.you.shirt {"shirt":7}');
  });

  // ⚠️ THE KEEPER IS A DIFFERENT SENTENCE BECAUSE HE IS A DIFFERENT GAME. He may handle it, he stands
  //    where nobody else stands, and a child switched to him without being told is a child who does not
  //    know why the pitch suddenly looks wrong.
  it('[Boundary] the keeper is told he is the keeper', () => {
    expect(youLine(live(), 0, echo)).toBe('hud.you.keeper {"shirt":1}');
  });

  it('[Boundary] and the keeper with the ball in his hands is told both', () => {
    expect(youLine(live(0), 0, echo)).toBe('hud.you.keeperBall {"shirt":1}');
  });

  // ⚠️ AND A SENT-OFF PLAYER IS NOT NAMED. Naming a man who is not on the pitch is the mirror telling her
  //    to move somebody who cannot move - the same class of lie as narrating a compass direction that
  //    swapped at half time.
  it('[Zero] a player who has been sent off is reported gone, not named', () => {
    const s = live();
    s.cards[6] = RED;

    expect(youLine(s, 6, echo)).toBe('hud.you.sentOff');
  });

  // ⚠️ EVERY SENTENCE COMES FROM THE DICTIONARY. A literal here would be a Portuguese word inside the
  //    game for a child reading in Spanish, and pillar 3 has no exception for short strings.
  it('[Interface] every sentence it can produce is a dictionary key', () => {
    const sentOff = live();
    sentOff.cards[6] = RED;
    const every = [live(), live(6), live(0)].map((s) => youLine(s, s === sentOff ? 6 : 0, echo));
    every.push(youLine(sentOff, 6, echo));

    for (const line of [...every, youLine(live(6), 6, echo)]) {
      expect(line).toMatch(/^hud\.you\./);
    }
  });
});
