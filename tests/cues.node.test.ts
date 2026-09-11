// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT A MATCH SOUNDS LIKE, decided WITHOUT a speaker.
//
// ========================= WHY THE TABLE IS PURE AND THE PLAYING IS NOT =========================
// Deciding "a goal against us is a different sound from a goal for us" needs no `AudioContext`, and a
// decision that can only be exercised through Web Audio is a decision nobody exercises: the browser
// project cannot hear, so an assertion there could only ever check that a function was CALLED. Splitting
// the table off means the part that carries the meaning is measured, and the part that opens an
// oscillator is thirty lines with nothing to get wrong.
//
// ⚠️ AND THE ASSERTION THAT MATTERS IS "THEY SOUND DIFFERENT", NOT "THEY ARE NAMED DIFFERENTLY". A child
// who cannot see the screen learns the match through these tones. Two cues with distinct names and
// identical waveforms are one cue with two spellings, and every name-based test in the world stays green.
import { describe, expect, it } from 'vitest';
import { CUES, cueFor, type CueName } from '../app/js/audio/cues.ts';
import { EVENTS, type PhaseEvent } from '../app/js/rules/phase.ts';
import { AWAY, HOME } from '../app/js/sim/ids.ts';
import { DICTS } from '../app/js/i18n/index.ts';
import type { RuleEvent } from '../app/js/rules/events.ts';

const ev = (kind: PhaseEvent, team?: 0 | 1): RuleEvent => ({ kind, ...(team === undefined ? {} : { team }) });

describe('which cue an event earns', () => {
  // ⚠️ THE ONE THAT CANNOT BE GOT WRONG. A blind child hears the crowd noise of the room, not the screen;
  //    if scoring and conceding make the same noise she has no way at all to know which happened, and the
  //    narration that follows arrives a beat later into a room that has already reacted.
  it('[Right] scoring and conceding are not the same sound', () => {
    const scored = cueFor(ev('goalScored', HOME), HOME);
    const conceded = cueFor(ev('goalScored', AWAY), HOME);

    expect(scored).not.toBe(conceded);
    expect(scored).not.toBeNull();
    expect(conceded).not.toBeNull();
  });

  it('[Right] and it is told from the seat, so the away seat hears its own goal as its own', () => {
    expect(cueFor(ev('goalScored', AWAY), AWAY)).toBe(cueFor(ev('goalScored', HOME), HOME));
  });

  it('[Right] offside is its own cue and not folded into the ball going out', () => {
    expect(cueFor(ev('offsideGiven', HOME), HOME)).not.toBe(cueFor(ev('crossedTouchline', HOME), HOME));
  });

  // A throw-in, a corner and a goal kick are one fact to the ear: play stopped. Which restart it is comes
  // in the sentence that follows, and three near-identical beeps would only make the sentence harder to
  // hear.
  it('[Boundary] the three ways out of play share one cue', () => {
    const out = cueFor(ev('crossedTouchline', HOME), HOME);

    expect(cueFor(ev('crossedGoalLineByAttacker', HOME), HOME)).toBe(out);
    expect(cueFor(ev('crossedGoalLineByDefender', HOME), HOME)).toBe(out);
  });

  it('[Right] half time and full time do not sound alike - one of them ends the match', () => {
    expect(cueFor(ev('periodExpired'), HOME)).not.toBe(cueFor(ev('secondPeriodExpired'), HOME));
  });

  it('[Zero] an event this game does not sound returns null rather than a default beep', () => {
    expect(cueFor(ev('ballMoved'), HOME)).toBeNull();
    expect(cueFor(ev('start'), HOME)).toBeNull();
  });

  it('[Zero] a goal with no team named is silent rather than guessing whose it was', () => {
    expect(cueFor(ev('goalScored'), HOME)).toBeNull();
  });

  it('[Interface] every event the referee can raise has an answer here, sound or silence', () => {
    for (const kind of EVENTS) {
      expect(() => cueFor(ev(kind, HOME), HOME), kind).not.toThrow();
    }
  });
});

