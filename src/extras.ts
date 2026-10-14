import { BYID, ESS, ITEMS, MAIN } from './data';
import type { Item } from './data';
import { detailsOf, episodeCount } from './details';
import { posterHTML } from './posters';
import { P, S, av, marksOf, starsHTML, stats, watchOf } from './state';
import type { Watch } from './state';
import { esc, fmt, hours } from './util';

/* Listas (quero ver / assistindo agora), episódios, comparação com amigo e @. */

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Quantos episódios a pessoa já viu desse título */
export const epsDone = (pid: string, id: string) => (watchOf(pid)[id]?.eps || []).length;

/** Texto curto do estado da pessoa num título: "Assistindo, 3 de 6 episódios", "Quer ver"… */
export function watchLabel(pid: string, id: string, you: boolean): string {
  const w = watchOf(pid)[id];
  if (!w || marksOf(pid)[id]) return '';
  const total = episodeCount(id), done = w.eps.length;
  if (w.list === 'assistindo' || done) return total ? `Assistindo, ${done} de ${total} episódios` : 'Assistindo';
  if (w.list === 'quero') return you ? 'Quero ver' : 'Quer ver';
  return '';
}

/* ---------------- detalhe: listas ---------------- */
export function listButtonsHTML(id: string): string {
  if (marksOf(S.me)[id]) return '';
  const w = watchOf(S.me)[id];
  return `<div class="list-row" role="group" aria-label="Suas listas">
    <button class="chip" data-list="quero" aria-pressed="${w?.list === 'quero'}">Quero ver</button>
    <button class="chip" data-list="assistindo" aria-pressed="${w?.list === 'assistindo'}">Assistindo agora</button>
  </div>`;
}

/* ---------------- detalhe: episódios ---------------- */
const openSeasons = new Set<string>();

export function rememberSeason(key: string, open: boolean) {
  if (open) openSeasons.add(key); else openSeasons.delete(key);
}

export function episodesHTML(id: string): string {
  const seasons = detailsOf(id).seasons;
  if (!seasons?.length) return '';
  const seen = new Set(watchOf(S.me)[id]?.eps || []);
  const total = episodeCount(id), done = [...seen].filter(k => { const [si, ei] = k.split(':').map(Number); return seasons[si]?.eps[ei - 1]; }).length;
  const firstOpen = seasons.findIndex((s, si) => s.eps.some((_, ei) => !seen.has(`${si}:${ei + 1}`)));
  const blocks = seasons.map((s, si) => {
    const key = `${id}:${si}`;
    if (!openSeasons.has(key) && !openSeasons.has(`${id}:touched`) && si === firstOpen) openSeasons.add(key);
    const inSeason = s.eps.filter((_, ei) => seen.has(`${si}:${ei + 1}`)).length;
    const all = inSeason === s.eps.length && s.eps.length > 0;
    const eps = s.eps.map(([name, min], ei) => {
      const k = `${si}:${ei + 1}`;
      return `<li><label><input type="checkbox" data-ep="${k}" ${seen.has(k) ? 'checked' : ''}><span class="ep-n">${ei + 1}</span><span class="ep-t">${esc(name)}</span>${min ? `<span class="ep-m">${min} min</span>` : ''}</label></li>`;
    }).join('');
    return `<details class="season" data-season-key="${key}" ${openSeasons.has(key) ? 'open' : ''}>
      <summary><span>${esc(s.label)}</span><span class="n">${inSeason} de ${s.eps.length}</span></summary>
      <div class="season-actions"><button class="linkish" data-season="${si}" data-all="${all ? '0' : '1'}">${all ? 'Desmarcar temporada' : 'Marcar temporada inteira'}</button></div>
      <ol class="eps">${eps}</ol>
    </details>`;
  }).join('');
  return `<section class="m-sec"><h3>Episódios <span>${done} de ${total}</span></h3>
    <div class="meter" role="img" aria-label="${done} de ${total} episódios"><i style="width:${total ? done / total * 100 : 0}%"></i></div>
    ${blocks}</section>`;
}

/**
 * Marca/desmarca episódios. Ao começar, a série vai para "Assistindo agora";
 * ao completar todos, ela é marcada como vista e sai da lista.
 */
