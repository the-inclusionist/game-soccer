# Licences

## Code

**AGPL-3.0-or-later** (ADR-0064). GPL treats *running* a service as not distributing, so a hosted
classroom server would owe its source to nobody; AGPL section 13 closes exactly that.

Economic ownership belongs to the **Município**, not to the developer — Lei 9.609/1998 art. 4, as the
requerimento filed with the Município proposes. That fact lives here rather than in a package name.

## Art

**All art in this repository is procedural, and procedural art is program.**

There is no image file under version control. What exists is the function that paints: kits, crests,
pitch, crowd and players are all produced at runtime by `pixelTexture` from a club seed and a palette.
The algorithm is source code, it falls under Lei 9.609, and it is covered whole by the AGPL above, with
the Município as the patrimonial owner.

⚠️ This reading is narrower than it may look, and the boundary matters. ADR-0010 pillar 10 was amended on
2026-08-27 to record that the project's *drawn* art belongs to a third party who holds full patrimonial
title over it, and is therefore licensed by its author rather than by us. That amendment still governs
drawn art everywhere in the ecosystem. **This game simply has none.**

If a drawn asset is ever added here, it does not inherit the AGPL: it arrives under its author's licence
and this section grows a row saying so.

## Third-party content

The engine's own vendored fonts travel with the engine package and keep their own terms; they are copied
into `app/public/vendor/` by `scripts/copy-engine-assets.mjs` and are not redistributed from this
repository. See the engine's `docs/LICENSES.md` for the font-by-font position, including the three faces
that may not be packaged at all.

No pictogram set is used by this game.