describe('the cue table', () => {
  const named = new Set<CueName>();
  for (const kind of EVENTS) {
    for (const team of [HOME, AWAY] as const) {
      const cue = cueFor(ev(kind, team), HOME);
      if (cue !== null) named.add(cue);
    }
  }

  it('[Interface] every cue a match can produce has a row', () => {
    for (const cue of named) expect(Object.keys(CUES), cue).toContain(cue);
  });

  // ⚠️ THE DEAF CHILD'S HALF OF THIS FEATURE, and the engine already built it: `sfx()` shows the caption
  //    BEFORE it checks whether sound is on, so a caption reaches a child with the speakers dead. A row
  //    without `cap` is a sound that only exists for children who can hear it.
  it('[Interface] every row carries a caption key, because a sound with no caption is a sound with an audience', () => {
    for (const [name, def] of Object.entries(CUES)) {
      expect(def.cap, name).toBeTruthy();
    }
  });

  it('[Interface] and every caption key is a word in the dictionaries, not a key on the screen', () => {
    for (const [name, def] of Object.entries(CUES)) {
      expect(Object.keys(DICTS.en), `${name} -> ${def.cap}`).toContain(def.cap);
    }
  });

  // Two rows with the same waveform are one row. This is the gate that a copy-pasted table fails.
  // ========================= ⚠️ A GOAL RISES AND A CONCESSION FALLS =========================
  // This table said, for months, that pitch was the only contrast available: "the engine's earcon is ONE
  // oscillator held at ONE frequency, so 'a goal goes up and a concession goes down' cannot be written at
  // this layer", and filed it as a finding the engine was owed.
  //
  // ⚠️ THE ENGINE PAID IT, AND NAMED THIS GAME WHILE DOING SO. `platform/audio-earcons` now takes `f2`, a
  // final frequency with an exponential ramp, and its own doc says why: «Medido ao construir o
  // `game-soccer`: marcar e sofrer golo têm de ser distinguíveis só de ouvido - uma criança cega ouve a
  // sala reagir e precisa de saber para que lado antes de a narração chegar.» The capability arrived and
  // nobody claimed it.
  //
  // ⚠️ AND THE DIRECTION IS NOT A CHOICE MADE HERE. It is the design both files already stated before it
  // was possible: up for hers, down for theirs. What this gate adds is that it cannot silently go back to
  // a flat note - which is exactly what it was, gated, and passing.
  it('[Right] the goal cues MOVE, and they move in opposite directions', () => {
    const ours = CUES.goalFor;
    const theirs = CUES.goalAgainst;

    expect(ours.f2, 'her goal is a flat note again').not.toBeUndefined();
    expect(theirs.f2, 'conceding is a flat note again').not.toBeUndefined();
    expect(ours.f2!, 'her goal does not rise').toBeGreaterThan(ours.f);
    expect(theirs.f2!, 'conceding does not fall').toBeLessThan(theirs.f);
  });

  // ⚠️ AND A RAMP HAS TO BE AUDIBLE AS A RAMP. A ramp of a few hertz is a flat note with extra arithmetic:
  //    pitch is perceived as a RATIO, which is why the engine's ramp is exponential, so the claim is a
  //    ratio too. A musical fourth is about 1.33 and is the smallest interval nobody argues about.
  it('[Boundary] and the ramp is wide enough to hear, which a few hertz would not be', () => {
    for (const name of ['goalFor', 'goalAgainst'] as const) {
      const c = CUES[name];
      const ratio = c.f2! > c.f ? c.f2! / c.f : c.f / c.f2!;
      expect(ratio, `${name} ramps by too little to hear`).toBeGreaterThanOrEqual(1.33);
    }
  });

  it('[Right] no two cues are the same tone, or a child hearing them cannot tell them apart', () => {
    const heard = new Set<string>();
    for (const [name, def] of Object.entries(CUES)) {
      const fingerprint = `${def.t}/${def.f}/${def.d}`;
      expect(heard.has(fingerprint), `${name} sounds exactly like another cue`).toBe(false);
      heard.add(fingerprint);
    }
  });

  it('[Boundary] every tone is audible and none of them is a drone', () => {
    for (const [name, def] of Object.entries(CUES)) {
      expect(def.f, name).toBeGreaterThan(100);
      expect(def.f, name).toBeLessThan(4000);
      expect(def.d, name).toBeGreaterThan(0.05);
      expect(def.d, name).toBeLessThan(1.2);
    }
  });

  // ⚠️ PITCH IS THE ONLY THING SEPARATING THEM, because the engine's earcon is ONE oscillator at ONE
  //    frequency - there is no rising figure to be had. Written down because the obvious fix ("make the
  //    goal go up") is not available at this layer, and the next reader will look for it.
  it('[Right] conceding is lower than scoring, which is the only contrast one tone can carry', () => {
    expect(CUES.goalAgainst.f).toBeLessThan(CUES.goalFor.f);
  });
});
