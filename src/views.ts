import { NEW_PHOTO, avatarFieldHTML, isPhoto, openAvatarChooser, photoURL, preparePhoto, setAvatarField } from './avatars';
import { BUCKETS, BYID, DOOMSDAY, ERAS, ESS, FILTERS, FILTER_LIST, GROUPS, ITEMS, KIND, MAIN, RELEASES, TRILHA } from './data';
import { googleCalURL, openICS, saveFile, storyImage } from './share';
import { openRecap } from './recap';
import { disablePush, dismissInstall, enablePush, installWay, isIOS, offerInstall, preparePush, promptInstall, pushStatus } from './pwa';
import type { Item, Release } from './data';
import { posterHTML } from './posters';
import BACKDROPS from './backdrops.json';
import { P, S, TABS, UI, USERNAME_RE, av, crowd, likesOf, eraOf, eventItem, friendIds, upcoming, incomingIds, isGuest, marksOf, nav, nextEvent, nextUp, onState, orderedAll, orderedMain, outgoingIds, passes, pids, ranked, relation, released, rememberPerson, savePrefs, starsHTML, stats, trailProgress, trailSeq, watchOf } from './state';
import { SERVICES, detailsOf, detailsReady, loadDetails, myServices, setMyServices, whereHTML } from './details';
import { introDone } from './intro';
import { syncTabLens } from './glass';
import { guestCount } from './backend-guest';
import { applyEpisodes, cleanUsername, compareHTML, episodesHTML, listButtonsHTML, listSectionHTML, rememberSeason, usernameFieldHTML, watchLabel, watchingStripHTML } from './extras';
import type { Notif, Person, PersonHit, Tab } from './state';
import { IC, RLBL, buzz, countdown, daysTo, dur, esc, fmt, fmtDate, hours, norm, reduced, smooth, toast } from './util';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T | null;
const isMe = (pid: string) => pid === S.me;
const demo = () => S.backend?.mode === 'demo';
const pad = (n: number) => String(n).padStart(2, '0');
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
let editAvatar: string | null = null;
/** Favorito escolhido na edição do perfil, ainda não salvo */
let editFav: string | null = null;
/** Foto escolhida na edição do perfil, ainda não enviada */
let editPhoto: { blob: Blob; url: string } | null = null;

/* ================= VISITANTE (sem conta) ================= */
const joinBtns = '<div class="row-btns"><button class="btn primary" data-auth="criar">Criar conta grátis</button><button class="btn" data-auth="entrar">Já tenho conta</button></div>';

/**
 * Convite para criar conta. O visitante pode marcar e avaliar à vontade; o convite aparece uma vez,
 * no primeiro título marcado (para avisar que nada fica salvo), e quando ele abre algo que só existe com conta.
 */
export function askAccount(save = false) {
  const el = $('#gate');
  if (!el) return;
  el.innerHTML = `<div class="m-back" data-gate-close></div>
  <div class="sheet small" role="dialog" aria-modal="true" aria-labelledby="gate-t">
    <h2 id="gate-t">${save ? 'Salve o seu progresso' : 'Crie sua conta'}</h2>
    <p class="muted">${save
      ? 'Você pode continuar marcando sem conta, mas nada fica salvo: ao fechar a página, as marcações se perdem. Com uma conta gratuita, o seu progresso fica guardado e o que você já marcou vai junto.'
      : 'Com uma conta gratuita, o seu progresso fica salvo, você acompanha as séries por episódio e compara as avaliações com os seus amigos.'}</p>
    ${joinBtns}
    <button class="linkish gate-later" type="button" data-gate-close>${save ? 'Continuar sem salvar' : 'Agora não'}</button>
  </div>`;
  el.hidden = false;
}
/** Primeira marcação de um visitante: avisa uma vez que sem conta não fica salvo. */
let nudged = false;
function guestNudge() {
  if (!isGuest() || nudged) return;
  nudged = true;
  setTimeout(() => { if (isGuest()) askAccount(true); }, 700);
}
function closeGate() {
  const el = $('#gate');
  if (el) { el.hidden = true; el.innerHTML = ''; }
}

/** Abas que só existem para quem tem conta: o visitante vê para que servem e o convite. */
function gateHTML(tab: Tab): string {
  const [title, text] = ({
    ranking: ['Ranking', 'Veja quem, entre os seus amigos, assistiu a mais títulos, mais essenciais e mais horas de Marvel.'],
    amigos: ['Amigos', 'Adicione seus amigos pelo @, acompanhe o progresso de cada um e compare as notas lado a lado.'],
    perfil: ['Perfil', 'Seu progresso, suas notas, e suas listas de "Quero ver" e "Assistindo agora".'],
  } as Record<string, [string, string]>)[tab] || ['', ''];
  return `<div class="page-head"><h1>${title}</h1></div>
  <p class="lead-note">${text}</p>
  <div class="gate-card"><p>Este recurso é exclusivo para quem tem conta. O cadastro é gratuito e leva um minuto.</p>${joinBtns}</div>`;
}

