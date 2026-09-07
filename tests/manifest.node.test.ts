// SPDX-License-Identifier: AGPL-3.0-or-later
// THE MANIFEST, WHICH IS HALF OF PILLAR 8 AND THE HALF NOTHING ELSE WOULD CATCH.
//
// A service worker makes the game WORK offline. The manifest is what makes a school able to INSTALL it -
// a launcher icon on a tablet, opening without browser chrome, rather than a bookmark to a URL a child
// has to type. A malformed one fails silently: the browser ignores it, the install prompt never appears,
// and the page keeps working perfectly, so nothing anywhere says the game is not installable.
//
// ⚠️ AND THE ICON IS AN SVG BECAUSE THE LICENCE POSITION SAYS SO. No image file is under version control
// in this repository; what exists is the description that paints. An SVG is a program, which is the same
// argument that makes the pitch, the kits and the crests AGPL rather than an asset licence.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(new URL(`../app/${path}`, import.meta.url), 'utf8');

const manifest = JSON.parse(read('public/manifest.webmanifest')) as Record<string, unknown>;
const html = read('index.html');

describe('the manifest', () => {
  it('[Interface] is valid JSON with the fields a browser needs to offer an install', () => {
    for (const field of ['name', 'start_url', 'scope', 'display', 'icons']) {
      expect(manifest[field], field).toBeDefined();
    }
    expect(manifest.display).toBe('standalone');
  });

  // ⚠️ RELATIVE, because this game does not know where it will be served from. The catalogue may mount it
  //    under a path, and an absolute `start_url` of `/` would then open the catalogue instead of the game.
  it('[Right] its paths are relative, because nobody here knows the deployment path', () => {
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    for (const icon of manifest.icons as { src: string }[]) expect(icon.src.startsWith('./')).toBe(true);
  });

  it('[Right] the icon is a description and not a bitmap, which is the licence position', () => {
    const icons = manifest.icons as { src: string; type: string; purpose?: string }[];

    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.type, icon.src).toBe('image/svg+xml');
      expect(icon.src, icon.src).toMatch(/\.svg$/);
    }
    // Maskable, or a launcher crops the mark into a circle and takes the corners of the pitch with it.
    expect(icons.some((i) => (i.purpose ?? '').includes('maskable'))).toBe(true);
  });

  it('[Interface] every icon it names actually exists and is an SVG', () => {
    for (const icon of manifest.icons as { src: string }[]) {
      const svg = read(`public/${icon.src.replace('./', '')}`);
      expect(svg.trimStart().startsWith('<svg'), icon.src).toBe(true);
    }
  });

  // ⚠️ A MANIFEST NOTHING LINKS TO IS A FILE IN A FOLDER. This is the one-line mistake that makes every
  //    assertion above true and the feature absent.
  it('[Zero] and the page links it, or none of the above is reachable', () => {
    expect(html).toMatch(/rel="manifest"[^>]*href="\.\/manifest\.webmanifest"/);
  });

  it('[Interface] the page also names a theme colour, so the shell is not white round a dark game', () => {
    expect(html).toMatch(/name="theme-color"/);
    expect(manifest.background_color).toBe(manifest.theme_color);
  });

  it('[Right] it declares its language, so a reader announces the name correctly', () => {
    expect(manifest.lang).toBe('pt-BR');
  });
});
