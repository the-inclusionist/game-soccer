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
import { chargeLine, hintLine, laggingLine, spotLines, youLine } from '../app/js/ui/mirror.ts';
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

// ========================= AND WHERE THE BALL COULD GO NEXT =========================
// The declaration answers that already - `targetsOf` is the half of the contract the SONAR uses, and it
// is the highest-leverage decision in the game: at most four spots, each actionable this instant, never
// the ten team-mates that would make the sonar beep ten times and say nothing.
//
// ⚠️ SO THIS DOES NOT WORK IT OUT AGAIN. It is handed the spots the sonar was handed, and turns them into
// words. A second copy of "who is free and legal" would be the same defect as a count written into two
// files: the two drift, and the one nobody is looking at is the one that goes wrong.
//
// ⚠️ AND IT IS FOR A CHILD THE SONAR CANNOT REACH. Spatial audio needs ears. A deaf-blind child on a
// braille display has the DOM and nothing else, and until this line existed the single most useful thing
// the game knew - where she could put the ball - was available only as sound.
describe('where the ball could go next', () => {
  // Attacking +x, so `dir` is 1: ahead is greater x, and the player's left hand points at smaller y.
  const from = { x: 45, y: 28 };

  it('[Zero] with nothing on, it SAYS nothing is on rather than going quiet', () => {
    expect(spotLines(from, [], 1, echo)).toEqual(['hud.spot.none']);
  });

  it('[Right] a spot toward their goal is ahead, counted in paces', () => {
    expect(spotLines(from, [{ x: 45 + 9, y: 28 }], 1, echo)).toEqual(['hud.spot.ahead {"paces":6}']);
  });

  it('[Right] and one toward our own goal is back', () => {
    expect(spotLines(from, [{ x: 45 - 9, y: 28 }], 1, echo)).toEqual(['hud.spot.back {"paces":6}']);
  });

  // ⚠️ THE SIDES ARE THE CHILD'S, NOT THE SCREEN'S, and this is the gate that matters. Ends swap at half
  //    time, so a spot at a fixed `y` is on her left in one half and on her right in the other - and a
  //    compass, or a raw coordinate, would send her the wrong way for forty-five minutes with nothing on
  //    screen looking wrong. `narration` has carried that rule since it existed; this obeys the same one.
  it('[Right] her left and right come from the way she is attacking, not from the screen', () => {
    const wide = [{ x: 45, y: 28 - 9 }];

    expect(spotLines(from, wide, 1, echo)).toEqual(['hud.spot.left {"paces":6}']);
    expect(spotLines(from, wide, -1, echo)).toEqual(['hud.spot.right {"paces":6}']);
  });

  it('[Right] and so does ahead, which is the same rule on the other axis', () => {
    const up = [{ x: 45 + 9, y: 28 }];

    expect(spotLines(from, up, 1, echo)).toEqual(['hud.spot.ahead {"paces":6}']);
    expect(spotLines(from, up, -1, echo)).toEqual(['hud.spot.back {"paces":6}']);
  });

  // ⚠️ ONE PACE IS A DIFFERENT WORD. "1 paces" is the kind of sentence that tells a child the machine is
  //    not really speaking to her, and no dictionary can repair it from the outside.
  it('[Boundary] one pace has its own sentence', () => {
    expect(spotLines(from, [{ x: 46.5, y: 28 }], 1, echo)).toEqual(['hud.spot.aheadOne']);
  });

  // ⚠️ AND NOTHING IS EVER NOUGHT PACES AWAY. A spot under her own feet still has to be reachable as a
  //    sentence, and "0 paces ahead" is not one.
  it('[Boundary] a spot on top of her rounds up to one, never to none', () => {
    expect(spotLines(from, [{ x: 45.2, y: 28 }], 1, echo)).toEqual(['hud.spot.aheadOne']);
  });

  it('[Many] one line per spot, in the order the declaration ranked them', () => {
    const three = [
      { x: 45 + 3, y: 28 },
      { x: 45, y: 28 + 9 },
      { x: 45 - 15, y: 28 },
    ];

    expect(spotLines(from, three, 1, echo)).toEqual([
      'hud.spot.ahead {"paces":2}',
      'hud.spot.right {"paces":6}',
      'hud.spot.back {"paces":10}',
    ]);
  });

  // ⚠️ THE DOMINANT AXIS AND NOT BOTH. "Six paces ahead and one to your left" is two facts where one is
  //    wanted; a child scanning four of these on a braille line is reading, not listening, and every
  //    extra clause is a line she has to get past to reach the next option.
  it('[Right] a spot that is both takes the bigger of the two', () => {
    expect(spotLines(from, [{ x: 45 + 9, y: 28 + 3 }], 1, echo)[0]).toMatch(/^hud\.spot\.ahead /);
  });

  it('[Interface] every line it can produce is a dictionary key', () => {
    const many = spotLines(from, [{ x: 60, y: 20 }, { x: 30, y: 40 }], 1, echo);

    for (const line of [...many, ...spotLines(from, [], 1, echo)]) expect(line).toMatch(/^hud\.spot\./);
  });
});