/* ================= BARRA ================= */
function renderBar() {
  const reqs = incomingIds().length, fa = $('.tabs a[data-tab="amigos"]');
  // Pedidos de amizade: só o número muda (o ícone e o nome da aba ficam)
  if (fa) { fa.querySelector('.badge')?.remove(); if (reqs) fa.insertAdjacentHTML('beforeend', `<span class="badge" aria-label="${reqs} ${reqs === 1 ? 'pedido' : 'pedidos'}">${reqs}</span>`); }
  // No celular, a aba Perfil mostra a foto de quem está na conta, como no Instagram
  const tabMe = $('.tabs a[data-tab="perfil"] .ti-me');
  if (tabMe) { tabMe.dataset.icon ??= tabMe.innerHTML; tabMe.innerHTML = isGuest() ? tabMe.dataset.icon : av(S.me, 'tab'); }
  document.querySelectorAll<HTMLElement>('.tabs a').forEach(a => {
    if (a.dataset.tab === UI.tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  // A lente de vidro da barra de baixo vai para a aba aberta
  syncTabLens();
  if (isGuest()) {
    $('#me')!.innerHTML = '<div class="guest-btns"><button class="btn sm" data-auth="entrar">Entrar</button><button class="btn sm primary join" data-auth="criar">Criar conta</button></div>';
    return;
  }
  const me = P(S.me);
  const menu = demo()
    ? `<p class="menu-note">Demonstração: escolha quem você quer ser.</p>${S.people.map(p => p.id).map(pid => `<button data-person="${pid}" aria-pressed="${isMe(pid)}">${av(pid, 'md')}${esc(P(pid).name)}</button>`).join('')}<button class="menu-quiet" data-reset>Restaurar dados de exemplo</button>`
    : `<button data-profile="${S.me}">${av(S.me, 'md')}Meu perfil</button><button class="menu-quiet" data-signout>Sair</button>`;
  const bell = demo() && !S.unread ? '' : `<button class="bell" type="button" data-notifs aria-label="Notificações${S.unread ? `, ${S.unread} ${S.unread === 1 ? 'nova' : 'novas'}` : ''}">${IC.bell}${S.unread ? `<span class="badge">${S.unread > 9 ? '9+' : S.unread}</span>` : ''}</button>`;
  $('#me')!.innerHTML = `${bell}<button class="me-btn" data-menu aria-expanded="${UI.menu}" aria-haspopup="true" aria-label="Conta de ${esc(me.name)}">${av(S.me, 'md')}<span class="nm">${esc(me.name)}</span>${IC.down}</button>${UI.menu ? `<div class="me-menu">${menu}</div>` : ''}`;
}

/* ================= LINHA DO TEMPO ================= */
function cardHTML(it: Item): string {
  const mine = marksOf(S.me)[it.id], locked = it.id === 'doomsday' && !released(), c = crowd(it);
  const meta = [`<span>${it.r.slice(0, 4)}</span>`];
  if (it.k !== 'f') meta.push(`<span>${KIND[it.k]}</span>`);
  if (it.star) meta.push('<span class="ess">Essencial</span>');
  if (locked) meta.push('<span class="ess">Estreia 17/12</span>');
  const wl = watchLabel(S.me, it.id, true);
  if (wl) meta.push(`<span class="wl">${esc(wl.replace(/ episódios$/, ' ep.'))}</span>`);
  return `<article class="card${mine ? ' seen' : ''}" data-id="${it.id}">
    <div class="p-wrap">
      <button class="p-open" data-open="${it.id}" aria-label="Abrir ${esc(it.t)}">${posterHTML(it)}</button>
      ${locked ? '' : `<button class="c-check" data-toggle="${it.id}" data-fk="t-${it.id}" aria-pressed="${!!mine}" aria-label="${mine ? 'Desmarcar' : 'Marcar'} ${esc(it.t)} como visto">${IC.check}</button>`}
    </div>
    <h3 class="c-t"><button data-open="${it.id}" tabindex="-1">${esc(it.t)}</button></h3>
    <p class="c-meta">${meta.join('')}</p>
    ${c.who.length ? `<div class="c-foot"><span class="stack">${c.who.slice(0, 5).map(pid => av(pid, 'sm')).join('')}</span>${c.avg != null ? `<span class="c-avg" title="Média entre amigos">${IC.star}${fmt(c.avg)}</span>` : ''}</div>` : ''}
  </article>`;
}

const arrows = (k: string) => `<div class="arrows"><button data-scroll="-1" data-rail-btn="${k}" aria-label="Voltar">${IC.left}</button><button data-scroll="1" data-rail-btn="${k}" aria-label="Avançar">${IC.right}</button></div>`;
const container = (k: string, vis: Item[]) => UI.view === 'h'
  ? `<div class="rail-wrap"><div class="rail" data-rail="${k}">${vis.map(cardHTML).join('')}</div></div>`
  : `<div class="grid">${vis.map(cardHTML).join('')}</div>`;

function eraHead(name: string, all: Item[], railKey: string | null, h = 'h2') {
  const m = marksOf(S.me), tot = all.filter(it => it.id !== 'doomsday'), seen = tot.filter(it => m[it.id]).length;
  return `<div class="era-head"><${h} class="era-name">${esc(name)}</${h}><span class="era-count">${seen} de ${tot.length}</span>${railKey && UI.view === 'h' ? arrows(railKey) : ''}</div>`;
}

/**
 * Títulos de uma saga numa lista só. Os de outros universos (Fox, Sony) entram na ordem de lançamento,
 * logo antes do primeiro título da linha principal que saiu depois deles.
 */
function sagaSeq(ids: Set<string>): Item[] {
  const main = orderedMain().filter(it => ids.has(it.id));
  const extra = ITEMS.filter(it => it.e === 5 && ids.has(it.id)).sort((a, b) => a.r.localeCompare(b.r));
  if (UI.order === 'lanc') return [...main, ...extra].sort((a, b) => a.r.localeCompare(b.r) || a.i - b.i);
  const out = [...main];
  for (const x of extra) {
    const k = out.findIndex(it => it.e <= 4 && it.r > x.r);
    out.splice(k < 0 ? out.length : k, 0, x);
  }
  return out;
}

function erasHTML(): string {
  const main = orderedMain(), labels = UI.order === 'crono' ? ERAS.slice(0, 5).map(e => e.name) : BUCKETS.map(b => b.name);
  // Com a trilha ligada, as contagens de cada era consideram só o que está nela
  const scope = (it: Item) => !UI.trail || TRILHA.has(it.id);
  // Com uma saga escolhida, uma lista só com o nome dela (as eras dos Vingadores não fazem sentido ali)
  const f = UI.saga ? FILTERS[UI.saga] : null;
  if (f) {
    const all = sagaSeq(f.ids).filter(scope), vis = all.filter(passes);
    return vis.length
      ? `<section class="era">${eraHead(f.label, all, 'saga')}${container('saga', vis)}</section>`
      : '<div class="empty"><p>Nada encontrado com esses filtros.</p><button class="btn" data-clear>Limpar filtros</button></div>';
  }
  let html = '';
  labels.forEach((name, idx) => {
    const all = main.filter(it => eraOf(it) === idx && scope(it)), vis = all.filter(passes);
    if (!vis.length) return;
    const key = ERAS[idx].key;
    html += `<section class="era">${eraHead(name, all, key)}${container(key, vis)}</section>`;
  });
  const subs = GROUPS.map(g => ({ g, all: ITEMS.filter(it => it.g === g.key && scope(it)) })).map(x => ({ ...x, vis: x.all.filter(passes) })).filter(x => x.vis.length);
  if (subs.length) {
    html += `<section class="era extras"><div class="era-head"><h2 class="era-name">Universos paralelos</h2></div><p class="era-note">${UI.trail ? 'Outro universo, mas os atores voltam em Doutor Destino. Contam na trilha, não no placar.' : 'Fora da linha do tempo principal. Não contam no placar.'}</p>${subs.map(x => `<div class="sub">${eraHead((UI.trail && 'trail' in x.g && x.g.trail) || x.g.name, x.all, 'alma-' + x.g.key, 'h3')}<p class="era-note">${esc(x.g.hint)}</p>${container('alma-' + x.g.key, x.vis)}</div>`).join('')}</section>`;
  }
  return html || '<div class="empty"><p>Nada encontrado com esses filtros.</p><button class="btn" data-clear>Limpar filtros</button></div>';
}

/* Faixa "Lançamentos": passa pelos próximos lançamentos da Marvel, um a cada 4 segundos, começando pela próxima grande estreia. */
const REL_EVERY = 4000;
/** Imagens largas do TMDB, usadas de fundo no cartão de lançamentos */
const BACK = BACKDROPS as Record<string, string>;
let relIdx = 0, relPaused = false, relHeld = false, relElapsed = 0, relLast = 0, relTimer: number | undefined;
/** O lançamento que está na tela agora */
function currentRelease() {
  const list = upcoming();
  if (relIdx >= list.length) relIdx = 0;
  return list[relIdx] || null;
}
const relSeen = new Set<string>();
/** Baixa antes as imagens do lançamento seguinte, pra troca não piscar */
function preloadRelease(ev?: Release) {
  if (!ev || relSeen.has(ev.id)) return;
  relSeen.add(ev.id);
  const urls = [BACK[ev.id] && `https://image.tmdb.org/t/p/w780${BACK[ev.id]}`, /src="([^"]+)"/.exec(posterHTML(eventItem(ev), 'lg'))?.[1]];
  for (const u of urls) if (u) new Image().src = u;
}
function countHTML(): string {
  const list = upcoming(), ev = currentRelease();
  if (!ev) return '';
  const c = countdown(ev.date), it = eventItem(ev), bg = BACK[ev.id], auto = list.length > 1;
  const art = posterHTML(it, 'lg').replace('loading="lazy"', 'fetchpriority="high"');
  if (auto) preloadRelease(list[(relIdx + 1) % list.length]);
  // Cartão novo na tela: os 4 segundos (e a barrinha do ponto) começam de novo
  relElapsed = 0;
  const dots = auto ? `<div class="rel-dots" role="group" aria-label="Escolher lançamento">${list.map((r, i) =>
    `<button type="button" data-rel="${i}" aria-pressed="${i === relIdx}" aria-label="${esc(r.t)}"></button>`).join('')}</div>` : '';
  const poster = BYID[ev.id]
    ? `<button class="count-poster" type="button" data-open="${ev.id}" aria-label="Abrir ${esc(ev.t)}">${art}</button>`
    : `<div class="count-poster">${art}</div>`;
  return `<div class="cdown${auto ? ' rel-auto' : ''}${relHeld ? ' rel-hold' : ''}" role="group" aria-roledescription="carrossel" aria-label="Lançamentos da Marvel">
    ${bg ? `<div class="rel-bg" aria-hidden="true"><img src="https://image.tmdb.org/t/p/w780${bg}" alt="" decoding="async"></div>` : ''}
    <p class="rel-kicker">Lançamentos</p>
    ${poster}
    <div class="count-body">
      <div class="count-days"><b data-cd="d">${c.d}</b><span data-cd="dl">${c.d === 1 ? 'dia' : 'dias'}</span></div>
      ${ev.approx ? '<div class="count-clock rel-approx">Data a confirmar</div>'
        : `<div class="count-clock"><b data-cd="h">${pad(c.h)}</b><span>h</span><b data-cd="m">${pad(c.m)}</b><span>min</span><b data-cd="s">${pad(c.s)}</b><span>s</span></div>`}
      <p class="rel-t"><b>${esc(ev.t)}</b><span>${esc(ev.what)}, ${ev.approx ? 'previsto para ' : ''}${esc(ev.label)}</span></p>
      ${ev.approx ? '' : `<button type="button" class="rel-remind" data-remind="${RELEASES.indexOf(ev)}">${IC.bell}<span>Me lembre</span></button>`}
    </div>
    ${dots}
  </div>`;
}
/** Troca o lançamento mostrado sem redesenhar o resto da página */
function showRelease(i: number) {
  const list = upcoming();
  if (!list.length) return;
  relIdx = ((i % list.length) + list.length) % list.length;
  const el = document.querySelector<HTMLElement>('#top .cdown');
  if (!el) return;
  const focused = el.contains(document.activeElement);
  el.outerHTML = countHTML();
  const fresh = document.querySelector<HTMLElement>('#top .cdown');
  fresh?.classList.add('rel-in');
  if (focused) fresh?.querySelector<HTMLElement>('[data-rel][aria-pressed="true"]')?.focus();
}
/** A faixa só anda à vista: sem mouse ou teclado nela, sem janela por cima e fora da tela de entrar */
const relBlocked = () => relPaused || document.hidden || UI.tab !== 'linha' || !!UI.modal || reduced() || upcoming().length < 2
  || !document.querySelector('#top .cdown') || !!document.querySelector('.avx') || document.body.classList.contains('logged-out');
function startReleases() {
  if (relTimer) return;
  relLast = performance.now();
  // Conta só o tempo em que a faixa está andando, pra barrinha do ponto e a troca ficarem juntas
  relTimer = window.setInterval(() => {
    const now = performance.now(), dt = now - relLast;
    relLast = now;
    const hold = relBlocked();
    if (hold !== relHeld) { relHeld = hold; document.querySelector('#top .cdown')?.classList.toggle('rel-hold', hold); }
    if (hold) return;
    relElapsed += Math.min(dt, 400);
    if (relElapsed >= REL_EVERY) showRelease(relIdx + 1);
  }, 200);
}

/* ---------- Primeiros passos: quem ainda não marcou nada recebe atalhos no lugar do progresso zerado ---------- */
const WELCOME = 'cronomovie-primeiros-passos';
/** Os 23 filmes da Saga do Infinito (de Homem de Ferro, 2008, a Homem-Aranha: Longe de Casa, 2019) */
const SAGA = ITEMS.filter(it => it.e <= 4 && it.k === 'f' && it.r <= '2019-07').map(it => it.id);
/** Filmes marcados pelo atalho, enquanto ainda dá para desfazer */
let welcomeUndo: string[] | null = null;
const welcomeDone = () => { try { return !!localStorage.getItem(WELCOME); } catch { return false; } };

function welcomeHTML(): string | null {
  if (welcomeUndo) {
    return `<div class="welcome"><p class="muted">Primeiros passos</p><h3>Pronto: ${welcomeUndo.length} filmes marcados como vistos</h3><p class="w-txt">Agora é seguir a ordem a partir do próximo título.</p><div class="w-btns"><button class="btn primary" data-welcome="ok">Continuar</button><button class="btn" data-welcome="desfazer">Desfazer</button></div></div>`;
  }
  if (welcomeDone() || Object.keys(marksOf(S.me)).length) return null;
  return `<div class="welcome"><p class="muted">Primeiros passos</p><h3>Comece pelo que você já viu</h3><p class="w-txt">Marque o que já assistiu e o Cronomovie mostra o que falta até Doutor Destino.</p><div class="w-btns"><button class="btn primary" data-welcome="saga">Já vi os ${SAGA.length} filmes da Saga do Infinito</button><button class="btn" data-welcome="um">Vou marcar um por um</button><button class="btn" data-welcome="zero">Estou começando do zero</button></div></div>`;
}

function welcomeAction(a: string) {
  const done = () => { try { localStorage.setItem(WELCOME, '1'); } catch { /* sem armazenamento: o cartão some quando a pessoa marcar algo */ } };
  if (a === 'saga') {
    const m = marksOf(S.me);
    welcomeUndo = SAGA.filter(id => !m[id]);
    welcomeUndo.forEach(id => S.backend?.setMark(id, {}));
    buzz();
  } else if (a === 'desfazer') {
    (welcomeUndo || []).forEach(id => S.backend?.setMark(id, null));
    welcomeUndo = null;
  } else if (a === 'ok') {
    welcomeUndo = null; done();
    guestNudge();
  } else if (a === 'um') {
    done();
    toast('Toque no ✓ de cada cartaz que você já viu.');
    // Rola até a lista depois do redesenho (senão a rolagem é interrompida), descontando a barra fixa do topo
    window.setTimeout(() => {
      const eras = $('#eras'), bar = document.querySelector<HTMLElement>('header.bar');
      if (eras) window.scrollTo({ top: eras.getBoundingClientRect().top + window.scrollY - (bar?.offsetHeight || 0) - 12, behavior: reduced() ? 'auto' : 'smooth' });
    }, 80);
  } else if (a === 'zero') {
    done();
    const nx = nextUp();
    if (nx) toast(`Comece por ${nx.t}.`);
  }
  refresh();
}

/** Quanto falta da Trilha Avengers até a estreia de Doutor Destino, e quanto isso dá por dia */
function trailLeftHTML(): string {
  const days = daysTo(DOOMSDAY);
  if (released() || days < 1) return '';
  const m = marksOf(S.me);
  const left = trailSeq().filter(it => it.id !== 'doomsday' && !m[it.id]).reduce((a, it) => a + (it.m || 0), 0);
  if (!left) return '';
  const perDay = Math.max(1, Math.round(left / days));
  const fmtMin = (x: number) => (x < 60 ? `${x} min` : `${Math.floor(x / 60)}h${x % 60 ? String(x % 60).padStart(2, '0') : ''}`);
  return `<p class="prog-left">Faltam <b>${hours(left)} h</b> de Trilha Avengers até Doutor Destino: cerca de <b>${fmtMin(perDay)} por dia</b>.</p>`;
}

function topHTML(): string {
  const st = stats(S.me), nx = nextUp();
  const who = demo() && !isMe('voce') ? esc(P(S.me).name) : '';
  const wel = who ? null : welcomeHTML();
  if (wel) return `${countHTML()}\n  <div class="top-side">${wel}</div>`;
  // Trilha ligada: o progresso do topo é o da trilha
  const tr = UI.trail ? trailProgress(S.me) : null;
  const seen = tr ? tr.seen : st.seenMain, total = tr ? tr.total : MAIN.length;
  const pct = Math.round(seen / total * 100);
  // Tipo, duração e peso do próximo título: a pessoa decide sem abrir a ficha
  const nxMeta = nx ? [KIND[nx.k], dur(nx), nx.star ? 'Essencial' : nx.opt ? 'Opcional' : ''].filter(Boolean).join(' · ') : '';
  const next = nx
    ? `<div class="next"><button class="next-poster" data-open="${nx.id}" aria-label="Abrir ${esc(nx.t)}">${posterHTML(nx)}</button><div><p class="muted">Próximo na ordem</p><h3><button data-open="${nx.id}">${esc(nx.t)}</button></h3>${nxMeta ? `<p class="next-meta">${esc(nxMeta)}</p>` : ''}<button class="btn" data-toggle="${nx.id}">Marcar como visto</button></div></div>`
    : `<div class="next"><div><p class="muted">Linha principal completa</p><h3>${released() ? 'Vingadores: Doutor Destino já estreou.' : 'Agora é aguardar a estreia de Doutor Destino.'}</h3></div></div>`;
  return `${countHTML()}
  <div class="top-side">
    <div class="prog">
      <p class="muted">${who ? 'Progresso de ' + who : 'Seu progresso'}${tr ? ' na Trilha Avengers' : ''}</p>
      <div class="prog-num"><b>${seen}</b><span>de ${total}</span></div>
      <div class="meter" role="img" aria-label="${pct}% ${tr ? 'da trilha' : 'da linha principal'}"><i style="width:${pct}%"></i></div>
      <p class="muted">${st.seenEss} de ${ESS.length} essenciais</p>
      ${trailLeftHTML()}
      ${isGuest() ? '<p class="guest-save">Sem conta, o seu progresso não fica salvo.</p>' : ''}
    </div>
    ${next}
  </div>`;
}

/** O botão "Filtros" abre as opções: um painel no computador, uma gaveta no celular. */
let filtersOpen = false;

/** O filtro tem pelo menos 2 títulos da Trilha Avengers? Se não tiver, escolher ele desliga a trilha. */
const inTrail = (key: string) => [...(FILTERS[key]?.ids || [])].filter(id => TRILHA.has(id)).length >= 2;

function toolsHTML(): string {
  const chips = FILTER_LIST.map(f => `<button class="chip" data-saga-chip="${f.key}" aria-pressed="false">${esc(f.label)}</button>`).join('');
  return `<div class="tools${filtersOpen ? ' open' : ''}">
    <button class="trail" type="button" data-trail aria-pressed="${UI.trail}">${BACK.ultimato ? `<span class="trail-bg" aria-hidden="true"><img src="https://image.tmdb.org/t/p/w780${BACK.ultimato}" alt="" loading="lazy" decoding="async"></span>` : ''}<span class="trail-kicker">Trilha</span><span class="trail-name"><img src="/avengers-logo.webp" alt="Avengers" width="1017" height="435" decoding="async"></span><span class="trail-sub">Só o que leva a Doutor Destino. <span data-trail-count></span></span><span class="trail-sw" aria-hidden="true"></span></button>
    <div class="tools-row">
      <label class="search">${IC.search}<input id="q" type="search" placeholder="Buscar título" aria-label="Buscar título" autocomplete="off" enterkeyhint="search"></label>
      <button class="btn filters-btn" type="button" data-filters aria-expanded="${filtersOpen}" aria-controls="tools-more">Filtros<span class="fcount" hidden></span></button>
      <div class="tools-back" data-filters-close aria-hidden="true"></div>
      <div class="tools-more" id="tools-more" role="dialog" aria-label="Filtros">
        <div class="tm-head"><h2>Filtros</h2><button class="linkish" type="button" data-clear>Limpar</button></div>
        <div class="tm-body">
          <p class="tm-lbl">Mostrar</p>
          <div class="seg" data-seg="type" role="group" aria-label="Mostrar"><button data-v="all">Tudo</button><button data-v="star">Essenciais</button><button data-v="film">Filmes</button><button data-v="series">Séries</button></div>
          <p class="tm-lbl">Assistidos</p>
          <div class="seg" data-seg="seen" role="group" aria-label="Assistidos"><button data-v="all">Todos</button><button data-v="seen">Já vi</button><button data-v="unseen">Falta ver</button></div>
          <p class="tm-lbl">Onde assistir</p>
          <div class="seg" data-seg="streams" role="group" aria-label="Onde assistir"><button data-v="all">Todos</button><button data-v="mine">Nos meus streamings</button></div>
          <button class="linkish tm-svc" type="button" data-svc-open>Escolher meus streamings<span data-svc-count></span></button>
          <p class="tm-lbl">Sagas</p>
          <div class="tm-chips" role="group" aria-label="Sagas">${chips}</div>
          <p class="tm-lbl">Ordem</p>
          <div class="seg" data-seg="order" role="group" aria-label="Ordem"><button data-v="crono">Cronológica</button><button data-v="lanc">Lançamento</button></div>
          <p class="tm-lbl">Visualização</p>
          <div class="seg" data-seg="view" role="group" aria-label="Visualização"><button data-v="h">Fileiras</button><button data-v="v">Grade</button></div>
        </div>
        <div class="tm-foot"><button class="btn primary" type="button" data-filters-close data-fres>Ver títulos</button></div>
      </div>
    </div>
  </div>`;
}

function resultHTML(): string {
  const active = UI.type !== 'all' || UI.seen !== 'all' || UI.streams !== 'all' || UI.q.trim() || UI.saga;
  if (!active) return '';
  const vis = ITEMS.filter(passes).length;
  return `<span>${plural(vis, 'título', 'títulos')}${UI.saga && FILTERS[UI.saga] ? ` em ${esc(FILTERS[UI.saga].label)}` : ''}</span><button class="linkish" data-clear>Limpar filtros</button>`;
}

function syncTools() {
  document.querySelectorAll<HTMLElement>('[data-seg]').forEach(g => {
    const k = g.dataset.seg as keyof typeof UI;
    g.querySelectorAll<HTMLElement>('button').forEach(b => b.setAttribute('aria-pressed', String(UI[k] === b.dataset.v)));
  });
  document.querySelectorAll<HTMLElement>('[data-saga-chip]').forEach(b => b.setAttribute('aria-pressed', String((UI.saga || '') === b.dataset.sagaChip)));
  const q = $<HTMLInputElement>('#q'); if (q && q.value !== UI.q) q.value = UI.q;
  const tp = trailProgress(S.me), tc = $('[data-trail-count]');
  if (tc) tc.textContent = `${tp.seen} de ${tp.total} vistos.`;
  $('[data-trail]')?.setAttribute('aria-pressed', String(UI.trail));
  // Quantos filtros estão ligados, no botão "Filtros" do celular
  const n = (UI.type !== 'all' ? 1 : 0) + (UI.seen !== 'all' ? 1 : 0) + (UI.streams !== 'all' ? 1 : 0) + (UI.saga ? 1 : 0), fc = $('.fcount');
  const sc = $('[data-svc-count]'), ns = myServices().size;
  if (sc) sc.textContent = ns ? ` (${ns})` : '';
  if (fc) { fc.textContent = String(n); fc.hidden = !n; }
  const fr = $('[data-fres]'), vis = ITEMS.filter(passes).length;
  if (fr) fr.textContent = vis ? `Ver ${plural(vis, 'título', 'títulos')}` : 'Nenhum título com esses filtros';
}

function setFilters(open: boolean, push = true) {
  if (filtersOpen === open) return;
  filtersOpen = open;
  // Computador: o painel abre embaixo do botão; sobe a página se precisar e cabe na altura que sobra
  const row = $('.tools-row'), panel = $('.tools-more');
  if (open && row && panel && !mobile()) {
    const top = row.getBoundingClientRect().top;
    if (top < 80 || top > window.innerHeight * .4) window.scrollBy(0, top - 88);
    panel.style.maxHeight = `${Math.max(320, Math.min(680, window.innerHeight - row.getBoundingClientRect().bottom - 24))}px`;
  } else if (panel) panel.style.maxHeight = '';
  $('.tools')?.classList.toggle('open', open);
  $('[data-filters]')?.setAttribute('aria-expanded', String(open));
  lockScroll();
  if (open && push) pushLayer('filters');
}

/** Fileiras horizontais: mostra o degradê e as setas só quando ainda tem cartaz escondido. */
function updateRailEdges(r: HTMLElement) {
  const start = r.scrollLeft <= 4, end = r.scrollLeft + r.clientWidth >= r.scrollWidth - 4;
  r.parentElement?.classList.toggle('more-left', !start);
  r.parentElement?.classList.toggle('more-right', !end);
  const btns = document.querySelectorAll<HTMLButtonElement>(`[data-rail-btn="${r.dataset.rail}"]`);
  btns.forEach(b => { b.disabled = b.dataset.scroll === '-1' ? start : end; });
}

function updateLinha() {
  const pos: Record<string, number> = {};
  document.querySelectorAll<HTMLElement>('.rail[data-rail]').forEach(r => { pos[r.dataset.rail!] = r.scrollLeft; });
  const top = $('#top')!;
  top.innerHTML = topHTML();
  top.classList.toggle('no-count', !upcoming().length);
  const wa = $('#watching');
  if (wa) wa.innerHTML = watchingStripHTML();
  const res = $('#result')!;
  res.innerHTML = resultHTML();
  res.hidden = !res.innerHTML;
  $('#eras')!.innerHTML = erasHTML();
  document.querySelectorAll<HTMLElement>('.rail[data-rail]').forEach(r => {
    if (pos[r.dataset.rail!]) r.scrollLeft = pos[r.dataset.rail!];
    updateRailEdges(r);
  });
  syncTools();
}

/* ================= RANKING ================= */
function rankingHTML(): string {
  const R = ranked(UI.metric);
  const val = (s: ReturnType<typeof stats>) => UI.metric === 'main' ? `${s.seenMain}<small>de ${MAIN.length}</small>` : UI.metric === 'horas' ? `${hours(s.minutes)}<small>horas</small>` : `${s.seenEss}<small>de ${ESS.length}</small>`;
  const podium = [1, 0, 2].filter(i => R[i]).map(i => {
    const { pid, s } = R[i];
    return `<div class="pod r${i + 1}"><button data-profile="${pid}" aria-label="Ver perfil de ${esc(P(pid).name)}">${av(pid, i === 0 ? 'xl' : 'lg')}</button><div class="pn">${esc(P(pid).name)}</div><div class="pv">${val(s)}</div><div class="blk" aria-hidden="true">${i + 1}</div></div>`;
  }).join('');
  // No celular a tabela mostra só a coluna escolhida (a "hl")
  const nc = (m: string) => `num${UI.metric === m ? ' hl' : ''}`;
  const rows = R.map(({ pid, s }, i) => `<tr${isMe(pid) ? ' class="me-row"' : ''}><td class="pos">${i + 1}</td><td><button class="who-cell" data-profile="${pid}">${av(pid, 'md')}<span>${esc(P(pid).name)}</span></button></td><td class="${nc('main')}">${s.seenMain}</td><td class="${nc('ess')}">${s.seenEss}</td><td class="${nc('horas')}">${hours(s.minutes)}</td></tr>`).join('');
  const favs = ITEMS.map(it => ({ it, c: crowd(it) })).filter(x => x.c.rs.length >= 2).sort((a, b) => (b.c.avg! - a.c.avg!) || b.c.rs.length - a.c.rs.length || a.it.i - b.it.i).slice(0, 10);
  const favHTML = favs.map((x, k) => `<button class="fav" data-open="${x.it.id}"><div class="p-wrap">${posterHTML(x.it)}<span class="rk" aria-hidden="true">${k + 1}</span></div><div class="ft">${esc(x.it.t)}</div><div class="fm">${starsHTML(x.c.avg!)}<span>${fmt(x.c.avg!)}</span></div></button>`).join('');
  return `<div class="page-head"><h1>Ranking</h1><div class="seg" data-seg="metric" role="group" aria-label="Ordenar por">${[['main', 'Vistos'], ['ess', 'Essenciais'], ['horas', 'Horas']].map(([v, l]) => `<button data-v="${v}" aria-pressed="${UI.metric === v}">${l}</button>`).join('')}</div></div>
  ${R.length > 1 ? `<div class="podium">${podium}</div>` : '<p class="muted solo">O ranking é entre você e seus amigos. Adicione amigos na aba <button class="linkish" data-tab="amigos">Amigos</button>.</p>'}
  <div class="table-wrap"><table class="rank"><thead><tr><th scope="col"><span class="sr">Posição</span></th><th scope="col">Pessoa</th><th scope="col" class="${nc('main')}">Vistos</th><th scope="col" class="${nc('ess')}">Essenciais</th><th scope="col" class="${nc('horas')}">Horas</th></tr></thead><tbody>${rows}</tbody></table></div>
  <section class="section"><h2>Mais bem avaliados entre amigos</h2>${favHTML ? `<div class="row-scroll favs">${favHTML}</div>` : '<p class="muted">Quando pelo menos duas pessoas avaliarem o mesmo título, ele aparece aqui.</p>'}</section>`;
}

/* ================= PERFIL ================= */
const miniCard = (it: Item, r: number | null) => `<button class="mini-card" data-open="${it.id}">${posterHTML(it)}<span class="mt">${esc(it.t)}</span>${r != null ? starsHTML(r) : ''}</button>`;

let compareWith: string | null = null;
let confirmDelete = false;
/** Aba aberta dentro do perfil (ao trocar de perfil, volta para "Vistos") */
let pfTab: 'vistos' | 'listas' | 'progresso' = 'vistos';
let pfTabOf = '';
/** O perfil foi aberto de dentro do site: a seta de voltar volta pelo histórico */
let pfBackable = false;

/** O que o servidor diz de cada perfil: número de amigos e amigos em comum. gone = não existe ou há bloqueio. */
interface Info { friends: number | null; mutual: number; mutualIds: string[]; t: number; gone?: boolean }
const infoCache = new Map<string, Info>();
const infoLoading = new Set<string>();
const forgetInfo = (id: string) => { infoCache.delete(id); };

/** Perfil aberto na aba Perfil: o seu ou o de quem você abriu */
const currentProfile = () => (UI.profile && UI.profile !== S.me ? UI.profile : S.me);

function openProfile(id: string) {
  UI.profile = id === S.me ? null : id;
  UI.editing = false;
  pfBackable = true;
  go('perfil');
}

/** Seta de voltar do perfil de outra pessoa */
function pfBack() {
  const h = hist();
  if (pfBackable && h.tab === 'perfil' && h.profile) history.back();
  else { UI.profile = null; go('amigos'); }
}

/** Busca no servidor o número de amigos e os amigos em comum (guardado por um minuto) */
function loadInfo(pid: string) {
  const c = infoCache.get(pid);
  if ((c && Date.now() - c.t < 60_000) || infoLoading.has(pid) || isGuest() || !S.backend) return;
  infoLoading.add(pid);
  void S.backend.profileInfo(pid).then(r => {
    if (r) rememberPerson(r.person);
    infoCache.set(pid, r ? { friends: r.friends, mutual: r.mutual, mutualIds: r.mutualIds, t: Date.now() } : { friends: null, mutual: 0, mutualIds: [], t: Date.now(), gone: true });
  }, () => { infoCache.set(pid, { friends: null, mutual: 0, mutualIds: [], t: Date.now() }); }).finally(() => {
    infoLoading.delete(pid);
    if (UI.tab === 'perfil' && currentProfile() === pid && !UI.editing && !compareWith) { const y = window.scrollY; renderView(); window.scrollTo(0, y); }
  });
}

/** "Em comum com você: Ana, Bia e mais 3" */
function mutualHTML(info: Info | undefined): string {
  if (!info || !info.mutual || !info.mutualIds.length) return '';
  const nm = info.mutualIds.map(id => `<b>${esc(P(id).name)}</b>`), n = info.mutual;
  const txt = n === 1 || nm.length === 1 ? nm[0] + (n > 1 ? ` e mais ${n - 1}` : '')
    : n === 2 ? `${nm[0]} e ${nm[1]}`
    : n === 3 && nm.length === 3 ? `${nm[0]}, ${nm[1]} e ${nm[2]}`
    : `${nm[0]}, ${nm[1]} e mais ${n - 2}`;
  return `<p class="pf-mutual"><span class="stack">${info.mutualIds.slice(0, 3).map(id => av(id, 'sm')).join('')}</span><span>Em comum com você: ${txt}</span></p>`;
}

/** Botões do perfil, conforme a relação (como o Seguir / Seguindo do Instagram) */
function pfActsHTML(pid: string): string {
  if (isMe(pid)) return `<button class="btn" data-edit>${UI.editing ? 'Fechar edição' : 'Editar perfil'}</button>${demo() ? '' : '<button class="btn" data-share>Compartilhar perfil</button>'}`;
  const r = relation(pid);
  if (r === 'friend') return `<button class="btn" data-pf-friend="${pid}" aria-haspopup="dialog">Amigos${IC.down}</button><button class="btn" data-compare="${pid}">Comparar comigo</button>`;
  if (r === 'sent') return `<button class="btn" data-pf-sent="${pid}" aria-haspopup="dialog">Pedido enviado${IC.down}</button>`;
  if (r === 'received') return `<button class="btn primary" data-accept="${pid}">Aceitar pedido</button><button class="btn" data-remove="${pid}">Recusar</button>`;
  return `<button class="btn primary" data-add="${pid}">Adicionar aos amigos</button>`;
}

/** Botão ou etiqueta de relação numa linha de pessoa (busca, sugestões, listas) */
function relBtnHTML(id: string): string {
  if (isMe(id)) return '<span class="tagline">Você</span>';
  const r = relation(id);
  return r === 'friend' ? '<span class="tagline">Amigos</span>'
    : r === 'sent' ? '<span class="tagline">Pedido enviado</span>'
    : r === 'received' ? `<button class="btn primary sm" data-accept="${id}">Aceitar</button>`
    : `<button class="btn primary sm" data-add="${id}">Adicionar</button>`;
}

function perfilHTML(): string {
  const pid = currentProfile(), mine = isMe(pid), rel = mine ? 'self' : relation(pid), open = mine || rel === 'friend';
  if (compareWith && compareWith === pid && rel === 'friend') return compareHTML(pid);
  compareWith = null;
  if (pfTabOf !== pid) { pfTab = 'vistos'; pfTabOf = pid; }
  if (!mine) loadInfo(pid);
  const info = mine ? undefined : infoCache.get(pid), p = P(pid);
  const handle = p.username ? `@${esc(p.username)}` : esc(p.name);
  const bar = `<div class="pf-bar">${mine ? '' : `<button class="pf-ic" data-pf-back aria-label="Voltar">${IC.left}</button>`}<span class="pf-bar-u">${handle}</span>${info?.gone || demo() && mine ? '<span></span>' : `<button class="pf-ic" data-pf-more="${pid}" aria-label="Mais opções" aria-haspopup="dialog">${IC.more}</button>`}</div>`;
  if (info?.gone) return `${bar}<div class="pf-gone"><h1>Perfil indisponível</h1><p class="muted">Este perfil não existe mais ou não está disponível para você.</p></div>`;
  const s = stats(pid), friendsN = mine ? friendIds().length : info?.friends ?? null;
  const nums = open ? `<div class="pf-nums">
      <button type="button" data-pf-go="vistos"><b>${s.seenAll}</b><span>${s.seenAll === 1 ? 'visto' : 'vistos'}</span></button>
      <button type="button" data-friends-of="${pid}"><b>${friendsN ?? '–'}</b><span>${friendsN === 1 ? 'amigo' : 'amigos'}</span></button>
      <button type="button" data-pf-go="progresso"><b>${s.seenEss}</b><span>essenciais</span></button>
    </div>` : '';
  const pos = open ? ranked('main').findIndex(x => x.pid === pid) + 1 : 0;
  const favIt = p.favorite ? BYID[p.favorite] : null;
  const head = `<header class="pf-top">${av(pid, 'xl')}${nums}</header>
    <div class="pf-who"><h1>${esc(p.name)}</h1>${p.username ? `<p class="uname">@${esc(p.username)}</p>` : ''}${pos && pids().length > 1 ? `<p class="pf-meta">${pos}º no ranking${s.first ? `, na maratona desde ${fmtDate(s.first)}` : ''}</p>` : ''}</div>
    ${favIt ? `<button class="pf-fav" data-open="${favIt.id}">${posterHTML(favIt)}<span><span class="pf-fav-l">${favIt.k === 'f' ? 'Filme favorito' : 'Série favorita'}</span><b>${esc(favIt.t)}</b></span></button>` : ''}
    ${mine ? '' : mutualHTML(info)}
    <div class="pf-acts">${pfActsHTML(pid)}</div>`;
  if (!open) {
    const msg = rel === 'sent' ? `Pedido enviado. Quando ${esc(p.name)} aceitar, vocês passam a ver o que cada um já assistiu.`
      : rel === 'received' ? `${esc(p.name)} enviou um pedido de amizade. Aceite para ver o que cada um já assistiu.`
      : 'Adicione aos amigos para ver os títulos, as listas e o progresso.';
    return `${bar}${head}<div class="pf-lock">${IC.lock}<div><b>Só os amigos veem o que ${esc(p.name)} assiste</b><p>${msg}</p></div></div>`;
  }
  const edit = mine && UI.editing ? `<form class="edit" id="editForm">
    <label class="lbl" for="pf-name">Nome</label>
    <input type="text" id="pf-name" maxlength="20" value="${esc(p.name)}" required>
    <label class="lbl" for="pf-user">Nome de usuário</label>
    ${usernameFieldHTML('pf-user', p.username || '')}
    <span class="lbl">Filme ou série favorita</span>
    ${favFieldHTML(editFav)}
    <span class="lbl">Foto de perfil</span>
    ${avatarFieldHTML(editAvatar, editPhoto?.url ?? photoURL(S.me, p.avatar))}
    <div class="row-btns"><button class="btn primary" type="submit">Salvar</button><button class="btn" type="button" data-edit>Cancelar</button></div>
  </form><div class="danger-zone"><button class="linkish" type="button" data-blocked-open>Contas bloqueadas</button>${demo() ? '' : confirmDelete
    ? '<p>Excluir a conta apaga suas marcações, notas, comentários, listas e amizades. Essa ação não pode ser desfeita.</p><div class="row-btns"><button class="btn danger" type="button" data-delete-yes>Sim, excluir minha conta</button><button class="btn" type="button" data-delete-no>Cancelar</button></div>'
    : '<button class="linkish" type="button" data-delete-ask>Excluir minha conta</button>'}</div>` : '';
  const tabs = ([['vistos', IC.grid, 'Vistos'], ['listas', IC.bookmark, 'Listas'], ['progresso', IC.chart, 'Progresso']] as const)
    .map(([k, ic, l]) => `<button type="button" role="tab" id="pft-${k}" aria-controls="pf-panel" aria-selected="${pfTab === k}" data-pf-tab="${k}">${ic}<span>${l}</span></button>`).join('');
  return `${bar}${head}${edit}<div class="pf-tabs" role="tablist" aria-label="Conteúdo do perfil">${tabs}</div>
  <div class="pf-panel" id="pf-panel" role="tabpanel" aria-labelledby="pft-${pfTab}">${pfPanelHTML(pid)}</div>`;
}

/** Conteúdo da aba do perfil: grade do que viu, listas ou progresso */
function pfPanelHTML(pid: string): string {
  const mine = isMe(pid), p = P(pid), m = marksOf(pid);
  if (pfTab === 'vistos') {
    const ids = Object.keys(m).filter(id => BYID[id]).sort((a, b) => (m[b].d || '').localeCompare(m[a].d || '') || BYID[b].i - BYID[a].i);
    if (!ids.length) return `<p class="muted pf-empty">${mine ? 'Você ainda não marcou nenhum título. Marque na linha do tempo e ele aparece aqui.' : 'Nada marcado ainda.'}</p>`;
    return `<div class="pf-grid">${ids.map(id => {
      const x = m[id];
      return `<button class="pf-tile" data-open="${id}" aria-label="${esc(BYID[id].t)}${x.r != null ? `, nota ${x.r} de 5` : ''}">${posterHTML(BYID[id])}${x.r != null ? `<span class="pf-r" aria-hidden="true">${IC.star}${x.r}</span>` : ''}</button>`;
    }).join('')}</div>`;
  }
  if (pfTab === 'listas') {
    return listSectionHTML(pid, 'assistindo', 'Assistindo agora', mine ? 'Nada no momento. Comece uma série e ela aparece aqui.' : 'Nada no momento.')
      + listSectionHTML(pid, 'quero', 'Quero ver', mine ? 'Sua lista está vazia. No detalhe de um título, toque em "Quero ver".' : 'A lista está vazia.');
  }
  const s = stats(pid), d = Math.max(0, daysTo(DOOMSDAY));
  const miss = ESS.filter(it => !m[it.id]);
  const perWeek = d > 0 ? miss.length / (d / 7) : miss.length;
  const quem = mine ? 'você' : esc(p.name);
  const pace = released()
    ? `Doutor Destino já estreou. ${miss.length ? `Ainda ${miss.length === 1 ? 'falta 1 essencial' : `faltam ${miss.length} essenciais`}.` : 'Todos os essenciais vistos.'}`
    : miss.length ? `Para ${quem} chegar pronto em 17/12, são ${fmt(perWeek)} essenciais por semana.` : 'Todos os essenciais vistos. Tudo em dia para a estreia.';
  const eras = ERAS.map((e, idx) => {
    const all = ITEMS.filter(it => it.e === idx && it.id !== 'doomsday'), k = all.filter(it => m[it.id]).length;
    return `<div class="er"><span>${esc(e.name)}</span><span class="n">${k} de ${all.length}</span><span class="meter"><i style="width:${k / all.length * 100}%"></i></span></div>`;
  }).join('');
  const favs = Object.keys(m).filter(id => BYID[id] && m[id].r != null).sort((a, b) => m[b].r! - m[a].r! || (m[b].d || '').localeCompare(m[a].d || '')).slice(0, 10).map(id => miniCard(BYID[id], m[id].r)).join('');
  return `${mine ? `<div class="pf-share"><button class="btn primary" data-story-open>${IC.share}Compartilhar nos Stories</button><button class="btn" data-recap>Ver sua retrospectiva</button></div>` : ''}<div class="stats">
    <div><b>${s.seenMain}</b><span>de ${MAIN.length} da linha do tempo</span></div>
    <div><b>${s.seenEss}</b><span>de ${ESS.length} essenciais</span></div>
    <div><b>${hours(s.minutes)}</b><span>horas assistidas</span></div>
  </div>
  <p class="pace">${pace}</p>
  <section class="section"><h2>Por era</h2><div class="eras-list">${eras}</div></section>
  <section class="section"><h2>Notas mais altas</h2>${favs ? `<div class="row-scroll minis">${favs}</div>` : '<p class="muted">Nenhuma nota ainda.</p>'}</section>
  <section class="section"><h2>Essenciais que faltam</h2>${miss.length ? `<div class="row-scroll minis">${miss.map(it => miniCard(it, null)).join('')}</div>` : '<p class="muted">Nenhum. Tudo em dia para a estreia.</p>'}</section>`;
}

/* ---------- janela de opções (sobe de baixo, como no Instagram) ---------- */
function openSheet(label: string, body: string) {
  const el = $('#gate')!;
  el.innerHTML = `<div class="m-back" data-sheet-close></div><div class="sheet small acts" role="dialog" aria-modal="true" aria-label="${esc(label)}">${body}<button class="btn" type="button" data-sheet-close>Cancelar</button></div>`;
  el.hidden = false;
  el.querySelector<HTMLElement>('.sheet button')?.focus();
}

/** Opções do perfil: "…" no topo, o botão "Amigos" e o "Pedido enviado" */
function profileSheet(kind: 'more' | 'friend' | 'sent', pid: string) {
  const p = P(pid), mine = isMe(pid), rel = relation(pid);
  const head = `<p class="acts-t">${av(pid, 'md')}<span>${esc(p.name)}${p.username ? `<small>@${esc(p.username)}</small>` : ''}</span></p>`;
  if (kind === 'sent') { openSheet('Pedido enviado', `${head}<button class="btn" data-sheet="cancel-request" data-id="${pid}">Cancelar pedido</button>`); return; }
  if (mine) {
    openSheet('Opções do perfil', `${head}<button class="btn" data-sheet="recap">Sua retrospectiva</button><button class="btn" data-sheet="story">Compartilhar progresso nos Stories</button>${p.username ? `<button class="btn" data-sheet="share" data-id="${pid}">Compartilhar perfil</button>` : ''}<button class="btn" data-sheet="blocked">Contas bloqueadas</button>${installWay() ? '<button class="btn" data-sheet="install">Instalar o app</button>' : ''}`);
    return;
  }
  openSheet('Opções', `${head}${kind === 'more' && p.username ? `<button class="btn" data-sheet="share" data-id="${pid}">Compartilhar perfil</button>` : ''}${rel === 'friend' ? `<button class="btn" data-sheet="unfriend" data-id="${pid}">Desfazer amizade</button>` : ''}<button class="btn danger" data-sheet="block" data-id="${pid}">Bloquear</button>`);
}

function sheetAction(a: string, id: string) {
  const p = P(id);
  if (a === 'share') { closeGate(); void shareProfile(false, id); return; }
  if (a === 'blocked') { closeGate(); openBlocked(); return; }
  if (a === 'story') { void openStory(); return; }
  if (a === 'recap') { closeGate(); openRecap(() => void openStory()); return; }
  if (a === 'install') { closeGate(); void installFlow(); return; }
  if (a === 'unfriend') {
    openSheet('Desfazer amizade', `<h2>Desfazer amizade?</h2><p class="muted">Você e ${esc(p.name)} deixam de ver o que o outro assiste e saem do ranking um do outro. Ninguém recebe aviso.</p><button class="btn danger" data-sheet="unfriend-yes" data-id="${id}">Desfazer amizade</button>`);
    return;
  }
  if (a === 'block') {
    openSheet('Bloquear', `<h2>Bloquear ${esc(p.name)}?</h2><p class="muted">A amizade é desfeita, e ${esc(p.name)} deixa de encontrar o seu perfil e não consegue mandar pedido. Ninguém recebe aviso. Para desbloquear depois: Editar perfil, Contas bloqueadas.</p><button class="btn danger" data-sheet="block-yes" data-id="${id}">Bloquear</button>`);
    return;
  }
  if (a === 'cancel-request' || a === 'unfriend-yes') {
    closeGate(); forgetInfo(id);
    const was = relation(id);
    void S.backend?.removeFriend(id).then(() => toast(was === 'friend' ? 'Amizade desfeita' : 'Pedido cancelado'));
    return;
  }
  if (a === 'block-yes') {
    closeGate(); forgetInfo(id); dropRecent(id);
    void S.backend?.block(id).then(() => {
      toast(`Você bloqueou ${p.name}`);
      if (UI.tab === 'perfil' && currentProfile() === id) pfBack();
    }, () => {});
  }
}

/* ---------- cartão dos Stories ---------- */
let storyBlob: Blob | null = null, storyURL = '';
async function openStory() {
  openSheet('Compartilhar nos Stories', '<h2>Compartilhar nos Stories</h2><p class="muted">Gerando a imagem</p>');
  try {
    const b = await storyImage(S.me);
    if ($('#gate')?.hidden) return; // fechou enquanto gerava
    if (storyURL) URL.revokeObjectURL(storyURL);
    storyBlob = b; storyURL = URL.createObjectURL(b);
    const canShare = !!navigator.canShare?.({ files: [new File([b], 'cronomovie.jpg', { type: 'image/jpeg' })] });
    openSheet('Compartilhar nos Stories', `<h2>Compartilhar nos Stories</h2>
      <img class="story-prev" src="${storyURL}" alt="Cartão com o seu progresso no Cronomovie" width="1080" height="1920">
      ${canShare ? '<button class="btn primary" data-story-share>Compartilhar</button>' : ''}
      <button class="btn${canShare ? '' : ' primary'}" data-story-save>Baixar imagem</button>
      <p class="muted story-tip">${canShare ? 'Em Compartilhar, escolha o Instagram e depois Stories.' : 'Depois é só postar a imagem nos Stories.'}</p>`);
  } catch {
    closeGate();
    toast('Não foi possível gerar a imagem agora. Tente de novo.');
  }
}
async function shareStory() {
  if (!storyBlob) return;
  try { await navigator.share({ files: [new File([storyBlob], 'cronomovie.jpg', { type: 'image/jpeg' })] }); }
  catch (e) { if ((e as DOMException)?.name !== 'AbortError') saveFile(storyBlob, 'cronomovie.jpg'); }
}

/* ---------- lembrete de estreia ---------- */
/** Botão de lembrete no detalhe, quando o título tem estreia marcada (o próximo episódio, no caso de série) */
function remindBtnHTML(id: string): string {
  const i = RELEASES.findIndex(r => r.id === id && !r.approx && !countdown(r.date).done);
  return i < 0 ? '' : `<button type="button" class="btn sm m-remind" data-remind="${i}">${IC.bell}Me lembre: ${esc(RELEASES[i].label)}</button>`;
}
function remindSheet(i: number) {
  const r = RELEASES[i];
  if (!r) return;
  openSheet('Lembrete de estreia', `<h2>Lembrete de estreia</h2><p class="muted">${esc(r.t)}. ${esc(r.what)}, ${esc(r.label)}. O aviso aparece na véspera e no dia.</p>
    <button class="btn primary" data-remind-ics="${i}">Adicionar à agenda do celular</button>
    <a class="btn" href="${esc(googleCalURL(r))}" target="_blank" rel="noopener" data-sheet-close>Google Agenda</a>`);
}

/* ---------- trailer: a capa do vídeo primeiro; o YouTube só carrega quando a pessoa toca ---------- */
let trailerOn = '';
function trailerHTML(id: string): string {
  const k = detailsOf(id).tr;
  if (!k || !/^[\w-]{6,20}$/.test(k)) return '';
  if (trailerOn !== id) return `<section class="m-sec"><h3>Trailer</h3><button type="button" class="trailer" data-trailer="${id}" aria-label="Ver o trailer"><img src="https://i.ytimg.com/vi/${k}/hqdefault.jpg" alt="" loading="lazy" decoding="async"><span class="tr-play">${IC.play}</span></button></section>`;
  return `<section class="m-sec"><h3>Trailer</h3><div class="trailer on"><iframe src="https://www.youtube-nocookie.com/embed/${k}?autoplay=1&rel=0&playsinline=1&modestbranding=1&hl=pt-BR" title="Trailer de ${esc(BYID[id]?.t || '')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div></section>`;
}

/* ---------- meus streamings ---------- */
function servicesSheet() {
  const mine = myServices();
  openSheet('Meus streamings', `<h2>Meus streamings</h2><p class="muted">Marque os que você assina. Com o filtro "Nos meus streamings", a linha do tempo mostra só o que dá para ver neles. Fica salvo neste aparelho.</p>
    <div class="svc-grid" role="group" aria-label="Streamings">${SERVICES.map(s => `<button type="button" class="chip" data-svc="${esc(s)}" aria-pressed="${mine.has(s)}">${esc(s)}</button>`).join('')}</div>
    <button class="btn primary" type="button" data-svc-done>Pronto</button>`);
}

/* ---------- comentário de amigo: escondido se você ainda não viu o título (pode ter spoiler) ---------- */
const spoilOpen = new Set<string>();
function commentHTML(pid: string, id: string, c: string): string {
  const key = `${pid}:${id}`;
  if (isMe(pid) || marksOf(S.me)[id] || spoilOpen.has(key)) return `<p class="fc">${esc(c)}</p>${likeHTML(pid, id)}`;
  return `<button type="button" class="fc spoil" data-spoil="${key}" aria-label="Comentário escondido porque pode ter spoiler. Toque para ver."><span class="fc-t" aria-hidden="true">${esc(c)}</span><span class="fc-w">Pode ter spoiler. Toque para ver.</span></button>${likeHTML(pid, id)}`;
}

/** Curtir o comentário de um amigo; no seu, quem curtiu */
function likeHTML(owner: string, id: string): string {
  if (isGuest()) return '';
  const who = likesOf(owner, id), n = who.length;
  if (isMe(owner)) {
    if (!n) return '';
    const names = who.filter(x => !isMe(x)).map(x => esc(P(x).name));
    const txt = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} e ${names[1]}` : `${names[0]}, ${names[1]} e mais ${names.length - 2}`;
    return `<p class="fc-likes">${IC.heart}<span>${txt} ${n === 1 ? 'curtiu' : 'curtiram'} seu comentário</span></p>`;
  }
  const on = who.includes(S.me);
  return `<button type="button" class="fc-like" data-like="${owner}|${id}" aria-pressed="${on}" aria-label="${on ? 'Descurtir' : 'Curtir'} o comentário">${IC.heart}${n ? `<span>${n}</span>` : ''}</button>`;
}

/* ---------- lista de pessoas em tela cheia: amigos de alguém e contas bloqueadas ---------- */
type ListPerson = Person & { common?: boolean };
interface PeopleOpts {
  title: string;
  search: boolean;
  /** Tocar na pessoa abre o perfil dela */
  openable: boolean;
  load: (q: string, offset: number) => Promise<{ people: ListPerson[]; total: number }>;
  row: (p: ListPerson) => string;
  sub?: (p: ListPerson) => string;
  empty: string;
}
/** Redesenha a lista aberta quando algo muda (ex.: pedido enviado por ela) */
let peopleRerender: (() => void) | null = null;

/**
 * Tela cheia por cima do site (lista de amigos, notificações). Entra no histórico: o Voltar do celular, o Esc e o botão Fechar fecham.
 * close(depois): o que vem depois (ex.: abrir um perfil) só roda quando o "voltar" terminar.
 */
function fullScreen(title: string, body: string, cls: string) {
  const el = document.createElement('div');
  el.className = `avx ${cls}`;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', title);
  el.innerHTML = `<header class="avx-head"><h2>${esc(title)}</h2><button type="button" class="btn" data-fs-close>Fechar</button></header><div class="avx-body">${body}</div>`;
  const root = document.documentElement, prevOverflow = root.style.overflow, back = document.activeElement as HTMLElement | null;
  let open = true, pushed = false, after: (() => void) | null = null;
  const cleanups: (() => void)[] = [];
  try { history.pushState({ ...(history.state || {}), people: true }, ''); pushed = true; } catch { /* sem histórico, segue sem */ }
  const finish = () => {
    if (!open) return;
    open = false;
    cleanups.forEach(f => f());
    peopleRerender = null;
    removeEventListener('popstate', onPopState);
    removeEventListener('keydown', onKey, true);
    el.remove();
    root.style.overflow = prevOverflow;
    const then = after; after = null;
    if (then) then(); else back?.focus?.();
  };
  const onPopState = () => { pushed = false; finish(); };
  const close = (then?: () => void) => {
    after = then || null;
    if (pushed) { history.back(); setTimeout(() => { if (open) { pushed = false; finish(); } }, 500); } else finish();
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  el.addEventListener('click', e => { if ((e.target as HTMLElement).closest('[data-fs-close]')) close(); });
  document.body.append(el);
  root.style.overflow = 'hidden';
  addEventListener('popstate', onPopState);
  addEventListener('keydown', onKey, true);
  return { el, body: el.querySelector<HTMLElement>('.avx-body')!, close, onClose: (f: () => void) => cleanups.push(f) };
}

function openPeople(o: PeopleOpts) {
  const fs = fullScreen(o.title, `${o.search ? `<label class="search avx-search">${IC.search}<input class="pl-q" type="search" placeholder="Buscar" aria-label="Buscar nesta lista" autocomplete="off" enterkeyhint="search"></label>` : ''}
      <ul class="plist pl-list"></ul>
      <p class="muted pl-msg" aria-live="polite"></p>
      <div class="pl-end" aria-hidden="true"></div>`, 'pl');
  const { el, body } = fs;
  const ul = el.querySelector<HTMLElement>('.pl-list')!, msg = el.querySelector<HTMLElement>('.pl-msg')!;
  let list: ListPerson[] = [], q = '', loading = false, done = false, seq = 0;
  const rowHTML = (x: ListPerson) => {
    const main = `${av(x.id, 'md')}<span class="pinfo"><span class="pname">${esc(x.name)}</span><span class="psub">${o.sub ? o.sub(x) : x.username ? `@${esc(x.username)}` : ''}</span></span>`;
    return `<li class="prow">${o.openable ? `<button type="button" class="prow-main" data-pl-open="${x.id}">${main}</button>` : `<div class="prow-main">${main}</div>`}<div class="pact">${o.row(x)}</div></li>`;
  };
  const draw = () => {
    ul.innerHTML = list.map(rowHTML).join('');
    msg.textContent = loading ? 'Carregando' : list.length ? '' : q ? 'Ninguém com esse nome nesta lista.' : o.empty;
    msg.hidden = !msg.textContent;
  };
  const more = async () => {
    if (loading || done) return;
    loading = true; draw();
    const my = ++seq;
    try {
      const r = await o.load(q, list.length);
      if (my !== seq) return;
      r.people.forEach(({ common: _c, ...x }) => rememberPerson(x));
      list = list.concat(r.people);
      done = r.people.length < 30 || list.length >= r.total;
    } catch {
      if (my === seq) { done = true; toast('Não foi possível carregar a lista agora.'); }
    } finally {
      if (my === seq) { loading = false; draw(); }
    }
  };
  // Carrega mais conforme a pessoa rola (de 30 em 30)
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) void more(); }, { root: body, rootMargin: '0px 0px 400px 0px' });
  fs.onClose(() => io.disconnect());
  let t: number | undefined;
  el.addEventListener('input', e => {
    const i = e.target as HTMLInputElement;
    if (!i.classList.contains('pl-q')) return;
    clearTimeout(t);
    t = window.setTimeout(() => { q = i.value.trim(); list = []; done = false; loading = false; seq++; void more(); }, 250);
  });
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.target as HTMLElement).classList.contains('pl-q')) e.preventDefault(); });
  el.addEventListener('click', e => {
    const tg = e.target as HTMLElement;
    const op = tg.closest<HTMLElement>('[data-pl-open]');
    if (op) { const id = op.dataset.plOpen!; fs.close(() => openProfile(id)); return; }
    const ub = tg.closest<HTMLElement>('[data-unblock]');
    if (ub) {
      const id = ub.dataset.unblock!, name = P(id).name;
      void S.backend?.unblock(id).then(() => { list = list.filter(x => x.id !== id); draw(); forgetInfo(id); toast(`Você desbloqueou ${name}`); }, () => {});
    }
  });
  peopleRerender = draw;
  io.observe(el.querySelector('.pl-end')!);
  void more();
  el.querySelector<HTMLElement>(o.search ? '.pl-q' : '[data-fs-close]')?.focus({ preventScroll: true });
}

/* ---------- notificações: pedidos, pedidos aceitos e curtidas (como o coração do Instagram) ---------- */
/** "agora", "há 5 min", "há 2 h", "há 3 dias" ou a data */
function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 7 * 86400) return `há ${Math.floor(s / 86400)} ${Math.floor(s / 86400) === 1 ? 'dia' : 'dias'}`;
  return fmtDate(iso.slice(0, 10));
}

async function openNotifications() {
  const fs = fullScreen('Notificações', '<div class="nt-push-slot"></div><ul class="plist nt-list"></ul><p class="muted pl-msg">Carregando</p>', 'pl nt');
  const { el } = fs;
  const ul = el.querySelector<HTMLElement>('.nt-list')!, msg = el.querySelector<HTMLElement>('.pl-msg')!, slot = el.querySelector<HTMLElement>('.nt-push-slot')!;
  let list: Notif[] = [];
  const row = (n: Notif) => {
    // Aviso do próprio site: o símbolo do Cronomovie no lugar da foto, o texto pronto e, se houver, o cartaz do título
    if (!n.actor) {
      const it = n.titleId ? BYID[n.titleId] : null;
      const open = it ? ` data-nt-open="${it.id}"` : '';
      return `<li class="prow nt-row${n.read ? '' : ' new'}"><button type="button" class="prow-main"${open}><span class="av md nt-sys" aria-hidden="true"><svg viewBox="0 0 64 32"><line x1="8" y1="16" x2="48" y2="16" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".42"/><circle cx="8" cy="16" r="4.5" fill="currentColor"/><circle cx="24" cy="16" r="4.5" fill="currentColor"/><circle cx="48" cy="16" r="11" fill="#E5484D"/></svg></span><span class="pinfo"><span class="nt-txt">${esc(n.info || '')}</span><span class="psub">${ago(n.at)}</span></span></button><div class="pact">${it ? `<button type="button" class="fd-p" data-nt-open="${it.id}" aria-label="${esc(it.t)}">${posterHTML(it)}</button>` : ''}</div></li>`;
    }
    const id = n.actor.id, it = n.titleId ? BYID[n.titleId] : null, name = `<b>${esc(n.actor.name)}</b>`;
    const txt = n.kind === 'request' ? `${name} enviou um pedido de amizade.`
      : n.kind === 'accepted' ? `${name} aceitou seu pedido de amizade.`
      : `${name} curtiu seu comentário${it ? ` sobre <b>${esc(it.t)}</b>` : ''}.`;
    const act = n.kind === 'request' && relation(id) === 'received'
      ? `<button class="btn primary sm" data-accept="${id}">Confirmar</button><button class="btn sm" data-remove="${id}">Excluir</button>`
      : it ? `<button type="button" class="fd-p" data-nt-open="${it.id}" aria-label="${esc(it.t)}">${posterHTML(it)}</button>` : '';
    return `<li class="prow nt-row${n.read ? '' : ' new'}"><button type="button" class="prow-main" data-nt-profile="${id}">${av(id, 'md')}<span class="pinfo"><span class="nt-txt">${txt}</span><span class="psub">${ago(n.at)}</span></span></button><div class="pact">${act}</div></li>`;
  };
  const draw = () => {
    ul.innerHTML = list.map(row).join('');
    msg.textContent = list.length ? '' : 'Nada por aqui ainda. Pedidos de amizade, curtidas e avisos de estreias aparecem aqui.';
    msg.hidden = !msg.textContent;
  };
  const pushBox = async () => {
    if (demo() || isGuest()) { slot.innerHTML = ''; return; }
    const st = await pushStatus();
    const box = (title: string, text: string, btn = '') => `<div class="nt-push">${IC.bell}<div><b>${title}</b><span>${text}</span></div>${btn}</div>`;
    slot.innerHTML = st === 'unsupported' ? ''
      : st === 'install' ? box('Receber no celular', 'No iPhone, as notificações chegam quando o Cronomovie está instalado na tela inicial.', '<button class="btn sm" type="button" data-nt-install>Como instalar</button>')
      : st === 'denied' ? box('Notificações bloqueadas', 'Para receber, libere as notificações do Cronomovie nos ajustes do celular ou do navegador.')
      : st === 'on' ? box('Notificações ativadas', 'Este aparelho recebe avisos de estreias, a contagem até Doutor Destino, pedidos de amizade e curtidas.', '<button class="btn sm" type="button" data-push-off>Desativar</button>')
      : box('Receber no celular', 'Seja avisado de estreias, da contagem até Doutor Destino, de pedidos de amizade e de curtidas, mesmo com o site fechado.', '<button class="btn sm primary" type="button" data-push-on disabled>Ativar</button>');
    // Deixa a chave pronta antes do toque em "Ativar"
    if (st === 'off' && await preparePush(() => S.backend!.pushKey())) slot.querySelector<HTMLButtonElement>('[data-push-on]')?.removeAttribute('disabled');
  };
  el.addEventListener('click', e => {
    const tg = e.target as HTMLElement;
    let x: HTMLElement | null;
    if ((x = tg.closest('[data-nt-profile]'))) { const id = x.dataset.ntProfile!; fs.close(() => openProfile(id)); return; }
    if ((x = tg.closest('[data-nt-open]'))) { const id = x.dataset.ntOpen!; fs.close(() => openModal(id)); return; }
    if (tg.closest('[data-nt-install]')) { e.stopPropagation(); fs.close(() => void installFlow()); return; }
    if (tg.closest('[data-push-on]')) {
      void enablePush(s => S.backend!.savePush(s)).then(r => {
        toast(r === 'on' ? 'Notificações ativadas neste aparelho' : r === 'denied' ? 'As notificações estão bloqueadas nos ajustes' : 'Não foi possível ativar agora. Tente de novo.');
        void pushBox();
      });
      return;
    }
    if (tg.closest('[data-push-off]')) { void disablePush(ep => S.backend!.dropPush(ep)).then(() => { toast('Notificações desativadas neste aparelho'); void pushBox(); }); }
  });
  peopleRerender = draw;
  void pushBox();
  list = await (S.backend?.notifications() ?? Promise.resolve([]));
  list.forEach(n => { if (n.actor) knowPerson(n.actor); });
  draw();
  // Abriu: tudo passa a contar como visto (o destaque das novas continua até fechar)
  if (S.unread || list.some(n => !n.read)) void S.backend?.readNotifications();
}

/** Amigos de alguém: só a própria pessoa e os amigos dela veem */
function openFriends(pid: string) {
  const mine = isMe(pid);
  if (!mine && relation(pid) !== 'friend') return;
  openPeople({
    title: mine ? 'Seus amigos' : `Amigos de ${P(pid).name}`,
    search: true,
    openable: true,
    load: (q, off) => S.backend!.friendsList(pid, q, off),
    sub: x => {
      const un = x.username ? `@${esc(x.username)}` : '';
      if (!isMe(x.id) && !pids().includes(x.id)) return un;
      return [un, plural(stats(x.id).seenAll, 'visto', 'vistos')].filter(Boolean).join(' · ');
    },
    row: x => (mine ? '' : relBtnHTML(x.id)),
    empty: mine ? 'Você ainda não tem amigos aqui.' : 'Nenhum amigo para mostrar.',
  });
}

function openBlocked() {
  openPeople({
    title: 'Contas bloqueadas',
    search: false,
    openable: false,
    load: async (_q, off) => {
      if (off) return { people: [], total: 0 };
      const ps = await S.backend!.blockedList();
      return { people: ps, total: ps.length };
    },
    row: x => `<button class="btn sm" data-unblock="${x.id}">Desbloquear</button>`,
    empty: 'Você não bloqueou ninguém.',
  });
}

/** No formulário: o favorito atual e o botão que abre a lista com busca */
function favFieldHTML(cur: string | null): string {
  const it = cur ? BYID[cur] : null;
  return `<div class="fav-field">${it ? `<span class="fav-field-p">${posterHTML(it)}</span>` : ''}<div class="av-field-txt"><span class="av-field-name">${it ? esc(it.t) : 'Nenhum escolhido'}</span><button type="button" class="btn sm" data-fav-open>${it ? 'Trocar' : 'Escolher'}</button></div></div>`;
}

/** Lista em tela cheia pra escolher o favorito: busca pelo nome e uma fileira por fase (e por universo). */
function openTitleChooser(selected: string | null, onPick: (id: string | null) => void) {
  const can = (it: Item) => it.id !== 'doomsday' || released();
  const tile = (it: Item) => `<button type="button" class="tix-tile" data-pick="${it.id}" aria-pressed="${it.id === selected}">${posterHTML(it)}<span class="avx-name">${esc(it.t)}</span></button>`;
  const row = (name: string, items: Item[]) => items.length ? `<section class="avx-row"><h3>${esc(name)}</h3><div class="avx-wrap"><div class="avx-rail">${items.map(tile).join('')}</div></div></section>` : '';
  const rows = ERAS.slice(0, 5).map((e, i) => row(e.name, ITEMS.filter(it => it.e === i && can(it)))).join('')
    + GROUPS.map(g => row(g.name, ITEMS.filter(it => it.g === g.key))).join('');
  const el = document.createElement('div');
  el.className = 'avx tix';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Escolher filme ou série favorita');
  el.innerHTML = `<header class="avx-head"><h2>Escolher favorito</h2><button type="button" class="btn" data-tix-close>Cancelar</button></header>
    <div class="avx-body">
      <div class="tix-tools"><label class="search avx-search">${IC.search}<input class="tix-q" type="search" placeholder="Buscar filme ou série" aria-label="Buscar filme ou série" autocomplete="off" enterkeyhint="search"></label>${selected ? '<button type="button" class="btn" data-pick="">Ficar sem favorito</button>' : ''}</div>
      <div class="avx-rows">${rows}</div>
      <section class="avx-found" hidden><h3>Resultados</h3><div class="avx-grid tix-grid"></div><p class="muted avx-none" hidden>Nenhum título com esse nome.</p></section>
    </div>`;

  const root = document.documentElement, prev = root.style.overflow, back = document.activeElement as HTMLElement | null;
  let open = true, pushed = false;
  try { history.pushState({ ...(history.state || {}), avx: true }, ''); pushed = true; } catch { /* sem histórico, segue sem */ }
  const finish = () => {
    if (!open) return;
    open = false;
    removeEventListener('popstate', onPopState);
    removeEventListener('keydown', onKey, true);
    el.remove();
    root.style.overflow = prev;
    back?.focus?.();
  };
  const onPopState = () => { pushed = false; finish(); };
  const close = () => { if (pushed) { pushed = false; finish(); history.back(); } else finish(); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };

  const rowsEl = el.querySelector<HTMLElement>('.avx-rows')!, found = el.querySelector<HTMLElement>('.avx-found')!;
  const grid = found.querySelector<HTMLElement>('.avx-grid')!, none = found.querySelector<HTMLElement>('.avx-none')!;
  el.addEventListener('input', e => {
    const t = e.target as HTMLInputElement;
    if (!t.classList.contains('tix-q')) return;
    const k = norm(t.value).trim();
    rowsEl.hidden = !!k; found.hidden = !k;
    if (!k) return;
    const hits = ITEMS.filter(it => can(it) && norm(it.t).includes(k));
    grid.innerHTML = hits.map(tile).join('');
    none.hidden = hits.length > 0;
  });
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.target as HTMLElement).classList.contains('tix-q')) e.preventDefault(); });
  el.addEventListener('click', e => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-tix-close]')) { close(); return; }
    const p = t.closest<HTMLElement>('[data-pick]');
    if (p) { close(); onPick(p.dataset.pick || null); }
  });

  document.body.append(el);
  root.style.overflow = 'hidden';
  addEventListener('popstate', onPopState);
  addEventListener('keydown', onKey, true);
  const cur = el.querySelector<HTMLElement>('.tix-tile[aria-pressed="true"]'), rail = cur?.closest<HTMLElement>('.avx-rail');
  if (cur && rail) { rail.scrollLeft = Math.max(0, cur.offsetLeft - rail.offsetLeft - 24); cur.closest('.avx-row')?.scrollIntoView({ block: 'center' }); }
  el.querySelector<HTMLElement>('[data-tix-close]')?.focus();
}

/* ---------- link de perfil: compartilhar e convidar ---------- */
const INVITE = 'cronomovie-convite';
const INVITE_SEEN = 'cronomovie-convite-visto';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
let inviteCard: Person | null = null;

/** Chegou por um link de perfil (/@nome ou ?u=nome): guarda o @ e limpa o endereço. Fica guardado por 7 dias, pra sobreviver ao cadastro. */
export function captureInvite() {
  const path = location.pathname.match(/^\/@([^/]+)\/?$/);
  let raw = new URLSearchParams(location.search).get('u') || '';
  if (path) { try { raw = decodeURIComponent(path[1]); } catch { raw = path[1]; } }
  const u = cleanUsername(raw);
  if (!u) return;
  try { localStorage.setItem(INVITE, JSON.stringify({ u, t: Date.now() })); } catch { /* sem armazenamento, o convite só não sobrevive ao cadastro */ }
  try { history.replaceState(history.state, '', (path ? '/' : location.pathname) + location.hash); } catch { /* ignorado */ }
}
function pendingInvite(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(INVITE) || 'null') as { u?: string; t?: number } | null;
    return v?.u && Date.now() - (v.t || 0) < WEEK_MS ? v.u : null;
  } catch { return null; }
}
function clearInvite() {
  inviteCard = null;
  try { localStorage.removeItem(INVITE); } catch { /* ignorado */ }
}
/** Mostra de quem é o link: o visitante é chamado pra criar conta; quem já tem conta pode adicionar aos amigos. */
async function checkInvite() {
  const u = pendingInvite();
  if (!u || demo() || UI.modal) return;
  const guest = isGuest();
  if (!guest && (P(S.me).username || '').toLowerCase() === u) { clearInvite(); return; }
  // Pro visitante o cartão aparece uma vez por visita; o convite continua guardado pra depois do cadastro.
  if (guest) { try { if (sessionStorage.getItem(INVITE_SEEN) === u) return; sessionStorage.setItem(INVITE_SEEN, u); } catch { /* segue */ } }
  const me = S.me;
  const card = await S.backend?.profileCard(u).catch(() => null);
  if (S.me !== me || !$('#gate')?.hidden) return;
  if (!card) { clearInvite(); return; }
  // Quem tem conta vai direto para o perfil da pessoa, como no Instagram
  if (!guest) { clearInvite(); rememberPerson(card); openProfile(card.id); return; }
  rememberPerson(card);
  inviteCard = card;
  const fav = card.favorite ? BYID[card.favorite] : null;
  const el = $('#gate')!;
  el.innerHTML = `<div class="m-back" data-gate-close></div>
  <div class="sheet small invite" role="dialog" aria-modal="true" aria-labelledby="gate-t">
    ${av(card.id, 'lg')}
    <h2 id="gate-t">${esc(card.name)}</h2>
    ${card.username ? `<p class="uname">@${esc(card.username)}</p>` : ''}
    ${fav ? `<p class="muted">${fav.k === 'f' ? 'Filme favorito' : 'Série favorita'}: ${esc(fav.t)}</p>` : ''}
    <p class="muted">${guest
      ? `${esc(card.name)} está acompanhando a linha do tempo da Marvel no Cronomovie. Crie a sua conta gratuita para adicionar aos amigos e comparar o que vocês já assistiram.`
      : 'Adicione aos amigos para comparar o que vocês já assistiram e aparecer no ranking um do outro.'}</p>
    ${guest ? `${joinBtns}<button class="linkish gate-later" type="button" data-gate-close>Agora não</button>`
      : '<div class="row-btns"><button class="btn primary" data-invite-add>Adicionar aos amigos</button><button class="btn" data-gate-close>Agora não</button></div>'}
  </div>`;
  el.hidden = false;
}

/** Abre o compartilhamento do celular (ou copia o link) com o endereço de um perfil (o seu, se nenhum for dito) */
async function shareProfile(invite: boolean, pid = S.me) {
  const me = P(pid), own = isMe(pid);
  if (!me.username) { toast(own ? 'Escolha um nome de usuário no perfil para ter o seu link.' : 'Este perfil ainda não tem link.'); return; }
  const url = `${location.origin}/@${encodeURIComponent(me.username)}`;
  const text = invite
    ? `Estou acompanhando a linha do tempo da Marvel no Cronomovie. Me adicione por lá: @${me.username}`
    : own ? `Meu perfil no Cronomovie: @${me.username}` : `Perfil de ${me.name} no Cronomovie: @${me.username}`;
  if (navigator.share) {
    try { await navigator.share({ title: 'Cronomovie', text, url }); return; }
    catch (e) { if ((e as DOMException)?.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); toast('Link copiado'); }
  catch { toast(url); }
}

function dropEditPhoto() {
  if (editPhoto) URL.revokeObjectURL(editPhoto.url);
  editPhoto = null;
}

/* ================= AMIGOS ================= */
/* ---------- atividade dos amigos (como o feed do Instagram): o que cada um marcou, do mais novo para o mais antigo ---------- */
let feedAll = false;
/** "Hoje", "Ontem", "há 3 dias" ou a data */
function whenLabel(d: string): string {
  const [y, m, dd] = d.split('-').map(Number), n = -daysTo({ y, m, d: dd });
  return n <= 0 ? 'Hoje' : n === 1 ? 'Ontem' : n < 7 ? `há ${n} dias` : fmtDate(d);
}
function feedHTML(): string {
  const fr = friendIds();
  if (!fr.length) return '';
  // Um evento por amigo e por dia: quem marcou muita coisa num dia só aparece agrupado
  const events: { pid: string; d: string; ids: string[] }[] = [];
  for (const pid of fr) {
    const m = marksOf(pid), byDay = new Map<string, string[]>();
    for (const id of Object.keys(m)) {
      const d = m[id].d;
      if (!BYID[id] || !d) continue;
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d)!.push(id);
    }
    for (const [d, ids] of byDay) events.push({ pid, d, ids: ids.sort((a, b) => BYID[a].i - BYID[b].i) });
  }
  if (!events.length) return '';
  events.sort((a, b) => b.d.localeCompare(a.d) || a.ids.length - b.ids.length);
  const limit = feedAll ? 40 : 6;
  const rows: string[] = [];
  for (const ev of events) {
    if (rows.length >= limit) break;
    const name = `<a class="fd-n" href="#perfil" data-profile="${ev.pid}">${esc(P(ev.pid).name)}</a>`, when = `<span class="fd-d">${whenLabel(ev.d)}</span>`;
    if (ev.ids.length > 3) {
      rows.push(`<li class="fd">${av(ev.pid, 'md')}<div class="fd-b"><p>${name} marcou ${ev.ids.length} títulos como vistos ${when}</p>
        <div class="fd-row">${ev.ids.slice(0, 8).map(id => `<button type="button" class="fd-mini" data-open="${id}" aria-label="${esc(BYID[id].t)}">${posterHTML(BYID[id])}</button>`).join('')}${ev.ids.length > 8 ? `<span class="fd-plus">+${ev.ids.length - 8}</span>` : ''}</div></div></li>`);
      continue;
    }
    for (const id of ev.ids) {
      if (rows.length >= limit) break;
      const it = BYID[id], x = marksOf(ev.pid)[id];
      rows.push(`<li class="fd">${av(ev.pid, 'md')}<div class="fd-b"><p>${name} ${it.k === 's' ? 'terminou' : 'viu'} <a class="fd-t" href="#linha" data-open="${id}">${esc(it.t)}</a> ${when}</p>
        ${x.r != null ? `<span class="fd-r">${starsHTML(x.r)}<span>${RLBL[x.r]}</span></span>` : ''}${x.c ? commentHTML(ev.pid, id, x.c) : ''}</div>
        <button type="button" class="fd-p" data-open="${id}" aria-label="${esc(it.t)}">${posterHTML(it)}</button></li>`);
    }
  }
  const more = !feedAll && events.length > 0 && rows.length >= limit;
  return `<section class="section f-sec"><h2>Atividade dos amigos</h2><ul class="feed">${rows.join('')}</ul>${more ? '<button class="linkish f-all" data-feed-all>Ver mais atividade</button>' : ''}</section>`;
}

let found: PersonHit[] = [];
let foundMore = false;
let searching = false;
/** Pessoas que talvez você conheça (amigos dos seus amigos), atualizadas a cada 2 minutos */
let sugg: PersonHit[] = [], suggAt = 0, suggLoading = false;
let showAllInc = false, showAllOut = false;

const RECENT = () => `cronomovie-recentes-${S.me}`;
const HIDDEN = () => `cronomovie-sugestoes-ocultas-${S.me}`;
function readList<T>(k: string): T[] {
  try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function writeList(k: string, v: unknown[]) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento: só não lembra */ }
}
/** Buscas recentes: os perfis abertos a partir da busca (os últimos 8, só neste aparelho) */
const recents = () => readList<Person>(RECENT());
function addRecent(p: Person) {
  writeList(RECENT(), [{ id: p.id, name: p.name, color: p.color, avatar: p.avatar, username: p.username ?? null }, ...recents().filter(x => x.id !== p.id)].slice(0, 8));
}
function dropRecent(id: string) { writeList(RECENT(), recents().filter(x => x.id !== id)); }
/** Usa os dados guardados só de quem ainda não é conhecido (não passa por cima de dados mais novos) */
const knowPerson = (p: Person) => { if (!S.people.some(x => x.id === p.id)) rememberPerson(p); };
const plainPerson = ({ mutual: _m, mutualIds: _i, ...p }: PersonHit): Person => p;
const hitSub = (p: PersonHit) => [p.username ? `@${esc(p.username)}` : '', p.mutual ? plural(p.mutual, 'amigo em comum', 'amigos em comum') : ''].filter(Boolean).join(' · ');
const unameSub = (id: string) => { const u = P(id).username; return u ? `@${esc(u)}` : ''; };

function personRow(p: Person, actions: string, sub = '') {
  return `<li class="prow"><button type="button" class="prow-main" data-profile="${p.id}">${av(p.id, 'md')}<span class="pinfo"><span class="pname">${esc(p.name)}</span>${sub ? `<span class="psub">${sub}</span>` : ''}</span></button><div class="pact">${actions}</div></li>`;
}

function resultsHTML(): string {
  const q = UI.fq.trim();
  if (q.replace(/^@/, '').length < 2) return '<p class="muted">Digite pelo menos 2 letras do nome ou do @.</p>';
  if (searching && !found.length) return '<p class="muted">Buscando</p>';
  if (!found.length) return `<p class="muted">Ninguém encontrado com “${esc(q)}”. A pessoa precisa ter conta no Cronomovie.</p>`;
  return `<ul class="plist">${found.map(p => personRow(p, relBtnHTML(p.id), hitSub(p))).join('')}</ul>${foundMore ? '<button class="btn sm f-more" type="button" data-fmore>Ver mais resultados</button>' : ''}`;
}

function loadSugg() {
  if (isGuest() || suggLoading || !S.backend || Date.now() - suggAt < 120_000) return;
  suggLoading = true;
  void S.backend.suggestions().then(r => { sugg = r; r.forEach(p => knowPerson(plainPerson(p))); }, () => {}).finally(() => {
    suggLoading = false; suggAt = Date.now();
    if (UI.tab === 'amigos') updateAmigos();
  });
}

function friendsSectionsHTML(): string {
  const inc = incomingIds(), out = outgoingIds(), fr = friendIds();
  const incHTML = inc.length ? `<section class="section f-sec"><h2>Pedidos de amizade <span class="count">${inc.length}</span></h2><ul class="plist">${(showAllInc ? inc : inc.slice(0, 3)).map(id =>
    personRow(P(id), `<button class="btn primary sm" data-accept="${id}">Confirmar</button><button class="btn sm" data-remove="${id}">Excluir</button>`, unameSub(id))).join('')}</ul>${inc.length > 3 && !showAllInc ? `<button class="linkish f-all" data-inc-all>Ver todos os ${inc.length} pedidos</button>` : ''}</section>` : '';
  const rec = recents();
  rec.forEach(knowPerson);
  const recHTML = rec.length ? `<section class="section f-sec f-recent"><div class="f-h"><h2>Recentes</h2><button class="linkish" data-recent-clear>Limpar</button></div><ul class="plist">${rec.map(p =>
    personRow(P(p.id), `<button class="f-x" data-recent-del="${p.id}" aria-label="Tirar ${esc(P(p.id).name)} dos recentes">${IC.close}</button>`, unameSub(p.id))).join('')}</ul></section>` : '';
  const hidden = new Set(readList<string>(HIDDEN()));
  const sg = sugg.filter(p => relation(p.id) === 'none' && !hidden.has(p.id));
  const sgHTML = sg.length ? `<section class="section f-sec"><h2>Pessoas que talvez você conheça</h2><div class="row-scroll f-sugg">${sg.map(p => `<div class="sg-card">
    <button type="button" class="f-x sg-x" data-sugg-hide="${p.id}" aria-label="Não sugerir ${esc(p.name)}">${IC.close}</button>
    <button type="button" class="sg-main" data-profile="${p.id}">${av(p.id, 'lg')}<span class="sg-n">${esc(p.name)}</span><span class="sg-s">${plural(p.mutual, 'amigo em comum', 'amigos em comum')}</span></button>
    <button class="btn primary sm" data-add="${p.id}">Adicionar</button></div>`).join('')}</div></section>` : '';
  const frHTML = `<section class="section f-sec"><h2>Seus amigos${fr.length ? ` <span class="count">${fr.length}</span>` : ''}</h2>${fr.length
    ? `<button type="button" class="f-friends" data-friends-of="${S.me}"><span class="stack">${pids().filter(id => !isMe(id)).slice(0, 5).map(id => av(id, 'md')).join('')}</span><span>Ver a lista de amigos</span>${IC.right}</button>`
    : '<p class="muted">Você ainda não tem amigos aqui. Busque pelo nome ou @, ou mande o seu link.</p>'}
    ${demo() ? '' : '<button class="btn f-invite" data-invite>Convidar por link</button>'}</section>`;
  const outHTML = out.length ? `<section class="section f-sec"><h2>Pedidos enviados <span class="count">${out.length}</span></h2><ul class="plist">${(showAllOut ? out : out.slice(0, 3)).map(id =>
    personRow(P(id), `<button class="btn sm" data-remove="${id}">Cancelar</button>`, 'Esperando a resposta')).join('')}</ul>${out.length > 3 && !showAllOut ? `<button class="linkish f-all" data-out-all>Ver todos os ${out.length}</button>` : ''}</section>` : '';
  return incHTML + feedHTML() + recHTML + sgHTML + frHTML + outHTML;
}

function amigosHTML(): string {
  loadSugg();
  const q = UI.fq.trim();
  return `<div class="page-head"><h1>Amigos</h1></div>
  <label class="search find">${IC.search}<input id="fq" type="search" placeholder="Buscar pelo nome ou @" aria-label="Buscar pessoas pelo nome ou @" autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="search" value="${esc(UI.fq)}"></label>
  <p class="f-note">O que você assiste fica visível só para os seus amigos.</p>
  <div id="fresults" class="fresults" aria-live="polite"${q ? '' : ' hidden'}>${q ? resultsHTML() : ''}</div>
  <div id="fsections"${q ? ' hidden' : ''}>${friendsSectionsHTML()}</div>`;
}

function updateAmigos() {
  const r = $('#fresults'), f = $('#fsections'), q = UI.fq.trim();
  if (r) { r.hidden = !q; r.innerHTML = q ? resultsHTML() : ''; }
  if (f) { f.hidden = !!q; if (!q) f.innerHTML = friendsSectionsHTML(); }
}

let searchT: number | undefined, searchSeq = 0;
function runSearch(more = false) {
  clearTimeout(searchT);
  const q = UI.fq.trim();
  if (q.replace(/^@/, '').length < 2) { found = []; foundMore = false; searching = false; searchSeq++; updateAmigos(); return; }
  if (!more) { searching = true; updateAmigos(); }
  const off = more ? found.length : 0;
  searchT = window.setTimeout(async () => {
    const seq = ++searchSeq;
    const res = await S.backend?.searchPeople(q, off) ?? [];
    if (seq !== searchSeq) return;
    res.forEach(p => rememberPerson(plainPerson(p)));
    found = more ? found.concat(res) : res;
    foundMore = res.length === 20;
    searching = false;
    updateAmigos();
  }, more ? 0 : 250);
}

/* ================= DETALHE ================= */
let lastFocusId: string | null = null;
/** Lista de amigos no detalhe: aberta por inteiro ou só os primeiros (volta a fechar ao trocar de título) */
let othersAll = false, othersOf = '';
const fullTxt = (c: ReturnType<typeof countdown>) => `${plural(c.d, 'dia', 'dias')}, ${pad(c.h)}h ${pad(c.m)}min ${pad(c.s)}s`;

function modalHTML(it: Item): string {
  const mine = marksOf(S.me)[it.id], locked = it.id === 'doomsday' && !released(), c = crowd(it);
  const seq = UI.trail && TRILHA.has(it.id) ? trailSeq() : orderedAll(), ix = seq.findIndex(x => x.id === it.id), prev = seq[ix - 1], next = seq[ix + 1];
  const group = it.g ? GROUPS.find(g => g.key === it.g) : null;
  const meta = [KIND[it.k], it.r.slice(0, 4), it.m ? dur(it) + (it.k === 's' ? ' no total' : '') : ''].filter(Boolean).join(', ');
  const notes = [it.star ? 'Essencial para Doutor Destino.' : '', it.n && it.id !== 'doomsday' ? esc(it.n) + '.' : '', group ? esc(group.hint) + '.' : ''].filter(Boolean).join(' ');
  const fr = pids().filter(pid => !isMe(pid));
  const saw = fr.filter(pid => marksOf(pid)[it.id] || watchLabel(pid, it.id, false))
    .sort((a, b) => Number(!!marksOf(b)[it.id]) - Number(!!marksOf(a)[it.id]) || (marksOf(b)[it.id]?.r ?? -1) - (marksOf(a)[it.id]?.r ?? -1));
  if (othersOf !== it.id) { othersOf = it.id; othersAll = false; }
  const notYet = fr.length - saw.length, shown = othersAll ? saw : saw.slice(0, 12);
  const others = shown.map(pid => {
    const x = marksOf(pid)[it.id], wl = watchLabel(pid, it.id, false);
    return `<li>${av(pid, 'md')}<div><span class="fn">${esc(P(pid).name)}</span><span class="fs">${x ? (x.r != null ? `${starsHTML(x.r)}<span>${RLBL[x.r]}</span>` : '<span>Viu, sem nota</span>') : `<span>${wl ? esc(wl) : 'Ainda não viu'}</span>`}</span>${x && x.c ? commentHTML(pid, it.id, x.c) : ''}</div></li>`;
  }).join('');
  const ov = detailsOf(it.id).ov;
  const rate = [5, 4, 3, 2, 1].map(v => `<button data-rate="${v}" data-fk="r${v}" class="${mine && (mine.r || 0) >= v ? 'on' : ''}" aria-label="${v} de 5: ${RLBL[v]}" aria-pressed="${!!mine && mine.r === v}">${IC.star}</button>`).join('');
  const mineSec = locked
    ? `<section class="m-sec"><h3>Estreia em</h3><p class="m-doom" data-cd="full">${fullTxt(countdown(DOOMSDAY))}</p><p class="muted">É possível marcar e avaliar depois da estreia.</p></section>`
    : `<section class="m-sec"><h3>${demo() && !isMe('voce') ? `Avaliação de ${esc(P(S.me).name)}` : 'Sua avaliação'}</h3>
      <div class="mine-row"><button class="btn ${mine ? 'on' : ''}" data-toggle="${it.id}" data-fk="tog" aria-pressed="${!!mine}">${mine ? 'Visto' : 'Marcar como visto'}</button><div class="srate" role="group" aria-label="Sua nota">${rate}</div><span class="rate-lbl">${mine && mine.r ? RLBL[mine.r] : ''}</span></div>
      ${listButtonsHTML(it.id)}
      ${mine && mine.d ? `<p class="m-when">Visto em ${fmtDate(mine.d)}</p>` : ''}
      <label for="m-c" class="lbl">Comentário</label>
      <textarea id="m-c" maxlength="140" placeholder="O que achou? (opcional)">${esc(mine ? mine.c : '')}</textarea>
      <button class="btn" data-save-c="${it.id}" data-fk="save">Salvar comentário</button>${mine && mine.c ? likeHTML(S.me, it.id) : ''}</section>`;
  const crowdTxt = c.avg != null
    ? `<b>${fmt(c.avg)}</b>${starsHTML(c.avg, 'lg')}<span class="muted">média entre amigos, ${plural(c.rs.length, 'nota', 'notas')}</span>`
    : `<span class="muted">${locked ? 'Estreia em 17 de dezembro.' : c.who.length ? `${plural(c.who.length, 'pessoa viu', 'pessoas viram')}, sem nota ainda.` : 'Ainda sem avaliações.'}</span>`;
  return `<div class="m-back" data-close></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="m-title">
    <div class="m-head"><span class="m-grab" aria-hidden="true"></span><p class="m-htitle" aria-hidden="true">${esc(it.t)}</p><button class="m-x" data-close data-fk="close" aria-label="Fechar">${IC.close}</button></div>
    <div class="m-scroll"><div class="m-grid">
      <div class="m-left">${posterHTML(it, 'lg')}</div>
      <div class="m-right">
        <h2 id="m-title">${esc(it.t)}</h2>
        <p class="m-meta">${meta}</p>
        ${notes ? `<p class="m-note">${notes}</p>` : ''}
        ${remindBtnHTML(it.id)}
        ${ov ? `<p class="m-ov">${esc(ov)}</p>` : ''}
        ${trailerHTML(it.id)}
        ${isGuest() ? '' : `<div class="m-crowd">${crowdTxt}</div>`}
        ${mineSec}
        ${isGuest() && !locked ? '<p class="guest-note">Sem conta, isso não fica salvo. <button class="linkish" data-auth="criar">Criar conta grátis</button></p>' : ''}
        ${locked ? '' : episodesHTML(it.id)}
        <section class="m-sec"><h3>Onde assistir</h3>${locked ? '<p class="muted">Nos cinemas a partir de 17 de dezembro.</p>' : whereHTML(it.id)}</section>
        ${fr.length ? `<section class="m-sec"><h3>Amigos</h3>${others ? `<ul class="friends">${others}</ul>` : ''}${saw.length > shown.length ? `<button class="linkish o-more" data-others-all>Ver todos os ${saw.length}</button>` : ''}${notYet ? `<p class="muted o-not">${saw.length ? '' : 'Nenhum amigo viu ainda. '}${plural(notYet, 'amigo ainda não viu', 'amigos ainda não viram')}.</p>` : ''}</section>` : ''}
        <nav class="m-nav" aria-label="Títulos vizinhos">${prev ? `<button data-open="${prev.id}" data-fk="prev"><span>Anterior</span><b>${esc(prev.t)}</b></button>` : '<span></span>'}${next ? `<button class="nx" data-open="${next.id}" data-fk="next"><span>Próximo</span><b>${esc(next.t)}</b></button>` : ''}</nav>
      </div>
    </div></div>
  </div>`;
}

/** Depois de rolar além do título, o topo do detalhe ganha fundo e mostra o nome do filme. */
function updateStuck(s: HTMLElement) {
  const h = s.querySelector<HTMLElement>('h2');
  if (!h || !h.offsetHeight) { s.parentElement?.classList.remove('stuck'); return; }
  s.parentElement?.classList.toggle('stuck', s.scrollTop > h.offsetTop + h.offsetHeight - 40);
}

function renderModal(keepScroll: boolean) {
  const el = $('#modal')!, it = UI.modal ? BYID[UI.modal] : null;
  if (!it) return;
  const sc = el.querySelector('.m-scroll')?.scrollTop || 0;
  el.innerHTML = modalHTML(it);
  const s = el.querySelector<HTMLElement>('.m-scroll')!;
  if (keepScroll) s.scrollTop = sc;
  updateStuck(s);
}

/** Abre e fecha com movimento: no celular a gaveta sobe e desce; no computador, um leve fade. */
function animateModal(el: HTMLElement, open: boolean, from = 0): Promise<void> {
  const sheet = el.querySelector<HTMLElement>('.sheet'), back = el.querySelector<HTMLElement>('.m-back');
  if (reduced() || !sheet || !back) return Promise.resolve();
  const m = mobile();
  const away = m ? { transform: 'translateY(100%)', opacity: 1 } : { transform: 'translateY(12px) scale(.985)', opacity: 0 };
  const here = { transform: `translateY(${from}px)`, opacity: 1 };
  const opts: KeyframeAnimationOptions = open
    ? { duration: m ? 360 : 220, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }
    : { duration: m ? 260 : 160, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' };
  back.animate([{ opacity: open ? 0 : Number(getComputedStyle(back).opacity) }, { opacity: open ? 1 : 0 }], opts);
  const done = sheet.animate(open ? [away, here] : [here, away], opts).finished.then(() => {}, () => {});
  // Se o navegador pausar a animação (aba em segundo plano), não fica preso esperando
  return Promise.race([done, new Promise<void>(r => setTimeout(r, Number(opts.duration) + 80))]);
}

function openModal(id: string, push = true) {
  const wasOpen = !!UI.modal;
  if (!wasOpen) lastFocusId = id;
  if (id !== trailerOn) trailerOn = '';
  UI.modal = id; UI.menu = false;
  if (!detailsReady()) void loadDetails().then(() => { if (UI.modal) renderModal(true); }, () => {});
  renderModal(false);
  const el = $('#modal')!;
  el.hidden = false;
  lockScroll();
  updateStuck(el.querySelector<HTMLElement>('.m-scroll')!);
  if (!wasOpen) {
    if (push) pushLayer('modal', id);
    void animateModal(el, true);
  } else if (history.state?.layer === 'modal') {
    // Anterior/próximo dentro do detalhe: troca o título sem empilhar histórico
    try { history.replaceState({ ...history.state, id }, ''); } catch { /* ignorado */ }
  }
  el.querySelector<HTMLElement>('.m-x')?.focus({ preventScroll: true });
}

async function closeModal(from = 0) {
  if (!UI.modal) return;
  const id = lastFocusId;
  UI.modal = null;
  trailerOn = '';
  const el = $('#modal')!;
  await animateModal(el, false, from);
  if (UI.modal) return; // abriu outro enquanto fechava
  el.hidden = true; el.innerHTML = '';
  lockScroll();
  const back = !id ? null : (document.querySelector<HTMLElement>(`.p-open[data-open="${id}"]`) || document.querySelector<HTMLElement>(`[data-open="${id}"]`));
  back?.focus({ preventScroll: true });
}

/* ================= HISTÓRICO (botão/gesto de voltar do celular) =================
   Abas, perfis, comparação, detalhe e gaveta de filtros entram no histórico do navegador:
   o "voltar" fecha o que estiver aberto em vez de sair do site. */
interface Hist { tab?: Tab; profile?: string | null; layer?: 'modal' | 'filters' | 'compare'; id?: string; y?: number }
let backPending = false;
let closeFrom = 0;
const mobile = () => matchMedia('(max-width:760px)').matches;
const hist = (): Hist => (history.state || {}) as Hist;

function pushLayer(layer: Hist['layer'], id?: string) {
  try { history.pushState({ tab: UI.tab, profile: UI.profile, layer, id } satisfies Hist, ''); } catch { /* ignorado */ }
}
/** Fecha a camada de cima: pelo histórico, se ela estiver lá; senão direto. */
function closeLayer(layer: Hist['layer'], direct: () => void) {
  if (hist().layer === layer) {
    if (backPending) return;
    backPending = true;
    history.back();
  } else direct();
}
const requestClose = (from = 0) => { if (!UI.modal) return; closeFrom = from; closeLayer('modal', () => void closeModal(from)); };
const requestFiltersClose = () => closeLayer('filters', () => setFilters(false));

/** Trava a rolagem da página enquanto tem gaveta ou detalhe aberto. */
function lockScroll() {
  document.documentElement.style.overflow = UI.modal || filtersOpen ? 'hidden' : '';
}

function onPop() {
  backPending = false;
  const st = hist();
  if (UI.modal && st.layer !== 'modal') { void closeModal(closeFrom); }
  closeFrom = 0;
  if (filtersOpen && st.layer !== 'filters') setFilters(false, false);
  const tab = st.tab && TABS.includes(st.tab) ? st.tab : (TABS.includes(location.hash.slice(1) as Tab) ? location.hash.slice(1) as Tab : UI.tab);
  const prof = st.profile ?? null, cmp = st.layer === 'compare' ? st.id || null : null;
  if (tab !== UI.tab || (tab === 'perfil' && (prof !== UI.profile || cmp !== compareWith))) {
    UI.profile = prof; compareWith = cmp;
    go(tab, false);
    window.scrollTo(0, st.y || 0);
  }
  // Avançar de novo para uma camada
  if (st.layer === 'modal' && st.id && !UI.modal && BYID[st.id]) openModal(st.id, false);
  if (st.layer === 'filters' && !filtersOpen && UI.tab === 'linha') setFilters(true, false);
}

/* ================= CONTAGEM AO VIVO ================= */
let wasReleased = released();
let lastEvent = nextEvent()?.id || '';
function tick() {
  // Doomsday estreou: destrava marcar e avaliar.
  if (!wasReleased && released()) { wasReleased = true; refresh(); toast('Vingadores: Doutor Destino estreou. Agora é possível marcar e avaliar.'); }
  // A próxima grande estreia mudou (ou acabaram): redesenha a contagem com o filme novo.
  const ev = nextEvent();
  if ((ev?.id || '') !== lastEvent) { lastEvent = ev?.id || ''; refresh(); return; }
  const rel = currentRelease();
  if (!rel) return;
  // O lançamento da faixa chegou: sai da fila e entra o próximo
  if (countdown(rel.date).done) { refresh(); return; }
  const c = countdown(rel.date);
  const set = (k: string, v: string) => document.querySelectorAll<HTMLElement>(`[data-cd="${k}"]`).forEach(el => { if (el.textContent !== v) el.textContent = v; });
  set('d', String(c.d)); set('dl', c.d === 1 ? 'dia' : 'dias');
  set('h', pad(c.h)); set('m', pad(c.m)); set('s', pad(c.s));
  if (!released()) set('full', fullTxt(countdown(DOOMSDAY)));
}

/* ================= RENDER GERAL ================= */
/** Faixa acima do conteúdo: aviso da demonstração ou, para o visitante, quantos títulos ainda não estão salvos. */
function renderBanner() {
  const el = $('#banner');
  if (!el) return;
  const n = isGuest() ? guestCount() : 0;
  // Quem chega sem conta vê, na linha do tempo, o que é o site
  const hero = isGuest() && UI.tab === 'linha'
    ? `<section class="hero"><h1>A linha do tempo da Marvel, na ordem certa.</h1><p>Marque o que você já viu e saiba o que falta.</p>${joinBtns}</section>`
    : '';
  const inst = UI.tab === 'linha' && !demo() && offerInstall() ? installCardHTML() : '';
  const retro = UI.tab === 'linha' && recapTime() ? recapCardHTML() : '';
  const html = demo()
    ? '<p class="demo-note">Demonstração com dados de exemplo. Nada aqui é salvo no banco.</p>'
    : hero + retro + inst + (n ? `<div class="unsaved" role="status"><span>${plural(n, 'título marcado', 'títulos marcados')} nesta visita, ainda sem salvar.</span><button class="btn sm primary" data-auth="criar">Criar conta para salvar</button></div>` : '');
  if (el.innerHTML !== html) el.innerHTML = html;
}

/* ---------- instalar como app ---------- */
const installCardHTML = () => `<div class="inst-card" role="region" aria-label="Instalar o app">
  <img class="inst-ic" src="/icons/icon-192.png" alt="" width="44" height="44">
  <div class="inst-t"><b>Instale o Cronomovie</b><span>Abre em tela cheia, direto da tela inicial, como um app.</span></div>
  <button class="btn sm primary" type="button" data-install>Instalar</button>
  <button class="f-x" type="button" data-install-later aria-label="Agora não">${IC.close}</button>
</div>`;

/* ---------- retrospectiva: em dezembro, um cartão no topo da linha do tempo convida para ver ---------- */
const RETRO = 'cronomovie-retrospectiva-2026';
function recapTime(): boolean {
  if (isGuest() || stats(S.me).seenAll < 3) return false;
  const d = new Date();
  if (d.getMonth() !== 11 || d.getFullYear() !== 2026) return false;
  try { return !localStorage.getItem(RETRO); } catch { return true; }
}
const recapCardHTML = () => `<div class="inst-card retro-card" role="region" aria-label="Sua retrospectiva">
  <span class="retro-ic" aria-hidden="true">${IC.chart}</span>
  <div class="inst-t"><b>Sua maratona até Doutor Destino</b><span>A sua retrospectiva está pronta para ver e compartilhar.</span></div>
  <button class="btn sm primary" type="button" data-recap>Ver</button>
  <button class="f-x" type="button" data-recap-later aria-label="Agora não">${IC.close}</button>
</div>`;

/** O navegador passou a oferecer (ou deixou de oferecer) a instalação */
export function installChanged() { if (!document.body.classList.contains('logged-out')) renderBanner(); }

async function installFlow() {
  const way = installWay();
  if (way === 'prompt') {
    if (await promptInstall()) toast('Pronto. O Cronomovie está na sua tela inicial.');
    renderBanner();
    return;
  }
  const steps = way === 'ios'
    ? `<li>Toque no botão <b>Compartilhar</b> <span class="inst-k">${IC.share}</span> do navegador${isIOS() && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent) ? ', na barra de baixo' : ''}.</li>
       <li>Role a lista e toque em <b>Adicionar à Tela de Início</b>.</li>
       <li>Toque em <b>Adicionar</b>. O ícone do Cronomovie aparece junto dos seus apps.</li>`
    : `<li>Abra o menu do navegador <b>⋮</b>, no canto de cima.</li>
       <li>Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</li>
       <li>Confirme. O ícone do Cronomovie aparece junto dos seus apps.</li>`;
  openSheet('Instalar o app', `<h2>Instalar o Cronomovie</h2><ol class="inst-steps">${steps}</ol>`);
}

function renderChrome() {
  renderBanner();
  $('#foot')!.innerHTML = `<span>Cronomovie é um projeto de fãs, sem ligação com a Marvel ou a Disney. Os nomes, personagens e cartazes pertencem aos seus donos.</span><span class="foot-links"><a href="/ordem-cronologica-marvel">Ordem em texto</a><a href="/privacidade.html">Privacidade</a><a href="/termos.html">Termos de uso</a></span>`;
}

function renderView() {
  const v = $('#view')!;
  if (UI.tab === 'linha') {
    v.innerHTML = `<section id="top" class="top"></section><div id="watching"></div>${toolsHTML()}<div id="result" class="result" hidden></div><div id="eras"></div>`;
    updateLinha();
  } else if (isGuest()) v.innerHTML = gateHTML(UI.tab);
  else if (UI.tab === 'ranking') v.innerHTML = rankingHTML();
  else if (UI.tab === 'amigos') v.innerHTML = amigosHTML();
  else v.innerHTML = perfilHTML();
}

function refresh() {
  if (document.body.classList.contains('logged-out')) return;
  const a = document.activeElement as HTMLElement | null, fk = a?.dataset?.fk;
  renderBar(); renderBanner();
  if (UI.tab === 'linha' && $('#eras')) updateLinha();
  else if (UI.tab === 'amigos' && $('#fsections')) updateAmigos();
  else if (!(UI.tab === 'perfil' && UI.editing)) renderView();
  if (UI.modal) renderModal(true);
  peopleRerender?.();
  if (fk) document.querySelector<HTMLElement>(`[data-fk="${fk}"]`)?.focus({ preventScroll: true });
}

/** Troca de aba. push=false quando veio do botão de voltar (o histórico já está certo). */
function go(tab: Tab, push = true) {
  const cur = hist(), changed = cur.tab !== tab || (tab === 'perfil' && (cur.profile ?? null) !== UI.profile) || !!cur.layer;
  UI.tab = tab; UI.menu = false;
  if (tab !== 'perfil') UI.editing = false;
  if (push) compareWith = null;
  if (filtersOpen) { filtersOpen = false; lockScroll(); }
  document.body.classList.remove('bar-hide');
  renderBanner();
  if (push) {
    try {
      const st: Hist = { tab, profile: UI.profile };
      if (changed) {
        // guarda onde a pessoa estava, para voltar no mesmo ponto
        history.replaceState({ ...cur, y: window.scrollY }, '');
        history.pushState(st, '', '#' + tab);
      } else history.replaceState(st, '', '#' + tab);
    } catch { /* ignorado */ }
  }
  const draw = () => { renderBar(); renderView(); window.scrollTo(0, 0); };
  if (push) smooth(draw); else draw();
}

/* ================= AÇÕES ================= */
function toggleSeen(id: string) {
  const it = BYID[id];
  if (!it || (id === 'doomsday' && !released())) return;
  const was = !!marksOf(S.me)[id];
  S.backend?.setMark(id, was ? null : {});
  // Visto sai das listas "quero ver" e "assistindo agora".
  if (!was && watchOf(S.me)[id]?.list) S.backend?.setWatch(id, { list: null });
  buzz();
  toast(was ? `Desmarcado: ${it.t}` : `Visto: ${it.t}`);
  if (!was) guestNudge();
}

/** Pede o @ para quem entrou antes de ele existir. Aparece uma vez por visita, é possível deixar para depois. */
let askedUsername = false;
function askUsername() {
  if (isGuest()) return;
  if (askedUsername || demo() || P(S.me).username || UI.modal) return;
  askedUsername = true;
  const el = $('#modal')!;
  el.innerHTML = `<div class="m-back"></div>
  <form class="sheet small" id="unForm" role="dialog" aria-modal="true" aria-labelledby="un-title">
    <h2 id="un-title">Escolha seu @</h2>
    <p class="muted">Cada pessoa tem um nome de usuário único. É por ele que os seus amigos encontram você na busca.</p>
    <label class="lbl" for="un-new">Nome de usuário</label>
    ${usernameFieldHTML('un-new', cleanUsername(P(S.me).name))}
    <p class="auth-msg" id="un-msg" role="alert" hidden></p>
    <div class="row-btns"><button class="btn primary" type="submit">Salvar</button><button class="btn" type="button" data-un-later>Depois</button></div>
  </form>`;
  el.hidden = false;
  $<HTMLInputElement>('#un-new')?.focus();
}

/** Confere o @ antes de salvar: formato e se está livre. Devolve a mensagem de erro, ou vazio se estiver ok. */
async function checkUsername(u: string): Promise<string> {
  if (!USERNAME_RE.test(u)) return 'Use de 3 a 20 caracteres: letras minúsculas, números, ponto ou _.';
  if (u === (P(S.me).username || '')) return '';
  return (await S.backend?.usernameAvailable(u)) ? '' : 'Esse nome de usuário já está em uso. Tente outro.';
}
function rate(id: string, v: number) {
  const cur = marksOf(S.me)[id], nv = cur && cur.r === v ? null : v;
  S.backend?.setMark(id, { r: nv });
  buzz();
  if (nv) guestNudge();
  toast(nv ? `${plural(nv, 'estrela', 'estrelas')}, ${RLBL[nv].toLowerCase()}` : 'Nota removida');
}

let wired = false;
let ticker = 0;
function wire() {
  if (wired) return;
  wired = true;

  document.addEventListener('click', e => {
    if (document.body.classList.contains('logged-out')) return;
    const t = e.target as HTMLElement, q = (s: string) => t.closest<HTMLElement>(s);
    let el: HTMLElement | null;
    if (UI.menu && !q('.me')) { UI.menu = false; renderBar(); }
    if (q('[data-gate-close]')) { if (!isGuest()) clearInvite(); closeGate(); return; }
    if (q('[data-sheet-close]')) { closeGate(); return; }
    if (q('[data-install]')) { void installFlow(); return; }
    if (q('[data-notifs]')) { void openNotifications(); return; }
    if (q('[data-recap]')) { openRecap(() => void openStory()); return; }
    if (q('[data-recap-later]')) { try { localStorage.setItem(RETRO, '1'); } catch { /* ignorado */ } renderBanner(); return; }
    if ((el = q('[data-like]'))) {
      const [owner, id] = el.dataset.like!.split('|'), on = el.getAttribute('aria-pressed') !== 'true';
      buzz();
      void S.backend?.like(owner, id, on);
      return;
    }
    if ((el = q('[data-trailer]'))) { trailerOn = el.dataset.trailer!; renderModal(true); return; }
    if (q('[data-svc-open]')) { servicesSheet(); return; }
    if ((el = q('[data-svc]'))) {
      const s = el.dataset.svc!, set = new Set(myServices());
      if (set.has(s)) set.delete(s); else set.add(s);
      setMyServices(set);
      el.setAttribute('aria-pressed', String(set.has(s)));
      return;
    }
    if (q('[data-svc-done]')) {
      closeGate();
      UI.streams = myServices().size ? 'mine' : 'all';
      if (UI.tab === 'linha') updateLinha();
      toast(myServices().size ? 'Mostrando só o que está nos seus streamings' : 'Nenhum streaming escolhido');
      return;
    }
    if (q('[data-install-later]')) { dismissInstall(); renderBanner(); return; }
    if (q('[data-story-open]')) { void openStory(); return; }
    if (q('[data-story-share]')) { void shareStory(); return; }
    if (q('[data-story-save]')) { if (storyBlob) saveFile(storyBlob, 'cronomovie.jpg'); return; }
    if ((el = q('[data-remind]'))) { remindSheet(+el.dataset.remind!); return; }
    if ((el = q('[data-remind-ics]'))) { const r = RELEASES[+el.dataset.remindIcs!]; closeGate(); if (r) openICS(r); return; }
    if ((el = q('[data-spoil]'))) {
      spoilOpen.add(el.dataset.spoil!);
      el.outerHTML = `<p class="fc">${esc(el.querySelector('.fc-t')?.textContent || '')}</p>`;
      return;
    }
    if ((el = q('[data-sheet]'))) { sheetAction(el.dataset.sheet!, el.dataset.id || ''); return; }
    if ((el = q('[data-rel]'))) { showRelease(+el.dataset.rel!); return; }
    if (q('[data-fav-open]') && q('#editForm')) {
      openTitleChooser(editFav, id => { editFav = id; const f = $('#editForm .fav-field'); if (f) f.outerHTML = favFieldHTML(editFav); });
      return;
    }
    if (q('[data-share]')) { void shareProfile(false); return; }
    if (q('[data-invite]')) { void shareProfile(true); return; }
    if (q('[data-invite-add]')) {
      const card = inviteCard;
      clearInvite(); closeGate();
      if (card) {
        const theirs = relation(card.id) === 'received';
        void S.backend?.requestFriend(card).then(() => toast(theirs ? `Agora você e ${card.name} são amigos` : `Pedido de amizade enviado para ${card.name}`), () => {});
      }
      return;
    }
    if ((el = q('[data-auth]'))) {
      // Vai para tela de entrar/criar conta: fecha o que estiver aberto por cima
      closeGate();
      if (UI.modal) { UI.modal = null; const m = $('#modal')!; m.hidden = true; m.innerHTML = ''; }
      filtersOpen = false; lockScroll();
      try { history.replaceState({ tab: UI.tab, profile: null } satisfies Hist, ''); } catch { /* ignorado */ }
      nav.openAuth(el.dataset.auth as 'entrar' | 'criar');
      return;
    }
    if (q('[data-delete-ask]')) { confirmDelete = true; renderView(); return; }
    if (q('[data-delete-no]')) { confirmDelete = false; renderView(); return; }
    if (q('[data-delete-yes]')) {
      void S.backend?.deleteAccount().then(() => { confirmDelete = false; UI.editing = false; toast('Conta excluída'); }, () => {});
      return;
    }
    if (q('[data-close]')) { requestClose(); return; }
    if (q('[data-filters-close]')) { requestFiltersClose(); return; }
    if (q('[data-filters]')) { setFilters(!filtersOpen); return; }
    if (q('[data-trail]')) {
      UI.trail = !UI.trail; savePrefs(); buzz();
      // ligou a trilha com um filtro que quase não tem nada nela: tira o filtro
      if (UI.trail && UI.saga && !inTrail(UI.saga)) UI.saga = null;
      const y = window.scrollY;
      renderView(); window.scrollTo(0, y);
      toast(UI.trail ? 'Trilha Avengers ligada' : 'Mostrando tudo');
      return;
    }
    if ((el = q('[data-saga-chip]'))) {
      const k = el.dataset.sagaChip || null;
      UI.saga = UI.saga === k ? null : k;
      buzz();
      // Filtro de fora da trilha (ex.: Saga dos Defensores): desliga a trilha para mostrar
      if (UI.saga && UI.trail && !inTrail(UI.saga)) {
        UI.trail = false; savePrefs();
        $('[data-trail]')?.setAttribute('aria-pressed', 'false');
        toast(`Trilha Avengers desligada para mostrar ${FILTERS[UI.saga].label}`);
      }
      updateLinha();
      return;
    }
    if ((el = q('[data-seg] button'))) {
      const k = el.closest<HTMLElement>('[data-seg]')!.dataset.seg as 'type' | 'order' | 'view' | 'metric' | 'seen' | 'streams';
      UI[k] = el.dataset.v!;
      // "Nos meus streamings" sem nenhum escolhido: pergunta quais são
      if (k === 'streams' && UI.streams === 'mine' && !myServices().size) { servicesSheet(); return; }
      if (k === 'order' || k === 'view') savePrefs();
      if (UI.tab === 'linha') updateLinha(); else renderView();
      return;
    }
    if ((el = q('[data-toggle]'))) { toggleSeen(el.dataset.toggle!); return; }
    if ((el = q('[data-welcome]'))) { welcomeAction(el.dataset.welcome!); return; }
    if ((el = q('[data-rate]'))) { if (UI.modal) rate(UI.modal, +el.dataset.rate!); return; }
    if ((el = q('[data-save-c]'))) {
      const ta = $<HTMLTextAreaElement>('#m-c'); if (!ta) return;
      const c = ta.value.trim();
      S.backend?.setMark(el.dataset.saveC!, { c });
      toast(c ? 'Comentário salvo' : 'Comentário apagado');
      return;
    }
    if (q('[data-av-open]') && q('#editForm')) {
      const own = () => editPhoto?.url ?? photoURL(S.me, P(S.me).avatar);
      const show = () => { const f = $('#editForm'); if (f) setAvatarField(f, editAvatar, own()); };
      openAvatarChooser({
        selected: editAvatar, upload: true, photo: own(),
        onPick: id => { editAvatar = id; show(); },
        // Volta pra foto da pessoa: a recém-escolhida ou a que já estava no perfil
        onOwn: () => { const cur = P(S.me).avatar; editAvatar = editPhoto ? NEW_PHOTO : isPhoto(cur) ? cur : editAvatar; show(); },
        onFile: file => void preparePhoto(file).then(photo => { dropEditPhoto(); editPhoto = photo; editAvatar = NEW_PHOTO; show(); },
          () => toast('Não foi possível usar essa imagem. Tente outra.')),
      });
      return;
    }
    if ((el = q('[data-open]'))) { e.preventDefault(); openModal(el.dataset.open!); return; }
    if ((el = q('[data-profile]'))) {
      e.preventDefault();
      const id = el.dataset.profile!;
      // Aberto pela busca, pelos recentes ou pelas sugestões: entra nos recentes
      if (el.closest('#fresults, .f-recent, .f-sugg')) addRecent(P(id));
      openProfile(id);
      return;
    }
    if ((el = q('[data-friends-of]'))) { openFriends(el.dataset.friendsOf!); return; }
    if ((el = q('[data-pf-tab]')) || (el = q('[data-pf-go]'))) {
      pfTab = (el.dataset.pfTab || el.dataset.pfGo) as typeof pfTab;
      const y = window.scrollY;
      renderView();
      if (el.dataset.pfGo) $('.pf-tabs')?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
      else window.scrollTo(0, y);
      return;
    }
    if (q('[data-pf-back]')) { pfBack(); return; }
    if ((el = q('[data-pf-more]'))) { profileSheet('more', el.dataset.pfMore!); return; }
    if ((el = q('[data-pf-friend]'))) { profileSheet('friend', el.dataset.pfFriend!); return; }
    if ((el = q('[data-pf-sent]'))) { profileSheet('sent', el.dataset.pfSent!); return; }
    if (q('[data-blocked-open]')) { openBlocked(); return; }
    if ((el = q('[data-recent-del]'))) { dropRecent(el.dataset.recentDel!); updateAmigos(); return; }
    if (q('[data-recent-clear]')) { writeList(RECENT(), []); updateAmigos(); return; }
    if ((el = q('[data-sugg-hide]'))) { writeList(HIDDEN(), [el.dataset.suggHide!, ...readList<string>(HIDDEN())].slice(0, 200)); updateAmigos(); return; }
    if (q('[data-inc-all]')) { showAllInc = true; updateAmigos(); return; }
    if (q('[data-feed-all]')) { feedAll = true; updateAmigos(); return; }
    if (q('[data-out-all]')) { showAllOut = true; updateAmigos(); return; }
    if (q('[data-fmore]')) { runSearch(true); return; }
    if ((el = q('[data-person]'))) {
      S.backend?.switchUser(el.dataset.person!);
      UI.menu = false; UI.profile = null; UI.editing = false;
      renderBar(); renderView();
      toast(`Agora você está como ${P(S.me).name}`);
      return;
    }
    if (q('[data-reset]')) { UI.menu = false; S.backend?.resetDemo(); toast('Dados de exemplo restaurados'); return; }
    if (q('[data-signout]')) { UI.menu = false; void S.backend?.signOut(); return; }
    if ((el = q('[data-list]'))) {
      if (!UI.modal) return;
      const id = UI.modal, l = el.dataset.list as 'quero' | 'assistindo', cur = watchOf(S.me)[id]?.list;
      S.backend?.setWatch(id, { list: cur === l ? null : l });
      buzz();
      if (cur !== l) guestNudge();
      toast(cur === l ? 'Tirado da lista' : l === 'quero' ? 'Adicionado em "Quero ver"' : 'Adicionado em "Assistindo agora"');
      return;
    }
    if ((el = q('[data-season]'))) {
      if (!UI.modal) return;
      const id = UI.modal, si = +el.dataset.season!, on = el.dataset.all === '1';
      const n = detailsOf(id).seasons?.[si]?.eps.length || 0;
      const r = applyEpisodes(id, Array.from({ length: n }, (_, k) => `${si}:${k + 1}`), on);
      if (r === 'done') toast('Série completa. Marcada como vista.');
      return;
    }
    if ((el = q('[data-compare]'))) { compareWith = el.dataset.compare!; pushLayer('compare', compareWith); renderView(); window.scrollTo(0, 0); return; }
    if (q('[data-compare-close]')) { closeLayer('compare', () => { compareWith = null; renderView(); window.scrollTo(0, 0); }); return; }
    if (q('[data-others-all]')) { othersAll = true; renderModal(true); return; }
    if (q('[data-un-later]')) { const m = $('#modal')!; m.hidden = true; m.innerHTML = ''; return; }
    if ((el = q('[data-add]'))) {
      const id = el.dataset.add!, p = P(id), theirs = relation(id) === 'received';
      forgetInfo(id);
      void S.backend?.requestFriend(p).then(() => toast(theirs ? `Agora você e ${p.name} são amigos` : `Pedido enviado para ${p.name}`), () => {});
      return;
    }
    if ((el = q('[data-accept]'))) {
      const id = el.dataset.accept!;
      forgetInfo(id);
      void S.backend?.acceptFriend(id).then(() => toast(`Agora você e ${P(id).name} são amigos`));
      return;
    }
    if ((el = q('[data-remove]'))) {
      const id = el.dataset.remove!, was = relation(id);
      forgetInfo(id);
      void S.backend?.removeFriend(id).then(() => toast(was === 'friend' ? 'Amizade desfeita' : was === 'sent' ? 'Pedido cancelado' : 'Pedido excluído'));
      return;
    }
    if (q('[data-menu]')) { UI.menu = !UI.menu; renderBar(); return; }
    if (q('[data-edit]')) {
      UI.editing = !UI.editing; editAvatar = P(S.me).avatar; editFav = P(S.me).favorite ?? null; dropEditPhoto(); renderView();
      if (UI.editing) $<HTMLInputElement>('#pf-name')?.focus();
      return;
    }
    if ((el = q('[data-scroll]'))) {
      const r = document.querySelector<HTMLElement>(`.rail[data-rail="${el.dataset.railBtn}"]`);
      r?.scrollBy({ left: (+el.dataset.scroll!) * r.clientWidth * .85, behavior: reduced() ? 'auto' : 'smooth' });
      return;
    }
    if (q('[data-clear]')) { UI.type = 'all'; UI.seen = 'all'; UI.streams = 'all'; UI.q = ''; UI.saga = null; updateLinha(); return; }
    if ((el = q('[data-tab]'))) {
      e.preventDefault();
      // A aba Perfil sempre abre o seu perfil
      if (el.dataset.tab === 'perfil') { UI.profile = null; UI.editing = false; }
      go(el.dataset.tab as Tab);
      return;
    }
  });

  document.addEventListener('scroll', e => {
    const r = e.target;
    if (r instanceof HTMLElement && r.classList.contains('rail')) updateRailEdges(r);
    if (r instanceof HTMLElement && r.classList.contains('m-scroll')) updateStuck(r);
  }, true);
  wireTouch();
  const overRel = (e: Event) => !!(e.target instanceof Element && e.target.closest('#top .cdown'));
  document.addEventListener('pointerover', e => { if (overRel(e)) relPaused = true; });
  document.addEventListener('pointerout', e => { if (overRel(e)) relPaused = false; });
  document.addEventListener('focusin', e => { relPaused = overRel(e) && (e.target as Element).matches(':focus-visible'); });
  let relX = NaN, relY = 0;
  document.addEventListener('touchstart', e => { relX = overRel(e) && e.touches.length === 1 ? e.touches[0].clientX : NaN; relY = e.touches[0].clientY; }, { passive: true });
  document.addEventListener('touchend', e => {
    if (Number.isNaN(relX)) return;
    const dx = e.changedTouches[0].clientX - relX, dy = e.changedTouches[0].clientY - relY;
    relX = NaN;
    if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.5) showRelease(relIdx + (dx < 0 ? 1 : -1));
  }, { passive: true });
  startReleases();
  window.addEventListener('resize', () => document.querySelectorAll<HTMLElement>('.rail[data-rail]').forEach(updateRailEdges));

  document.addEventListener('input', e => {
    const t = e.target as HTMLInputElement;
    if (t.id === 'q') { UI.q = t.value; updateLinha(); }
    if (t.id === 'fq') { UI.fq = t.value; runSearch(); }
    // @ sempre no formato aceito enquanto digita
    if (t.id === 'pf-user' || t.id === 'un-new') { const v = cleanUsername(t.value); if (v !== t.value) t.value = v; }
  });
  // Episódio marcado/desmarcado
  document.addEventListener('change', e => {
    const t = e.target as HTMLInputElement;
    if (!t.dataset?.ep || !UI.modal) return;
    const r = applyEpisodes(UI.modal, [t.dataset.ep], t.checked);
    buzz();
    if (r === 'done') toast('Série completa. Marcada como vista.');
    guestNudge();
  });
  // Lembra quais temporadas estão abertas quando a tela redesenha
  document.addEventListener('toggle', e => {
    const d = e.target as HTMLElement;
    if (d instanceof HTMLDetailsElement && d.dataset.seasonKey) {
      rememberSeason(d.dataset.seasonKey, d.open);
      rememberSeason(d.dataset.seasonKey.split(':')[0] + ':touched', true);
    }
  }, true);
  document.addEventListener('submit', async e => {
    const f = e.target as HTMLFormElement;
    if (f.id === 'unForm') {
      e.preventDefault();
      const u = cleanUsername($<HTMLInputElement>('#un-new')?.value || ''), msg = $('#un-msg')!;
      const err = await checkUsername(u);
      if (err) { msg.textContent = err; msg.hidden = false; return; }
      try {
        await S.backend?.updateProfile(P(S.me).name, P(S.me).avatar, u);
        const m = $('#modal')!; m.hidden = true; m.innerHTML = '';
        toast(`Pronto, você é @${u}`);
      } catch { /* o backend já avisou */ }
      return;
    }
    if (f.id !== 'editForm') return;
    e.preventDefault();
    const name = ($<HTMLInputElement>('#pf-name')?.value || '').trim().slice(0, 20);
    if (!name) { toast('Escreva um nome'); return; }
    const u = cleanUsername($<HTMLInputElement>('#pf-user')?.value || '');
    const hint = $('#pf-user-hint');
    const err = u || P(S.me).username ? await checkUsername(u) : '';
    if (err) { if (hint) { hint.textContent = err; hint.classList.add('bad'); } return; }
    const btn = f.querySelector<HTMLButtonElement>('button[type=submit]');
    try {
      if (btn) btn.disabled = true;
      const avatar = editAvatar === NEW_PHOTO && editPhoto ? await S.backend!.uploadPhoto(editPhoto.blob) : editAvatar;
      await S.backend?.updateProfile(name, avatar, u || null, editFav);
      UI.editing = false; dropEditPhoto(); renderBar(); renderView();
      toast('Perfil atualizado');
    } catch { /* o backend já avisou */ } finally {
      if (btn) btn.disabled = false;
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('#gate')?.hidden) { closeGate(); return; }
    if (UI.modal) { requestClose(); return; }
    if (filtersOpen) { requestFiltersClose(); return; }
    if (UI.menu) { UI.menu = false; renderBar(); }
  });
  window.addEventListener('popstate', () => { if (!document.body.classList.contains('logged-out')) onPop(); });
  window.addEventListener('hashchange', () => {
    const h = location.hash.slice(1) as Tab;
    if (TABS.includes(h) && h !== UI.tab && !document.body.classList.contains('logged-out')) go(h, false);
  });
}

/* ================= CELULAR: GESTOS ================= */
function wireTouch() {
  // Sem isso o iPhone não mostra o efeito de toque (:active)
  document.addEventListener('touchstart', () => {}, { passive: true });

  // Barra de cima some ao rolar para baixo e volta ao rolar para cima (o CSS só faz isso no celular)
  let lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    const y = window.scrollY, dy = y - lastY;
    if (Math.abs(dy) < 6) return;
    lastY = y;
    const hide = dy > 0 && y > 120 && !UI.menu;
    document.body.classList.toggle('bar-hide', hide);
  }, { passive: true });

  // Detalhe: arrastar para baixo fecha (com o conteúdo no topo, ou pegando pela barra de cima)
  const modal = $('#modal')!;
  let drag: { y0: number; t0: number; dy: number; on: boolean; sheet: HTMLElement; back: HTMLElement; scroller: HTMLElement } | null = null;
  modal.addEventListener('touchstart', e => {
    drag = null;
    if (!UI.modal || !mobile() || e.touches.length !== 1) return;
    const t = e.target as HTMLElement, sheet = t.closest<HTMLElement>('.sheet');
    const scroller = sheet?.querySelector<HTMLElement>('.m-scroll'), back = modal.querySelector<HTMLElement>('.m-back');
    if (!sheet || !scroller || !back || t.closest('textarea, input')) return;
    if (scroller.scrollTop > 0 && !t.closest('.m-head')) return;
    drag = { y0: e.touches[0].clientY, t0: performance.now(), dy: 0, on: false, sheet, back, scroller };
  }, { passive: true });
  modal.addEventListener('touchmove', e => {
    if (!drag) return;
    const dy = e.touches[0].clientY - drag.y0;
    if (!drag.on) {
      if (dy < -4) { drag = null; return; } // subindo: é rolagem normal
      if (dy < 8) return;
      drag.on = true;
    }
    e.preventDefault();
    drag.dy = Math.max(0, dy);
    drag.sheet.style.transform = `translateY(${drag.dy}px)`;
    drag.back.style.opacity = String(Math.max(0, 1 - drag.dy / (window.innerHeight * .8)));
  }, { passive: false });
  const endDrag = () => {
    const d = drag;
    drag = null;
    if (!d || !d.on) return;
    const speed = d.dy / Math.max(1, performance.now() - d.t0);
    if (d.dy > 130 || (d.dy > 50 && speed > .5)) { buzz(); requestClose(d.dy); return; }
    d.sheet.animate([{ transform: `translateY(${d.dy}px)` }, { transform: 'translateY(0)' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
    d.back.animate([{ opacity: d.back.style.opacity || '1' }, { opacity: 1 }], { duration: 220 });
    d.sheet.style.transform = ''; d.back.style.opacity = '';
  };
  modal.addEventListener('touchend', endDrag);
  modal.addEventListener('touchcancel', endDrag);
}

/* ================= ENTRADA ================= */
export function showApp() {
  document.body.classList.remove('logged-out');
  closeGate();
  UI.profile = null; UI.editing = false; UI.menu = false; compareWith = null; confirmDelete = false; dropEditPhoto();
  pfBackable = false; infoCache.clear(); found = []; sugg = []; suggAt = 0; showAllInc = false; showAllOut = false;
  const h = location.hash.slice(1) as Tab;
  if (TABS.includes(h)) UI.tab = h;
  // Começa limpo: um recarregar não deixa "camadas" velhas no histórico
  try { history.replaceState({ tab: UI.tab, profile: null } satisfies Hist, ''); } catch { /* ignorado */ }
  wire();
  onState(refresh);
  if (!ticker) {
    ticker = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });
  }
  renderChrome(); renderBar(); renderView();
  // Os detalhes chegam logo, mas o redesenho espera a abertura acabar (para ela não travar)
  void loadDetails().then(() => introDone()).then(() => new Promise(r => (window.requestIdleCallback || setTimeout)(r, { timeout: 600 }))).then(refresh, () => {});
  askUsername();
  void checkInvite();
  openFromLink();
}

/** Chegou por um link de título (?t=loki1, das páginas /titulo/...): abre a ficha depois da abertura e limpa o endereço. */
function openFromLink() {
  const t = new URLSearchParams(location.search).get('t');
  if (!t || !BYID[t]) return;
  try { history.replaceState(history.state, '', location.pathname + location.hash); } catch { /* ignorado */ }
  void introDone().then(() => openModal(t), () => openModal(t));
}

export function showMessage(title: string, text: string) {
  document.body.classList.add('logged-out');
  $('#view')!.innerHTML = `<div class="empty"><p><b>${esc(title)}</b></p><p>${esc(text)}</p></div>`;
}
