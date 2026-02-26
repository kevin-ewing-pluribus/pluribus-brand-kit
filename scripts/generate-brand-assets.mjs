#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import opentype from 'opentype.js';

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
  topFill: args.topFill || '#ffffff',
  stroke: args.stroke || '#1e1e1e',
  depth: Number(args.depth || 13),
  depthAngle: Number(args.depthAngle || -25),
  depthJitter: Number(args.depthJitter || 36),
  tilt: Number(args.tilt || 10),
  tracking: Number(args.tracking || -2),
  curveRes: Number(args.curveRes || 12),
  fontSize: Number(args.fontSize || 276),
  seed: Number(args.seed || 12),
  transparent: String(args.transparent || 'true') === 'true',
  fontPath:
    args.fontPath ||
    path.resolve(process.cwd(), 'assets/fonts/FormulaCondensed-Bold.otf'),
  outDir: args.outDir || path.resolve(process.cwd(), 'assets'),
};

fs.mkdirSync(cfg.outDir, { recursive: true });

function fmt(n) {
  return Number(n.toFixed(2));
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quadAt(p0, p1, p2, t) {
  return {
    x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x,
    y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y,
  };
}

function cubicAt(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  return {
    x:
      mt * mt * mt * p0.x +
      3 * mt * mt * t * p1.x +
      3 * mt * t * t * p2.x +
      t * t * t * p3.x,
    y:
      mt * mt * mt * p0.y +
      3 * mt * mt * t * p1.y +
      3 * mt * t * t * p2.y +
      t * t * t * p3.y,
  };
}

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function rotatePoint(p, cx, cy, deg) {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const x = p.x - cx;
  const y = p.y - cy;
  return { x: cx + x * cos - y * sin, y: cy + x * sin + y * cos };
}

function mergeBounds(b, p) {
  if (!Number.isFinite(b.minX) || p.x < b.minX) b.minX = p.x;
  if (!Number.isFinite(b.minY) || p.y < b.minY) b.minY = p.y;
  if (!Number.isFinite(b.maxX) || p.x > b.maxX) b.maxX = p.x;
  if (!Number.isFinite(b.maxY) || p.y > b.maxY) b.maxY = p.y;
}

function pathToD(commands, ox = 0, oy = 0) {
  const d = [];
  for (const c of commands) {
    if (c.type === 'M') d.push(`M ${fmt(c.x + ox)} ${fmt(c.y + oy)}`);
    else if (c.type === 'L') d.push(`L ${fmt(c.x + ox)} ${fmt(c.y + oy)}`);
    else if (c.type === 'Q')
      d.push(
        `Q ${fmt(c.x1 + ox)} ${fmt(c.y1 + oy)} ${fmt(c.x + ox)} ${fmt(c.y + oy)}`
      );
    else if (c.type === 'C')
      d.push(
        `C ${fmt(c.x1 + ox)} ${fmt(c.y1 + oy)} ${fmt(c.x2 + ox)} ${fmt(c.y2 + oy)} ${fmt(c.x + ox)} ${fmt(c.y + oy)}`
      );
    else if (c.type === 'Z') d.push('Z');
  }
  return d.join(' ');
}

function sampleContours(commands, curveRes = 12) {
  const contours = [];
  let contour = [];
  let start = null;
  let prev = null;

  for (const c of commands) {
    if (c.type === 'M') {
      if (contour.length) contours.push(contour);
      contour = [];
      start = { x: c.x, y: c.y };
      prev = start;
      contour.push(start);
    } else if (c.type === 'L' && prev) {
      const p = { x: c.x, y: c.y };
      contour.push(p);
      prev = p;
    } else if (c.type === 'Q' && prev) {
      const p0 = prev;
      const p1 = { x: c.x1, y: c.y1 };
      const p2 = { x: c.x, y: c.y };
      for (let i = 1; i <= curveRes; i++) contour.push(quadAt(p0, p1, p2, i / curveRes));
      prev = p2;
    } else if (c.type === 'C' && prev) {
      const p0 = prev;
      const p1 = { x: c.x1, y: c.y1 };
      const p2 = { x: c.x2, y: c.y2 };
      const p3 = { x: c.x, y: c.y };
      for (let i = 1; i <= curveRes; i++) contour.push(cubicAt(p0, p1, p2, p3, i / curveRes));
      prev = p3;
    } else if (c.type === 'Z') {
      if (contour.length && start && dist(contour[contour.length - 1], start) > 0.25) {
        contour.push(start);
      }
      if (contour.length) contours.push(contour);
      contour = [];
      prev = start;
    }
  }

  if (contour.length) contours.push(contour);
  return contours;
}

function sideColor(i, gi) {
  const palette = [cfg.c1, cfg.c2, cfg.c3, cfg.c4];
  return palette[(i + gi) % palette.length];
}

function glyphGroup({ glyphPath, idx, rotate, dx, dy }) {
  const dFront = pathToD(glyphPath.commands, 0, 0);
  const dBack = pathToD(glyphPath.commands, dx, dy);
  const bb = glyphPath.getBoundingBox();
  const cx = (bb.x1 + bb.x2) / 2;
  const cy = (bb.y1 + bb.y2) / 2;

  const contours = sampleContours(glyphPath.commands, cfg.curveRes);
  const sidePolys = [];
  let faceIdx = 0;

  for (const contour of contours) {
    for (let i = 0; i < contour.length - 1; i++) {
      const a = contour[i];
      const b = contour[i + 1];
      if (dist(a, b) < 0.45) continue;
      const pts = `${fmt(a.x + dx)},${fmt(a.y + dy)} ${fmt(b.x + dx)},${fmt(b.y + dy)} ${fmt(
        b.x
      )},${fmt(b.y)} ${fmt(a.x)},${fmt(a.y)}`;
      sidePolys.push(`<polygon points="${pts}" fill="${sideColor(faceIdx, idx)}" stroke="${cfg.stroke}" stroke-width="0.95" stroke-linejoin="round" stroke-linecap="round" />`);
      faceIdx++;
    }
  }

  return `<g transform="rotate(${fmt(rotate)} ${fmt(cx)} ${fmt(cy)})">
    <path d="${dBack}" fill="${cfg.topFill}" stroke="${cfg.stroke}" stroke-width="1.0" />
    ${sidePolys.join('\n')}
    <path d="${dBack}" fill="none" stroke="${cfg.stroke}" stroke-width="1.0" />
    <path d="${dFront}" fill="${cfg.topFill}" stroke="${cfg.stroke}" stroke-width="1.15" />
  </g>`;
}

function glyphBounds({ glyphPath, rotate, dx, dy }) {
  const bb = glyphPath.getBoundingBox();
  const cx = (bb.x1 + bb.x2) / 2;
  const cy = (bb.y1 + bb.y2) / 2;

  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const contours = sampleContours(glyphPath.commands, cfg.curveRes);

  for (const contour of contours) {
    for (const p of contour) {
      mergeBounds(b, rotatePoint(p, cx, cy, rotate));
      mergeBounds(b, rotatePoint({ x: p.x + dx, y: p.y + dy }, cx, cy, rotate));
    }
  }

  const m = 0;
  b.minX -= m;
  b.minY -= m;
  b.maxX += m;
  b.maxY += m;
  return b;
}

function measureText(font, text, fontSize, tracking) {
  const scale = fontSize / font.unitsPerEm;
  let x = 0;
  let prev = null;
  for (const ch of text) {
    const glyph = font.charToGlyph(ch);
    if (prev) x += font.getKerningValue(prev, glyph) * scale;
    x += (glyph.advanceWidth || font.unitsPerEm * 0.5) * scale + tracking;
    prev = glyph;
  }
  return x;
}

function renderWordmark(font) {
  const fs = cfg.fontSize;
  const width = measureText(font, cfg.text, fs, cfg.tracking);
  const scale = fs / font.unitsPerEm;
  let x = 0;
  const baseline = fs;
  const rand = mulberry32(cfg.seed);

  let prev = null;
  const groups = [];
  let idx = 0;
  const all = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

  for (const ch of cfg.text) {
    const glyph = font.charToGlyph(ch);
    if (prev) x += font.getKerningValue(prev, glyph) * scale;

    if (ch !== ' ') {
      const pathObj = glyph.getPath(x, baseline, fs);
      const rot = (rand() - 0.5) * cfg.tilt;
      const ang = ((cfg.depthAngle + (rand() - 0.5) * cfg.depthJitter) * Math.PI) / 180;
      const dx = Math.cos(ang) * cfg.depth;
      const dy = Math.sin(ang) * cfg.depth;

      groups.push(glyphGroup({ glyphPath: pathObj, idx, rotate: rot, dx, dy }));
      const gb = glyphBounds({ glyphPath: pathObj, rotate: rot, dx, dy });
      mergeBounds(all, { x: gb.minX, y: gb.minY });
      mergeBounds(all, { x: gb.maxX, y: gb.maxY });
      idx++;
    }

    x += (glyph.advanceWidth || font.unitsPerEm * 0.5) * scale + cfg.tracking;
    prev = glyph;
  }

  if (!Number.isFinite(all.minX)) {
    all.minX = 0;
    all.minY = 0;
    all.maxX = width;
    all.maxY = fs;
  }

  const w = Math.max(1, Math.ceil(all.maxX - all.minX));
  const h = Math.max(1, Math.ceil(all.maxY - all.minY));
  const tx = -all.minX;
  const ty = -all.minY;
  const bgRect = cfg.transparent ? '' : `<rect width="${w}" height="${h}" fill="${cfg.bg}"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none">
  ${bgRect}
  <g transform="translate(${fmt(tx)} ${fmt(ty)})">
    ${groups.join('\n')}
  </g>
</svg>`;
}

function renderIcon(font) {
  const fs = 196;
  const glyph = font.charToGlyph(cfg.iconText);
  const pathObj = glyph.getPath(0, fs, fs);
  const g = glyphGroup({
    glyphPath: pathObj,
    idx: 0,
    rotate: -6,
    dx: cfg.depth * 0.82,
    dy: -cfg.depth * 0.36,
  });

  const b = glyphBounds({
    glyphPath: pathObj,
    rotate: -6,
    dx: cfg.depth * 0.82,
    dy: -cfg.depth * 0.36,
  });
  const w = Math.max(1, Math.ceil(b.maxX - b.minX));
  const h = Math.max(1, Math.ceil(b.maxY - b.minY));
  const tx = -b.minX;
  const ty = -b.minY;
  const bgRect = cfg.transparent ? '' : `<rect width="${w}" height="${h}" fill="${cfg.bg}"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none">
  ${bgRect}
  <g transform="translate(${fmt(tx)} ${fmt(ty)})">
    ${g}
  </g>
</svg>`;
}

if (!fs.existsSync(cfg.fontPath)) {
  console.error(`Font not found: ${cfg.fontPath}`);
  process.exit(1);
}

const font = opentype.loadSync(cfg.fontPath);
const logoSvg = renderWordmark(font);
const faviconSvg = renderIcon(font);

fs.writeFileSync(path.join(cfg.outDir, 'pluribus-logo.svg'), logoSvg);
fs.writeFileSync(path.join(cfg.outDir, 'pluribus-favicon.svg'), faviconSvg);

console.log('Generated:');
console.log(path.join(cfg.outDir, 'pluribus-logo.svg'));
console.log(path.join(cfg.outDir, 'pluribus-favicon.svg'));
console.log('Using font:', cfg.fontPath);
console.log('Config:', cfg);
