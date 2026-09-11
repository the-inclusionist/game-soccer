# The figure — the brief a drawing has to hit

What the renderer will accept, so a figure is drawn once. Every number here is derived from a measurement
or from a constant already in this repository; where something is a judgement, it says so and says why.

⚠️ **THIS IS WRITTEN BEFORE THE ART AND THAT IS THE ONLY REASON IT IS CHEAP.** Written afterwards it would
be a request to repaint somebody's hand work. The part that cannot be fixed later at all is §3.

---

## 1. The frame box: **14 wide × 26 tall**

Twice today's `BODY = { w: 7, h: 13 }`, because the camera doubles.

| | today | after the camera |
|---|---|---|
| pixels per metre, along the pitch (`SX`) | 8 | **16** |
| pixels per metre, across it (`SY`) | 5 | **10** |
| pixels per metre of height (`SZ`) | 7 | **14** |
| a 1.86 m player | 13 px | **26 px** |
| the frame box | 7 × 13 | **14 × 26** |

The tilt is the ratio `SY/SX`, and it stays exactly 5/8 — about fifty-one degrees — so the pitch keeps
reading as a high broadcast angle rather than turning top-down. No perspective divide, no zoom, ever.

**The box is a canvas, not a measurement.** Nothing has to fill it. Today's figure is 7 wide only because
the arms swing outside the shirt; columns may be empty, and on most frames they will be.

⚠️ **AND 26 PX IS ROOM FOR A DIFFERENT FIGURE, NOT THE SAME ONE ENLARGED.** Today's is about four and a
half heads tall, which is what 13 pixels allows and reads as a token. At 26 the proportion is a real
choice — five heads, six — and it is the artist's. What the renderer needs is that whatever is chosen is
the same in every frame and every facing.

### Why this scale and not another, measured rather than argued

Two measurements decided it, both taken on 2026-09-11.

**The cost is not the problem.** Doubling takes the baked pitch texture from 768×306 to 1536×602 — 0.24
to 0.92 megapixels, roughly 0.9 MB to 3.7 MB of RGBA — and the **scene build time does not move**: a
median of 40 ms against 39 ms over five cold builds. 1536 is comfortably inside the 2048 texture limit of
even a cheap tablet GPU.

**And the field of view it costs is affordable, which was the real worry.** At 320 pixels wide, doubling
the scale halves what is on screen: from about 40 metres of pitch to about 20. That sounds severe, so it
was measured rather than feared — every ball flight above the control speed, across twelve fixtures:

```
flights 2022   median 1.3 m   p75 4.7 m   p90 9.0 m   p99 28.5 m   max 45.2 m
fits in a 20 m window: 98.6%      in 26 m: 98.7%      in 40 m (today): 99.3%
```

**The close camera costs 0.7 percentage points of deliveries.** This game is played in short bursts — the
median flight is a dribble touch and the ninetieth percentile is a nine-metre pass — so the frame that
shows a body properly also shows the play. The tail that does not fit was already rare.

---

## 2. Facings: **five drawn, eight shown**

> ⚠️ **The plumbing for this is built and running as of 2026-09-11**, with a placeholder figure that
> carries only THREE views — front, side and back — and borrows the diagonals from their nearest
> neighbour. The table that maps facing to drawing already takes five; filling it is the whole of what the
> drawing changes. Nothing else in the game moves when it arrives, which is why the plumbing went first.

Draw **S, SE, E, NE, N** — the player seen from the front, then turning away to the right, to the far side.
The renderer **mirrors horizontally** for SW, W and NW. So eight directions cost five.

**Mirroring is safe here and that is worth stating, because it usually is not.** The shirt number never
appears on the sprite — the number a child needs is in the DOM and on the name tag, where a screen reader
can reach it — so there is no text to come out backwards, and nothing else on the figure is
left-or-right specific. If a frame ever gains an asymmetric detail, mirroring stops being free and this
line has to be revisited rather than quietly broken.

⚠️ **EIGHT AND NOT FOUR, AND THE REASON IS THE SIMULATION AND NOT TASTE.** `Body.facing` is already a unit
vector and the eight-point direction already falls out of it by comparison — the arithmetic rule in this
repository forbids trigonometry, so eight points is what the maths naturally produces. Four facings would
make a diagonal run read as a player sliding sideways, and diagonal running is the ordinary case in
football, not the exception.

⚠️ **AND FACING IS THE LARGEST LEGIBILITY GAIN AVAILABLE, LARGER THAN DETAIL.** Today the figure has NO
facing: one silhouette, whichever way the player runs. `Body.facing` exists in the simulation and reaches
the renderer for nothing. A player who faces where he runs reads as a person; one who does not reads as a
token sliding on grass, and no amount of extra pixels fixes that. It also closes a disagreement rather
than adding a feature: the declaration's `focusOf` already returns a heading, which the cane and the
scanning path already consume — so the screen has been saying something different from the non-visual
channels this whole time.

---

## 3. **Parts, not colours** — the one thing that cannot be fixed later

⚠️ **A FRAME IS A GRID OF PART INDICES. IT IS NEVER A GRID OF COLOURS.**

Every pixel belongs to one of SIX parts, and the renderer paints it:

| part | painted from |
|---|---|
| `head` | skin, fixed |
| `hair` | a fixed dark tone |
| `shirt` | **the club's generated palette** |
| `arm` | skin, fixed |
| `shorts` | **the club's generated palette** |
| `leg` | skin, fixed |

⚠️ **`hair` WAS ADDED ON 2026-09-11, AFTER THIS FILE WAS FIRST WRITTEN, AND IT IS THE REASON TO READ THIS
SECTION AGAIN.** Building the facing table found that with five flat parts a figure seen from the FRONT and
the same figure seen from BEHIND are the identical plan of cells — there is no face at this size, so
nothing tells them apart. A sixth index painted a fixed dark tone is the cheapest thing that does: hair on
the top rows for a front view, over the whole head for a back one.

