import { esc } from './util';

/** Sinopse, onde assistir (Brasil) e episódios de cada título, gerados por scripts/fetch-posters.mjs. */
export interface Season { label: string; eps: [string, number | null][] }
export interface Details {
  ov?: string;
  prov?: { link?: string; s?: [string, string][]; r?: [string, string][]; b?: [string, string][] };
  seasons?: Season[];
  /** Trailer no YouTube (código do vídeo) */
  tr?: string;
}
let DETAILS: Record<string, Details> = {};
let ready = false, loading: Promise<void> | undefined;
/** Os detalhes pesam mais que o resto dos dados juntos e só aparecem ao abrir um título: são baixados logo depois da primeira tela. */
export function loadDetails(): Promise<void> {
  return loading ??= import('./details.json').then(m => { DETAILS = m.default as unknown as Record<string, Details>; ready = true; },
    e => { loading = undefined; throw e; });
}
export const detailsReady = () => ready;
export const detailsOf = (id: string): Details => DETAILS[id] || {};

/** Total de episódios de uma série (0 se não for série com episódios). */
export const episodeCount = (id: string) => (detailsOf(id).seasons || []).reduce((a, s) => a + s.eps.length, 0);

// Canais repetidos (versões com anúncio, canais dentro da Amazon…) poluem a lista.
const NOISE = /with ads|amazon channel|standard with ads|basic with ads|claro tv\+/i;
const NAMES: Record<string, string> = { 'Disney Plus': 'Disney+', 'Amazon Prime Video': 'Prime Video' };
const clean = (list?: [string, string][]) => (list || []).filter(([n]) => !NOISE.test(n)).slice(0, 5);

/* ---------- meus streamings: a pessoa marca os que assina e a linha do tempo pode mostrar só o que está neles ---------- */
const SERVICE_OF: [RegExp, string][] = [
  [/^disney/i, 'Disney+'], [/^netflix/i, 'Netflix'], [/^amazon prime/i, 'Prime Video'], [/hbo max|^max$/i, 'HBO Max'],
  [/^apple tv/i, 'Apple TV'], [/globoplay/i, 'Globoplay'], [/^claro/i, 'Claro'], [/mercado play/i, 'Mercado Play'],
  [/pluto/i, 'Pluto TV'], [/telecine/i, 'Telecine'], [/universal\+/i, 'Universal+'], [/sony one/i, 'Sony One'],
];
export const SERVICES = SERVICE_OF.map(([, s]) => s);
const serviceOf = (name: string) => SERVICE_OF.find(([re]) => re.test(name))?.[1] || null;
/** Streamings em que o título está para assinantes (ou grátis) */
export const servicesOf = (id: string) => new Set((detailsOf(id).prov?.s || []).map(([n]) => serviceOf(n)).filter((s): s is string => !!s));

const MINE = 'cronomovie-streamings';
let mine: Set<string> | null = null;
/** Os streamings que a pessoa assina (guardados neste aparelho) */
export function myServices(): Set<string> {
  if (!mine) { try { mine = new Set(JSON.parse(localStorage.getItem(MINE) || '[]')); } catch { mine = new Set(); } }
  return mine;
}
export function setMyServices(list: Iterable<string>) {
  mine = new Set(list);
  try { localStorage.setItem(MINE, JSON.stringify([...mine])); } catch { /* sem armazenamento: vale só nesta visita */ }
}
/** O título está em algum streaming que a pessoa assina? */
export const inMyServices = (id: string) => { const m = myServices(); for (const s of servicesOf(id)) if (m.has(s)) return true; return false; };

const logo = ([n, l]: [string, string]) => {
  const have = myServices().has(serviceOf(n) || '');
  return `<span class="prov${have ? ' mine' : ''}" title="${esc(NAMES[n] || n)}"><img src="https://image.tmdb.org/t/p/w92${l}" alt="" loading="lazy"><span>${esc(NAMES[n] || n)}${have ? '<small>Você assina</small>' : ''}</span></span>`;
};

/** Bloco "Onde assistir" do detalhe. */
export function whereHTML(id: string): string {
  if (!ready) return '<p class="muted">Carregando…</p>';
  const p = detailsOf(id).prov;
  const s = clean(p?.s), rb = clean([...(p?.r || []), ...(p?.b || [])].filter((x, i, a) => a.findIndex(y => y[0] === x[0]) === i));
  if (!s.length && !rb.length) return '<p class="muted">Ainda não está em nenhum streaming no Brasil.</p>';
  return `${s.length ? `<div class="provs">${s.map(logo).join('')}</div>` : ''}
    ${rb.length ? `<p class="prov-sub">${s.length ? 'Também para alugar ou comprar:' : 'Para alugar ou comprar:'} ${rb.map(([n]) => esc(NAMES[n] || n)).join(', ')}</p>` : ''}
    ${p?.link ? `<p class="prov-sub"><a href="${esc(p.link)}" target="_blank" rel="noopener">Ver todas as opções</a>. Dados de streaming: JustWatch.</p>` : ''}`;
}
