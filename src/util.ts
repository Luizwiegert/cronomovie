import type { Item } from './data';

export const esc = (s: unknown): string =>
  String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const fmt = (n: number) => n.toFixed(1).replace('.', ',');

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function fmtDate(d: string): string {
  const [y, m, dd] = d.split('-').map(Number);
  return `${dd} ${MESES[m - 1]}` + (y !== new Date().getFullYear() ? ` ${y}` : '');
}

export const hours = (min: number) => Math.round(min / 60);

export function dur(it: Item): string {
  if (!it.m) return '';
  if (it.k !== 's') return it.m < 60 ? `${it.m} min` : `${Math.floor(it.m / 60)}h${String(it.m % 60).padStart(2, '0')}`;
  return `≈ ${Math.round(it.m / 60)}h`;
}

export const iso = (t: Date) =>
  `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;

// Só no computador (npm run dev): ?simular=2026-12-17T23:59:50 finge que agora é essa data e hora.
const SIM = import.meta.env.DEV ? new URLSearchParams(location.search).get('simular') : null;
const OFFSET = SIM && !Number.isNaN(Date.parse(SIM)) ? Date.parse(SIM) - Date.now() : 0;
export const now = () => Date.now() + OFFSET;

function today(): Date {
  const n = new Date(now());
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/** Quanto falta até a data (meia-noite, ou a hora h, no horário local), já quebrado em partes. */
export function countdown(d: { y: number; m: number; d: number; h?: number }) {
  const ms = Math.max(0, new Date(d.y, d.m - 1, d.d, d.h || 0).getTime() - now());
  const s = Math.floor(ms / 1000);
  return { done: ms === 0, d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
}

export const daysTo = (d: { y: number; m: number; d: number }) =>
  Math.round((new Date(d.y, d.m - 1, d.d).getTime() - today().getTime()) / 86400000);

export function hash(s: string): number {
  let h = 2166136261;
  for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function rng(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Troca de tela com uma passagem suave, onde o navegador oferece (e sem ela para quem pediu menos movimento). */
export function smooth(update: () => void) {
  const d = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<unknown>; finished: Promise<unknown> } };
  if (reduced() || document.hidden || !d.startViewTransition) { update(); return; }
  // Se outra troca começar antes desta acabar, o navegador pula a passagem (a tela já foi atualizada)
  const t = d.startViewTransition(update);
  t.ready.catch(() => {}); t.finished.catch(() => {});
}

export const RLBL = ['', 'Não gostei', 'Mais ou menos', 'Bom', 'Muito bom', 'Obra-prima'];

export const IC = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  rows: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="6" width="5" height="12" rx="1"/><rect x="9.5" y="6" width="5" height="12" rx="1"/><rect x="17" y="6" width="5" height="12" rx="1"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 004 0"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3.5M7.5 8L12 3.5 16.5 8"/><path d="M5 12.5V19a1.5 1.5 0 001.5 1.5h11A1.5 1.5 0 0019 19v-6.5"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7.5-4.6-9-9.5C2 7 4.2 4.5 7 4.5c2 0 3.3 1.1 5 3 1.7-1.9 3-3 5-3 2.8 0 5 2.5 4 6-1.5 4.9-9 9.5-9 9.5z"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13l11-6.5z"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 20V12M12 20V5M19 20v-6"/></svg>',
};

/** O símbolo da marca: a linha do tempo com a estreia em vermelho. */
export const MARK = '<svg class="mark" viewBox="0 0 64 32" aria-hidden="true"><line x1="8" y1="16" x2="48" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".42"/><circle cx="8" cy="16" r="4" fill="currentColor"/><circle cx="24" cy="16" r="4" fill="currentColor"/><circle cx="48" cy="16" r="11" fill="#E5484D"/></svg>';

/** Vibração curtinha de confirmação no toque (Android; no iPhone não faz nada). */
export function buzz(ms = 8) {
  try { navigator.vibrate?.(ms); } catch { /* sem vibração */ }
}

let toastT: number | undefined;
export function toast(msg: string) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastT);
  toastT = window.setTimeout(() => { t.hidden = true; }, 2200);
}
