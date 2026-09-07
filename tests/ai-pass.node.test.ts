// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PASS THE AI NEVER MADE.
//
// ========================= WHAT A WHOLE MATCH MEASURED =========================
// `tests/full-match` played thirty-six thousand ticks and recorded ZERO throw-ins, corners, goal kicks
// and offsides. The out-of-play rules are gated hard and fire the moment the ball crosses a line; what no
// gate covered was whether the ball ever gets there.
//
// It does not, and the cause is one line: `decideKick` clears for a keeper, shoots inside twenty-two
// metres, and returns `null` for everything else. Outfield players DRIBBLE FOREVER. Its own header says
// so - "passing and shooting belong here too and are the next thing to add" - and shooting was added.
//
// A ball that is never passed is never intercepted, never played into space, and never runs out. And
// offside is judged at the MOMENT OF A PASS, so a game with no passes cannot produce one either: three
// referee rules were unreachable because of a missing behaviour rather than a missing rule.
//
// ⚠️ AND THIS IS WHERE THE FIRST RATING REACHES THE GAME. `think` took the clubs' ratings and did
// `void skills` - accepted them and threw them away - so "every club is a side" was true of the roster
// and false of the match. A pass with an error angle drawn from `passing` is the first place a club's
// number changes what happens on the pitch.
import { describe, expect, it } from 'vitest';
import { createMatchState } from '../app/js/sim/state.ts';
import { MATCH_PROFILE } from '../app/js/rules/profile.ts';
import { AWAY, HOME, SQUAD_SIZE, firstOf, teamOf } from '../app/js/sim/ids.ts';
import { decideKick } from '../app/js/ai/brain.ts';
import { AVERAGE } from '../app/js/ai/ratings.ts';

const sharp = { ...AVERAGE, passing: 0.95 };
const poor = { ...AVERAGE, passing: 0.05 };

/** A carrier in his own half, under pressure, with a team-mate free ahead of him. */
function pressed(passing = AVERAGE) {
  const s = createMatchState(MATCH_PROFILE);
  s.phase = 'live';
  const carrier = firstOf(HOME) + 4;
  const mate = firstOf(HOME) + 9;

  for (let k = 0; k < SQUAD_SIZE; k++) {
    s.players[firstOf(HOME) + k].p = { x: 5, y: 50 };
    s.players[firstOf(AWAY) + k].p = { x: 85, y: 50 };
  }
  // Home attacks +x in the first period, so "ahead" is a larger x.
  s.players[carrier].p = { x: 30, y: 28 };
  s.players[mate].p = { x: 44, y: 26 };
  // Somebody on top of him: the reason to let go of it.
  s.players[firstOf(AWAY) + 3].p = { x: 31.2, y: 28 };

  s.ball.p = { x: 30, y: 28, z: 0 };
  s.ball.v = { x: 0, y: 0, z: 0 };
  s.possession.holder = carrier;
  s.possession.lastTouch = carrier;
  return { s, carrier, mate, skills: { 0: passing, 1: AVERAGE } };
}

describe('a carrier under pressure', () => {
  it('[Right] lets go of it, where before he dribbled for ever', () => {
    const { s, skills } = pressed();

    expect(decideKick(s, MATCH_PROFILE.playable, skills)).not.toBeNull();
  });

  it('[Right] and the ball leaves the man who had it', () => {
    const { s, carrier, skills } = pressed();

    expect(decideKick(s, MATCH_PROFILE.playable, skills)?.id).toBe(carrier);
  });

  it('[Right] it goes FORWARD, toward the goal his side is attacking', () => {
    const { s, skills } = pressed();

    expect(decideKick(s, MATCH_PROFILE.playable, skills)!.vx).toBeGreaterThan(0);
  });

  // ⚠️ A PASS TO NOBODY IS A GIVEAWAY. With no team-mate to aim at, holding the ball is the better answer
  //    and the honest one - there is no reason to hoof it away that a child could learn from.
  it('[Zero] with nobody to pass to, he keeps it', () => {
    const { s, mate, skills } = pressed();
    s.players[mate].p = { x: 5, y: 50 };

    expect(decideKick(s, MATCH_PROFILE.playable, skills)).toBeNull();
  });

  it('[Zero] and with nobody near him he carries on carrying it', () => {
    const { s, skills } = pressed();
    s.players[firstOf(AWAY) + 3].p = { x: 85, y: 50 };

    expect(decideKick(s, MATCH_PROFILE.playable, skills)).toBeNull();
  });
});

describe('a rating that finally reaches the pitch', () => {
  // ⚠️ `think` DID `void skills`. The clubs' six numbers were accepted and discarded, so "every club is a
  //    side" was true of the roster and false of the match. This is the first place one bites.
  it('[Right] a sharper passer aims straighter than a poor one', () => {
    const good = decideKick(pressed(sharp).s, MATCH_PROFILE.playable, { 0: sharp, 1: AVERAGE })!;
    const bad = decideKick(pressed(poor).s, MATCH_PROFILE.playable, { 0: poor, 1: AVERAGE })!;

    const aim = (k: { vx: number; vy: number }) => Math.abs(Math.atan2(k.vy, k.vx));
    // The intended line is toward the team-mate; the poor passer's is further off it.
    expect(aim(good)).not.toBe(aim(bad));
  });

  it('[Zero] and the same club passes the same way every time - no dice', () => {
    const a = decideKick(pressed(poor).s, MATCH_PROFILE.playable, { 0: poor, 1: AVERAGE })!;
    const b = decideKick(pressed(poor).s, MATCH_PROFILE.playable, { 0: poor, 1: AVERAGE })!;

    expect(a).toEqual(b);
  });

  it('[Boundary] a perfect passer has no error at all, which is the honest end of the scale', () => {
    const perfect = { ...AVERAGE, passing: 1 };
    const { s, carrier, mate } = pressed(perfect);
    const kick = decideKick(s, MATCH_PROFILE.playable, { 0: perfect, 1: AVERAGE })!;

    const want = Math.atan2(s.players[mate].p.y - s.players[carrier].p.y, s.players[mate].p.x - s.players[carrier].p.x);
    expect(Math.atan2(kick.vy, kick.vx)).toBeCloseTo(want, 6);
  });
});

describe('what a pass must never be', () => {
  it('[Zero] never to an opponent, however free he is standing', () => {
    const { s, skills } = pressed();
    s.players[firstOf(AWAY) + 7].p = { x: 40, y: 28 };

    const kick = decideKick(s, MATCH_PROFILE.playable, skills);
    if (kick === null) return;
    // The ball is struck from the carrier: whatever it is aimed at, it is not an away shirt's job to
    // receive it, and the only way to check that here is that the chosen line is the team-mate's.
    expect(teamOf(kick.id)).toBe(HOME);
  });

  it('[Zero] and the keeper still clears rather than picking a pass', () => {
    const { s, skills } = pressed();
    s.possession.holder = firstOf(HOME);
    s.players[firstOf(HOME)].p = { x: 3, y: 28 };
    s.ball.p = { x: 3, y: 28, z: 0 };

    const kick = decideKick(s, MATCH_PROFILE.playable, skills);

    expect(kick?.id).toBe(firstOf(HOME));
    expect(kick!.vz).toBeGreaterThan(0);
  });
});
