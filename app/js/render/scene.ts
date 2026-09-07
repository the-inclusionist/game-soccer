// SPDX-License-Identifier: AGPL-3.0-or-later
// THE UGLY RENDERER. Deliberately ugly, and deliberately early.
//
// ========================= WHY THIS EXISTS BEFORE THE ART DOES =========================
// The plan puts a playable-and-ugly screen before any kit, crest or crowd, because the one risk that
// cannot be reasoned about is whether twenty-two twelve-pixel figures READ at 320x180. Everything else in
// this repository can be argued from a test; this can only be looked at. Building the art first would
// mean discovering the answer after paying for it.
//
// ========================= THE SIX THINGS THAT MAKE IT LEGIBLE =========================
// In order of how much each one buys, and the first is worth more than the rest combined:
//   1. A shadow under every body and under the ball. It separates every sprite from the turf whatever
//      colour the kit is - and the ball's shadow STAYING ON THE GROUND while the ball rises is the only
//      way a three-pixel ball can say "I am in the air".
//   2. A one-pixel dark outline, so a body never merges into the grass.
//   3. Kit colour from the team palette, so high contrast by role can recolour it later.
//   4. A chevron over the body the seat is driving. Without it a child cannot find her own player, which
//      is the difference between a game and a screensaver.
//   5. The pitch baked ONCE, with mowing stripes that double as a distance ruler and a depth cue.
//   6. A ball drawn at three pixels rather than the one it would really be. Legibility beats realism, and
//      a low-vision child has to be able to find it at all.

import * as PIXI from 'pixi.js';
import { Z } from '@the-inclusionist/engine/core/layers.js';
import { criarCamera, type CameraObj } from '@the-inclusionist/engine/render/camera.js';
import { posicoesParallax } from '@the-inclusionist/engine/render/parallax.js';
import { STADIUM_LAYERS, crowdBands } from './stadium-layers.ts';
import { SQUAD_SIZE } from '../sim/ids.ts';
import { kitFor } from '../teams/kits.ts';
import type { Fixture } from '../teams/clubs.ts';
import { NOBODY } from '../sim/possession.ts';
import { onPitch } from '../sim/squads.ts';
import type { MatchState } from '../sim/state.ts';
import { GOAL, PITCH } from '../sim/units.ts';
import { MARKER, markerCells } from './marker-pixels.ts';
import { centreCircle, penaltySpotAt, pitchLines } from './pitch-marks.ts';
import { SX, SY, SZ, WORLD_PX, project } from '../project.ts';

/** The engine's logical screen. Never anything else: ADR-0001, integer scale only. */
export const LOGICAL = Object.freeze({ w: 320, h: 180 });

const OUTLINE = 0x101410;
const SHADOW = 0x000000;

/** How far the camera looks ahead of the ball, in seconds of its own travel. */
const LEAD_SECONDS = 0.35;

/** Per tick. A fixed lerp, not an exponential: the same arithmetic discipline as the simulation. */
const SMOOTH = 0.12;

/** Vertical gain, relative to horizontal. Half, and it is what makes it read as broadcast. */
const VERTICAL_GAIN = 0.5;

export interface Scene {
  readonly app: PIXI.Application;
  draw(state: MatchState, controlled: readonly number[]): void;
  /**
   * Dress the players for a different fixture.
   *
   * ⚠️ RE-TEXTURING RATHER THAN REBUILDING THE SCENE. Tearing the PixiJS application down and building it
   * again on every club change would drop the pitch texture, the stands and every cached kit - about a
   * second of work on the hardware pillar 1 names, for a change that is twenty-two texture assignments.
   */
  setFixture(next: Fixture): void;
  destroy(): void;
}

function bodyTexture(app: PIXI.Application, kit: number): PIXI.Texture {
  const g = new PIXI.Graphics();
  // A body is 6x12 px: about 1.8m tall at SZ, and wide enough to have a shape at all.
  g.beginFill(OUTLINE).drawRect(0, 0, 6, 12).endFill();
  g.beginFill(kit).drawRect(1, 1, 4, 6).endFill();
  g.beginFill(0x2a1c12).drawRect(1, 7, 4, 4).endFill();
  g.beginFill(0xe3b08a).drawRect(1, 0, 4, 2).endFill();
  return app.renderer.generateTexture(g);
}

