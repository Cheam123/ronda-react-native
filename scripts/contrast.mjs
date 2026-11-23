// WCAG 2.x contrast for Ronda's token pairs, both palettes: node scripts/contrast.mjs
// Text needs 4.5:1, edges and icons 3:1 (WCAG 1.4.3, 1.4.11). Exits 1 if any pair fails.
import { readFileSync } from 'node:fs';
const src = readFileSync(process.argv[2] ?? new URL('../src/theme/tokens.ts', import.meta.url), 'utf8');
// Pull the two palette object literals out and evaluate them (plain data only).
const grab = (name) => {
  const start = src.indexOf(`export const ${name}: Palette = {`);
  let i = src.indexOf('{', start), depth = 0, j = i;
  for (; j < src.length; j++) { if (src[j] === '{') depth++; if (src[j] === '}' && --depth === 0) break; }
  return Function(`return (${src.slice(i, j + 1)})`)();
};
const lum = (hex) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
for (const name of ['light', 'dark']) {
  const p = grab(name);
  const rows = [];
  const add = (label, fg, bg, min) => rows.push({ label, r: ratio(fg, bg), min });
  for (const bgName of ['ground', 'panel', 'raised']) for (const fg of ['ink', 'body', 'ink2', 'muted', 'link', 'danger', 'brandInk']) add(`${fg} on ${bgName}`, p[fg], p[bgName], 4.5);
  add('chevron on panel (icon)', p.chevron, p.panel, 3);
  add('control border on panel (field edge)', p.control, p.panel, 3);
  add('control border on ground (field edge on the page)', p.control, p.ground, 3);
  add('control border on raised (dark fields)', p.control, p.raised, 3);
  add('check ring on panel (checkbox edge)', p.check.ring, p.panel, 3);
  add('switch knob on off track', '#FFFFFF', p.control, 3);
  add('primary fg on primary bg', p.primary.fg, p.primary.bg, 4.5);
  add('chipOn fg/bg', p.chipOn.fg, p.chipOn.bg, 4.5);
  add('chipOff fg/bg', p.chipOff.fg, p.chipOff.bg, 4.5);
  add('tab inactive on bar', p.tabBar.inactive, name === 'dark' ? '#1A2230' : '#FFFFFF', 4.5);
  add('tab active on bar', p.tabBar.active, name === 'dark' ? '#1A2230' : '#FFFFFF', 4.5);
  add('toast fg', p.toast.fg, p.toast.bg, 4.5);
  add('toast action', p.toast.action, p.toast.bg, 4.5);
  add('brandInk on brandTint', p.brandInk, p.brandTint, 4.5);
  for (const [t, v] of Object.entries(p.tones)) { add(`tone ${t}: ink on tile`, v.ink, v.tile, 4.5); add(`tone ${t}: ink on panel`, v.ink, p.panel, 4.5); }
  for (const [s, v] of Object.entries(p.status)) add(`status ${s}: ink on bg`, v.ink, v.bg, 4.5);
  for (const [i, v] of p.avatars.entries()) add(`avatar ${i}`, v.ink, v.bg, 4.5);
  console.log(`\n== ${name}`);
  for (const r of rows) {
    if (r.r < r.min) process.exitCode = 1;
    console.log(`${r.r < r.min ? 'FAIL' : ' ok '}  ${r.r.toFixed(2).padStart(5)}  (min ${r.min})  ${r.label}`);
  }
}
