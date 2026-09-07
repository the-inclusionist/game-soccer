// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SENTENCE A CHILD RECEIVES.
//
// ========================= ENDS SWAP AT HALF TIME, SO A COMPASS IS A LIE =========================
// "Their goal is to the east" is true for forty-five minutes and false for the next forty-five. A child
// who learned it in the first half would be sent the wrong way for the whole second half, and nothing on
// screen would look wrong. Every narrated direction therefore derives from which way this side is
// attacking, never from a raw heading - and that is one function, called from one place.
//
// ========================= AND NOT EVERYTHING INTERRUPTS =========================
// An assertive live region cuts off whatever is being read. A goal earns that; a throw-in does not. A
// screen reader that announces every restart over the score is a screen reader a child turns off.
import { describe, expect, it } from 'vitest';
import { announce, narrate } from '../app/js/narration.ts';
import { AWAY, HOME } from '../app/js/sim/ids.ts';
import type { RuleEvent } from '../app/js/rules/events.ts';
import { en } from '../app/js/i18n/en.ts';

const keyEcho = (key: string, params?: Record<string, string | number>) =>
  params === undefined ? key : `${key}(${Object.values(params).join(',')})`;

const say = (event: RuleEvent, period = 1, us = HOME) =>
  narrate(event, { period, us, t: keyEcho });

describe('every event says something', () => {
  const events: RuleEvent[] = [
    { kind: 'goalScored', team: HOME },
    { kind: 'crossedTouchline', at: { x: 30, y: 0 } },
    { kind: 'crossedGoalLineByDefender', at: { x: 90, y: 4 } },
    { kind: 'crossedGoalLineByAttacker', at: { x: 90, y: 4 } },
    { kind: 'offsideGiven', team: HOME },
    { kind: 'restartTaken', team: HOME },
    { kind: 'ballMoved', team: HOME },
    { kind: 'periodExpired' },
    { kind: 'secondPeriodExpired' },
    { kind: 'start' },
  ];

  it('[Many] no event is left without a sentence', () => {
    for (const event of events) {
      expect(say(event), event.kind).not.toBe('');
    }
  });

  it('[Interface] every sentence comes from the dictionary - no raw literal reaches a child', () => {
    for (const event of events) {
      expect(say(event).startsWith('say.'), event.kind).toBe(true);
    }
  });

  // ⚠️ THE KEY THAT EXISTS IN THE CODE AND NOT IN THE DICTIONARY IS SILENT: `t()` falls back to the key,
  //    so a child would read `say.corner.ours` on screen and nothing would report an error.
  it('[Interface] every key the narration can ask for exists in the dictionary', () => {
    const asked = new Set<string>();
    const collect = (k: string) => {
      asked.add(k);
      return k;
    };
    for (const event of events) narrate(event, { period: 1, us: HOME, t: collect });
    for (const event of events) narrate(event, { period: 2, us: AWAY, t: collect });

    expect([...asked].filter((k) => !(k in en))).toEqual([]);
  });
});

describe('who it happened to', () => {
  it('[Right] our goal and their goal are different sentences, not the same one twice', () => {
    expect(say({ kind: 'goalScored', team: HOME })).not.toBe(say({ kind: 'goalScored', team: AWAY }));
  });

  it('[Right] and an offside against us reads differently from one in our favour', () => {
    expect(say({ kind: 'offsideGiven', team: HOME })).not.toBe(
      say({ kind: 'offsideGiven', team: AWAY }),
    );
  });
});

describe('the compass', () => {
  // ⚠️ THE ONE THIS FILE EXISTS FOR.
  it('[Right] the same event on the same spot swaps side when the ends swap', () => {
    const event: RuleEvent = { kind: 'crossedGoalLineByDefender', at: { x: 90, y: 4 } };

    expect(say(event, 1)).not.toBe(say(event, 2));
  });

  it('[Right] a corner at OUR end and one at THEIR end are told apart, in both periods', () => {
    const ours = { kind: 'crossedGoalLineByDefender', at: { x: 0, y: 4 } } as const;
    const theirs = { kind: 'crossedGoalLineByDefender', at: { x: 90, y: 4 } } as const;

    expect(say(ours, 1)).not.toBe(say(theirs, 1));
    expect(say(ours, 2)).not.toBe(say(theirs, 2));
  });

  it('[Interface] the two sides read the same event from opposite points of view', () => {
    const event: RuleEvent = { kind: 'goalScored', team: HOME };

    expect(say(event, 1, HOME)).not.toBe(say(event, 1, AWAY));
  });
});

describe('how loudly', () => {
  it('[Right] a goal interrupts, because it is the thing that happened', () => {
    expect(announce({ kind: 'goalScored', team: HOME }).urgent).toBe(true);
  });

  // ⚠️ AND A THROW-IN DOES NOT. A live region that cuts off the score to say "throw-in" is a live region
  //    a child turns off, and then hears nothing at all.
  it('[Zero] a throw-in does not interrupt', () => {
    expect(announce({ kind: 'crossedTouchline', at: { x: 3, y: 0 } }).urgent).toBe(false);
  });

  it('[Right] half time and full time interrupt - a child must know the match stopped', () => {
    expect(announce({ kind: 'periodExpired' }).urgent).toBe(true);
    expect(announce({ kind: 'secondPeriodExpired' }).urgent).toBe(true);
  });

  it('[Interface] an announcement carries a speakable, with agreement, not a bare string', () => {
    const a = announce({ kind: 'goalScored', team: HOME });

    expect(a.name).toHaveProperty('text');
    expect(['m', 'f', 'n']).toContain(a.name.gender);
    expect(typeof a.name.plural).toBe('boolean');
  });
});
