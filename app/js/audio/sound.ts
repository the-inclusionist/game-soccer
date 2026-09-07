// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SOUND OF THE MATCH, wired to the engine's mixer through injected ports.
//
// ========================= WHY THE PORTS ARE INJECTED =========================
// `platform/audio.js` reads `window` the moment it is imported, so a module that imported it directly
// would run in the browser project and nowhere else - where it still could not be HEARD. Injection puts
// the decisions (which cue, whether a caption fires, what happens on a machine with no Web Audio) in the
// project that can exercise them, and leaves the composition root to hand over the real oscillators.
//
// ⚠️ THE EARCONS COME FROM THE ENGINE, NOT FROM THIRTY LINES HERE, and the reason is the CAPTION. Writing
// `ac.createOscillator()` in this file is genuinely easy; what would be lost is the ordering the engine
// already got right - `sfx()` shows the caption BEFORE it checks whether sound is on, so a deaf child
// gets the information with the speakers dead. That ordering is the entire deaf half of this feature, and
// it is exactly the sort of thing a game reimplementing the easy part would drop without noticing.

import { createAudioEarcons } from '@the-inclusionist/engine/platform/audio-earcons.js';
import { createAudioJingles } from '@the-inclusionist/engine/platform/audio-jingles.js';
import type { TeamId } from '../sim/ids.ts';
import type { RuleEvent } from '../rules/events.ts';
import { CUES, cueFor, type CueName } from './cues.ts';

/** Everything this layer needs from outside itself. The engine supplies all of it in `boot/main.ts`. */
export interface SoundPorts {
  readonly ensureAC: () => AudioContext | null;
  readonly catNode: (cat: string) => AudioNode | null;
  readonly audioOut: () => AudioNode | null;
  readonly noiseHit: (mat: string) => void;
  readonly tone: (
    freq: number,
    dur: number,
    type?: OscillatorType,
    when?: number,
    vol?: number,
  ) => void;
  /**
   * ⚠️ FUNCTIONS, NOT VALUES. `soundOn` and `volume` are live bindings a child changes from the engine's
   * own audio menu at any moment; captured once at boot, this layer would answer with whatever was true
   * before she touched anything.
   */
  readonly soundOn: () => boolean;
  readonly volume: () => number;
  readonly captionsOn: () => boolean;
  readonly caption: (text: string) => void;
}

export interface Sound {
  /** Play one cue by name. */
  readonly play: (cue: CueName) => void;
  /** Play whatever cue this event earns, told from the seat `us` is sitting in. Silence is an answer. */
  readonly forEvent: (event: RuleEvent, us: TeamId) => void;
  /**
   * The match is over.
   *
   * ⚠️ THE SAME SOUND WHOEVER WON. ADR-0049 leaves room to celebrate GROWTH and none to celebrate beating
   * somebody, so what is marked here is that a child FINISHED A MATCH - which is true of the child who
   * lost 3-0. A jingle that fired only on a win would be teaching the opposite of the record, in the one
   * moment she is certainly listening.
   */
  readonly matchComplete: () => void;
}

export function createSound(ports: SoundPorts): Sound {
  const earcons = createAudioEarcons({
    SFX: CUES,
    ensureAC: ports.ensureAC,
    catNode: ports.catNode,
    audioOut: ports.audioOut,
    noiseHit: ports.noiseHit,
    getSoundOn: ports.soundOn,
    getVolume: ports.volume,
    getCaptionsOn: ports.captionsOn,
    showCaption: ports.caption,
  });

  const jingles = createAudioJingles({
    tone: ports.tone,
    ensureAC: ports.ensureAC,
    catNode: ports.catNode,
    audioOut: ports.audioOut,
    getSoundOn: ports.soundOn,
    getVolume: ports.volume,
  });

  const play = (cue: CueName): void => earcons.sfx(cue);

  return {
    play,
    forEvent: (event, us) => {
      const cue = cueFor(event, us);
      // Silence is a decision this game took in `cues.ts`, and it is spelled out rather than falling
      // through: `ballMoved` fires on every kickoff touch, and sounding it would be a beep the child
      // learns to ignore, which is worse than no beep at all.
      if (cue !== null) play(cue);
    },
    // ⚠️ THE SOFT ONE, NOT THE FIREWORKS. `playVictory` sets off four bursts of square-wave explosions;
    //    the engine's own note on `playPuzzleSolved` says it is the phrase that is NEVER aggressive, and
    //    a room full of children with one of them autistic is exactly the audience that note was written
    //    for. It is also the honest one here: nobody was defeated, a match was completed.
    matchComplete: () => jingles.playPuzzleSolved(),
  };
}
