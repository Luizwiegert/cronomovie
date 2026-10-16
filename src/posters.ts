import type { Item } from './data';
import { esc, hash, rng } from './util';
import TMDB from './posters.json';

/** Caminhos de cartaz do TMDB, gerados por scripts/fetch-posters.mjs */
const REAL = TMDB as Record<string, string>;
export const hasRealPosters = Object.keys(REAL).length > 0;
/** Endereço do cartaz oficial (ou null, quando o título só tem a ilustração gerada) */
export const posterURL = (id: string, size = 'w342') => (REAL[id] ? `https://image.tmdb.org/t/p/${size}${REAL[id]}` : null);

interface Style { a: string; b: string; c: string; c2?: string; m: string }

const STY: Record<string, Style> = {
  vingadores: { a: '#26365e', b: '#0a0e1a', c: '#d8b24a', m: 'burst' },
  ferro: { a: '#9a1f1f', b: '#2a0707', c: '#f4c65a', m: 'rings' },
  cap: { a: '#23428a', b: '#0b1733', c: '#f1f1f1', c2: '#d0213a', m: 'shield' },
  thor: { a: '#2a3d5e', b: '#080d18', c: '#a8dcff', m: 'bolt' },
  hulk: { a: '#35682d', b: '#0e1c0b', c: '#c79cf0', m: 'cracks' },
  viuva: { a: '#26262c', b: '#050506', c: '#e0303a', m: 'hourglass' },
  aranha: { a: '#b5161f', b: '#1c2f6e', c: '#f5f5f5', m: 'web' },
  gotg: { a: '#6a2f96', b: '#c8561f', c: '#ffd166', m: 'planet' },
  formiga: { a: '#86161a', b: '#141418', c: '#d0d4da', m: 'quantum' },
  estranho: { a: '#154047', b: '#040c0f', c: '#ffa53a', m: 'mandala' },
  pantera: { a: '#34195a', b: '#07040d', c: '#bd98ff', m: 'vibranium' },
  capita: { a: '#1f3278', b: '#8f1d29', c: '#ffcf3a', m: 'star' },
  loki: { a: '#15462f', b: '#040e09', c: '#dcb541', m: 'clock' },
  wanda: { a: '#7a1120', b: '#170306', c: '#ff5a78', m: 'hex' },
  multiverso: { a: '#231c55', b: '#070514', c: '#7fe6d6', m: 'orbits' },
  xmen: { a: '#1f2f60', b: '#0a0e22', c: '#ffd23f', m: 'xbars' },
  wolverine: { a: '#4a3a12', b: '#0f0b04', c: '#ffd23f', m: 'slash' },
  quarteto: { a: '#2263b8', b: '#0a1d3f', c: '#ffffff', m: 'four' },
  thunder: { a: '#3d3d42', b: '#0e0e10', c: '#f2f2f2', m: 'asterisk' },
  netflix: { a: '#5e0d0d', b: '#0c0202', c: '#e8453c', m: 'rain' },
  shield: { a: '#223242', b: '#070b10', c: '#a9b6c3', m: 'hexgrid' },
};

