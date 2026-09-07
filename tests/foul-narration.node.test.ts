// SPDX-License-Identifier: AGPL-3.0-or-later
// SAYING WHAT THE REFEREE JUST DID.
//
// ========================= A DEFAULT THAT ANSWERED WITH THE WRONG SENTENCE =========================
// `narrate` ended in `default: return t('say.start')`. So the day fouls existed, a blind child heard "the
// match begins" every time one was given - a wrong answer delivered confidently, which is worse than
// silence and which no test would have caught, because a sentence came back and it was a real sentence.
//
// `audio/cues` has an exhaustive switch and it STOPPED THE BUILD when the two events arrived. This file
// takes the same discipline into the narration: every event the referee can raise is answered here by
// name, and adding a thirteenth fails the typecheck instead of quietly becoming "the match begins".
//
// ⚠️ AND A CARD IS ITS OWN EVENT rather than a field on the foul. A booking and a sending-off are
// different things that happen to a PLAYER, while a foul is about a TEAM - and widening the event every
// consumer reads, for the one consumer that needs it, is how a shared type stops being readable.
import { describe, expect, it } from 'vitest';
import { EVENTS } from '../app/js/rules/phase.ts';
import { URGENT } from '../app/js/rules/events.ts';
import { announce, narrate } from '../app/js/narration.ts';
import { AWAY, HOME } from '../app/js/sim/ids.ts';
import type { RuleEvent } from '../app/js/rules/events.ts';

const say = (event: RuleEvent, us = HOME) => narrate(event, { period: 1, us, t: (k) => k });

describe('every event has its own sentence', () => {
  // ⚠️ THE GATE THAT WOULD HAVE CAUGHT THE DEFAULT. `say.start` is the sentence for the match beginning;
  //    any other event answering with it is the fall-through, and it is invisible from the outside.
  it('[Interface] and none of them falls through to "the match begins"', () => {
    for (const kind of EVENTS) {
      if (kind === 'start') continue;
      expect(say({ kind, team: HOME, at: { x: 20, y: 20 } }), kind).not.toBe('say.start');
    }
  });

  it('[Interface] every event says something, and no two unrelated ones say the same thing', () => {
    const said = EVENTS.map((kind) => say({ kind, team: HOME, at: { x: 20, y: 20 } }));

    for (const [i, s] of said.entries()) expect(s.length, EVENTS[i]).toBeGreaterThan(0);
  });
});

describe('a foul', () => {
  it('[Right] says whose it is, because that is the only thing a child needs from it', () => {
    const toUs = say({ kind: 'foulGiven', team: HOME }, HOME);
    const toThem = say({ kind: 'foulGiven', team: AWAY }, HOME);

    expect(toUs).not.toBe(toThem);
  });

  // A foul is frequent. `URGENT` interrupts whatever is being read, and a channel that interrupts every
  // few seconds is a channel a child turns off - which is the reasoning `rules/events` already states
  // about throw-ins.
  it('[Zero] and it does not interrupt, because it happens all the time', () => {
    expect(URGENT.has('foulGiven')).toBe(false);
  });
});

describe('a penalty', () => {
  it('[Right] is not narrated as an ordinary foul', () => {
    expect(say({ kind: 'penaltyGiven', team: HOME })).not.toBe(say({ kind: 'foulGiven', team: HOME }));
  });

  it('[Right] and says whose it is', () => {
    expect(say({ kind: 'penaltyGiven', team: HOME }, HOME)).not.toBe(
      say({ kind: 'penaltyGiven', team: AWAY }, HOME),
    );
  });

  // ⚠️ IT STOPS EVERYTHING, so it earns the interruption a throw-in does not.
  it('[Right] it interrupts, like a goal does', () => {
    expect(URGENT.has('penaltyGiven')).toBe(true);
  });
});

describe('a card', () => {
  it('[Interface] a booking and a sending-off are events of their own', () => {
    expect(EVENTS).toContain('bookingGiven');
    expect(EVENTS).toContain('sendingOff');
  });

  it('[Right] they are not narrated the same, because one of them ends his match', () => {
    expect(say({ kind: 'bookingGiven', team: HOME })).not.toBe(say({ kind: 'sendingOff', team: HOME }));
  });

  it('[Right] and each says which side it was against', () => {
    expect(say({ kind: 'sendingOff', team: HOME }, HOME)).not.toBe(
      say({ kind: 'sendingOff', team: AWAY }, HOME),
    );
  });

  // ⚠️ A PLAYER LEAVING THE PITCH IS THE BIGGEST THING THAT CAN HAPPEN SHORT OF A GOAL - one side plays
  //    the rest of the match a man down. A child who missed it plays the rest of it not knowing why the
  //    shape changed.
  it('[Right] a sending-off interrupts and a booking does not', () => {
    expect(URGENT.has('sendingOff')).toBe(true);
    expect(URGENT.has('bookingGiven')).toBe(false);
  });

  it('[Interface] and they reach the announcement channel like any other event', () => {
    const spoken = announce({ kind: 'sendingOff', team: AWAY }, { period: 1, us: HOME, t: (k) => k });

    expect(spoken.kind).toBe('event');
    expect(spoken.urgent).toBe(true);
    expect(spoken.name.text.length).toBeGreaterThan(0);
  });
});
