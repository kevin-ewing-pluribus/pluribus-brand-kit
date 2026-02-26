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
  outDir: args.outDir || path.resolve(process.cwd(), 'assets'),
};

fs.mkdirSync(cfg.outDir, { recursive: true });

const logoSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="360" viewBox="0 0 1200 360" fill="none">
  <rect width="1200" height="360" rx="28" fill="${cfg.bg}"/>

  <!-- Icon container -->
  <g transform="translate(26,26)">
    <rect width="308" height="308" rx="42" fill="white" fill-opacity="0.62"/>
    <rect x="0.5" y="0.5" width="307" height="307" rx="41.5" stroke="black" stroke-opacity="0.08"/>

    <!-- Letter mark -->
    <text x="86" y="220" font-size="192" font-weight="800"
      font-family="Inter, SF Pro Text, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
      fill="${cfg.c1}">${cfg.iconText}</text>

    <!-- Accent bars -->
    <rect x="238" y="72" width="14" height="164" rx="7" fill="${cfg.c3}"/>
    <rect x="262" y="72" width="14" height="164" rx="7" fill="${cfg.c2}"/>
  </g>

  <!-- Wordmark -->
  <g transform="translate(372, 0)">
    <text x="0" y="172" font-size="112" font-weight="750"
      letter-spacing="-1.5"
      font-family="Inter, SF Pro Text, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
      fill="#111827">${cfg.text}</text>
    <rect x="0" y="202" width="530" height="10" rx="5" fill="${cfg.c1}"/>
    <rect x="540" y="202" width="78" height="10" rx="5" fill="${cfg.c3}"/>
    <rect x="624" y="202" width="78" height="10" rx="5" fill="${cfg.c2}"/>
  </g>
</svg>
`;

const faviconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" fill="none">
  <rect width="256" height="256" rx="38" fill="${cfg.bg}"/>
  <rect x="16" y="16" width="224" height="224" rx="32" fill="white" fill-opacity="0.62"/>
  <text x="66" y="177" font-size="142" font-weight="800"
    font-family="Inter, SF Pro Text, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fill="${cfg.c1}">${cfg.iconText}</text>
  <rect x="194" y="54" width="10" height="126" rx="5" fill="${cfg.c3}"/>
  <rect x="210" y="54" width="10" height="126" rx="5" fill="${cfg.c2}"/>
</svg>
`;

fs.writeFileSync(path.join(cfg.outDir, 'pluribus-logo.svg'), logoSvg);
fs.writeFileSync(path.join(cfg.outDir, 'pluribus-favicon.svg'), faviconSvg);

console.log('Generated:');
console.log(path.join(cfg.outDir, 'pluribus-logo.svg'));
console.log(path.join(cfg.outDir, 'pluribus-favicon.svg'));
console.log('Config:', cfg);