export function applyEpisodes(id: string, keys: string[], on: boolean): 'done' | 'progress' {
  const cur = new Set(watchOf(S.me)[id]?.eps || []);
  keys.forEach(k => on ? cur.add(k) : cur.delete(k));
  const eps = [...cur];
  const total = episodeCount(id);
  const seen = !!marksOf(S.me)[id];
  if (total && eps.length >= total && !seen) {
    S.backend?.setWatch(id, { eps, list: null });
    S.backend?.setMark(id, {});
    return 'done';
  }
  const patch: Partial<Watch> = { eps };
  if (!seen && eps.length && watchOf(S.me)[id]?.list !== 'assistindo') patch.list = 'assistindo';
  S.backend?.setWatch(id, patch);
  return 'progress';
}

/* ---------------- listas no perfil e na linha do tempo ---------------- */
const listCard = (it: Item, pid: string) => {
  const total = episodeCount(it.id), done = epsDone(pid, it.id);
  const sub = total ? `${done} de ${total} episódios` : '';
  return `<button class="mini-card" data-open="${it.id}">${posterHTML(it)}<span class="mt">${esc(it.t)}</span>${sub ? `<span class="ms">${sub}</span>` : ''}${total ? `<span class="meter thin"><i style="width:${done / total * 100}%"></i></span>` : ''}</button>`;
};

export function listItems(pid: string, list: Watch['list']): Item[] {
  const w = watchOf(pid), m = marksOf(pid);
  return Object.keys(w).filter(id => BYID[id] && !m[id] && (w[id].list === list || (list === 'assistindo' && !w[id].list && w[id].eps.length)))
    .map(id => BYID[id]).sort((a, b) => a.i - b.i);
}

export function listSectionHTML(pid: string, list: 'quero' | 'assistindo', title: string, empty: string): string {
  const items = listItems(pid, list);
  return `<section class="section"><h2>${title}${items.length ? ` <span class="count">${items.length}</span>` : ''}</h2>${items.length ? `<div class="row-scroll minis">${items.map(it => listCard(it, pid)).join('')}</div>` : `<p class="muted">${empty}</p>`}</section>`;
}

/** Faixa "Assistindo agora" no topo da linha do tempo (só aparece se tiver algo). */
export function watchingStripHTML(): string {
  const items = listItems(S.me, 'assistindo');
  if (!items.length) return '';
  return `<section class="watching"><h2>Assistindo agora</h2><div class="row-scroll minis">${items.map(it => listCard(it, S.me)).join('')}</div></section>`;
}

