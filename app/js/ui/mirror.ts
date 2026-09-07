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