const OV: Record<string, Style> = {
  shangchi: { a: '#8e1a1a', b: '#1a0606', c: '#f2c14e', m: 'ten' },
  eternos: { a: '#6b5214', b: '#0d0a03', c: '#ffe08a', m: 'burst' },
  gaviao: { a: '#4b2a78', b: '#0c0714', c: '#c9a7ff', m: 'target' },
  cavaleiro: { a: '#3a3f4a', b: '#07080b', c: '#e9ecf2', m: 'moon' },
  lobisomem: { a: '#3a3a3a', b: '#050505', c: '#e6e6e6', m: 'moon' },
  invasao: { a: '#1f4a2a', b: '#050d07', c: '#8fe39a', m: 'hexgrid' },
  wonderman: { a: '#7a5a12', b: '#130d02', c: '#ffd76a', m: 'burst' },
  zombies: { a: '#3d4a1a', b: '#0b0d05', c: '#b6d957', m: 'cracks' },
  blade1: { a: '#5a0a10', b: '#060203', c: '#d9d9d9', m: 'slash' },
  blade2: { a: '#4a0a1a', b: '#060203', c: '#d9d9d9', m: 'slash' },
  blade3: { a: '#5a1a0a', b: '#060203', c: '#d9d9d9', m: 'slash' },
  elektra: { a: '#7a0f1a', b: '#0d0204', c: '#ff5a5a', m: 'slash' },
  dp1: { a: '#9c1414', b: '#140404', c: '#ffffff', m: 'eyes' },
  dp2: { a: '#8a1030', b: '#140404', c: '#ffffff', m: 'eyes' },
  deadpool3: { a: '#9c1414', b: '#3a2a05', c: '#ffffff', m: 'eyes' },
  doomsday: { a: '#124a33', b: '#040a07', c: '#9fa8ad', c2: '#3fbf80', m: 'mask' },
};

const f = (n: number) => String(Math.round(n * 10) / 10);

function polyPts(cx: number, cy: number, r: number, n: number, rot = -90) {
  const p: string[] = [];
  for (let k = 0; k < n; k++) { const a = (rot + k * 360 / n) * Math.PI / 180; p.push(f(cx + Math.cos(a) * r) + ',' + f(cy + Math.sin(a) * r)); }
  return p.join(' ');
}
function starPts(cx: number, cy: number, R: number, r: number, n: number) {
  const p: string[] = [];
  for (let k = 0; k < n * 2; k++) { const a = (-90 + k * 180 / n) * Math.PI / 180, rr = k % 2 ? r : R; p.push(f(cx + Math.cos(a) * rr) + ',' + f(cy + Math.sin(a) * rr)); }
  return p.join(' ');
}
function halftone(C: string, R: () => number, op: number) {
  const fx = 40 + R() * 120, fy = 60 + R() * 100;
  let s = '';
  for (let y = 6; y < 300; y += 12) for (let x = 6; x < 200; x += 12) {
    const r = Math.max(0, 5.4 - Math.hypot(x - fx, y - fy) / 28);
    if (r > .3) s += `<circle cx="${x}" cy="${y}" r="${f(r)}" fill="${C}" opacity="${op}"/>`;
  }
  return s;
}