/* ---------------- comparar com um amigo ---------------- */
export function compareHTML(fid: string): string {
  const a = S.me, b = fid, pa = P(a), pb = P(b), sa = stats(a), sb = stats(b), ma = marksOf(a), mb = marksOf(b);
  const row = (label: string, va: number | null, vb: number | null, show: (v: number | null) => string) => {
    const win = va == null || vb == null || va === vb ? 0 : va > vb ? 1 : 2;
    return `<tr><td class="${win === 1 ? 'win' : ''}">${show(va)}</td><th scope="row">${label}</th><td class="${win === 2 ? 'win' : ''}">${show(vb)}</td></tr>`;
  };
  const n = (v: number | null) => (v == null ? '–' : String(v));
  const common = ITEMS.filter(it => ma[it.id] && mb[it.id]);
  const rated = common.filter(it => ma[it.id].r != null && mb[it.id].r != null);
  const diffs = rated.map(it => ({ it, ra: ma[it.id].r!, rb: mb[it.id].r!, d: Math.abs(ma[it.id].r! - mb[it.id].r!) }));
  const compat = diffs.length ? Math.round(100 - diffs.reduce((x, y) => x + y.d, 0) / diffs.length / 4 * 100) : null;
  const disagree = diffs.filter(x => x.d >= 2).sort((x, y) => y.d - x.d || x.it.i - y.it.i).slice(0, 4);
  const onlyA = ITEMS.filter(it => ma[it.id] && !mb[it.id]);
  const onlyB = ITEMS.filter(it => mb[it.id] && !ma[it.id]);
  const mini = (it: Item) => `<button class="mini-card" data-open="${it.id}">${posterHTML(it)}<span class="mt">${esc(it.t)}</span></button>`;
  const both = common.map(it => `<li><button data-open="${it.id}">${posterHTML(it)}<span class="rt">${esc(it.t)}</span>
      <span class="cmp-r">${ma[it.id].r != null ? starsHTML(ma[it.id].r!) : '<span class="muted">sem nota</span>'}</span>
      <span class="cmp-r">${mb[it.id].r != null ? starsHTML(mb[it.id].r!) : '<span class="muted">sem nota</span>'}</span></button></li>`).join('');
  return `<button class="linkish back-link" data-compare-close>Voltar para o perfil de ${esc(pb.name)}</button>
  <header class="cmp-head">
    <div class="cmp-p">${av(a, 'lg')}<b>${esc(pa.name)}</b>${pa.username ? `<span class="uname">@${esc(pa.username)}</span>` : ''}</div>
    <span class="cmp-vs" aria-hidden="true">vs</span>
    <div class="cmp-p">${av(b, 'lg')}<b>${esc(pb.name)}</b>${pb.username ? `<span class="uname">@${esc(pb.username)}</span>` : ''}</div>
  </header>
  <div class="compat">${compat != null ? `<b>${compat}%</b><span>de compatibilidade de gosto, pelos ${plural(diffs.length, 'título', 'títulos')} que os dois avaliaram</span>` : '<span class="muted">Ainda não tem títulos avaliados pelos dois para calcular a compatibilidade de gosto.</span>'}</div>
  <div class="table-wrap cmp-table"><table>
    <thead><tr><th scope="col">${esc(pa.name)}</th><th scope="col"><span class="sr">Dado</span></th><th scope="col">${esc(pb.name)}</th></tr></thead>
    <tbody>
      ${row(`Vistos (de ${MAIN.length})`, sa.seenMain, sb.seenMain, n)}
      ${row(`Essenciais (de ${ESS.length})`, sa.seenEss, sb.seenEss, n)}
      ${row('Horas assistidas', hours(sa.minutes), hours(sb.minutes), n)}
      ${row('Média das notas', sa.avg, sb.avg, v => (v == null ? '–' : fmt(v)))}
      ${row('Títulos avaliados', sa.rated, sb.rated, n)}
      ${row('Comentários', sa.comments, sb.comments, n)}
    </tbody></table></div>
  ${disagree.length ? `<section class="section"><h2>Onde mais discordam</h2><ul class="recent cmp-list">${disagree.map(x => `<li><button data-open="${x.it.id}">${posterHTML(x.it)}<span class="rt">${esc(x.it.t)}</span><span class="cmp-r">${starsHTML(x.ra)}</span><span class="cmp-r">${starsHTML(x.rb)}</span></button></li>`).join('')}</ul></section>` : ''}
  <section class="section"><h2>Os dois viram <span class="count">${common.length}</span></h2>${common.length ? `<div class="cmp-cols muted"><span></span><span>${esc(pa.name)}</span><span>${esc(pb.name)}</span></div><ul class="recent cmp-list">${both}</ul>` : '<p class="muted">Nenhum título em comum ainda.</p>'}</section>
  <section class="section"><h2>Só ${esc(pb.name)} viu <span class="count">${onlyB.length}</span></h2>${onlyB.length ? `<div class="row-scroll minis">${onlyB.map(mini).join('')}</div>` : '<p class="muted">Nada. Você viu tudo que essa pessoa viu.</p>'}</section>
  <section class="section"><h2>Só você viu <span class="count">${onlyA.length}</span></h2>${onlyA.length ? `<div class="row-scroll minis">${onlyA.map(mini).join('')}</div>` : '<p class="muted">Nada ainda.</p>'}</section>`;
}

/* ---------------- @ ---------------- */
export const usernameFieldHTML = (id: string, value: string) =>
  `<div class="at-input"><span aria-hidden="true">@</span><input type="text" id="${id}" value="${esc(value)}" maxlength="20" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="seu.nome" aria-describedby="${id}-hint"></div>
  <p class="hint" id="${id}-hint">É por ele que os amigos encontram você. Use letras minúsculas, números, ponto ou _.</p>`;

/** Deixa o @ no formato aceito enquanto a pessoa digita. */
export const cleanUsername = (v: string) => v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_.]/g, '').slice(0, 20);
