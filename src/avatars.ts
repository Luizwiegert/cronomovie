import LIST from './avatars.json';
import { IC, esc, norm } from './util';

// Fotos de perfil. Duas origens:
//  - personagens: imagens da pasta avatares/, preparadas por scripts/avatares.mjs (npm run avatares)
//    e servidas de public/avatars/<id>.webp;
//  - foto da própria pessoa: enviada no perfil e guardada no Supabase (balde "avatars").

/** char = personagem; variant = nome daquela versão, quando há mais de uma; team = fileira em que aparece no seletor */
export interface Avatar { id: string; name: string; char: string; variant?: string; group: 'heroi' | 'vilao'; team: string }

export const AVATARS = LIST as Avatar[];

const BY_ID: Record<string, Avatar> = Object.fromEntries(AVATARS.map(a => [a.id, a]));

// Fotos da primeira versão que viraram outro id. As que saíram mostram a inicial até a pessoa escolher de novo.
const ALIAS: Record<string, string> = { bucky: 'soldado-invernal' };

export const avatarById = (id: string | null | undefined) => (id ? BY_ID[id] || BY_ID[ALIAS[id]] : undefined);

const cover = (url: string) => `background-image:url('${url}');background-size:cover;background-position:center`;
export const avatarStyle = (a: Avatar) => cover(`/avatars/${a.id}.webp`);

/* ---------- foto da própria pessoa ---------- */

/** Valor guardado no perfil quando a foto é da pessoa: "foto:<versão>". O arquivo fica em avatars/<id da pessoa>/<versão>.jpg */
const STORED = /^foto:([a-z0-9]{1,30})$/;
/** Na demonstração não há servidor: a imagem vai embutida no próprio valor */
const INLINE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
/** Foto escolhida no formulário e ainda não enviada */
export const NEW_PHOTO = 'foto:nova';
const BASE = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) || '').replace(/\/$/, '');

export const isPhoto = (v: string | null | undefined): boolean => !!v && (STORED.test(v) || INLINE.test(v));
export const photoVersion = (v: string | null | undefined) => (v && v !== NEW_PHOTO ? STORED.exec(v)?.[1] ?? null : null);
/** Endereço da foto enviada, ou null se o valor não é uma foto (ou não dá pra montar o endereço). */
export function photoURL(pid: string, v: string | null | undefined): string | null {
  if (!v || v === NEW_PHOTO) return null;
  if (INLINE.test(v)) return v;
  const ver = STORED.exec(v)?.[1];
  return ver && BASE && /^[0-9a-f-]{36}$/i.test(pid) ? `${BASE}/storage/v1/object/public/avatars/${pid}/${ver}.jpg` : null;
}
export const photoStyle = (url: string) => cover(url);

const PHOTO_SIZE = 320;
/** Corta a imagem em quadrado (um pouco acima do centro nas fotos em pé, onde costuma estar o rosto) e reduz. */
export async function preparePhoto(file: File): Promise<{ blob: Blob; url: string }> {
  if (!file.type.startsWith('image/')) throw new Error('não é imagem');
  const src = await (typeof createImageBitmap === 'function'
    ? createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => viaImg(file))
    : viaImg(file));
  const w = src.width, h = src.height, side = Math.min(w, h);
  if (!side) throw new Error('imagem vazia');
  const c = document.createElement('canvas');
  c.width = c.height = PHOTO_SIZE;
  const g = c.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, (w - side) / 2, h > w ? (h - side) * 0.3 : 0, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/jpeg', 0.86));
  if (!blob) throw new Error('não deu pra converter');
  return { blob, url: URL.createObjectURL(blob) };
}
function viaImg(file: File): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); fail(new Error('imagem inválida')); };
    img.src = url;
  });
}

/* ---------- campo no formulário ---------- */

