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
  | 'halfTime'
  | 'fullTime'
  | 'restart';

/**
 * The seven sounds a match makes.
 *
 * ⚠️ PITCH IS THE ONLY CONTRAST AVAILABLE, and it is worth saying why the obvious design is absent. The
 * engine's earcon is ONE oscillator held at ONE frequency for a duration; there is no rising figure to be
 * had, so "a goal goes up and a concession goes down" cannot be written at this layer. What is left is
 * high-and-long against low-and-short, and it is enough to tell apart - but a future engine earcon that
 * took a frequency RAMP would make this table better, and that is a finding the engine is owed rather
 * than a limitation of this game.
 */
export const CUES: Readonly<Record<CueName, CueDef>> = Object.freeze({
  // Ours: the highest and the longest thing in the match. Nothing else is allowed to be mistaken for it.
  goalFor: { t: 'triangle', f: 880, d: 0.55, cap: 'cue.goalFor' },
  // Theirs: low, and shorter. Not a sad noise - a different one. ADR-0049 has no room for a game that
  // punishes a child with its own soundtrack.
  goalAgainst: { t: 'triangle', f: 262, d: 0.45, cap: 'cue.goalAgainst' },
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