/**
 * A band of crowd: low-contrast noise in three shades, and no faces.
 *
 * ⚠️ THE PATTERN IS SEEDED BY POSITION, NOT BY A RANDOM SOURCE. A crowd redrawn from `Math.random` would
 * differ between two machines watching the same recording, and although nothing about a crowd affects the
 * match, "the replay looks different" is a report somebody would have to chase.
 */
function crowdTexture(app: PIXI.Application, base: number, w: number, h: number): PIXI.Texture {
  const g = new PIXI.Graphics();
  const bands = crowdBands(base);
  g.beginFill(bands[1]).drawRect(0, 0, w, h).endFill();

  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const pick = (x * 73856093) ^ (y * 19349663);
      g.beginFill(bands[Math.abs(pick) % bands.length]).drawRect(x, y, 2, 2).endFill();
    }
  }
  return app.renderer.generateTexture(g);
}

/**
 * A stand: a dark structure with a band of hoardings along the bottom.
 *
 * ⚠️ THE HOARDINGS CARRY NO WORDS. A real stadium's advertising is somebody's trademark, and a school game
 * that painted invented brand names would be inventing a brand. They are a band of colour, and that is
 * all they will ever be.
 */
function standTexture(app: PIXI.Application, w: number, h: number): PIXI.Texture {
  const g = new PIXI.Graphics();
  g.beginFill(0x1d2a1c).drawRect(0, 0, w, h).endFill();
  g.beginFill(0x22301f).drawRect(0, h - 6, w, 6).endFill();
  return app.renderer.generateTexture(g);
}

function skyTexture(app: PIXI.Application, w: number, h: number): PIXI.Texture {
  const g = new PIXI.Graphics();
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const c = ((0x1a + t * 0x14) << 16) | ((0x2c + t * 0x1a) << 8) | (0x3e + t * 0x10);
    g.beginFill(c).drawRect(0, y, w, 1).endFill();
  }
  return app.renderer.generateTexture(g);
}

function ballTexture(app: PIXI.Application): PIXI.Texture {
  const g = new PIXI.Graphics();
  g.beginFill(OUTLINE).drawRect(0, 0, 5, 5).endFill();
  g.beginFill(0xffffff).drawRect(1, 1, 3, 3).endFill();
  return app.renderer.generateTexture(g);
}

function shadowTexture(app: PIXI.Application, w: number, h: number): PIXI.Texture {
  const g = new PIXI.Graphics();
  g.beginFill(SHADOW, 0.35).drawEllipse(w / 2, h / 2, w / 2, h / 2).endFill();
  return app.renderer.generateTexture(g);
}

/**
 * The mark over the body a seat is driving.
 *
 * ⚠️ THE SHAPE COMES FROM `marker-pixels`, and it moved there the day there were two seats. With one seat
 * the marker only had to exist; with two it has to be TELLABLE APART, and that is a property of the PAIR
 * which no amount of reading either half of this function would check. It is a gate in the node project
 * now, including the one that catches "the same wedge, one pixel lower".
 */
function markerTexture(app: PIXI.Application, seat: number, colour: number): PIXI.Texture {
  const g = new PIXI.Graphics();
  g.beginFill(OUTLINE).drawRect(0, 0, MARKER.w, MARKER.h).endFill();
  for (const [x, y] of markerCells(seat)) g.beginFill(colour).drawRect(x, y, 1, 1).endFill();
  return app.renderer.generateTexture(g);
}

/**
 * The pitch, drawn once into one texture.
 *
 * The mowing stripes are six metres wide, which is not decoration: they are a free distance ruler and the
 * only depth cue an affine projection can offer. The centre circle is an ELLIPSE because the ground plane
 * is squashed - drawing it as a circle would be the one place the projection is visibly contradicted.
 */
