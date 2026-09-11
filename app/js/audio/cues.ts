// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT A MATCH SOUNDS LIKE. The table and the mapping, with no speaker anywhere near them.
//
// ========================= SOUND IS INFORMATION HERE, NOT DECORATION =========================
// A child who cannot see the screen learns the state of the match through three channels: the sentence
// the screen reader says, the sonar she asks for, and this. The sentence arrives after the event and
// takes a second to read; this arrives ON the tick. It is what tells her to react before she is told
// what happened - which is the difference between playing football and being narrated at.
//
// ⚠️ SCORING AND CONCEDING MUST NOT SOUND ALIKE. It is the one thing at this layer that cannot be got
// wrong: a room reacts to a goal instantly, and a child whose only signal is a beep identical in both
// directions is the last person in the room to know which way it went.
//
// ⚠️ AND EVERY ROW CARRIES A CAPTION KEY, which is the deaf half of the same feature. The engine's
// `sfx()` shows the caption BEFORE it checks whether sound is on - so a caption reaches a child with the
// speakers dead, and a row with no `cap` is a sound that exists only for children who can hear it.
//
// ========================= WHY THIS FILE IS PURE =========================
// Nothing here opens an `AudioContext`, and that is what makes the decisions measurable: the browser
// project cannot hear, so a gate written over there could only ever assert that a function was CALLED.
// The meaning lives in the node project; `sound.ts` is the thirty lines that turn a row into a tone.

import type { TeamId } from '../sim/ids.ts';
import type { RuleEvent } from '../rules/events.ts';

/**
 * One earcon, in the shape the engine's `createAudioEarcons` reads.
 *
 * ⚠️ THE SHAPE IS COPIED BECAUSE THE ENGINE DOES NOT EXPORT IT - `SfxDef` is declared inside
 * `platform/audio-earcons.d.ts` and never surfaced. Written here rather than imported through a deep
 * path, and named so the next reader knows it is a mirror rather than an invention.
 */
export interface CueDef {
  /** The waveform. One oscillator, one shape - the engine's earcon has no envelope to shape. */
  readonly t: OscillatorType;
  /** Hertz. */
  readonly f: number;
  /** Seconds. */
  readonly d: number;
  /**
   * Hertz. The frequency the note ARRIVES at, or absent for a flat one.
   *
   * ⚠️ IT IS THE FINDING THIS GAME FILED, PAID. The note below used to say pitch was the only contrast
   * available because the engine's earcon was one oscillator at one frequency - and
   * `platform/audio-earcons` now takes `f2` with an exponential ramp, crediting this game by name while
   * doing it. The ramp is exponential because pitch is perceived as a RATIO and not as a difference.
   */
  readonly f2?: number;
  /** The dictionary KEY of the caption, never the caption. The table would freeze at the boot language. */
  readonly cap: string;
}

export type CueName =
  | 'goalFor'
  | 'goalAgainst'
  | 'outOfPlay'
  | 'offside'
  | 'foul'
  | 'penalty'
  | 'booking'
  | 'sendingOff'
  | 'halfTime'
  | 'fullTime'
  | 'restart'
  | 'chargeStep'
  | 'heldKick';

/**
 * The seven sounds a match makes.
 *
 * ⚠️ THIS TABLE USED TO SAY PITCH WAS THE ONLY CONTRAST AVAILABLE, and the sentence is kept because the
 * correction is the useful half. It said the engine's earcon is one oscillator held at one frequency, so
 * "a goal goes up and a concession goes down" could not be written at this layer, and filed that as a
 * finding the engine was owed.
 *
 * ⚠️ THE ENGINE PAID IT AND NAMED THIS GAME WHILE DOING SO. `platform/audio-earcons` takes `f2` now, and
 * its own doc gives the reason in our words: «marcar e sofrer golo têm de ser distinguíveis só de ouvido -
 * uma criança cega ouve a sala reagir e precisa de saber para que lado antes de a narração chegar». The
 * capability arrived on 2026-09-11 with engine 8.0 and sat unclaimed until this line: the cues were still
 * flat notes, gated, and passing.
 *
 * So the two goals MOVE now, in opposite directions, and it is the design both files stated before it was
 * possible rather than a new choice. Everything else in the table stays a flat note on purpose - a ramp
 * is information, and putting one on a throw-in would spend it on nothing.
 */
