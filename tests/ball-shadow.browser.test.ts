// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CLAIM THIS REPOSITORY MADE IN TWO HEADERS AND NEVER CHECKED.
//
// `sim/ball` says it and `render/scene` says it again, in the plan's own words: the ball's shadow staying
// on the ground while the ball rises is THE ONLY WAY a three-pixel ball can say "I am in the air". A ball
// that size has no room to grow with height and the projection is affine on purpose - a divided one would
// make the near player bigger than the far one, and at twelve pixels tall one of the two stops reading.
// So height has exactly one channel, and this is it.
//
// ⚠️ AND IT WAS UNGATED UNTIL NOW, which is the pattern this repository has now named ten times: a module
// that is right, a claim that is right, and nothing holding either to it. Nothing here failed - the
// shadow was drawn correctly from the first day. What was missing is the thing that would notice if it
// stopped, and a lofted pass, a keeper's punch and a cross all spend their whole flight depending on it.
//
// ⚠️ IT ADDS NO PRODUCTION API. `createScene` is exported and its `app` is public - `boot/main` reaches
// through it for the ticker - so a test can build a scene of its own and read the sprites off the stage.
// The alternative was a `Booted.scene` accessor existing only to be asserted on, and this needs none.
//
// ⚠️ AND THE CAMERA CANNOT CONTAMINATE IT, which is why there is no settling loop here and why the
// stands gate needed one. Sprites are positioned in WORLD space; the camera is the world container's own
// position. And the tele target is projected at `z: 0` explicitly, so raising the ball does not move the
// camera even in principle. Both readings are taken in the same frame of reference, unmoved.
import { describe, expect, it } from 'vitest';
import * as PIXI from 'pixi.js';
import { createMatchState } from '../app/js/sim/state.ts';
import { createScene } from '../app/js/render/scene.ts';
import { fixtureOf } from '../app/js/teams/roster.ts';

/** Every sprite on the stage whose texture is exactly this size. */
function spritesSized(stage: PIXI.Container, w: number, h: number): PIXI.Sprite[] {
  const found: PIXI.Sprite[] = [];
  const walk = (node: PIXI.Container): void => {
    for (const child of node.children) {
      const sprite = child as PIXI.Sprite;
      const tex = sprite.texture as PIXI.Texture | undefined;
      if (tex !== undefined && tex !== null && tex.width === w && tex.height === h) found.push(sprite);
      const inner = child as PIXI.Container;
      if (Array.isArray(inner.children)) walk(inner);
    }
  };
  walk(stage);
  return found;
}

describe('a ball in the air', () => {
  /**
   * Boot a scene, put the ball at a height, and hand back the two sprites.
   *
   * ⚠️ THE SPRITES ARE FOUND BY THE SIZE OF THEIR TEXTURE, and the sizes are the ones `render/scene`
   *    paints: the ball, its shadow and a body's shadow are all distinct sizes. That the identification is
   *    UNAMBIGUOUS is asserted rather than assumed - if a future sprite arrives at 5x5, this gate says so
   *    instead of quietly measuring the wrong thing, which is the failure mode this session met four
   *    times in the node project.
   */
  function readAt(z: number): { ballY: number; shadowY: number; shadowScale: number } {
    const host = document.createElement('div');
    document.body.append(host);
    const scene = createScene(host, fixtureOf(0, 3));
    try {
      const state = createMatchState();
      state.phase = 'live';
      state.ball.p = { x: 45, y: 28, z };
      state.ball.v = { x: 0, y: 0, z: 0 };
      scene.draw(state, []);

      // ⚠️ THE SIZES FOLLOW `ART`, AND THEY MOVED ON 2026-09-11. The cell plans are unchanged - the
      //    ball is still 5x5 and its shadow 5x2 as a PLAN - but the renderer draws each cell at 2x2 while
      //    the camera is doubled and the drawn figure has not arrived, so the textures are 10x10 and 10x4.
      //    They are literals here on purpose: identification is not the claim, and a gate that derived
      //    them from the renderer's own factor would follow a mistake in it rather than catch one. The
      //    length assertions below are what stop this measuring the wrong sprite in silence.
      const balls = spritesSized(scene.app.stage, 10, 10);
      const shadows = spritesSized(scene.app.stage, 10, 4);
      expect(balls, 'the ball sprite is not the only one of its size').toHaveLength(1);
      expect(shadows, 'the ball shadow is not the only one of its size').toHaveLength(1);
      return { ballY: balls[0].position.y, shadowY: shadows[0].position.y, shadowScale: shadows[0].scale.x };
    } finally {
      scene.destroy();
      host.remove();
    }
  }

  it('[Right] is drawn higher than a ball on the turf', () => {
    const ground = readAt(0);
    const air = readAt(4);
    // Screen rows grow downward, so up the screen is a SMALLER y.
    expect(air.ballY, 'the ball did not rise on screen').toBeLessThan(ground.ballY - 1);
  });

  // ⚠️ AND THE SHADOW STAYED WHERE IT WAS, which is the whole of the claim. A shadow that travels with
  //    the ball is a second ball: the two sprites move as one lump, nothing on the screen distinguishes a
  //    lofted pass from a ground one, and the only channel a 3px ball has for height is spent saying
  //    nothing. `render/scene` projects the shadow at `z: 0` on purpose, and this is what says so.
  it('[Right] leaves its shadow on the ground', () => {
    const ground = readAt(0);
    const air = readAt(4);
    expect(air.shadowY, 'the shadow rose with the ball').toBe(ground.shadowY);
  });

  // ⚠️ THE SECOND CUE, and it is a second cue rather than a decoration. Height reads from the GAP between
  //    ball and shadow, and a gap is only legible if you can tell which end is which - at 320x180 a
  //    shrinking shadow is what says "that one is the shadow" without a frame of reference.
  it('[Right] casts a smaller shadow the higher it goes', () => {
    const ground = readAt(0);
    const air = readAt(4);
    expect(air.shadowScale, 'the shadow did not shrink with height').toBeLessThan(ground.shadowScale);
  });

  // ⚠️ [Boundary] A BALL ON THE TURF IS ONE SPRITE, NOT TWO. This is the other end of the same claim and
  //    it fails differently: a shadow drawn at a permanent offset would pass every gate above and still
  //    put a smudge under a rolling ball that a child would read as height that is not there.
  it('[Boundary] sits on its own shadow when it is on the ground', () => {
    const ground = readAt(0);
    expect(Math.abs(ground.ballY - ground.shadowY), 'a grounded ball is drawn away from its shadow').toBeLessThan(1);
    expect(ground.shadowScale, 'a grounded shadow is already shrunk').toBe(1);
  });
});
