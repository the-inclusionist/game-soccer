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
import { Z } from './layers.ts';
import { createCamera, type CameraObj } from './camera.ts';
import { STADIUM_LAYERS, crowdBands, parallaxPositions } from './stadium-layers.ts';
import { SQUAD_SIZE, shirtOf } from '../sim/ids.ts';
import { kitFor } from '../teams/kits.ts';
import type { Fixture } from '../teams/clubs.ts';
import { NOBODY } from '../sim/possession.ts';
import { onPitch } from '../sim/squads.ts';
import type { MatchState } from '../sim/state.ts';
import { GOAL, PITCH } from '../sim/units.ts';
import { MARKER, hintCells, markerCells } from './marker-pixels.ts';
import { DIGIT, digitCells } from './digit-pixels.ts';
import { centreCircle, penaltySpotAt, pitchLines } from './pitch-marks.ts';
import { MIRRORED, bodyCells, facingOf, outlineOf, type Facing } from './body-pixels.ts';
import { SX, SY, SZ, WORLD_PX, project } from '../project.ts';

/** The engine's logical screen. Never anything else: ADR-0001, integer scale only. */
export const LOGICAL = Object.freeze({ w: 320, h: 180 });

const OUTLINE = 0x101410;
const SHADOW = 0x000000;

/** How far the camera looks ahead of the ball, in seconds of its own travel. */
/**
 * How many pixels one pixel of a cell plan is worth.
 *
 * ⚠️ AN INTERIM, AND IT SAYS SO. The figure, the marker and the ball are plans of CELLS drawn at 1x1,
 * sized for a camera at half this scale. Doubling the projection without them would leave a 13-pixel
 * player on a pitch drawn twice as large - which is the opposite of what the closer camera is for. So
 * every cell becomes 2x2 and the art reads EXACTLY as it did, at twice the size: nothing regresses, and
 * the outline stays proportionally what it was rather than thinning to half its former work.
 *
 * ⚠️ IT COMES OUT WHEN THE DRAWN FIGURE ARRIVES. `docs/FIGURE-SPEC` sizes that at 14x26 with its own
 * pixels, and a hand-drawn figure scaled by two would be a waste of the hand. This constant is the bridge
 * between the camera landing and the art landing, and it should not outlive the second.
 */
const ART = 2;

const LEAD_SECONDS = 0.35;

/** Per tick. A fixed lerp, not an exponential: the same arithmetic discipline as the simulation. */
const SMOOTH = 0.12;

/** Vertical gain, relative to horizontal. Half, and it is what makes it read as broadcast. */
const VERTICAL_GAIN = 0.5;

/**
 * How far above the ball the camera aims, in pixels.
 *
 * ⚠️ IT WAS TWELVE, AND THAT IS WHY NOBODY EVER SAW THE STANDS. The stand band sits in screen space at
 * rows 10 to 44, and the grass reaches the screen at `grassTop - camY` - so a stand is only ever visible
 * while `camY` is under about twenty-six. With a twelve-pixel lift the camera sits at `camY = 84` with the
 * ball on the halfway line, which covers the band completely: the stands could only be seen with the ball
 * held against the far touchline, which happens in no match anybody plays.
 *
 * ⚠️ AND IT IS WHAT A BROADCAST CAMERA ACTUALLY DOES. The ball sits LOW in a televised frame and the far
 * stand fills the top of it; a camera that centred on the ball would show as much empty grass behind the
 * play as in front. So this is not a trick to expose a background - it is the framing, and the background
 * becoming visible is the consequence of getting the framing right.
 */
const BALL_SITS_LOW_BY = 58;

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
  /**
   * Where the camera is, in world pixels, after the last frame.
   *
   * ⚠️ IT IS RETURNED FOR THE SAME REASON `Booted.state` IS: a property nobody can read is a property
   * nobody can assert. The stadium parallax was gated on its own maths and reported "never seen in a
   * captured frame" for months - and the reason turned out to be two things about the CAMERA, neither of
   * which could be measured from outside, so both were argued about from screenshots instead.
   *
   * Nothing writes through this, and a debug overlay would want exactly the same handle.
   */
  cameraAt(): { readonly x: number; readonly y: number };
  /**
   * The screen row the pitch sprite starts at.
   *
   * ⚠️ THIS NOW MEASURES SOMETHING, WHICH THE FIRST VERSION DID NOT. It was asked once before, of a
   * texture that spanned the world, and answered row 0 whether the top band was transparent or painted -
   * the same number in both cases, a diagnostic agreeing with itself. The texture is CROPPED to the grass
   * and the sprite is positioned by that crop, so this row is where the grass begins, and it is the number
   * that decides whether a stand is covered.
   */
  pitchTopOnScreen(): number;
  destroy(): void;
}