function motif(st: Style, seed: number): string {
  const R = rng(seed), C = st.c, C2 = st.c2 || st.c, cx = 100, cy = 112;
  let s = '';
  switch (st.m) {
    case 'burst': { const o = R() * 10; for (let k = 0; k < 36; k++) { const a = (k * 10 + o) * Math.PI / 180; s += `<line x1="${f(cx + Math.cos(a) * 30)}" y1="${f(cy + Math.sin(a) * 30)}" x2="${f(cx + Math.cos(a) * 240)}" y2="${f(cy + Math.sin(a) * 240)}" stroke="${C}" stroke-width="${k % 2 ? 1 : 2.5}" opacity="${k % 2 ? .22 : .5}"/>`; } s += `<circle cx="${cx}" cy="${cy}" r="24" fill="none" stroke="${C}" stroke-width="3"/><circle cx="${cx}" cy="${cy}" r="9" fill="${C}"/>`; break; }
    case 'rings': { s += `<circle cx="${cx}" cy="${cy}" r="76" fill="none" stroke="${C}" stroke-width="1.5" opacity=".3"/><circle cx="${cx}" cy="${cy}" r="58" fill="none" stroke="${C}" stroke-width="9" opacity=".75" stroke-dasharray="14 5" transform="rotate(${f(R() * 30)} ${cx} ${cy})"/><circle cx="${cx}" cy="${cy}" r="42" fill="none" stroke="${C}" stroke-width="2" opacity=".55"/><circle cx="${cx}" cy="${cy}" r="27" fill="${C}"/><polygon points="${polyPts(cx, cy + 2, 16, 3)}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="3"/>`; break; }
    case 'shield': { const ox = cx + (R() - .5) * 20; s += `<circle cx="${f(ox)}" cy="${cy}" r="76" fill="${C2}" opacity=".9"/><circle cx="${f(ox)}" cy="${cy}" r="60" fill="${C}" opacity=".92"/><circle cx="${f(ox)}" cy="${cy}" r="45" fill="${C2}" opacity=".9"/><circle cx="${f(ox)}" cy="${cy}" r="31" fill="${st.a}"/><polygon points="${starPts(ox, cy, 28, 11, 5)}" fill="${C}"/>`; break; }
    case 'bolt': { for (let k = 0; k < 14; k++) { const x = R() * 280 - 40; s += `<line x1="${f(x)}" y1="0" x2="${f(x - 80)}" y2="300" stroke="${C}" stroke-width="1" opacity=".15"/>`; } s += `<polygon points="118,30 66,138 98,138 76,236 142,112 108,112 132,30" fill="${C}" opacity=".92"/>`; break; }
    case 'cracks': { for (let k = 0; k < 9; k++) { let a = (k / 9) * Math.PI * 2 + R() * .4, x = cx, y = cy, p = `M${cx} ${cy}`; for (let j = 0; j < 6; j++) { a += (R() - .5) * .9; x += Math.cos(a) * 22; y += Math.sin(a) * 22; p += ` L${f(x)} ${f(y)}`; } s += `<path d="${p}" fill="none" stroke="${C}" stroke-width="${f(3.2 - k * .2)}" opacity=".75" stroke-linejoin="round"/>`; } s += `<circle cx="${cx}" cy="${cy}" r="16" fill="${C}"/>`; break; }
    case 'hourglass': { s += `<circle cx="${cx}" cy="${cy}" r="72" fill="none" stroke="${C}" stroke-width="2" opacity=".35"/><polygon points="62,54 138,54 100,109" fill="${C}"/><polygon points="100,115 138,170 62,170" fill="${C}"/>`; break; }
    case 'web': { const N = 12; for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2; s += `<line x1="${cx}" y1="${cy}" x2="${f(cx + Math.cos(a) * 260)}" y2="${f(cy + Math.sin(a) * 260)}" stroke="${C}" stroke-width="1.4" opacity=".5"/>`; } for (let rr = 22; rr < 220; rr += 24) { let p = ''; for (let k = 0; k <= N; k++) { const a = k / N * Math.PI * 2, a2 = (k - .5) / N * Math.PI * 2; p += k === 0 ? `M${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr)}` : ` Q${f(cx + Math.cos(a2) * rr * .9)} ${f(cy + Math.sin(a2) * rr * .9)} ${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr)}`; } s += `<path d="${p}" fill="none" stroke="${C}" stroke-width="1.2" opacity=".45"/>`; } break; }
    case 'planet': { for (let k = 0; k < 28; k++) s += `<circle cx="${f(R() * 200)}" cy="${f(R() * 190)}" r="${f(R() * 1.4 + .4)}" fill="#fff" opacity="${f(R() * .6 + .2)}"/>`; s += `<circle cx="112" cy="${cy}" r="56" fill="${C}" opacity=".92"/><ellipse cx="112" cy="${cy}" rx="96" ry="18" fill="none" stroke="#fff" stroke-width="3" opacity=".6" transform="rotate(-18 112 ${cy})"/>`; break; }
    case 'quantum': { ([[70, 82, 52], [132, 150, 28], [160, 190, 15], [174, 213, 8], [182, 226, 4]] as const).forEach(([x, y, r], k) => { s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${k === 4 ? C : 'none'}" stroke="${C}" stroke-width="${f(Math.max(1.2, r / 9))}" opacity="${f(.9 - k * .08)}"/>`; }); break; }
    case 'mandala': { const o = R() * 15; for (let k = 0; k < 6; k++) s += `<rect x="${cx - 48}" y="${cy - 48}" width="96" height="96" fill="none" stroke="${C}" stroke-width="1.6" opacity=".7" transform="rotate(${f(k * 15 + o)} ${cx} ${cy})"/>`; s += `<circle cx="${cx}" cy="${cy}" r="76" fill="none" stroke="${C}" stroke-width="2" opacity=".5"/><circle cx="${cx}" cy="${cy}" r="86" fill="none" stroke="${C}" stroke-width="1" stroke-dasharray="2 4" opacity=".6"/><circle cx="${cx}" cy="${cy}" r="18" fill="${C}"/>`; break; }
    case 'vibranium': { for (let row = 0; row < 13; row++) for (let col = -1; col < 9; col++) { const x = col * 26 + (row % 2 ? 13 : 0), y = row * 24; s += `<polygon points="${x},${y + 22} ${x + 13},${y} ${x + 26},${y + 22}" fill="none" stroke="${C}" stroke-width=".8" opacity=".2"/>`; } s += `<polygon points="100,44 150,${cy} 100,180 50,${cy}" fill="none" stroke="${C}" stroke-width="3"/><polygon points="100,70 128,${cy} 100,154 72,${cy}" fill="${C}" opacity=".85"/>`; break; }
    case 'star': { s += `<circle cx="${cx}" cy="${cy}" r="80" fill="none" stroke="${C}" stroke-width="1.5" opacity=".4"/><polygon points="${starPts(cx, cy, 72, 24, 8)}" fill="${C}" opacity=".95" transform="rotate(${f(R() * 22)} ${cx} ${cy})"/>`; break; }
    case 'clock': { s += `<circle cx="${cx}" cy="${cy}" r="70" fill="none" stroke="${C}" stroke-width="3"/>`; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; s += `<line x1="${f(cx + Math.cos(a) * 57)}" y1="${f(cy + Math.sin(a) * 57)}" x2="${f(cx + Math.cos(a) * 66)}" y2="${f(cy + Math.sin(a) * 66)}" stroke="${C}" stroke-width="${k % 3 ? 2 : 4}"/>`; } const h1 = R() * 6.28, h2 = R() * 6.28; s += `<line x1="${cx}" y1="${cy}" x2="${f(cx + Math.cos(h1) * 36)}" y2="${f(cy + Math.sin(h1) * 36)}" stroke="${C}" stroke-width="5" stroke-linecap="round"/><line x1="${cx}" y1="${cy}" x2="${f(cx + Math.cos(h2) * 52)}" y2="${f(cy + Math.sin(h2) * 52)}" stroke="${C}" stroke-width="3" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="6" fill="${C}"/>`; break; }
    case 'hex': { for (let k = 0; k < 5; k++) { const y = 40 + k * 56; s += `<path d="M-10 ${y} C 40 ${y - 20}, 60 ${y + 20}, 110 ${y} S 180 ${y - 20}, 210 ${y}" fill="none" stroke="${C}" stroke-width="1.5" opacity=".3"/>`; } [74, 54, 34].forEach((rr, k) => { s += `<polygon points="${polyPts(cx, cy, rr, 6, 0)}" fill="${k === 2 ? C : 'none'}" stroke="${C}" stroke-width="${k === 1 ? 5 : 2}" opacity="${k === 0 ? .5 : .9}"/>`; }); break; }
    case 'orbits': { for (let k = 0; k < 8; k++) { const ox = cx + (R() - .5) * 60, oy = cy + (R() - .5) * 60, rr = 30 + R() * 60; s += `<circle cx="${f(ox)}" cy="${f(oy)}" r="${f(rr)}" fill="none" stroke="${C}" stroke-width="${f(1 + R() * 2)}" opacity="${f(.3 + R() * .5)}"/>`; } s += `<circle cx="${cx}" cy="${cy}" r="10" fill="${C}"/>`; break; }
    case 'xbars': { s += halftone(C, R, .18) + `<rect x="${cx - 15}" y="${cy - 92}" width="30" height="184" rx="6" fill="${C}" transform="rotate(38 ${cx} ${cy})"/><rect x="${cx - 15}" y="${cy - 92}" width="30" height="184" rx="6" fill="${C}" opacity=".85" transform="rotate(-38 ${cx} ${cy})"/>`; break; }
    case 'slash': { const o = (R() - .5) * 20; for (let k = 0; k < 3; k++) { const x = 78 + k * 26 + o; s += `<line x1="${f(x + 40)}" y1="40" x2="${f(x - 40)}" y2="200" stroke="${C}" stroke-width="7" stroke-linecap="round" opacity=".92"/>`; } break; }
    case 'four': { s += `<circle cx="${cx}" cy="${cy}" r="64" fill="none" stroke="${C}" stroke-width="7"/><text x="${cx}" y="${cy + 38}" text-anchor="middle" font-family="Big Shoulders Display, Impact, sans-serif" font-weight="900" font-size="112" fill="${C}">4</text>`; break; }
    case 'asterisk': { for (let k = 0; k < 12; k++) s += `<line x1="0" y1="${k * 28}" x2="200" y2="${k * 28 - 40}" stroke="${C}" stroke-width="1" opacity=".12"/>`; for (let k = 0; k < 3; k++) s += `<rect x="${cx - 8}" y="${cy - 70}" width="16" height="140" rx="3" fill="${C}" transform="rotate(${k * 60} ${cx} ${cy})"/>`; break; }
    case 'rain': { for (let k = 0; k < 70; k++) { const x = R() * 200, y = R() * 300, l = 14 + R() * 40; s += `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x - 4)}" y2="${f(y + l)}" stroke="${C}" stroke-width="1" opacity="${f(.15 + R() * .35)}"/>`; } s += `<rect x="0" y="${cy - 4}" width="200" height="8" fill="${C}" opacity=".85"/>`; break; }
    case 'hexgrid': { for (let row = 0; row < 14; row++) for (let col = 0; col < 9; col++) { const x = col * 26 + (row % 2 ? 13 : 0), y = row * 22; s += `<polygon points="${polyPts(x, y, 12, 6, 30)}" fill="none" stroke="${C}" stroke-width=".8" opacity=".2"/>`; } s += `<polygon points="${polyPts(cx, cy, 48, 6, 30)}" fill="none" stroke="${C}" stroke-width="5"/><polygon points="${polyPts(cx, cy, 28, 6, 30)}" fill="${C}" opacity=".8"/>`; break; }
    case 'ten': { for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; s += `<circle cx="${f(cx + Math.cos(a) * 56)}" cy="${f(cy + Math.sin(a) * 56)}" r="13" fill="none" stroke="${C}" stroke-width="4.5"/>`; } s += `<circle cx="${cx}" cy="${cy}" r="28" fill="${C}" opacity=".3"/>`; break; }
    case 'target': { [72, 54, 36, 18].forEach((rr, k) => { s += `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="${k === 3 ? C : 'none'}" stroke="${C}" stroke-width="3" opacity="${f(.4 + k * .18)}"/>`; }); s += `<line x1="${cx}" y1="${cy}" x2="190" y2="20" stroke="${C}" stroke-width="3"/>`; break; }
    case 'moon': { for (let k = 0; k < 24; k++) s += `<circle cx="${f(R() * 200)}" cy="${f(R() * 200)}" r="${f(R() * 1.2 + .3)}" fill="#fff" opacity="${f(R() * .5 + .2)}"/>`; s += `<path d="M125 50 A64 64 0 1 0 125 174 A50 50 0 1 1 125 50Z" fill="${C}" opacity=".95"/>`; break; }
    case 'eyes': { s += `<circle cx="${cx}" cy="${cy}" r="68" fill="#0b0b0d"/><ellipse cx="${cx - 26}" cy="${cy - 4}" rx="20" ry="11" fill="${C}" transform="rotate(20 ${cx - 26} ${cy - 4})"/><ellipse cx="${cx + 26}" cy="${cy - 4}" rx="20" ry="11" fill="${C}" transform="rotate(-20 ${cx + 26} ${cy - 4})"/>`; break; }
    case 'mask': { s += `<circle cx="${cx}" cy="${cy + 6}" r="94" fill="${C2}" opacity=".22"/><rect x="58" y="48" width="84" height="134" rx="30" fill="${C}"/><rect x="68" y="92" width="26" height="8" rx="2" fill="#050807"/><rect x="106" y="92" width="26" height="8" rx="2" fill="#050807"/><line x1="${cx}" y1="102" x2="${cx}" y2="132" stroke="#050807" stroke-width="3" opacity=".5"/>`; for (let k = 0; k < 5; k++) s += `<rect x="${83 + k * 8}" y="142" width="3" height="28" fill="#050807" opacity=".85"/>`; break; }
    default: { s += halftone(C, R, .45) + `<circle cx="${cx}" cy="${cy}" r="40" fill="none" stroke="${C}" stroke-width="3" opacity=".7"/>`; }
  }
  return s;
}