export const CUES: Readonly<Record<CueName, CueDef>> = Object.freeze({
  // ⚠️ THE STAIRCASE, AND THE ONLY CUE HERE THAT IS NOT ABOUT THE MATCH. It sounds once each time the
  //    power she is holding goes up a step, so "wait for five" is something she can do by ear instead of
  //    by watching a bar - which is the whole reason the plan asked for a countable power rather than a
  //    continuous one. Short and quiet-sounding on purpose: it fires up to five times in a second and a
  //    half, and anything with weight to it would become a siren.
  //    ⚠️ AND 0.06 IS THE FLOOR THIS FILE ALREADY HAD, not a number I chose. It was written at 0.05 and
  //    `tests/cues` refused it: a tone of fifty milliseconds or less is not reliably heard, so an earcon
  //    that short is not an earcon. The gate was right and the cue moved.
  chargeStep: { t: 'sine', f: 700, d: 0.06, cap: 'cue.chargeStep' },
  // ⚠️ A MOMENT SHE DID NOT DIRECTLY CAUSE, WHICH IS WHY IT OWES A SOUND AND A CAPTION. The kick was
  //    hers, but the instant was the world's - she pressed half a second ago and the ball arrived now.
  //    An action with no explanation is worse than a dropped one: a dropped press teaches her to press
  //    later, and an unexplained kick teaches her the game does things on its own.
  // ⚠️ AND IT RISES, which engine 8.0 made possible and this table could not say before. A short
  //    figure going UP is "something you asked for has happened", and it is deliberately unlike the
  //    charge staircase above it, which is one flat note repeated.
  heldKick: { t: 'triangle', f: 520, f2: 780, d: 0.12, cap: 'cue.heldKick' },
  // Ours: the highest and the longest thing in the match. Nothing else is allowed to be mistaken for it.
  // ⚠️ UP A FIFTH, AND THE INTERVAL IS THE POINT RATHER THAN THE ENDPOINTS. 880 to 1320 is 1.5, which is
  //    heard as a rise by anybody; a ramp of a few hertz would be a flat note with extra arithmetic.
  goalFor: { t: 'triangle', f: 880, d: 0.55, f2: 1320, cap: 'cue.goalFor' },
  // Theirs: low, and shorter. Not a sad noise - a different one. ADR-0049 has no room for a game that
  // punishes a child with its own soundtrack.
  // ⚠️ AND DOWN A FIFTH, the same interval in the other direction: 262 to 175. The two are the same
  //    gesture mirrored, which is what makes them one thing a child learns instead of two.
  goalAgainst: { t: 'triangle', f: 262, d: 0.45, f2: 175, cap: 'cue.goalAgainst' },
  // Play stopped. Which restart it is arrives in the sentence; three near-identical beeps would only make
  // that sentence harder to hear.
  outOfPlay: { t: 'sine', f: 440, d: 0.12, cap: 'cue.outOfPlay' },
  // A decision GIVEN, and the square wave is deliberate: a referee's call should not sound like the ball.
  offside: { t: 'square', f: 622, d: 0.3, cap: 'cue.offside' },
  // The referee's whistle. Square, like the offside call, because a DECISION should not sound like the
  // ball - but lower and shorter than offside, which is the rarer and stranger of the two.
  foul: { t: 'square', f: 466, d: 0.22, cap: 'cue.foul' },
  // ⚠️ THE LONGEST CALL IN THE MATCH, and deliberately so. A penalty stops everything, and a child who
  //    cannot see the referee point at the spot has to be told that something bigger than a free kick
  //    just happened, before the sentence arrives to say what.
  penalty: { t: 'square', f: 349, d: 0.7, cap: 'cue.penalty' },
  // A card is SHOWN, not blown - so it is not a whistle. A short flat tone for a booking, and for a
  // sending-off the same tone twice as long and lower: the same family, unmistakably worse.
  booking: { t: 'sawtooth', f: 415, d: 0.18, cap: 'cue.booking' },
  sendingOff: { t: 'sawtooth', f: 233, d: 0.75, cap: 'cue.sendingOff' },
  halfTime: { t: 'square', f: 740, d: 0.4, cap: 'cue.halfTime' },
  fullTime: { t: 'square', f: 494, d: 0.8, cap: 'cue.fullTime' },
  // Play is live again. Short, because it happens often - and present, because a child who cannot see the
  // ball being placed has no other way to know the match has restarted.
  restart: { t: 'sine', f: 587, d: 0.1, cap: 'cue.restart' },
});

/**
 * The cue one event earns, told from the seat `us` is sitting in.
 *
 * ⚠️ `us` IS A PARAMETER AND NOT `HOME`. "The home side scored" is a fact about the match; "you scored"
 * is the fact she needs, and hard-coding which column is hers would be right until somebody took the
 * away seat - which the second seat and the practice profile both already can.
 *
 * ⚠️ AND THE SWITCH IS EXHAUSTIVE ON PURPOSE. Adding a row to `EVENTS` without deciding what it sounds
 * like stops the typecheck here, instead of shipping an event that is silent because nobody thought about
 * it. Silence has to be CHOSEN.
 */
export function cueFor(event: RuleEvent, us: TeamId): CueName | null {
  switch (event.kind) {
    case 'goalScored':
      // A goal whose team is unknown is not guessed at. Celebrating the wrong way is worse than silence.
      if (event.team === undefined) return null;
      return event.team === us ? 'goalFor' : 'goalAgainst';

    case 'crossedTouchline':
    case 'crossedGoalLineByAttacker':
    case 'crossedGoalLineByDefender':
      return 'outOfPlay';

    case 'offsideGiven':
      return 'offside';

    case 'foulGiven':
      return 'foul';

    case 'penaltyGiven':
      return 'penalty';

    case 'bookingGiven':
      return 'booking';

    case 'sendingOff':
      return 'sendingOff';

    case 'periodExpired':
      return 'halfTime';

    case 'secondPeriodExpired':
      return 'fullTime';

    case 'restartTaken':
      return 'restart';

    // `start` opens a match that has not begun and `ballMoved` fires on the first touch of every kickoff.
    // Both are already carried by the whistle beside them; sounding them would be two noises for one fact.
    case 'start':
    case 'ballMoved':
      return null;
  }
}