function pitchTexture(app: PIXI.Application): PIXI.Texture {
  const g = new PIXI.Graphics();
  const m = WORLD_PX.margin;

  // ⚠️ THE WHOLE WORLD IS PINNED FIRST, WITH A FULLY TRANSPARENT RECTANGLE, and without it the top band is
  //    transparent and the parallax is STILL invisible. `generateTexture` crops to the graphics' own
  //    BOUNDS: with the first painted thing starting at y = 36, the texture began there, and a sprite
  //    placed at (0, 0) put row 36 of the world at row 0 of the screen. The grass then covered exactly the
  //    band that had been left clear for the stands - so leaving it transparent achieved nothing, and the
  //    pitch sat thirty-six pixels above where `project()` says it is.
  //
  //    Zero alpha still contributes to bounds, so this costs one rectangle and makes the alignment a fact
  //    rather than a consequence of what happens to be painted highest.
  g.beginFill(0x000000, 0).drawRect(0, 0, WORLD_PX.w, WORLD_PX.h).endFill();

  // The top of the world is left clear, so the stands behind it show through. Painting grass from edge to
  // edge is what made the parallax invisible the FIRST time.
  const grassTop = m.top - 10;
  g.beginFill(0x27632f).drawRect(0, grassTop, WORLD_PX.w, WORLD_PX.h - grassTop).endFill();

  for (let band = 0; band * 6 < PITCH.length; band++) {
    const shade = band % 2 === 0 ? 0x2f7a3f : 0x2b7239;
    g.beginFill(shade).drawRect(m.x + band * 6 * SX, m.top, 6 * SX, PITCH.width * SY).endFill();
  }

  const line = (x: number, y: number, w: number, h: number) => {
    g.beginFill(0xe8f0e8, 0.75).drawRect(Math.round(x), Math.round(y), Math.max(1, w), Math.max(1, h)).endFill();
  };

  // ⚠️ EVERY LINE COMES FROM `render/pitch-marks`, IN METRES, and none of them is a number typed here.
  //    This block used to draw the penalty area at 16.5 by 40.3 - the real laws' numbers - while the
  //    referee gave penalties inside 14 by 32, because this pitch is 90 by 56 and not 105 by 68. The
  //    painted box and the refereed box were different rectangles: a child standing inside the line she
  //    could see got a free kick, and one standing outside it got a penalty. There is no learning a rule
  //    whose picture is wrong, and nothing reported it, because the drawing was correct code producing a
  //    box that looked like a box.
  for (const l of pitchLines()) {
    line(
      m.x + Math.min(l.x0, l.x1) * SX,
      m.top + Math.min(l.y0, l.y1) * SY,
      Math.abs(l.x1 - l.x0) * SX,
      Math.abs(l.y1 - l.y0) * SY,
    );
  }

  const circle = centreCircle();
  g.lineStyle(1, 0xe8f0e8, 0.75);
  g.drawEllipse(m.x + circle.x * SX, m.top + circle.y * SY, circle.r * SX, circle.r * SY);
  g.lineStyle(0);

  // The spot, which had never been drawn at all - and a penalty is now taken from it.
  for (const end of [0, 1] as const) {
    const spot = penaltySpotAt(end);
    g.beginFill(0xe8f0e8, 0.85)
      .drawRect(Math.round(m.x + spot.x * SX) - 1, Math.round(m.top + spot.y * SY), 2, 1)
      .endFill();
  }

  for (const end of [0, 1]) {

    // The goal itself, drawn as posts on the line so the mouth is visibly a gap and not a colour.
    const mouth = GOAL.width * SY;
    const gy = m.top + (PITCH.width * SY - mouth) / 2;
    const gx = end === 0 ? m.x - 3 : m.x + PITCH.length * SX + 1;
    g.beginFill(0xf4f8f4).drawRect(gx, gy, 3, 1).endFill();
    g.beginFill(0xf4f8f4).drawRect(gx, gy + mouth - 1, 3, 1).endFill();
    g.beginFill(0xf4f8f4, 0.5).drawRect(gx, gy, 3, mouth).endFill();
  }

  return app.renderer.generateTexture(g);
}