export function styleOf(it: Item): Style {
  if (OV[it.id]) return OV[it.id];
  const k = it.fr[0];
  if (STY[k]) return STY[k];
  const h = hash(it.id) % 360;
  return { a: `hsl(${h} 45% 28%)`, b: `hsl(${h} 40% 6%)`, c: `hsl(${h} 80% 72%)`, m: 'halftone' };
}

function splitTitle(t: string): [string, string] {
  const s = t.match(/^(.*?)\s*\(T([^)]*)\)$/);
  if (s) { const n = s[2].replace(/T/g, ''); return [(/ e | a /.test(n) ? 'Temporadas ' : 'Temporada ') + n, s[1]]; }
  const y = t.match(/^(.*?)\s*\((\d{4})\)$/);
  if (y) return ['', y[1]];
  const i = t.indexOf(':');
  if (i > 0) return [t.slice(0, i), t.slice(i + 1).trim()];
  return ['', t];
}

const cache: Record<string, string> = {};
/** Cartazes que já carregaram nesta visita (título + tamanho): ao redesenhar a tela, não surgem de novo */
const shown = new Set<string>();

/** Cartaz do título: o oficial do TMDB quando existe, com a ilustração gerada por baixo (reserva se a imagem falhar). */
export function posterHTML(it: Item, size: 'sm' | 'lg' = 'sm'): string {
  const key = it.id + size;
  if (cache[key]) return shown.has(key) ? cache[key].replace('class="p-img"', 'class="p-img ok"') : cache[key];
  const st = styleOf(it), [kick, main] = splitTitle(it.t), L = main.length;
  const sz = L <= 9 ? 'xl' : L <= 15 ? 'l' : L <= 24 ? 'm' : 's';
  const path = REAL[it.id];
  const img = path ? `<img class="p-img" data-k="${key}" src="https://image.tmdb.org/t/p/${size === 'lg' ? 'w500' : 'w342'}${path}" alt="" loading="lazy" decoding="async">` : '';
  return cache[key] = `<span class="poster" style="--pa:${st.a};--pb:${st.b}"><svg class="motif" viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${motif(st, hash(it.id))}</svg><span class="p-title">${kick ? `<small>${esc(kick)}</small>` : ''}<b class="${sz}">${esc(main)}</b></span>${img}</span>`;
}

/** Se um cartaz do TMDB falhar, some com ele e fica a ilustração. */
export function installPosterFallback() {
  document.addEventListener('load', e => {
    const t = e.target;
    if (t instanceof HTMLImageElement && t.classList.contains('p-img')) { t.classList.add('ok'); if (t.dataset.k) shown.add(t.dataset.k); }
  }, true);
  document.addEventListener('error', e => {
    const t = e.target;
    if (t instanceof HTMLImageElement && t.classList.contains('p-img')) {
      // Falha passageira acontece: tenta mais uma vez antes de mostrar a ilustração.
      if (!t.dataset.retry) {
        t.dataset.retry = '1';
        const src = t.src;
        setTimeout(() => { t.src = src + (src.includes('?') ? '&' : '?') + 'r=1'; }, 1500);
        return;
      }
      t.remove();
    }
  }, true);
}
