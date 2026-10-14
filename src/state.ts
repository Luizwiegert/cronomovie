import { BUCKETS, BYID, DOOMSDAY, ESS, EVENTS, EXTRAS_ORDER, FILTERS, ITEMS, MAIN, RELEASES, TRILHA } from './data';
import type { Item, Release } from './data';
import { avatarById, avatarStyle, photoStyle, photoURL } from './avatars';
import { countdown, esc, fmt, norm } from './util';

/** Doomsday já estreou? Antes disso ele não pode ser marcado. */
export const released = () => countdown(DOOMSDAY).done;

/** Próxima grande estreia que ainda não aconteceu (ou nenhuma). */
export const nextEvent = () => EVENTS.find(e => !countdown(e.date).done) || null;

const stamp = (r: Release) => new Date(r.date.y, r.date.m - 1, r.date.d, r.date.h || 0).getTime();
/** Lançamentos que ainda vão acontecer: a próxima grande estreia primeiro, depois os outros por data (um por título). */
export function upcoming(): Release[] {
  const main = nextEvent(), seen = new Set(main ? [main.id] : []);
  const rest = RELEASES.filter(r => !countdown(r.date).done).sort((a, b) => stamp(a) - stamp(b))
    .filter(r => !seen.has(r.id) && !!seen.add(r.id));
  return main ? [main, ...rest] : rest;
}

export interface Mark { r: number | null; c: string; d: string }
/** favorite = id do filme ou série favorita (ou null) */
export interface Person { id: string; name: string; color: string; avatar: string | null; username?: string | null; favorite?: string | null }
/** Listas e episódios de um título: quero ver, assistindo agora, e episódios vistos ("temporada:episódio") */
export interface Watch { list: 'quero' | 'assistindo' | null; eps: string[] }
/** Pedido de amizade (pending) ou amizade aceita (accepted). a pediu, b recebeu. */
export interface Friendship { a: string; b: string; status: 'pending' | 'accepted' }

/** O que muda por trás do app: demonstração local ou Supabase de verdade. */
export interface Backend {
  /** guest = visitante sem conta: vê tudo, mas não marca nada */
  mode: 'demo' | 'live' | 'guest';
  setMark(titleId: string, patch: Partial<Mark> | null): void;
  /** username e favorite: sem passar (undefined), ficam como estão */
  updateProfile(name: string, avatar: string | null, username?: string | null, favorite?: string | null): Promise<void>;
  /** O que é público de um perfil (nome, @, foto e favorito), buscado pelo @. Funciona sem conta: é o que o link de perfil mostra. */
  profileCard(username: string): Promise<Person | null>;
  /** Guarda a foto que a pessoa enviou e devolve o valor que vai no perfil (ainda sem salvar o perfil) */
  uploadPhoto(photo: Blob): Promise<string>;
  /** Muda listas/episódios de um título (null apaga) */
  setWatch(titleId: string, patch: Partial<Watch> | null): void;
  /** O @ está livre? */
  usernameAvailable(u: string): Promise<boolean>;
  signOut(): Promise<void>;
  /** Apaga a conta e tudo que é dela (marcações, listas, amizades) */
  deleteAccount(): Promise<void>;
  /** Busca pessoas pelo nome (sem você) */
  searchPeople(q: string): Promise<Person[]>;
  /** Pede amizade; se a pessoa já tinha pedido para você, aceita */
  requestFriend(p: Person): Promise<void>;
  acceptFriend(id: string): Promise<void>;
  /** Recusa, cancela o pedido ou desfaz a amizade */
  removeFriend(id: string): Promise<void>;
  /** Só na demonstração: trocar de pessoa */
  switchUser(id: string): void;
  /** Só na demonstração: voltar aos dados de exemplo */
  resetDemo(): void;
}

export const S = {
  me: '',
  /** Perfis conhecidos: você, seus amigos e quem está em algum pedido com você */
  people: [] as Person[],
  friendships: [] as Friendship[],
  watch: {} as Record<string, Record<string, Watch>>,
  marks: {} as Record<string, Record<string, Mark>>,
  backend: null as Backend | null,
};

/** Visitante sem conta? */
export const isGuest = () => !S.me;

/** Ligações com a tela de entrar/criar conta (preenchidas no main.ts) */
export const nav = {
  openAuth: (_mode: 'entrar' | 'criar') => {},
};

