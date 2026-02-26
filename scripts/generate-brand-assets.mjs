#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [k, ...rest] = arg.replace(/^--/, '').split('=');
    return [k, rest.join('=') || 'true'];
  })
);

const cfg = {
  text: args.text || 'Pluribus',
  iconText: args.iconText || 'P',
  bg: args.bg || '#dee3e2',
  c1: args.c1 || '#78b3d6',
  c2: args.c2 || '#d86969',
  c3: args.c3 || '#4f7969',
  topFill: args.topFill || '#f5f5f5',
  stroke: args.stroke || '#1e1e1e',
  depth: Number(args.depth || 11),
  seed: Number(args.seed || 7),
  outDir: args.outDir || path.resolve(process.cwd(), 'assets'),
};

fs.mkdirSync(cfg.outDir, { recursive: true });

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(cfg.seed);
const sidePalette = [cfg.c1, cfg.c2, cfg.c3, '#fccbcb'];

function charAdvance(ch, fs) {
  if (/[ilI1]/.test(ch)) return fs * 0.34;
  if (/[mwMW]/.test(ch)) return fs * 0.86;
  if (/[A-Z]/.test(ch)) return fs * 0.68;
  if (/[a-z]/.test(ch)) return fs * 0.57;
  if (ch === ' ') return fs * 0.34;
  return fs * 0.56;
}

function wordMetrics(text, fs, tracking = 2) {
  let w = 0;
  for (const ch of text) w += charAdvance(ch, fs) + tracking;
  return w;
}

function extrudedGlyph({ ch, x, y, fs, rotate, depth, dx, dy, idPrefix }) {
  const layers = [];

  // Side depth layers: fill-only to avoid stacked multi-stroke banding artifacts.
  for (let i = depth; i >= 1; i--) {
    const col = sidePalette[i % sidePalette.length];
    layers.push(
      `<text x="${x + dx * i}" y="${y + dy * i}" font-size="${fs}" font-weight="800" fill="${col}" font-family="Inter, SF Pro Text, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif">${esc(ch)}</text>`
    );
  }

  // Single back outline for depth silhouette.
  layers.push(
    `<text x="${x + dx * depth}" y="${y + dy * depth}" font-size="${fs}" font-weight="800" fill="none" stroke="${cfg.stroke}" stroke-opacity="0.9" stroke-width="1.0" paint-order="stroke" font-family="Inter, SF Pro Text, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif">${esc(ch)}</text>`
  );

  // Front face with primary outline.
  layers.push(
    `<text x="${x}" y="${y}" font-size="${fs}" font-weight="800" fill="${cfg.topFill}" stroke="${cfg.stroke}" stroke-width="1.2" paint-order="stroke" font-family="Inter, SF Pro Text, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif">${esc(ch)}</text>`
  );

  return `<g id="${idPrefix}" transform="rotate(${rotate} ${x} ${y})">${layers.join('')}</g>`;
}

function makeWordmarkSVG() {
  const W = 1400;
  const H = 420;
  const fs = 244;
  const tracking = -2;
  const text = cfg.text;
  const textWidth = wordMetrics(text, fs, tracking);
  let cursor = (W - textWidth) / 2;
  const baseline = 286;

  const glyphs = [];
  let idx = 0;
  for (const ch of text) {
    const adv = charAdvance(ch, fs) + tracking;
    if (ch !== ' ') {
      const rotate = (rand() - 0.5) * 12;
      const dx = 0.65 + rand() * 0.65;
      const dy = -0.10 - rand() * 0.35;
      glyphs.push(
        extrudedGlyph({
          ch,
          x: cursor,
          y: baseline,
          fs,
          rotate,
          depth: cfg.depth,
          dx,
          dy,
          idPrefix: `glyph-${idx}`,
        })
      );
    }
    cursor += adv;
    idx++;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none">
  <rect width="${W}" height="${H}" rx="16" fill="${cfg.bg}"/>
  <g>${glyphs.join('\n')}</g>
</svg>`;
}

function makeIconSVG(size = 256) {
  const fs = size * 0.62;
  const baseline = size * 0.70;
  const x = size * 0.26;
  const rotate = -6;
  const dx = 0.9;
  const dy = -0.32;

  const glyph = extrudedGlyph({
    ch: cfg.iconText,
    x,
    y: baseline,
    fs,
    rotate,
    depth: Math.max(6, Math.floor(cfg.depth * 0.85)),
    dx,
    dy,
    idPrefix: 'icon-glyph',
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.12)}" fill="${cfg.bg}"/>
  ${glyph}
</svg>`;
}

const logoSvg = makeWordmarkSVG();
const faviconSvg = makeIconSVG(256);

fs.writeFileSync(path.join(cfg.outDir, 'pluribus-logo.svg'), logoSvg);
fs.writeFileSync(path.join(cfg.outDir, 'pluribus-favicon.svg'), faviconSvg);

console.log('Generated:');
console.log(path.join(cfg.outDir, 'pluribus-logo.svg'));
console.log(path.join(cfg.outDir, 'pluribus-favicon.svg'));
console.log('Config:', cfg);
