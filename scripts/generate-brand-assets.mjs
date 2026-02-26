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
  c4: args.c4 || '#fccbcb',
  topFill: args.topFill || '#f2f2f2',
  stroke: args.stroke || '#1e1e1e',
  depthX: Number(args.depthX || 12),
  depthY: Number(args.depthY || -5),
  seed: Number(args.seed || 7),
  transparent: String(args.transparent || 'true') === 'true',
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

function sidePattern(id) {
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="24" height="84" x="0" y="0">
    <rect width="24" height="21" fill="${cfg.c1}"/>
    <rect y="21" width="24" height="21" fill="${cfg.c2}"/>
    <rect y="42" width="24" height="21" fill="${cfg.c3}"/>
    <rect y="63" width="24" height="21" fill="${cfg.c4}"/>
  </pattern>`;
}

function extrudedGlyph({ ch, x, y, fs, rotate, dx, dy, idPrefix }) {
  const pId = `${idPrefix}-pat`;
  return `<g id="${idPrefix}" transform="rotate(${rotate} ${x} ${y})">
    <defs>${sidePattern(pId)}</defs>

    <!-- back shape defines the side face coloring -->
    <text x="${x + dx}" y="${y + dy}" font-size="${fs}" font-weight="800" fill="url(#${pId})"
      stroke="${cfg.stroke}" stroke-width="1.0" paint-order="stroke"
      font-family="Inter, SF Pro Text, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif">${esc(ch)}</text>

    <!-- front face -->
    <text x="${x}" y="${y}" font-size="${fs}" font-weight="800" fill="${cfg.topFill}"
      stroke="${cfg.stroke}" stroke-width="1.2" paint-order="stroke"
      font-family="Inter, SF Pro Text, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif">${esc(ch)}</text>
  </g>`;
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
      const rotate = (rand() - 0.5) * 10;
      glyphs.push(
        extrudedGlyph({
          ch,
          x: cursor,
          y: baseline,
          fs,
          rotate,
          dx: cfg.depthX,
          dy: cfg.depthY,
          idPrefix: `glyph-${idx}`,
        })
      );
    }
    cursor += adv;
    idx++;
  }

  const bgRect = cfg.transparent ? '' : `<rect width="${W}" height="${H}" rx="16" fill="${cfg.bg}"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none">
  ${bgRect}
  <g>${glyphs.join('\n')}</g>
</svg>`;
}

function makeIconSVG(size = 256) {
  const fs = size * 0.62;
  const baseline = size * 0.70;
  const x = size * 0.26;

  const glyph = extrudedGlyph({
    ch: cfg.iconText,
    x,
    y: baseline,
    fs,
    rotate: -6,
    dx: Math.max(7, Math.round(cfg.depthX * 0.9)),
    dy: Math.min(-2, Math.round(cfg.depthY * 0.9)),
    idPrefix: 'icon-glyph',
  });

  const bgRect = cfg.transparent ? '' : `<rect width="${size}" height="${size}" rx="${Math.round(size * 0.12)}" fill="${cfg.bg}"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">
  ${bgRect}
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