/**
 * Build the scene.
 *
 * ⚠️ INTEGER PIXELS IN TWO PLACES, NOT ONE. The camera is rounded AND every sprite is rounded. Rounding
 * only the container leaves sprites on fractional world coordinates and NEAREST sampling shimmers them;
 * rounding only the sprites lets the whole scene slide sub-pixel as a block. Both, or neither works.
 */
/**
 * Has the child asked her system for less motion?
 *
 * ⚠️ READ FROM THE SYSTEM AND NEVER FROM A MENU OF OURS (WCAG 2.3.3). She has already answered once;
 * asking again in our settings would be a second place for one preference to live, and two places for one
 * preference is two places to disagree.
 */
function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function createScene(host: HTMLElement, fixture: Fixture): Scene {
  const app = new PIXI.Application({
    width: LOGICAL.w,
    height: LOGICAL.h,
    backgroundColor: 0x1b3d20,
    antialias: false,
    autoStart: false,
  });
  PIXI.BaseTexture.defaultOptions.scaleMode = PIXI.SCALE_MODES.NEAREST;
  host.appendChild(app.view as unknown as Node);

  // ⚠️ THE STADIUM SITS IN SCREEN SPACE, BEHIND THE WORLD, and is moved by its `tilePosition` rather than
  //    by being inside the world container. A background that moved with the world would move at the
  //    world's speed, which is the opposite of parallax.
  const sky = new PIXI.TilingSprite(skyTexture(app, 64, LOGICAL.h), LOGICAL.w, LOGICAL.h);
  const far = new PIXI.TilingSprite(crowdTexture(app, 0x2b3a55, 32, 24), LOGICAL.w, 24);
  const near = new PIXI.TilingSprite(standTexture(app, 32, 14), LOGICAL.w, 14);
  far.y = 10;
  near.y = 30;
  for (const layer of [sky, far, near]) app.stage.addChild(layer);

  const world = new PIXI.Container();
  world.sortableChildren = true;
  app.stage.addChild(world);

  const pitch = new PIXI.Sprite(pitchTexture(app));
  pitch.zIndex = Z.TILES;
  world.addChild(pitch);

  const shadowTex = shadowTexture(app, 7, 3);
  const ballShadowTex = shadowTexture(app, 5, 2);
  const ballTex = ballTexture(app);
  // ⚠️ TWO COLOURS AS WELL AS TWO SHAPES, and the colours are the SECOND cue rather than the first. Yellow
  //    and white both separate from grass and from every kit this game generates; a colour-blind child
  //    reads the silhouette, and everyone else gets the colour for free.
  const markerTex = [markerTexture(app, 0, 0xffe64d), markerTexture(app, 1, 0xffffff)];
  // ⚠️ ONE TEXTURE PER DISTINCT KIT, NOT ONE PER BODY. Twenty-two textures where four will do is twenty-two
  //    uploads at boot on a machine that has none to spare - and the colours come from `kitFor`, so the
  //    renderer holds no table of its own to disagree with the crest.
  const kitTex = new Map<number, PIXI.Texture>();
  const textureFor = (colour: number): PIXI.Texture => {
    const found = kitTex.get(colour);
    if (found !== undefined) return found;
    const made = bodyTexture(app, colour);
    kitTex.set(colour, made);
    return made;
  };

  const shadows: PIXI.Sprite[] = [];
  const bodies: PIXI.Sprite[] = [];
  for (let i = 0; i < SQUAD_SIZE * 2; i++) {
    const sh = new PIXI.Sprite(shadowTex);
    sh.anchor.set(0.5, 0.5);
    sh.zIndex = Z.VFX_BACK;
    world.addChild(sh);
    shadows.push(sh);

    const sp = new PIXI.Sprite(textureFor(kitFor(fixture, i)));
    sp.anchor.set(0.5, 1);
    world.addChild(sp);
    bodies.push(sp);
  }

  const ballShadow = new PIXI.Sprite(ballShadowTex);
  ballShadow.anchor.set(0.5, 0.5);
  ballShadow.zIndex = Z.VFX_BACK;
  world.addChild(ballShadow);

  const ball = new PIXI.Sprite(ballTex);
  ball.anchor.set(0.5, 0.5);
  ball.zIndex = Z.VFX_FRONT;
  world.addChild(ball);

  const chevrons: PIXI.Sprite[] = [];
  for (let seat = 0; seat < 2; seat++) {
    const c = new PIXI.Sprite(markerTex[seat]);
    c.anchor.set(0.5, 1);
    c.zIndex = Z.HUD;
    c.visible = false;
    world.addChild(c);
    chevrons.push(c);
  }

  const camera: CameraObj = criarCamera(
    { w: WORLD_PX.w, h: WORLD_PX.h },
    { w: LOGICAL.w, h: LOGICAL.h },
    { w: 48, h: 40 },
  );
  const smooth = { x: WORLD_PX.w / 2, y: WORLD_PX.h / 2 };

  return {
    app,

    setFixture(next: Fixture): void {
      for (let i = 0; i < bodies.length; i++) bodies[i].texture = textureFor(kitFor(next, i));
    },

    draw(state: MatchState, controlled: readonly number[]): void {
      // The tele target: the ball plus a lead, sat a little above it so more of the far half is in frame.
      const lead = project({
        x: state.ball.p.x + state.ball.v.x * LEAD_SECONDS,
        y: state.ball.p.y + state.ball.v.y * LEAD_SECONDS,
        z: 0,
      });
      smooth.x += (lead.x - smooth.x) * SMOOTH;
      smooth.y += (lead.y - 12 - smooth.y) * SMOOTH * VERTICAL_GAIN;

      const cam = camera.seguir(smooth.x, smooth.y);
      const camX = Math.round(cam.camX);
      const camY = Math.round(cam.camY);
      world.position.set(-camX, -camY);

      // ⚠️ FED THE ROUNDED CAMERA, the same one the world gets. A background placed from the unrounded
      //    value would drift a fraction of a pixel against a world that had been snapped, and NEAREST
      //    sampling turns that into a shimmer along the horizon.
      const spots = posicoesParallax(camX, camY, STADIUM_LAYERS, reducedMotion());
      const sprites = [sky, far, near];
      for (let i = 0; i < sprites.length; i++) {
        sprites[i].tilePosition.set(Math.round(spots[i].tileX), Math.round(spots[i].tileY));
      }

      for (let i = 0; i < bodies.length; i++) {
        // ⚠️ HIDDEN, NOT DRAWN SOMEWHERE HARMLESS. A body parked off screen is still a body a child could
        //    reach with the sonar, and every consumer has to agree on who is playing - see `sim/squads`.
        const playing = onPitch(state, i);
        bodies[i].visible = playing;
        shadows[i].visible = playing;
        if (!playing) continue;
        const at = project({ x: state.players[i].p.x, y: state.players[i].p.y, z: 0 });
        const px = Math.round(at.x);
        const py = Math.round(at.y);
        bodies[i].position.set(px, py);
        // Painter's algorithm: `y` grows toward the near touchline, so ascending `y` is far to near.
        bodies[i].zIndex = Z.PLAYER + Math.round(state.players[i].p.y * 4);
        shadows[i].position.set(px, py);
      }

      const ballAt = project(state.ball.p);
      ball.position.set(Math.round(ballAt.x), Math.round(ballAt.y));
      const ground = project({ x: state.ball.p.x, y: state.ball.p.y, z: 0 });
      ballShadow.position.set(Math.round(ground.x), Math.round(ground.y));
      // The shadow shrinks with height, which is the second half of how three pixels say "in the air".
      const lift = 1 - Math.min(0.6, (state.ball.p.z * SZ) / 40);
      ballShadow.scale.set(lift, lift);

      for (let seat = 0; seat < chevrons.length; seat++) {
        const who = controlled[seat];
        const on = who !== undefined && who !== NOBODY;
        chevrons[seat].visible = on;
        if (!on) continue;
        const at = project({ x: state.players[who].p.x, y: state.players[who].p.y, z: 0 });
        chevrons[seat].position.set(Math.round(at.x), Math.round(at.y) - 13);
      }

      app.render();
    },

    destroy(): void {
      app.destroy(true);
    },
  };
}
