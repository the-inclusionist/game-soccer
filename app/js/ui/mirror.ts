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
import { STEPS } from '../input/charge.ts';
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

/**
 * Who a press of switch would hand this seat, or nothing when there is nobody to give.
 *
 * ⚠️ THE MARK IS THE ONE CHANNEL A BLIND CHILD CANNOT HAVE, so this sentence is not a convenience
 * beside the picture - it is the whole feature for her. She is who the hinted switch was built for twice
 * over: once because it takes a reaction-time demand out of the control, and once because without a
 * number she has no way at all of knowing who the press would give her.
 *
 * ⚠️ AND IT READS `state.hinted` RATHER THAN WORKING IT OUT. The renderer draws that body and `play`
 * hands her that body; a third derivation here would be a third answer, and the day any two disagreed the
 * child with the fewest ways to check would be the one told the wrong number.
 *
 * ⚠️ NOTHING TO SAY IS SAID WITH NOTHING, as everywhere else in this module. "Switch to nobody" is a
 * sentence a reader announces and she listens to, and it was never information.
 */
export function hintLine(state: MatchState, seat: number, t: Translate): string {
  const who = state.hinted[seat] ?? -1;
  if (who < 0 || !onPitch(state, who)) return '';
  return t('hud.switch.to', { shirt: shirtOf(who) });
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

/**
 * How far the shot she is holding has charged, as a countable sentence - or nothing when she is not.
 *
 * ⚠️ A BAR DOES NOT SERVE A CHILD WHO CANNOT SEE ONE, which the plan says in as many words: the power
 * is countable - "three of five" - because a child counts five, and five of five is a thing she can
 * decide to wait for. A percentage is a number she has to convert.
 *
 * ⚠️ AND THE ONE MODE THAT NEEDED IT WAS THE ONE WITHOUT IT. The step was built as a `powerStep` from 1
 * to 5, gated hard, offered in three routes, and shown to nobody: the only strength on the screen was in
 * the TURN panel, which is the mode where she is not holding a key down at all. In real time she held the
 * key, received no bar, no count and no tone, and let go blind.
 */
export function chargeLine(step: number, t: Translate): string {
  if (step <= 0) return '';
  return t('hud.charge', { have: step, need: STEPS });
}

/**
 * Milliseconds of dropped time past which the page says the machine is losing it. Two seconds.
 *
 * ⚠️ ONE DROPPED FRAME IS A HICCUP EVERY DEVICE HAS, and a line that appeared for it would be a line
 * nobody reads by the second minute. Two seconds of wall time thrown away is a machine that is not
 * keeping up, which is a different thing and worth saying once.
 */
export const LAGGING_AT_MS = 2000;

/**
 * A sentence for when the machine cannot keep up, or nothing when it can.
 *
 * ⚠️ `drivers/driver` COUNTED THIS AND ITS OWN HEADER SAID IT WAS SURFACED. It clamps how many ticks
 * one frame may run and adds the thrown-away wall time to `droppedMs`, and the file says the number
 * "exists and is surfaced rather than swallowed" - and nothing read it. A module making a false claim
 * about itself is worse than a silent one, because the next reader believes it.
 *
 * ⚠️ AND PILLAR 1 IS WHY IT MATTERS. The hardware this game is FOR is a school tablet, which is exactly
 * where a frame runs long and time is dropped. A child who cannot see the screen has no way to tell a
 * stutter from a lull, and one who can has no way to tell it from her own mistake: saying so is the
 * difference between "the machine is struggling" and "I pressed the wrong thing".
 */
export function laggingLine(droppedMs: number, t: Translate): string {
  return droppedMs < LAGGING_AT_MS ? '' : t('hud.lagging');
}