// ========================= AND HOW FAR THE SHOT IS CHARGED =========================
// The plan asks for it in as many words: a bar does not serve a child who cannot see one, so the power is
// COUNTABLE - "three of five" - with a tone per step. It was built as a `powerStep` from 1 to 5, gated
// hard, offered in three routes, and shown to nobody: the only place a strength appeared on screen was
// the TURN panel, which is the one mode where she is not holding a key down at all.
//
// ⚠️ SO THE ONE MODE THAT NEEDS THE FEEDBACK WAS THE ONE WITHOUT IT. In real time she holds the key and
// receives nothing - no bar, no count, no tone - and lets go blind.
describe('the line that says how hard it will be hit', () => {
  it('[Zero] nothing charging says nothing at all', () => {
    expect(chargeLine(0, echo)).toBe('');
  });

  // ⚠️ `{have} OF {need}` AND NOT A PERCENTAGE, which is the 2048's lesson: a child counts five, and
  //    five of five is a thing she can decide to wait for. A percentage is a number she has to convert.
  it('[Right] a charge in flight is counted, not measured', () => {
    expect(chargeLine(3, echo)).toBe('hud.charge {"have":3,"need":5}');
  });

  it('[Boundary] the first step and the last are both sayable', () => {
    expect(chargeLine(1, echo)).toBe('hud.charge {"have":1,"need":5}');
    expect(chargeLine(5, echo)).toBe('hud.charge {"have":5,"need":5}');
  });

  it('[Interface] and the sentence is a dictionary key, like every other', () => {
    expect(chargeLine(2, echo)).toMatch(/^hud\./);
  });
});

// ========================= AND WHEN THE MACHINE CANNOT KEEP UP =========================
// `drivers/driver` clamps how many ticks one frame may run and counts the wall time it throws away, and
// its own header says `droppedMs` "exists and is surfaced rather than swallowed". Nothing surfaced it.
// The composition root never read the field, so the file made a claim about itself that was false.
//
// ⚠️ AND PILLAR 1 IS THE REASON IT MATTERS. The hardware this game is FOR is a school tablet, which is
// exactly where a frame runs long and time gets dropped. A child who cannot see the screen has no way to
// tell a stutter from a lull; a child who can has no way to tell it from her own mistake. Saying so is
// the difference between "the machine is struggling" and "I pressed the wrong thing".
describe('the line that says the machine is losing time', () => {
  it('[Zero] a machine that is keeping up says nothing at all', () => {
    expect(laggingLine(0, echo)).toBe('');
  });

  // ⚠️ A THRESHOLD, NOT ANY DROP AT ALL. One dropped frame is a hiccup every device has; a line that
  //    appeared for it would be a line nobody reads by the second minute.
  it('[Zero] and neither does one hiccup', () => {
    expect(laggingLine(30, echo)).toBe('');
  });

  it('[Right] but a machine that keeps falling behind says so', () => {
    expect(laggingLine(5000, echo)).toBe('hud.lagging');
  });

  it('[Interface] and the sentence is a dictionary key, like every other', () => {
    expect(laggingLine(5000, echo)).toMatch(/^hud\./);
  });
});

// ========================= AND WHO A PRESS WOULD HAND HER =========================
// The hint exists on screen as a hollow chevron over another body. ⚠️ THAT IS A MARK, AND A MARK IS THE
// one channel this game cannot offer a blind child - so the sentence is not a convenience beside the
// picture, it is the whole feature for her. She is the child the hinted switch was built for twice over:
// once because it removes a reaction-time demand, and once because without a number she has no way to
// know who she would get.
describe('who a press would hand her', () => {
  it('[Right] names the hinted body by its shirt number', () => {
    const state = createMatchState();
    state.phase = 'live';
    state.hinted[0] = 7;

    expect(hintLine(state, 0, echo)).toContain('hud.switch.to');
  });

  // ⚠️ NOTHING TO SAY IS SAID WITH NOTHING, which is the rule this module already follows for the
  //    charge line and the lagging line. A sentence reading "switch to nobody" is worse than a blank: a
  //    reader announces it, she listens to it, and it was never information.
  it('[Zero] says nothing at all when there is nobody to switch to', () => {
    const state = createMatchState();
    state.phase = 'live';
    state.hinted[0] = -1;

    expect(hintLine(state, 0, echo)).toBe('');
  });

  // ⚠️ AND A SENT-OFF BODY IS NOT OFFERED, through `onPitch` - the one function that answers "is he
  //    playing". Naming a player who has left the pitch would be the mirror telling her to switch to
  //    somebody who is not there, which is the shape of defect this file already records once.
  it('[Boundary] and never names a body that has been sent off', () => {
    const state = createMatchState();
    state.phase = 'live';
    state.hinted[0] = 7;
    // A red card is the whole of it: `sim/squads.onPitch` answers false the moment the card is there,
    // and the squad count is about how many a side FIELDS rather than about who has been sent off.
    state.cards[7] = RED;

    expect(hintLine(state, 0, echo)).toBe('');
  });
});
