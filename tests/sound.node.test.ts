// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SOUND LAYER, MEASURED WITHOUT A SPEAKER.
//
// ========================= WHAT CAN AND CANNOT BE ASSERTED HERE =========================
// No test anywhere can hear a tone. What CAN be measured is everything around it: that the caption fires,
// that it fires for a child whose speakers are dead, that an event with no cue makes no noise, and that
// a machine with Web Audio switched off does not crash the match. Those four are the whole feature minus
// the oscillator, and the oscillator is the part with nothing to get wrong.
//
// ⚠️ THE PORTS ARE INJECTED SO THIS FILE RUNS IN THE `node` PROJECT. A sound layer that imported the
// engine's `platform/audio.js` directly would reach `window` at module load and be testable only in a
// browser - where it still could not be heard. Injection is what moves the meaning into the project that
// can actually exercise it.
import { describe, expect, it, vi } from 'vitest';
import { createSound, type SoundPorts } from '../app/js/audio/sound.ts';
import { AWAY, HOME } from '../app/js/sim/ids.ts';
import type { RuleEvent } from '../app/js/rules/events.ts';

function ports(over: Partial<SoundPorts> = {}) {
  const captions: string[] = [];
  const base: SoundPorts = {
    t: (key: string) => key,
    // No Web Audio at all is the DEFAULT here, because it is the honest default of a school machine with
    // audio blocked - and because a test that needed a real context would be a browser test that still
    // could not hear.
    ensureAC: () => null,
    catNode: () => null,
    audioOut: () => null,
    noiseHit: () => {},
    tone: () => {},
    soundOn: () => true,
    volume: () => 0.6,
    captionsOn: () => true,
    caption: (text: string) => captions.push(text),
    ...over,
  };
  return { ports: base, captions };
}

const ev = (kind: RuleEvent['kind'], team?: 0 | 1): RuleEvent =>
  ({ kind, ...(team === undefined ? {} : { team }) });

describe('captions', () => {
  it('[Right] a goal captions something', () => {
    const { ports: p, captions } = ports();

    createSound(p).forEvent(ev('goalScored', HOME), HOME);

    expect(captions).toHaveLength(1);
    expect(captions[0].length).toBeGreaterThan(0);
  });

  it('[Right] and conceding captions something ELSE', () => {
    const { ports: p, captions } = ports();
    const sound = createSound(p);

    sound.forEvent(ev('goalScored', HOME), HOME);
    sound.forEvent(ev('goalScored', AWAY), HOME);

    expect(captions[0]).not.toBe(captions[1]);
  });

  // ⚠️ THE ASSERTION THE WHOLE DEAF HALF OF THIS FEATURE RESTS ON. The engine's `sfx()` shows the caption
  //    BEFORE it looks at whether sound is on - so a child with the speakers off still gets the
  //    information. A wiring that forgot to pass `showCaption` would leave every other test here green.
  it('[Right] the caption reaches a child whose sound is switched off', () => {
    const { ports: p, captions } = ports({ soundOn: () => false, volume: () => 0 });

    createSound(p).forEvent(ev('goalScored', HOME), HOME);

    expect(captions).toHaveLength(1);
  });

  it('[Zero] with captions switched off nothing is written to the screen', () => {
    const { ports: p, captions } = ports({ captionsOn: () => false });

    createSound(p).forEvent(ev('goalScored', HOME), HOME);

    expect(captions).toEqual([]);
  });

  it('[Zero] an event with no cue makes no sound and writes no caption', () => {
    const { ports: p, captions } = ports();

    createSound(p).forEvent(ev('ballMoved'), HOME);

    expect(captions).toEqual([]);
  });
});

describe('a machine that cannot play sound', () => {
  // A locked-down school Chromebook, a tab that has never been clicked, a browser with Web Audio
  // disabled. Every one of those returns null from `ensureAC`, and none of them may end the match.
  it('[Interface] no audio context is a quiet game, not a broken one', () => {
    const { ports: p, captions } = ports({ ensureAC: () => null });
    const sound = createSound(p);

    expect(() => sound.forEvent(ev('goalScored', HOME), HOME)).not.toThrow();
    expect(() => sound.matchComplete()).not.toThrow();

    // ...and the caption still happened, which is the point: the child who cannot hear it anyway loses
    // nothing on a machine that cannot play it.
    expect(captions).toHaveLength(1);
  });
});

describe('the end of the match', () => {
  // ⚠️ THE JINGLE IS NOT FOR WINNING. ADR-0049 leaves room to celebrate GROWTH and none to celebrate
  //    beating somebody, so the sound that marks the end of a match is the same whoever scored more. A
  //    child who lost 3-0 finished a match, and that is the thing being marked.
  it('[Right] finishing the match sounds the same however it ended', () => {
    const won = vi.fn();
    const lost = vi.fn();

    createSound(ports({ tone: won }).ports).matchComplete();
    createSound(ports({ tone: lost }).ports).matchComplete();

    expect(won.mock.calls).toEqual(lost.mock.calls);
  });

  it('[Right] and it actually reaches the mixer rather than being a no-op', () => {
    const tone = vi.fn();

    createSound(ports({ tone }).ports).matchComplete();

    expect(tone.mock.calls.length).toBeGreaterThan(0);
  });

  // ⚠️ AND IT IS NOT CAPTIONED, which is a decision rather than an omission. The deaf equivalent of this
  //    jingle is the end panel, which is already on the screen saying who scored what - a caption reading
  //    "match over" beside it would be the same fact twice. The sound switch is not checked here either:
  //    the mixer's own `tone` is where that lives, and re-checking it would be a second copy of one rule.
  it('[Zero] finishing the match writes no caption - the end panel already says so', () => {
    const { ports: p, captions } = ports();

    createSound(p).matchComplete();

    expect(captions).toEqual([]);
  });
});