/** No formulário (cadastro e edição de perfil): a foto atual e o botão que abre o seletor. */
export const avatarFieldHTML = (selected: string | null, photo?: string | null) => {
  const a = avatarById(selected);
  const own = !a && !!photo && (isPhoto(selected) || selected === NEW_PHOTO);
  const style = a ? avatarStyle(a) : own ? photoStyle(photo!) : '';
  const label = a ? a.name : own ? 'Sua foto' : 'Nenhuma foto escolhida';
  return `<div class="av-field"><span class="av ${style ? 'pic ' : ''}lg"${style ? ` style="${style}"` : ''} aria-hidden="true"></span><div class="av-field-txt"><span class="av-field-name">${esc(label)}</span><button type="button" class="btn sm" data-av-open>Trocar foto</button></div></div>`;
};
export function setAvatarField(root: ParentNode, selected: string | null, photo?: string | null) {
  const f = root.querySelector<HTMLElement>('.av-field');
  if (f) f.outerHTML = avatarFieldHTML(selected, photo);
}

/* ---------- seletor em tela cheia ---------- */

/** Fileiras do seletor, na ordem em que aparecem; o que não estiver aqui vai pro fim, em ordem alfabética */
const TEAM_ORDER = ['Vingadores', 'Homem-Aranha', 'X-Men', 'Guardiões da Galáxia', 'Quarteto Fantástico', 'Heróis de rua', 'Thunderbolts', 'Vilões'];
interface Row { team: string; items: Avatar[] }
const ROWS: Row[] = (() => {
  const by = new Map<string, Avatar[]>();
  for (const a of AVATARS) {
    const list = by.get(a.team);
    if (list) list.push(a); else by.set(a.team, [a]);
  }
  const pos = (t: string) => { const i = TEAM_ORDER.indexOf(t); return i < 0 ? TEAM_ORDER.length : i; };
  return [...by.entries()]
    .sort((x, y) => pos(x[0]) - pos(y[0]) || x[0].localeCompare(y[0], 'pt'))
    // Dentro da fileira: personagens de A a Z, com as variações de cada um juntas
    .map(([team, items]) => ({ team, items: items.slice().sort((x, y) => x.char.localeCompare(y.char, 'pt')) }));
})();

export interface ChooserOpts {
  selected: string | null;
  /** Mostra a fileira "Sua foto", pra enviar da galeria ou da câmera (só no perfil, com a conta já criada) */
  upload?: boolean;
  /** Endereço da foto da pessoa, se ela já tem uma (enviada antes ou escolhida agora) */
  photo?: string | null;
  /** Escolheu um personagem */
  onPick(id: string): void;
  /** Voltou pra própria foto */
  onOwn?(): void;
  /** Escolheu uma imagem da galeria ou tirou na câmera */
  onFile?(file: File): void;
}