let listener: () => void = () => {};
export const onState = (fn: () => void) => { listener = fn; };
export const emit = () => listener();

export type Tab = 'linha' | 'ranking' | 'amigos' | 'perfil';
export const TABS: Tab[] = ['linha', 'ranking', 'amigos', 'perfil'];

export const UI = {
  tab: 'linha' as Tab,
  type: 'all',
  order: 'crono',
  view: 'h',
  hide: false,
  q: '',
  saga: null as string | null,
  metric: 'main',
  profile: null as string | null,
  editing: false,
  editColor: null as string | null,
  modal: null as string | null,
  menu: false,
  /** Busca na aba Amigos */
  fq: '',
  /** Trilha Vingadores ligada: a linha do tempo mostra só o que leva a Doomsday */
  trail: false,
};

const PREF = 'moviegram-prefs';
try {
  const p = JSON.parse(localStorage.getItem(PREF) || '{}');
  if (p.view === 'h' || p.view === 'v') UI.view = p.view;
  if (p.order === 'crono' || p.order === 'lanc') UI.order = p.order;
  if (typeof p.trail === 'boolean') UI.trail = p.trail;
} catch { /* sem preferências salvas */ }
export function savePrefs() {
  try { localStorage.setItem(PREF, JSON.stringify({ view: UI.view, order: UI.order, trail: UI.trail })); } catch { /* ignorado */ }
}

const other = (f: Friendship) => (f.a === S.me ? f.b : f.a);
const mine = (f: Friendship) => f.a === S.me || f.b === S.me;
/** Amigos aceitos de quem está usando o site */
export const friendIds = () => S.friendships.filter(f => f.status === 'accepted' && mine(f)).map(other);
/** Pedidos que chegaram para você e ainda não foram respondidos */
export const incomingIds = () => S.friendships.filter(f => f.status === 'pending' && f.b === S.me).map(f => f.a);
/** Pedidos que você mandou e ainda não foram respondidos */
export const outgoingIds = () => S.friendships.filter(f => f.status === 'pending' && f.a === S.me).map(f => f.b);
/** Relação com uma pessoa: amigo, pedido enviado, pedido recebido ou nenhuma */
export function relation(id: string): 'friend' | 'sent' | 'received' | 'none' {
  const f = S.friendships.find(x => (x.a === S.me && x.b === id) || (x.b === S.me && x.a === id));
  if (!f) return 'none';
  if (f.status === 'accepted') return 'friend';
  return f.a === S.me ? 'sent' : 'received';
}
/** Quem entra no ranking, nas médias e nas bolinhas: você e seus amigos */
export const pids = () => {
  const fr = friendIds().sort((x, y) => P(x).name.localeCompare(P(y).name, 'pt'));
  return S.me ? [S.me, ...fr] : fr;
};
export const marksOf = (pid: string): Record<string, Mark> => S.marks[pid] || (S.marks[pid] = {});
export const watchOf = (pid: string): Record<string, Watch> => S.watch[pid] || (S.watch[pid] = {});
/** Formato aceito para o @: 3 a 20 letras minúsculas, números, ponto ou _ */
export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

export function P(pid: string): Person {
  return S.people.find(p => p.id === pid) || { id: pid, name: 'Alguém', color: '#6A7080', avatar: null };
}

/** Foto de perfil: o personagem escolhido ou a foto enviada; sem nenhum dos dois, a inicial do nome. */
export function av(pid: string, size = ''): string {
  const p = P(pid), a = avatarById(p.avatar), photo = a ? null : photoURL(pid, p.avatar);
  const style = a ? avatarStyle(a) : photo ? photoStyle(photo) : '';
  if (style) return `<span class="av pic ${size}" style="${style}" title="${esc(p.name)}" aria-hidden="true"></span>`;
  return `<span class="av ${size}" title="${esc(p.name)}" aria-hidden="true">${esc((p.name.trim()[0] || '?').toUpperCase())}</span>`;
}

export const starsHTML = (v: number, cls = '') =>
  `<span class="stars ${cls}" style="--v:${Math.round(v / 5 * 100)}%" role="img" aria-label="${fmt(v)} de 5 estrelas"><i></i><i></i><i></i><i></i><i></i><b><i></i><i></i><i></i><i></i><i></i></b></span>`;

export interface Stats {
  seenMain: number; seenEss: number; extras: number; seenAll: number; minutes: number;
  avg: number | null; rs: number[]; rated: number; comments: number; first: string | null; last: string | null;
}

