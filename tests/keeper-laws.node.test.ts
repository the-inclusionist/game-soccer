// SPDX-License-Identifier: AGPL-3.0-or-later
// A KEEPER'S HANDS ARE A PRIVILEGE WITH A BOUNDARY, AND THE BOUNDARY IS DRAWN ON THE GRASS.
//
// ========================= WHAT THE KEEPER'S HANDS ACTUALLY ARE HERE =========================
// One number. An outfielder controls the ball inside `CONTROL_R`; the keeper reaches `KEEPER_REACH`, and
// everything between the two is the parry in `sim/save`. That gap IS his hands, and until this file it
// went with him everywhere on the pitch: a keeper who had come out to the halfway line still palmed shots
// away, because the loop asked only whether he was ON the pitch.
//
// ⚠️ AND IT WAS INVISIBLE BECAUSE `ai/brain` KEEPS HIM HOME. `KEEPER_RANGE` is eight metres, so he rarely
// stands where the law would bite and nothing in the counts could see it. A rule that is only obeyed
// because nobody tests it is not a rule - and a child driving a keeper CAN walk him out, which is the one
// case the AI never produces.
//
// ⚠️ THE LINE IS PART OF THE AREA, which is football's own answer and the same class of boundary as
// offside's `>` against `>=`. It gets its own gate for the same reason that one does.
import { describe, expect, it } from 'vitest';
import { createMatchState } from '../app/js/sim/state.ts';
import { MATCH_PROFILE } from '../app/js/rules/profile.ts';
import { AWAY, HOME, SQUAD_SIZE, firstOf } from '../app/js/sim/ids.ts';
import { NOBODY } from '../app/js/sim/possession.ts';
import { keeperSave } from '../app/js/sim/save.ts';
import { BALL, BOX, PITCH } from '../app/js/sim/units.ts';

/**
 * A shot the away keeper can only get a hand to, with him and the ball `outBy` metres beyond his area.
 *
 * Away defends the far line in the first period, so his area runs from `PITCH.length - BOX.depth` to the
 * goal line. `outBy` of zero puts the ball exactly on the line.
 */
function reachingOut(outBy: number) {
  const s = createMatchState(MATCH_PROFILE);
  s.phase = 'live';
  for (let k = 0; k < SQUAD_SIZE; k++) {
    s.players[firstOf(HOME) + k].p = { x: 10, y: 50 };
    s.players[firstOf(AWAY) + k].p = { x: 10, y: 4 };
  }
  const keeper = firstOf(AWAY);
  const edge = PITCH.length - BOX.depth;
  s.players[keeper].p = { x: edge - outBy, y: PITCH.width / 2 };
  s.ball.p = { x: edge - outBy, y: PITCH.width / 2 + 1.5, z: 0 };
  s.ball.v = { x: 26, y: 0, z: 0 };
  s.ball.grounded = true;
  s.possession.holder = NOBODY;
  s.possession.lastTouch = firstOf(HOME) + 9;
  return { s, keeper };
}

/** He parried it: `sim/save`'s own signature is that he becomes the last man to touch it. */
const parried = (s: ReturnType<typeof reachingOut>['s'], keeper: number): boolean =>
  s.possession.lastTouch === keeper;

describe('hands only inside his own area', () => {
  it('[Right] inside it he gets a hand to the ball, as he always has', () => {
    const { s, keeper } = reachingOut(-1);

    keeperSave(s);

    expect(parried(s, keeper), 'the keeper stopped saving inside his own area').toBe(true);
  });

  it('[Right] and a metre outside it he is an ordinary body, and the ball runs on', () => {
    const { s, keeper } = reachingOut(1);
    const was = { x: s.ball.v.x, y: s.ball.v.y };

    keeperSave(s);

    expect(parried(s, keeper), 'he palmed a ball away outside his own area').toBe(false);
    expect(s.ball.v.x, 'the ball was deflected by a keeper with no hands there').toBe(was.x);
    expect(s.ball.v.y, 'the ball was deflected by a keeper with no hands there').toBe(was.y);
  });

  // ⚠️ [Boundary] THE LINE IS PART OF THE AREA. Football's answer, and the mutation that proves this gate
  //    is a strict comparison away - the same one the offside line already carries a gate for.
  it('[Boundary] exactly on the line he may still handle it', () => {
    const { s, keeper } = reachingOut(0);

    keeperSave(s);

    expect(parried(s, keeper), 'the area line was treated as outside the area').toBe(true);
  });

  // ⚠️ [Boundary] AND THE SIDES OF THE AREA COUNT TOO, which a test on `x` alone cannot see. A keeper
  //    level with his own goal but out by the touchline is OUTSIDE his area, and a check on distance from
  //    the goal would call it inside - the same rectangle-not-a-radius mistake `rules/foul` records.
  it('[Boundary] and wide of the area is outside it, however near the goal line', () => {
    const { s, keeper } = reachingOut(-3);
    const wide = PITCH.width / 2 + BOX.width / 2 + 1;
    s.players[keeper].p = { x: s.players[keeper].p.x, y: wide };
    s.ball.p = { x: s.ball.p.x, y: wide + 1.5, z: 0 };

    keeperSave(s);

    expect(parried(s, keeper), 'he handled it out by the touchline').toBe(false);
  });

  // ⚠️ [Boundary] AND A BALL STRADDLING HIS OWN GOAL LINE IS STILL PARTLY IN HIS AREA. This is the gate
  //    that cost the most to learn. The first version of the law tested the ball's CENTRE, and measured
  //    over the twelve-fixture slate it refused NINETY-SEVEN legal parries and took the corners from 3.00
  //    a match to 0.42. Every one of the refusals was a ball a few centimetres over the line and still in
  //    play - `rules/out-of-play` requires it to have WHOLLY crossed - so it was partly inside the area
  //    and football lets him handle it. `sim/units` says the sentence beside the radius: a point test
  //    moves every line by one radius. Here it moved a law.
  it('[Boundary] a ball part-way over his own goal line is still his to handle', () => {
    const { s, keeper } = reachingOut(-BOX.depth + 1);
    // Centre a HAIR past the line, so the ball has not wholly crossed and play goes on.
    s.ball.p = { x: PITCH.length + BALL.radius / 2, y: PITCH.width / 2 + 1.5, z: 0 };

    keeperSave(s);

    expect(s.possession.lastTouch, 'a ball still in play was ruled outside his area').toBe(keeper);
  });

  // ⚠️ AND THE ENDS SWAP AT HALF TIME, so the law is a fact about the PERIOD. A comparison written for one
  //    half is right for forty-five minutes and silently inverted for the other forty-five, which is the
  //    defect `sim/ends` exists to prevent and which no gate playing a single half can see.
  it('[Boundary] and it is his area in the second half too, at the other end', () => {
    const { s, keeper } = reachingOut(-1);
    s.period = 2;
    // Away now defends x = 0, so where he was standing is the far end of the pitch: not his area at all.

    keeperSave(s);

    expect(parried(s, keeper), 'the law did not swap ends at half time').toBe(false);
  });
});
