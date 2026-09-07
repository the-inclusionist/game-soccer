// SPDX-License-Identifier: AGPL-3.0-or-later
// CARDS, AND A PLAYER WHO IS NOT THERE ANY MORE.
//
// ========================= WHY A SENDING-OFF WAS NOT FREE =========================
// `state.onPitch` is a COUNT per side, and `squads.onPitch(state, id)` answers "is this body playing" by
// asking whether the id falls inside that count. It works because every absence so far has been a
// PREFIX: a practice squad of three is ids 0, 1 and 2.
//
// A red card is not a prefix. Sending off number seven by decrementing a count removes number ten, who
// is still standing there, and leaves number seven on the pitch. So presence needed a second answer -
// and `sim/squads` opens by saying an absent body must be absent EVERYWHERE, with ONE answer to "is he
// playing" rather than each consumer keeping its own idea. The card had to go through that one function,
// not around it.
import { describe, expect, it } from 'vitest';
import { createMatchState } from '../app/js/sim/state.ts';
import { digest } from '../app/js/sim/digest.ts';
import { MATCH_PROFILE } from '../app/js/rules/profile.ts';
import { AWAY, HOME, firstOf, teamOf } from '../app/js/sim/ids.ts';
import { onPitch, squadIds } from '../app/js/sim/squads.ts';
import { RED, YELLOW, book, cardFor } from '../app/js/rules/cards.ts';

const live = () => {
  const s = createMatchState(MATCH_PROFILE);
  s.phase = 'live';
  return s;
};

describe('what a challenge costs', () => {
  it('[Zero] a careless one costs nothing but the free kick', () => {
    expect(cardFor('careless')).toBe(0);
  });

  it('[Right] a reckless one is a booking and a violent one is a sending-off', () => {
    expect(cardFor('reckless')).toBe(YELLOW);
    expect(cardFor('violent')).toBe(RED);
  });
});

describe('booking a player', () => {
  it('[Right] a yellow is recorded against that player and nobody else', () => {
    const s = live();
    const who = firstOf(HOME) + 4;

    book(s, who, YELLOW);

    expect(s.cards[who]).toBe(YELLOW);
    expect(s.cards[who + 1]).toBe(0);
  });

  // ⚠️ THE RULE EVERY CHILD ALREADY KNOWS. Two yellows is a red, and it has to be the SAME red - not a
  //    third state that some other module has to learn about.
  it('[Right] a second yellow is a red', () => {
    const s = live();
    const who = firstOf(AWAY) + 3;

    book(s, who, YELLOW);
    book(s, who, YELLOW);

    expect(s.cards[who]).toBe(RED);
  });

  it('[Zero] a card never goes backwards - a yellow after a red leaves him sent off', () => {
    const s = live();
    const who = firstOf(HOME) + 2;

    book(s, who, RED);
    book(s, who, YELLOW);

    expect(s.cards[who]).toBe(RED);
  });

  it('[Zero] and booking somebody already booked twice does not invent a fourth state', () => {
    const s = live();
    const who = firstOf(HOME) + 2;

    book(s, who, YELLOW);
    book(s, who, YELLOW);
    book(s, who, YELLOW);

    expect(s.cards[who]).toBe(RED);
  });
});

describe('a player who has been sent off', () => {
  // ⚠️ THE ONE ANSWER. If the renderer hid him and possession still considered him, he would be an
  //    invisible player who can take the ball; if the AI skipped him and the offside line still counted
  //    him, he would be a defender nobody can see holding a line.
  it('[Right] is not on the pitch, asked through the one function that answers that', () => {
    const s = live();
    const who = firstOf(HOME) + 7;
    expect(onPitch(s, who)).toBe(true);

    book(s, who, RED);

    expect(onPitch(s, who)).toBe(false);
  });

  it('[Right] and it is HIM who goes, not the last man in the list', () => {
    const s = live();
    const who = firstOf(HOME) + 7;
    const last = firstOf(HOME) + 10;

    book(s, who, RED);

    expect(onPitch(s, last), 'the last man was sent off instead').toBe(true);
    expect(squadIds(s, HOME)).not.toContain(who);
    expect(squadIds(s, HOME)).toContain(last);
  });

  it('[Right] his side is a man down and the other side is not', () => {
    const s = live();
    const before = squadIds(s, AWAY).length;

    book(s, firstOf(HOME) + 7, RED);

    expect(squadIds(s, HOME).length).toBe(10);
    expect(squadIds(s, AWAY).length).toBe(before);
  });

  it('[Zero] a booking leaves him playing - only a red takes him off', () => {
    const s = live();
    const who = firstOf(HOME) + 7;

    book(s, who, YELLOW);

    expect(onPitch(s, who)).toBe(true);
  });

  // ⚠️ A KEEPER CAN BE SENT OFF and the game must not fall over. Whether a side then puts somebody in
  //    goal is football; whether the simulation survives the keeper being absent is arithmetic, and it
  //    is this line that asks.
  it('[Boundary] even the keeper, and nothing throws', () => {
    const s = live();
    const keeper = firstOf(AWAY);

    expect(() => book(s, keeper, RED)).not.toThrow();
    expect(onPitch(s, keeper)).toBe(false);
    expect(squadIds(s, AWAY)).not.toContain(keeper);
    expect(teamOf(keeper)).toBe(AWAY);
  });
});

describe('the digest', () => {
  // ⚠️ A FIELD THE DIGEST CANNOT SEE IS A FIELD A REPLAY DOES NOT REPRODUCE. A sending-off changes the
  //    match completely and would have left the golden replay passing while describing a different game.
  it('[Interface] a card changes the summary of the world', () => {
    const clean = live();
    const booked = live();

    book(booked, firstOf(HOME) + 4, YELLOW);

    expect(digest(booked)).not.toBe(digest(clean));
  });

  it('[Interface] and a red is not the same as a yellow', () => {
    const yellow = live();
    const red = live();
    book(yellow, firstOf(HOME) + 4, YELLOW);
    book(red, firstOf(HOME) + 4, RED);

    expect(digest(yellow)).not.toBe(digest(red));
  });
});
