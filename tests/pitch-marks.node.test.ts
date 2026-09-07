// SPDX-License-Identifier: AGPL-3.0-or-later
// THE LINES ON THE GRASS, AND THE LAW THEY ARE SUPPOSED TO BE A PICTURE OF.
//
// ========================= THE BUG THIS FILE WAS WRITTEN FOR =========================
// The renderer drew a penalty area 16.5m deep and 40.3m wide - the real laws' numbers - baked as literals
// inside `pitchTexture`. The referee gives penalties inside `BOX`, which is 14 by 32, because this pitch
// is 90 by 56 and not 105 by 68.
//
// So the painted box and the refereed box were different rectangles. A child sees a line, stands inside
// it, is fouled, and gets a free kick; or stands outside it and gets a penalty. There is no way to learn
// a rule whose picture is wrong, and nothing would ever have reported it: the drawing is correct code
// producing a correct-looking box.
//
// `units.ts` predicted this in as many words - "whether the box is painted on the grass is `render/`, and
// the two must not disagree, so the renderer reads this rather than keeping a rectangle of its own". It
// was written the same day the constant was, and the renderer was already disagreeing with it.
//
// ⚠️ SO THE MARKINGS ARE DATA, in metres, like `marker-pixels` and `crest-pixels`. "The picture agrees
// with the law" is then a thing a test can ask, instead of a thing somebody has to notice.
import { describe, expect, it } from 'vitest';
import { BOX, GOAL, PENALTY_SPOT, PITCH } from '../app/js/sim/units.ts';
import { boxAt, centreCircle, penaltySpotAt, pitchLines } from '../app/js/render/pitch-marks.ts';

describe('the penalty area drawn on the grass', () => {
  // ⚠️ THE GATE. Read from the same constant the referee reads, so the two cannot drift again.
  it('[Interface] is exactly the area the referee gives penalties in', () => {
    for (const end of [0, 1] as const) {
      const box = boxAt(end);

      expect(Math.abs(box.x1 - box.x0), `end ${end} depth`).toBeCloseTo(BOX.depth, 6);
      expect(Math.abs(box.y1 - box.y0), `end ${end} width`).toBeCloseTo(BOX.width, 6);
    }
  });

  it('[Right] it sits against the goal line it belongs to, at each end', () => {
    expect(Math.min(boxAt(0).x0, boxAt(0).x1)).toBeCloseTo(0, 6);
    expect(Math.max(boxAt(1).x0, boxAt(1).x1)).toBeCloseTo(PITCH.length, 6);
  });

  it('[Right] and it is centred across the pitch', () => {
    const box = boxAt(0);

    expect((box.y0 + box.y1) / 2).toBeCloseTo(PITCH.width / 2, 6);
  });

  // ⚠️ THE OLD NUMBERS WOULD FAIL THIS. 40.3m of a 56m pitch leaves 7.85m of grass on each side; the box
  //    was very nearly the whole width, which is not what a penalty area looks like and not what the
  //    referee was using.
  it('[Boundary] it fits on the pitch with grass either side of it', () => {
    const box = boxAt(0);

    expect(Math.min(box.y0, box.y1)).toBeGreaterThan(0);
    expect(Math.max(box.y0, box.y1)).toBeLessThan(PITCH.width);
    expect(Math.abs(box.x1 - box.x0)).toBeLessThan(PITCH.length / 3);
  });

  it('[Interface] and it is wider than the goal, or it is not an area', () => {
    expect(BOX.width).toBeGreaterThan(GOAL.width);
  });
});

describe('the penalty spot', () => {
  it('[Right] is on the spot the ball is actually placed on', () => {
    expect(penaltySpotAt(0).x).toBeCloseTo(PENALTY_SPOT, 6);
    expect(penaltySpotAt(1).x).toBeCloseTo(PITCH.length - PENALTY_SPOT, 6);
  });

  it('[Right] and in the middle of the goal, which is what a child aims at', () => {
    for (const end of [0, 1] as const) expect(penaltySpotAt(end).y).toBeCloseTo(PITCH.width / 2, 6);
  });

  // ⚠️ A SPOT OUTSIDE ITS OWN BOX WOULD BE A PICTURE OF A CONTRADICTION - the ball placed where the
  //    referee would not have given the penalty.
  it('[Boundary] it is inside the area it belongs to', () => {
    const box = boxAt(0);

    expect(penaltySpotAt(0).x).toBeGreaterThan(Math.min(box.x0, box.x1));
    expect(penaltySpotAt(0).x).toBeLessThan(Math.max(box.x0, box.x1));
  });
});

describe('the rest of the markings', () => {
  it('[Interface] every line is on the pitch, in metres', () => {
    for (const l of pitchLines()) {
      for (const x of [l.x0, l.x1]) expect(x, JSON.stringify(l)).toBeGreaterThanOrEqual(0);
      for (const x of [l.x0, l.x1]) expect(x, JSON.stringify(l)).toBeLessThanOrEqual(PITCH.length);
      for (const y of [l.y0, l.y1]) expect(y, JSON.stringify(l)).toBeGreaterThanOrEqual(0);
      for (const y of [l.y0, l.y1]) expect(y, JSON.stringify(l)).toBeLessThanOrEqual(PITCH.width);
    }
  });

  it('[Interface] there is a halfway line and a touchline, so it reads as a pitch', () => {
    const lines = pitchLines();

    expect(lines.some((l) => l.x0 === PITCH.length / 2 && l.x1 === PITCH.length / 2)).toBe(true);
    expect(lines.some((l) => l.y0 === 0 && l.y1 === 0)).toBe(true);
  });

  it('[Right] the centre circle is centred and fits inside the pitch', () => {
    const c = centreCircle();

    expect(c.x).toBeCloseTo(PITCH.length / 2, 6);
    expect(c.y).toBeCloseTo(PITCH.width / 2, 6);
    expect(c.r * 2).toBeLessThan(PITCH.width);
  });
});
