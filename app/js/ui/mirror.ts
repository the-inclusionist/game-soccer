// SPDX-License-Identifier: AGPL-3.0-or-later
// THE STATE OF THE MATCH AS TEXT, FOR THE CHILD WHO IS NOT LOOKING AT IT.
//
// ========================= PILLAR 2: THE TEXT IS IN THE DOM, NOT ON THE CANVAS =========================
// The shell carries five mirror lines - the fixture, the score, the clock, the phase and whose ball it is
// - and they were enough to follow a match without seeing it. They were not enough to PLAY one.
//
// ⚠️ WHICH OF THE ELEVEN SHE IS DRIVING LIVED ONLY IN PIXELS. It is a five-pixel wedge over a head, and
// that is a fine answer for a child who can see the head. Every other fact this mirror publishes has a
// second route to her - the score is also an earcon, the phase is also narrated - and this one had none.
// So `hud.ball.with` could say her club had the ball while she had no way of learning that it was at her
// own feet, which is the difference between following football and playing it.
//
// ⚠️ AND THE SENTENCE IS DECIDED HERE, IN A PURE MODULE. `tests/mirror` measures what it SAYS; a browser
// test could only ever measure that something was called. The wire into the page is gated separately, in
// `tests/mirror.browser`, because this repository has found eight modules that were right, gated, and
// connected to nothing.
import { isKeeper, shirtOf, type PlayerId } from '../sim/ids.ts';
import { onPitch } from '../sim/squads.ts';
import type { MatchState } from '../sim/state.ts';
import { PACE_M } from '../sim/units.ts';
import type { Vec2 } from '../sim/vec.ts';

/** Resolves a dictionary key. The same shape the engine's `t` has, so the caller passes its own. */
type Translate = (key: string, params?: Record<string, string | number>) => string;

/**
 * The one line that says which player this seat is driving.
 *
 * ⚠️ FOUR SENTENCES AND NOT TWO CLAUSES JOINED. "You are number 7" plus ", and you have the ball" reads
 * as one sentence in English and as a broken one in the languages where the verb moves - and pillar 3 is
 * not satisfied by a string that was translated in halves. Each case is a whole sentence a translator can
 * see the whole of.
 *
 * ⚠️ AND A SENT-OFF PLAYER IS REPORTED GONE RATHER THAN NAMED. `onPitch` is the single function that
 * answers "is he playing", so the mirror inherits red cards the same way the AI, the offside line and the
 * renderer do: without knowing that cards exist.
 */
export function youLine(state: MatchState, who: PlayerId, t: Translate): string {
  if (!onPitch(state, who)) return t('hud.you.sentOff');

  const shirt = { shirt: shirtOf(who) };
  const mine = state.possession.holder === who;
  if (isKeeper(who)) return t(mine ? 'hud.you.keeperBall' : 'hud.you.keeper', shirt);
  return t(mine ? 'hud.you.shirtBall' : 'hud.you.shirt', shirt);
}

/** A place on the pitch. The engine's `Spot` shape, restated so this module imports no engine at all. */
interface Spot {
  readonly x: number;
  readonly y: number;
}

/**
 * One phrase per place the ball could go next, from the child's own point of view.
 *
 * ⚠️ THE SPOTS ARE HANDED IN, NOT WORKED OUT. `declaration.targetsOf` already answers "where can I put
 * it next" - at most four places, each actionable this instant, never the ten team-mates that would make
 * the sonar beep ten times and say nothing. Deciding that a second time here would be one fact living in
 * two files, and the copy nobody is watching is the one that goes wrong.
 *
 * ⚠️ AND THIS IS THE SONAR FOR A CHILD WHO CANNOT USE THE SONAR. Spatial audio needs ears; a deaf-blind
 * child on a braille display has the DOM and nothing else, and the most useful thing this game knows was
 * reaching her through no channel at all.
 *
 * ⚠️ AND THEY ARE NOT ALL PASSES. `targetsOf` answers whichever question the state is asking - the
 * loose ball to chase, the space to run into, or the receivers to choose between - so nothing here calls
 * them passes, and the list's own label must not either. The first label did, and a match watched on
 * screen showed it captioning a LOOSE ball as somewhere to pass to.
 *
 * ⚠️ HER LEFT, NOT THE SCREEN'S. Ends swap at half time, so a spot at a fixed `y` is on her left in one
 * half and her right in the other. `across` is multiplied by the attacking direction for exactly that
 * reason - it is the same rule `narration` has obeyed since it existed, and getting it backwards would
 * send a blind child the wrong way for forty-five minutes with nothing on screen looking wrong.
 */
export function spotLines(from: Vec2, targets: readonly Spot[], dir: 1 | -1, t: Translate): string[] {
  // ⚠️ EMPTY IS AN ANSWER AND NOT A SILENCE. A dead ball against us really has nothing on it, and a line
  //    that simply vanishes reads as the game having stopped telling her things.
  if (targets.length === 0) return [t('hud.spot.none')];

  return targets.map((at) => {
    const dx = at.x - from.x;
    const dy = at.y - from.y;
    const along = dx * dir;
    // Facing their goal, her left hand points at smaller `y` when she attacks +x and at larger `y` when
    // she attacks -x. One multiplication carries the whole of that.
    const across = dy * dir;

    // ⚠️ ROUNDED UP TO ONE, NEVER DOWN TO NONE. "Nought paces ahead" is not a sentence, and a spot at her
    //    feet still has to be reachable as one.
    const paces = Math.max(1, Math.round(Math.sqrt(dx * dx + dy * dy) / PACE_M));

    // ⚠️ THE BIGGER AXIS AND NOT BOTH. "Six ahead and one to your left" is two facts where one was
    //    wanted, and a child reading four of these on a braille line has to get past every extra clause
    //    to reach the next option.
    const which =
      (along < 0 ? -along : along) >= (across < 0 ? -across : across)
        ? along >= 0
          ? 'ahead'
          : 'back'
        : across < 0
          ? 'left'
          : 'right';

    // ⚠️ ONE PACE IS ITS OWN SENTENCE. "1 paces" tells a child the machine is not really speaking to her,
    //    and no dictionary can repair that from the outside.
    return paces === 1 ? t(`hud.spot.${which}One`) : t(`hud.spot.${which}`, { paces });
  });
}