It is a **fixed** colour and never a club one. Taking it from the kit palette would put a second club
colour on the figure, competing with the shirt a child uses to tell the sides apart and unpicking the
luminance guarantee between the two kits.

Plus transparent, and plus the outline, which the renderer derives from the silhouette rather than taking
from the art (see §5).

**Why it must be this way.** Club colours in this game are generated from a seed, and a gate enforces that
the two sides' primaries differ in luminance by at least 40 out of 255 — all 132 ordered pairings are
walked, not sampled. That gap is what a colour-blind child uses to tell the sides apart. **Art delivered
with the kits already painted in takes the generated palettes and that guarantee with it**, and there is
no way to get them back short of repainting every frame.

### What that means in Aseprite, concretely

- Work in **indexed colour mode**, with a palette of exactly the entries in the table above plus
  transparent. Index 0 transparent, then `head`, `hair`, `shirt`, `arm`, `shorts`, `leg`.
- The colours you actually see while drawing are **placeholders**. Pick whatever is easiest to see; the
  renderer never reads them, only the index.
- If a frame needs shading on the shirt, it needs a **second shirt index** (`shirt` and `shirtShade`), not
  a darker colour — the renderer derives the shade from the club colour. Say so if you want it and the
  table grows by one entry; deciding it now is free and deciding it later is a repaint.
- **No anti-aliasing and no partial alpha.** A pixel is one part or it is transparent. The world is
  sampled NEAREST at an integer scale; a half-transparent edge pixel shimmers when the camera moves.

---

## 4. The poses, in two tiers

The second tier is honest rather than optimistic: **a pose the simulation cannot ask for cannot be drawn
on screen**, and asking for art the game has no way to show would be asking for wasted work.

### Tier 1 — the simulation can ask for these today

| pose | frames | what asks for it |
|---|---|---|
| **stand** | 1 | speed below the walking threshold |
| **run** | **4 or more**, not 2 | driven by distance travelled, not by a clock — so a stopped player stands and a quick one strides faster, for free and identically in all three clock modes |
| **strike** | 2 (wind-up, contact) | `state.lastStruck` names who just hit it |
| **press** | 1 | `state.pressedBy` names the one designated challenger |
| **restart** | 1 (throw-in shape) | `state.tookRestart` names the taker |
| **sent off** | 1 (walking away) | a red card, through `onPitch`, the one function that answers "is he playing" |
| **keeper: ready** | 1 | the keeper is always index 0 of a side |
| **keeper: dive** | 2 (left, right — and **NOT mirrored**, see below) | a save is a distinct event in `sim/save` |

⚠️ **THE RUN CYCLE IS THE ONE PLACE THE FRAME COUNT IS A REQUIREMENT AND NOT A SUGGESTION.** Today it is
two pictures, because at 13 pixels a leg moved by one pixel is a leg that did not move. At 26 there is
room for a real cycle, and a two-frame cycle at this size reads as a twitch.

⚠️ **AND THE KEEPER'S DIVE IS THE ONE POSE MIRRORING MUST NOT TOUCH.** A dive is a whole-body rotation,
and rotation is unavailable to us: a rotated sprite on an integer grid at NEAREST sampling shimmers, and
the arithmetic rule forbids trigonometry in the modules that would drive it. So a dive left and a dive
right are two drawings, and so is anything else that would otherwise be "the standing frame, turned".

### Tier 2 — these need simulation work first, and it is named

| pose | blocked on |
|---|---|
| **slide tackle** | a one-tick marker in `sim/state` saying who committed one. Small, and owed anyway. |
| **shielding / being pressed** | the positional duel — the last item of the absorption plan, and the only one whose feasibility is genuinely uncertain |
| **celebrate** | a celebration phase, which does not exist. It is its own plan item, and a phase missing from the list of phases that stop play once left this world running under no laws. |

**Draw tier 1 first.** Tier 2 is worth drawing only when the item that shows it is landing; otherwise it
sits in a file and goes stale against whatever the pose ends up needing to communicate.

---

## 5. What the renderer supplies, so it is not drawn twice

Do **not** draw these; they are produced from the figure and would fight it if both existed.

- **The outline.** Derived from the silhouette — the empty four-neighbours of the filled pixels — so it
  follows arms and the gap between legs automatically. It is the single biggest thing separating a player
  from grass whatever colour the kit is, and it is already gated.
- **The shadow.** An ellipse under the body, and it is already gated four ways.
- **The marker over the controlled player.** A five-pixel wedge today, and there will be **three** of them
  — two seats plus the hinted switch target — which must be distinguishable from each other at one pixel.
  That is the renderer's problem, not the figure's.
- **Depth order.** Bodies sort by their position up the pitch.

⚠️ **AND THE OUTLINE DOES LESS WORK AT THE NEW SIZE, WHICH IS WORTH KNOWING BEFORE DRAWING.** At 13
pixels a one-pixel outline is a large fraction of the figure and carries most of the separation from the
grass. At 26 it is proportionally half as much, so the figure has to carry more of its own legibility —
either a two-tone edge, or internal contrast. ⚠️ Internal contrast fights the kit colour, which is the
thing a child uses to tell the sides apart, so it is a real tension and not a free choice.

---

## 6. Delivery

Whatever is convenient — the renderer's cell plans are data, and reading a sprite sheet into them is a
small piece of work at this end. What matters is that the **indices are preserved**, so an indexed PNG or
the `.aseprite` file are both fine and a flattened RGB PNG is not.

Naming that would make it unambiguous: `pose_facing.png`, e.g. `run_ne_2.png`, with facings `s se e ne n`
only.