/**
 * A player, painted from `body-pixels`.
 *
 * ⚠️ THE OUTLINE FOLLOWS THE FIGURE. It used to be a filled rectangle drawn UNDER four blocks, which is
 * why the silhouette was a rectangle however the figure was shaped - and the outline is the single
 * biggest thing separating twelve pixels of player from a field of grass, whatever colour the kit is.
 *
 * ⚠️ AND THE SKIN IS ONE TONE FOR EVERYBODY, which is a decision and not an oversight. At three pixels of
 * head there is no room to say anything true about a face, and a generator picking tones would be
 * inventing differences it cannot draw. What a child recognises here is the KIT and the mark over her own
 * player; the figure is a body, and every body is the same body.
 */
function bodyTexture(app: PIXI.Application, kit: number, facing: Facing, frame: number): PIXI.Texture {
  const g = new PIXI.Graphics();
  const cells = bodyCells(facing, frame);

  // Offset by one so an arm on column 0 has room for its outline. The sprite is therefore two wider and
  // two taller than `BODY`, and the anchor below puts its feet where the projection says they are.
  const O = 1;
  for (const o of outlineOf(cells)) g.beginFill(OUTLINE).drawRect((o.x + O) * ART, (o.y + O) * ART, ART, ART).endFill();

  const colours: Record<string, number> = {
    head: 0xe3b08a,
    // ⚠️ A FIXED COLOUR AND NEVER A CLUB ONE. Hair is what tells a front view from a back one at
    //    this size - there is no face to draw - and taking it from the kit palette would put a
    //    second club colour on the figure, competing with the shirt a child uses to tell the sides
    //    apart and unpicking the luminance guarantee between the two kits.
    hair: 0x24180f,
    arm: 0xe3b08a,
    leg: 0xe3b08a,
    shirt: kit,
    shorts: 0x2a1c12,
  };
  for (const c of cells) g.beginFill(colours[c.part]).drawRect((c.x + O) * ART, (c.y + O) * ART, ART, ART).endFill();

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
  // ⚠️ IT WAS TWO NESTED SQUARES AND IT READ AS A BOX. At five pixels across, a square with a darker
  //    border IS a ball - there is no room for it to be anything else, and the eye supplies the curve. At
  //    ten there is room, and the eye stops supplying it: the first frame captured after the camera
  //    doubled has a white CRATE sitting on the halfway line. Same plan, twice the size, and the shape
  //    stopped meaning what it meant - which is the whole argument of `docs/FIGURE-SPEC` for why 26
  //    pixels is room for a different figure rather than the same one enlarged, arriving early and on
  //    the one sprite nobody was going to redraw.
  const r = (5 * ART) / 2;
  g.beginFill(OUTLINE).drawCircle(r, r, r).endFill();
  g.beginFill(0xffffff).drawCircle(r, r, r - ART).endFill();
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
function markerTexture(app: PIXI.Application, cells: readonly (readonly [number, number])[], colour: number): PIXI.Texture {
  const g = new PIXI.Graphics();
  g.beginFill(OUTLINE).drawRect(0, 0, MARKER.w * ART, MARKER.h * ART).endFill();
  for (const [x, y] of cells) g.beginFill(colour).drawRect(x * ART, y * ART, ART, ART).endFill();
  return app.renderer.generateTexture(g);
}

/**
 * The pitch, drawn once into one texture.
 *
 * The mowing stripes are six metres wide, which is not decoration: they are a free distance ruler and the
 * only depth cue an affine projection can offer. The centre circle is an ELLIPSE because the ground plane
 * is squashed - drawing it as a circle would be the one place the projection is visibly contradicted.
 */
/**
 * The pitch, baked once - and WHERE ITS TOP-LEFT LANDS IN THE WORLD, which is the part that was assumed.
 *
 * ⚠️ `generateTexture` CROPS TO THE GRAPHICS' OWN BOUNDS. The first thing painted here is grass at
 * `grassTop`, so the texture begins THERE and not at the world's origin - and a sprite placed at (0, 0)
 * puts world row 36 on screen row 0. The pitch sat thirty-six pixels above where `project()` says it is,
 * and the band deliberately left clear for the stands was covered by grass. That is why the parallax was
 * never seen.
 *
 * Two attempts to stop the crop failed and are recorded so nobody repeats them: a fully transparent
 * rectangle over the whole world does NOT extend the bounds, and `{ region }` drew every player as a
 * two-pixel dash. So the crop is not fought - it is MEASURED and handed back, and the caller positions the
 * sprite by it. Read from the graphics rather than assumed to be `grassTop`, because the day something is
 * painted higher this keeps working and an assumed constant would not.
 */
function pitchTexture(app: PIXI.Application): { texture: PIXI.Texture; at: { x: number; y: number } } {
  const g = new PIXI.Graphics();
  const m = WORLD_PX.margin;

  // The top of the world is left clear, so the stands behind it show through. Painting grass from edge to
  // edge is what made the parallax invisible the FIRST time.
  const grassTop = m.top - 10;
  g.beginFill(0x27632f).drawRect(0, grassTop, WORLD_PX.w, WORLD_PX.h - grassTop).endFill();

  for (let band = 0; band * 6 < PITCH.length; band++) {
    const shade = band % 2 === 0 ? 0x2f7a3f : 0x2b7239;
    g.beginFill(shade).drawRect(m.x + band * 6 * SX, m.top, 6 * SX, PITCH.width * SY).endFill();
  }

  // ⚠️ THE FLOOR IS `ART` AND NOT 1, AND LOOKING AT THE PITCH IS WHAT FOUND IT. A touchline is one
  //    pixel of a 56-metre width, so the floor is what actually draws it - and at the doubled camera a
  //    one-pixel line does proportionally half the work it did, which is the same thinning the outline
  //    around a figure suffers. The markings stopped reading as markings before any gate noticed,
  //    because no gate asks what a line LOOKS like.
  const line = (x: number, y: number, w: number, h: number) => {
    g.beginFill(0xe8f0e8, 0.75)
      .drawRect(Math.round(x), Math.round(y), Math.max(ART, w), Math.max(ART, h))
      .endFill();
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
  // ⚠️ AND THE CENTRE CIRCLE WAS THE WORST OF IT: a one-pixel stroke on an ellipse this large broke
  //    into dashes, so the circle read as a dotted line rather than a line. It is the one marking drawn
  //    with a stroke instead of filled rectangles, which is why it thinned differently and why it went
  //    first.
  g.lineStyle(ART, 0xe8f0e8, 0.75);
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

  const bounds = g.getLocalBounds();
  return { texture: app.renderer.generateTexture(g), at: { x: bounds.x, y: bounds.y } };
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

  const baked = pitchTexture(app);
  const pitch = new PIXI.Sprite(baked.texture);
  // Put the texture back where it was painted. See `pitchTexture`: the crop is measured, not fought.
  pitch.position.set(baked.at.x, baked.at.y);
  pitch.zIndex = Z.TILES;
  world.addChild(pitch);

  const shadowTex = shadowTexture(app, 7 * ART, 3 * ART);
  const ballShadowTex = shadowTexture(app, 5 * ART, 2 * ART);
  const ballTex = ballTexture(app);
  // ⚠️ TWO COLOURS AS WELL AS TWO SHAPES, and the colours are the SECOND cue rather than the first. Yellow
  //    and white both separate from grass and from every kit this game generates; a colour-blind child
  //    reads the silhouette, and everyone else gets the colour for free.
  const markerTex = [markerTexture(app, markerCells(0), 0xffe64d), markerTexture(app, markerCells(1), 0xffffff)];
  // ⚠️ THE HINT IS DIMMER AS WELL AS A DIFFERENT SHAPE, and the shape is what carries it. A grey mark
  //    against two bright ones says "not yours yet" to a child who sees colour, and the hollow chevron
  //    says the same thing to one who does not - which is the order those two have to come in here.
  const hintTex = markerTexture(app, hintCells(), 0x9aa7b4);

  // ⚠️ THE SHIRT NUMBER OF THE BODY SHE IS DRIVING, and at this camera it fits. At the old scale it
  //    would have been three pixels tall over a thirteen-pixel body, beside a marker of its own - which
  //    is why this item waited for the camera rather than being cheap all along.
  // ⚠️ IT IS A DUPLICATE AND NEVER THE ONLY COPY. Pillar 2 says text lives in the DOM, and it does:
  //    `ui/mirror.youLine` has said "you are number 7" since before there were pixels for it. This is the
  //    SIGHTED channel for a fact a blind child already had, which is the reverse of the usual direction
  //    here and worth saying out loud.
  const numberTex = new Map<number, PIXI.Texture>();
  const numberFor = (shirt: number): PIXI.Texture => {
    const had = numberTex.get(shirt);
    if (had !== undefined) return had;
    const g = new PIXI.Graphics();
    const glyphs = [...String(shirt)].map((c) => digitCells(Number(c)));
    const w = glyphs.length * (DIGIT.w + 1) - 1;
    g.beginFill(OUTLINE, 0.65).drawRect(0, 0, (w + 2) * ART, (DIGIT.h + 2) * ART).endFill();
    for (let i = 0; i < glyphs.length; i++) {
      const ox = 1 + i * (DIGIT.w + 1);
      for (const [x, y] of glyphs[i]) {
        g.beginFill(0xffffff).drawRect((ox + x) * ART, (1 + y) * ART, ART, ART).endFill();
      }
    }
    const made = app.renderer.generateTexture(g);
    numberTex.set(shirt, made);
    return made;
  };
  // ⚠️ ONE TEXTURE PER DISTINCT KIT, NOT ONE PER BODY. Twenty-two textures where four will do is twenty-two
  //    uploads at boot on a machine that has none to spare - and the colours come from `kitFor`, so the
  //    renderer holds no table of its own to disagree with the crest.
  const kitTex = new Map<string, PIXI.Texture>();
  const textureFor = (colour: number, facing: Facing, frame: number): PIXI.Texture => {
    const key = `${colour}/${facing}/${frame}`;
    const found = kitTex.get(key);
    if (found !== undefined) return found;
    const made = bodyTexture(app, colour, facing, frame);
    kitTex.set(key, made);
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

    const sp = new PIXI.Sprite(textureFor(kitFor(fixture, i), 's', 0));
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
  const hints: PIXI.Sprite[] = [];
  const numbers: PIXI.Sprite[] = [];
  for (let seat = 0; seat < 2; seat++) {
    const c = new PIXI.Sprite(markerTex[seat]);
    c.anchor.set(0.5, 1);
    c.zIndex = Z.HUD;
    c.visible = false;
    world.addChild(c);
    chevrons.push(c);

    const h = new PIXI.Sprite(hintTex);
    h.anchor.set(0.5, 1);
    h.zIndex = Z.HUD;
    h.visible = false;
    world.addChild(h);
    hints.push(h);

    const n = new PIXI.Sprite(PIXI.Texture.EMPTY);
    n.anchor.set(0.5, 1);
    n.zIndex = Z.HUD;
    n.visible = false;
    world.addChild(n);
    numbers.push(n);
  }

  // Which kits are on the pitch right now. The draw needs it every frame, because the stride picks a
  // different texture per body per tick.
  let shirts = fixture;

  const camera: CameraObj = createCamera(
    { w: WORLD_PX.w, h: WORLD_PX.h },
    { w: LOGICAL.w, h: LOGICAL.h },
    { w: 48, h: 40 },
  );
  const smooth = { x: WORLD_PX.w / 2, y: WORLD_PX.h / 2 };

  return {
    app,

    cameraAt(): { readonly x: number; readonly y: number } {
      return { x: -world.position.x, y: -world.position.y };
    },

    pitchTopOnScreen(): number {
      return pitch.getBounds().y;
    },

    setFixture(next: Fixture): void {
      shirts = next;
      for (let i = 0; i < bodies.length; i++) bodies[i].texture = textureFor(kitFor(next, i), 's', 0);
    },

    draw(state: MatchState, controlled: readonly number[]): void {
      // The tele target: the ball plus a lead, sat a little above it so more of the far half is in frame.
      const lead = project({
        x: state.ball.p.x + state.ball.v.x * LEAD_SECONDS,
        y: state.ball.p.y + state.ball.v.y * LEAD_SECONDS,
        z: 0,
      });
      smooth.x += (lead.x - smooth.x) * SMOOTH;
      smooth.y += (lead.y - BALL_SITS_LOW_BY - smooth.y) * SMOOTH * VERTICAL_GAIN;

      const cam = camera.follow(smooth.x, smooth.y);
      const camX = Math.round(cam.camX);
      const camY = Math.round(cam.camY);
      world.position.set(-camX, -camY);

      // ⚠️ FED THE ROUNDED CAMERA, the same one the world gets. A background placed from the unrounded
      //    value would drift a fraction of a pixel against a world that had been snapped, and NEAREST
      //    sampling turns that into a shimmer along the horizon.
      const spots = parallaxPositions(camX, camY, STADIUM_LAYERS, reducedMotion());
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
        // ⚠️ THE STRIDE IS DRIVEN BY DISTANCE TRAVELLED, NOT BY THE CLOCK. A leg cycle on a timer keeps
        //    running while a player stands still, which reads as fidgeting; driven by where the body has
        //    got to, a stopped player stands and a quick one strides faster - for free, and identically
        //    in all three clock modes, because it is a fact about the world rather than about frames.
        const body = state.players[i];
        const stride = Math.floor((Math.abs(body.p.x) + Math.abs(body.p.y)) * 1.1) % 2;
        // ⚠️ `Body.facing` REACHED THIS RENDERER AND DID NOTHING AT ALL until now. It is a unit
        //    vector the simulation has always kept, the declaration's `focusOf` already hands it to
        //    the cane and the scanning path, and the screen was the one channel saying something
        //    different - one silhouette whichever way a player ran. A body that faces where it runs
        //    reads as a person; one that does not reads as a token sliding on grass, and at
        //    twenty-six pixels no amount of extra detail fixes that.
        // ⚠️ AND THE MIRRORED HALF COSTS NOTHING BUT A SIGN. Five facings are drawn and eight are
        //    shown; `MIRRORED` says which borrow, and the sprite is flipped rather than redrawn.
        const facing = facingOf(body.facing.x, body.facing.y);
        const from = MIRRORED[facing];
        bodies[i].texture = textureFor(kitFor(shirts, i), from ?? facing, stride);
        bodies[i].scale.x = from === null ? 1 : -1;
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
        if (!on) {
          hints[seat].visible = false;
          numbers[seat].visible = false;
          continue;
        }
        const at = project({ x: state.players[who].p.x, y: state.players[who].p.y, z: 0 });
        chevrons[seat].position.set(Math.round(at.x), Math.round(at.y) - 13 * ART);

        // ⚠️ ABOVE THE MARKER, NOT OVER THE BODY. The tag must not sit on the figure it names - a
        //    number printed across a kit is a number competing with the one thing a child uses to tell
        //    the sides apart. The marker is 13 cells up and four tall, so this clears both.
        numbers[seat].texture = numberFor(shirtOf(who));
        numbers[seat].visible = true;
        numbers[seat].position.set(Math.round(at.x), Math.round(at.y) - (13 + MARKER.h) * ART);

        // ⚠️ IT IS READ FROM THE WORLD AND NOT WORKED OUT HERE. `state.hinted` is the answer `play`
        //    hands her when she presses, so the mark and the press cannot disagree - and a renderer that
        //    found its own nearest body would be a second answer to the question the mark exists to
        //    answer. Only drawn for a seat that is actually being driven: a mark for a chair nobody is
        //    in is the defect the empty seat plan already forbids.
        const hinted = state.hinted[seat] ?? NOBODY;
        const show = hinted !== NOBODY && hinted >= 0 && onPitch(state, hinted);
        hints[seat].visible = show;
        if (!show) continue;
        const spot = project({ x: state.players[hinted].p.x, y: state.players[hinted].p.y, z: 0 });
        hints[seat].position.set(Math.round(spot.x), Math.round(spot.y) - 13 * ART);
      }

      app.render();
    },

    destroy(): void {
      app.destroy(true);
    },
  };
}