export function stats(pid: string): Stats {
  const m = marksOf(pid);
  const ids = Object.keys(m).filter(id => BYID[id]);
  const byId = (id: string) => BYID[id];
  const rs = ids.map(id => m[id].r).filter((r): r is number => r != null);
  const dated = ids.filter(id => m[id].d).sort((a, b) => m[b].d.localeCompare(m[a].d) || byId(b).i - byId(a).i);
  return {
    seenMain: MAIN.filter(it => m[it.id]).length,
    seenEss: ESS.filter(it => m[it.id]).length,
    extras: ids.filter(id => byId(id).e === 5).length,
    seenAll: ids.length,
    minutes: ids.reduce((a, id) => a + (byId(id).m || 0), 0),
    avg: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
    rs, rated: rs.length,
    comments: ids.filter(id => m[id].c).length,
    first: dated.length ? m[dated[dated.length - 1]].d : null,
    last: dated[0] || null,
  };
}

export function ranked(metric: string) {
  const k = ({ main: 'seenMain', horas: 'minutes', ess: 'seenEss' } as const)[metric as 'main'] || 'seenMain';
  return pids().map(pid => ({ pid, s: stats(pid) })).sort((a, b) => b.s[k] - a.s[k] || b.s.seenAll - a.s.seenAll);
}

export function crowd(it: Item) {
  const who = pids().filter(pid => marksOf(pid)[it.id]);
  const rs = who.map(pid => marksOf(pid)[it.id].r).filter((r): r is number => r != null);
  return { who, rs, avg: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null };
}

export function orderedMain(): Item[] {
  const l = ITEMS.filter(it => it.e <= 4);
  return UI.order === 'lanc' ? l.slice().sort((a, b) => a.r < b.r ? -1 : a.r > b.r ? 1 : a.i - b.i) : l;
}
export const orderedAll = () => orderedMain().concat(EXTRAS_ORDER);

export function eraOf(it: Item): number {
  if (it.e === 5 || UI.order === 'crono') return it.e;
  return BUCKETS.findIndex(b => it.r <= b.to);
}

export function nextUp(): Item | undefined {
  const m = marksOf(S.me);
  return (UI.trail ? trailSeq() : orderedMain()).find(it => !m[it.id] && (!it.opt || UI.trail) && (it.id !== 'doomsday' || released()));
}

export function passes(it: Item): boolean {
  const m = marksOf(S.me), q = UI.q.trim();
  if (UI.trail && !TRILHA.has(it.id)) return false;
  if (UI.type === 'star' && !it.star) return false;
  if (UI.type === 'film' && it.k === 's') return false;
  if (UI.type === 'series' && it.k !== 's') return false;
  if (UI.saga && !FILTERS[UI.saga]?.ids.has(it.id)) return false;
  if (UI.hide && m[it.id]) return false;
  if (q && !norm(it.t).includes(norm(q))) return false;
  return true;
}

/** Título de uma grande estreia: o item da lista ou, se não estiver nela (ex.: Guerras Secretas), um item só para o cartaz. */
export function eventItem(ev: { id: string; t: string; k?: Item['k']; date: { y: number; m?: number } }): Item {
  return BYID[ev.id] || { id: ev.id, t: ev.t, k: ev.k || 'f', r: `${ev.date.y}-${String(ev.date.m || 12).padStart(2, '0')}`, star: false, opt: false, n: '', e: 4, fr: ['vingadores'], m: null, i: 9999 };
}

/** A trilha na ordem de ver: a linha principal, com os X-Men e o Quarteto antigo da Fox logo antes de Deadpool & Wolverine. */
export function trailSeq(): Item[] {
  const main = orderedMain().filter(it => TRILHA.has(it.id));
  const fox = EXTRAS_ORDER.filter(it => TRILHA.has(it.id));
  const k = main.findIndex(it => it.id === 'deadpool3');
  return k < 0 ? main.concat(fox) : [...main.slice(0, k), ...fox, ...main.slice(k)];
}

/** Quanto da trilha a pessoa já viu (Doomsday fica fora da conta até estrear). */
export function trailProgress(pid: string) {
  const m = marksOf(pid), all = trailSeq().filter(it => it.id !== 'doomsday');
  return { seen: all.filter(it => m[it.id]).length, total: all.length };
}
