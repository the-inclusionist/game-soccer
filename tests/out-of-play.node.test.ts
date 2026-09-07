// SPDX-License-Identifier: AGPL-3.0-or-later
// WHERE THE BALL WENT. Touchline, goal line, or in the net.
//
// ========================= THE BALL IS NOT A POINT, AND THAT IS THE WHOLE TEST FILE =========================
// The laws say the ball is out only when it has WHOLLY crossed the line, and in the net only when it has
// wholly crossed the goal line. Modelling the ball as a point makes the line a threshold instead of a
// line, which is wrong by one ball radius in both directions - a goal given a hair early, a throw-in given
// a hair late. It is also the bug that never gets reported, because nobody can see eleven centimetres at
// 320x180; it just makes the game feel arbitrary.
import { describe, expect, it } from 'vitest';
import { createBall } from '../app/js/sim/ball.ts';
import { judgeBall } from '../app/js/rules/out-of-play.ts';
import { BALL, GOAL, PITCH } from '../app/js/sim/units.ts';

const MID_Y = PITCH.width / 2;

function ballAt(x: number, y: number, z = 0) {
  const b = createBall({ x, y });
  b.p.z = z;
  return b;
}

describe('a ball on the pitch', () => {
  it('[Zero] in the middle of the pitch, is in play', () => {
    expect(judgeBall(ballAt(45, 28)).kind).toBe('in');
  });

  it('[Boundary] with its centre exactly on the touchline, is still IN play', () => {
    expect(judgeBall(ballAt(45, 0)).kind).toBe('in');
  });

  it('[Boundary] one radius past the touchline is still touching the line, so still in play', () => {
    expect(judgeBall(ballAt(45, -BALL.radius)).kind).toBe('in');
  });

  it('[One] wholly past the touchline is out for a throw-in, and remembers where', () => {
    const out = judgeBall(ballAt(45, -BALL.radius - 0.01));

    expect(out.kind).toBe('touchline');
    if (out.kind === 'touchline') expect(out.at.x).toBeCloseTo(45, 5);
  });
});

describe('a ball at the goal line', () => {
  it('[Boundary] with its centre exactly on the goal line, between the posts, is NOT a goal', () => {
    expect(judgeBall(ballAt(PITCH.length, MID_Y)).kind).toBe('in');
  });

  it('[Right] wholly over the goal line, between the posts and under the bar, is a goal', () => {
    const g = judgeBall(ballAt(PITCH.length + BALL.radius + 0.01, MID_Y, 1));

    expect(g.kind).toBe('goal');
    if (g.kind === 'goal') expect(g.end).toBe(1);
  });

  it('[Boundary] wholly over the line but exactly at the height of the bar is NOT a goal', () => {
    expect(judgeBall(ballAt(PITCH.length + 0.5, MID_Y, GOAL.height)).kind).not.toBe('goal');
  });

  it('[Boundary] wholly over the line but exactly at the post is NOT a goal', () => {
    const atPost = MID_Y + GOAL.width / 2;

    expect(judgeBall(ballAt(PITCH.length + 0.5, atPost, 1)).kind).not.toBe('goal');
  });

  it('[One] wholly over the line and wide of the post is a goal-line exit, not a goal', () => {
    const wide = judgeBall(ballAt(PITCH.length + 0.5, MID_Y + GOAL.width, 0));

    expect(wide.kind).toBe('goalLine');
    if (wide.kind === 'goalLine') expect(wide.end).toBe(1);
  });

  it('[Interface] the other end is judged the same way, mirrored', () => {
    const g = judgeBall(ballAt(-BALL.radius - 0.01, MID_Y, 1));

    expect(g.kind).toBe('goal');
    if (g.kind === 'goal') expect(g.end).toBe(0);
  });

  it('[Many] a ball high over the bar and wide is one verdict, not two', () => {
    const v = judgeBall(ballAt(PITCH.length + 0.5, MID_Y + GOAL.width, 5));

    expect(v.kind).toBe('goalLine');
  });
});