const arrow = (d: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const key = (a: Avatar) => norm(`${a.char} ${a.variant || ''} ${a.team}`);

/** Seletor de foto no estilo dos serviços de streaming: tela cheia, uma fileira por equipe, e busca. */
export function openAvatarChooser(o: ChooserOpts) {
  const sel = avatarById(o.selected)?.id ?? null;
  const ownOn = isPhoto(o.selected) || o.selected === NEW_PHOTO;
  const tile = (a: Avatar) =>
    `<button type="button" class="avx-tile" data-av="${a.id}" aria-pressed="${a.id === sel}"><span class="av pic" style="${avatarStyle(a)}"></span><span class="avx-name">${esc(a.char)}</span>${a.variant ? `<span class="avx-var">${esc(a.variant)}</span>` : ''}</button>`;
  const rail = (inner: string) =>
    `<div class="avx-wrap"><button type="button" class="avx-nav prev" data-avx-scroll="-1" aria-label="Anteriores" tabindex="-1">${arrow('M15 5l-7 7 7 7')}</button><div class="avx-rail">${inner}</div><button type="button" class="avx-nav next" data-avx-scroll="1" aria-label="Próximos" tabindex="-1">${arrow('M9 5l7 7-7 7')}</button></div>`;
  const own = o.upload ? `<section class="avx-row avx-own"><h3>Sua foto</h3><div class="avx-own-in">
      ${o.photo ? `<button type="button" class="avx-tile" data-av-own aria-pressed="${ownOn}"><span class="av pic" style="${photoStyle(o.photo)}"></span><span class="avx-name">Sua foto</span></button>` : ''}
      <div class="avx-own-act"><p>Envie uma imagem da galeria ou tire uma foto na hora. Ela é cortada em círculo.</p>
        <div class="avx-own-btns"><label class="btn">Escolher da galeria<input class="vh" type="file" accept="image/*" data-av-file></label><label class="btn avx-cam">Usar a câmera<input class="vh" type="file" accept="image/*" capture="user" data-av-file></label></div></div>
    </div></section>` : '';
  const el = document.createElement('div');
  el.className = 'avx';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Escolher foto de perfil');
  el.innerHTML = `<header class="avx-head"><h2>Escolher foto de perfil</h2><button type="button" class="btn" data-avx-close>Cancelar</button></header>
    <div class="avx-body">
      <label class="search avx-search">${IC.search}<input class="avx-q" type="search" placeholder="Buscar personagem" aria-label="Buscar personagem" autocomplete="off" enterkeyhint="search"></label>
      <div class="avx-rows">${own}${ROWS.map(r => `<section class="avx-row"><h3>${esc(r.team)}</h3>${rail(r.items.map(tile).join(''))}</section>`).join('')}</div>
      <section class="avx-found" hidden><h3>Resultados</h3><div class="avx-grid"></div><p class="muted avx-none" hidden>Nenhum personagem com esse nome.</p></section>
    </div>`;

  const root = document.documentElement, prevOverflow = root.style.overflow, back = document.activeElement as HTMLElement | null;
  let open = true, pushed = false;
  // O botão de voltar do celular fecha o seletor em vez de sair da tela
  try { history.pushState({ ...(history.state || {}), avx: true }, ''); pushed = true; } catch { /* sem histórico, segue sem */ }
  const finish = () => {
    if (!open) return;
    open = false;
    removeEventListener('popstate', onPop);
    removeEventListener('keydown', onKey, true);
    el.remove();
    root.style.overflow = prevOverflow;
    back?.focus?.();
  };
  const onPop = () => { pushed = false; finish(); };
  const close = () => { if (pushed) { pushed = false; finish(); history.back(); } else finish(); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  /** Fecha e só depois avisa quem abriu (o formulário por baixo volta a ser o que está na tela) */
  const done = (fn?: () => void) => { close(); fn?.(); };

  const rows = el.querySelector<HTMLElement>('.avx-rows')!, found = el.querySelector<HTMLElement>('.avx-found')!;
  const grid = found.querySelector<HTMLElement>('.avx-grid')!, none = found.querySelector<HTMLElement>('.avx-none')!;
  el.addEventListener('input', e => {
    const t = e.target as HTMLInputElement;
    if (!t.classList.contains('avx-q')) return;
    const q = norm(t.value).trim();
    rows.hidden = !!q; found.hidden = !q;
    if (!q) return;
    const hits = AVATARS.filter(a => key(a).includes(q)).sort((x, y) => x.char.localeCompare(y.char, 'pt'));
    grid.innerHTML = hits.map(tile).join('');
    none.hidden = hits.length > 0;
  });
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.target as HTMLElement).classList.contains('avx-q')) e.preventDefault(); });
  el.addEventListener('change', e => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.avFile === undefined) return;
    const file = t.files?.[0];
    t.value = '';
    if (file) done(() => o.onFile?.(file));
  });
  el.addEventListener('click', e => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-avx-close]')) { close(); return; }
    const nav = t.closest<HTMLElement>('[data-avx-scroll]');
    if (nav) {
      const r = nav.parentElement!.querySelector<HTMLElement>('.avx-rail')!;
      r.scrollBy({ left: +nav.dataset.avxScroll! * r.clientWidth * 0.85, behavior: 'smooth' });
      return;
    }
    if (t.closest('[data-av-own]')) { done(o.onOwn); return; }
    const pick = t.closest<HTMLElement>('[data-av]');
    if (pick) done(() => o.onPick(pick.dataset.av!));
  });

  document.body.append(el);
  root.style.overflow = 'hidden';
  addEventListener('popstate', onPop);
  addEventListener('keydown', onKey, true);
  // Abre já mostrando a foto atual na fileira dela
  const cur = el.querySelector<HTMLElement>('.avx-tile[aria-pressed="true"]');
  const curRail = cur?.closest<HTMLElement>('.avx-rail');
  if (cur && curRail) curRail.scrollLeft = Math.max(0, cur.offsetLeft - curRail.offsetLeft - 24);
  el.querySelector<HTMLElement>('[data-avx-close]')?.focus();
}

