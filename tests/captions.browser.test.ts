// SPDX-License-Identifier: AGPL-3.0-or-later
// THE NARRATION, FOR A CHILD WHO CANNOT HEAR IT.
//
// ========================= THE HOLE THIS FILE CLOSES =========================
// Every event of a match already produced a SENTENCE - "the ball went out for a throw-in to Campo" - and
// that sentence went to `srSay` or `srAlert`, which are live regions. A live region is read by a screen
// reader. A deaf child does not use one.
//
// So the whole narration reached a blind child and reached nobody else, while the visible caption line
// carried only the seven earcon words - "Ball out of play" where the sentence said which side had it and
// where it was taken from. Two channels, one of them carrying a tenth of the information, and the one
// that was starved is the one for the child who can SEE the screen and cannot hear a thing.
//
// ⚠️ AND IT IS NOT A SECOND ANNOUNCEMENT. `#caption` is `aria-hidden`: the screen reader already had this
// sentence through `#sr-alert`, and a second live region would say every goal twice and cut the first
// announcement in half. The caption is for eyes that cannot hear.
import { beforeEach, describe, expect, it } from 'vitest';
import { bootar } from '../app/js/boot/main.ts';
import { until } from './helpers/ticks.ts';
import { msToTicks, ticks } from './helpers/ticks.ts';
import { t } from '@the-inclusionist/engine/core/i18n.js';
import { setCaptionsOnValue, captionsOn } from '@the-inclusionist/engine/core/state.js';

const SHELL_SRC = await import('./boot.browser.test.ts?raw');
const SHELL = (() => {
  const src = SHELL_SRC.default;
  const from = src.indexOf('const SHELL = `') + 'const SHELL = `'.length;
  return src.slice(from, src.indexOf('`;', from));
})();

let booted: ReturnType<typeof bootar> = null;
const wasOn = captionsOn;

beforeEach(() => {
  booted?.stop();
  booted = null;
  setCaptionsOnValue(wasOn);
  document.body.innerHTML = SHELL;
});

/**
 * ⚠️ PATIENCE IN TICKS, NOT IN SECONDS. This was `Date.now() + 6000`, and measured under the full browser
 * project six seconds is about thirty-six ticks of football - not reliably enough for a goal to be judged,
 * narrated and written to the caption line. It passed alone and failed in the suite. `tests/helpers/ticks`
 * holds the shared version so the next file does not reinvent it, which is what happened here and in
 * `tests/stands`.
 */
const waitFor = (what: () => boolean, why: string): Promise<void> => until(booted, what, why);

const caption = (): string => document.querySelector('#caption')?.textContent ?? '';
const alerted = (): string => document.querySelector('#sr-alert')?.textContent ?? '';

/** Put the ball wholly beyond the goal line, between the posts: `judgeBall` calls that a goal. */
const scoreAGoal = (): void => {
  booted!.state.phase = 'live';
  booted!.state.ball.p = { x: 91, y: 28, z: 0 };
};

/**
 * Every distinct thing the caption line says, in order.
 *
 * ⚠️ OBSERVED RATHER THAN SAMPLED, because a caption is a value that CHANGES. A goal is followed a few
 * ticks later by the restart, and the restart's own caption legitimately replaces the goal's sentence -
 * so a poll every forty milliseconds can miss the sentence entirely and report that it never appeared.
 * The first version of the second case below "passed" by finding the restart caption and only checking it
 * was longer than twelve characters.
 */
function watchCaption(): { said: string[]; stop: () => void } {
  const host = document.querySelector('#caption') as HTMLElement;
  const said: string[] = [];
  const push = (): void => {
    const now = host.textContent ?? '';
    if (now !== '' && now !== said[said.length - 1]) said.push(now);
  };
  const observer = new MutationObserver(push);
  observer.observe(host, { childList: true, characterData: true, subtree: true });
  return { said, stop: () => observer.disconnect() };
}

describe('what a deaf child reads', () => {
  it('[Right] the whole sentence, not just the name of the sound', async () => {
    booted = bootar(document, window);
    const seen = watchCaption();
    scoreAGoal();

    await waitFor(() => alerted() !== '', 'the goal to be announced');
    const sentence = alerted();
    await waitFor(() => seen.said.includes(sentence), `the caption line to say "${sentence}"`);
    seen.stop();

    // The earcon's own caption is three words; the narration is a sentence, and it is the sentence a
    // child who cannot hear has to be given.
    expect(seen.said).toContain(sentence);
  });

  // ⚠️ "LONGER THAN THE EARCON WORD" WAS THE FIRST ASSERTION HERE AND IT WAS FALSE. A goal is narrated
  //    "Gol nosso!" - ten characters, SHORTER than its own earcon caption - and that is the narration
  //    being right: a goal is punchy, a throw-in names the side and the spot. The claim that holds for
  //    every event is not about length. It is that the two are DIFFERENT things and the sentence is the
  //    one that lands last, so a deaf child reads the narration and not the label of a sound.
  it('[Right] the sentence and the earcon word are different, and the sentence wins', async () => {
    booted = bootar(document, window);
    const seen = watchCaption();
    scoreAGoal();

    await waitFor(() => alerted() !== '', 'the goal to be announced');
    const sentence = alerted();
    await waitFor(() => seen.said.includes(sentence), 'the sentence to reach the caption line');
    seen.stop();

    // ⚠️ AND THE EARCON WORD IS NEVER SEEN AT ALL, which is worth writing down rather than asserting.
    //    Both writes happen in the SAME task - one tick of the match - so the browser paints once and a
    //    child only ever reads the last value. The earcon's caption is a FALLBACK that shows when nothing
    //    narrates, not a thing that flashes and is replaced. A `MutationObserver` cannot see the
    //    intermediate value either, and an assertion about the order between them would be an assertion
    //    about something no eye and no test can observe.
    expect(sentence, 'the narration is only the earcon label').not.toBe(t('cue.goalFor'));
    expect(seen.said[seen.said.length - 1]).toBe(sentence);
  });

  it('[Right] and the sentence is a word, never a dictionary key', async () => {
    booted = bootar(document, window);
    const seen = watchCaption();
    scoreAGoal();

    await waitFor(() => seen.said.length > 0, 'anything to be captioned');
    seen.stop();

    for (const said of seen.said) expect(said, said).not.toMatch(/^(sr|hud|cue|club|end)\./);
  });

  // ⚠️ THE SAME SWITCH THE ENGINE ALREADY OWNS. Captions are a preference a child sets in the engine's own
  //    menu; a game that honoured it for earcons and ignored it for sentences would give her a control
  //    that half works, which is worse than one that does not exist.
  it('[Zero] with captions switched off, nothing is written to the screen', async () => {
    setCaptionsOnValue(false);
    booted = bootar(document, window);
    scoreAGoal();

    await waitFor(() => alerted() !== '', 'the goal to be announced');
    await ticks(booted, msToTicks(200));

    expect(caption()).toBe('');
  });

  // ⚠️ NOT A SECOND LIVE REGION. The reader already got this through `#sr-alert`; a caption that announced
  //    itself would say every goal twice, and an assertive one would cut the first announcement in half.
  it('[Zero] and it stays invisible to a screen reader', () => {
    booted = bootar(document, window);
    const el = document.querySelector('#caption') as HTMLElement;

    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.getAttribute('aria-live')).toBeNull();
    expect(el.getAttribute('role')).toBeNull();
  });
});
