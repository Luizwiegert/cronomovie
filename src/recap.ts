import { BYID, DOOMSDAY, ERAS, ESS, ITEMS } from './data';
import { P, S, friendIds, marksOf, released, starsHTML, stats } from './state';
import { posterHTML, posterURL } from './posters';
import { countdown, esc, fmt, fmtDate, hours, reduced } from './util';

/**
 * Retrospectiva "Sua maratona": telas em sequência, como os Stories do Instagram.
 * Passa sozinha a cada 6 segundos; tocar à direita avança, à esquerda volta, segurar pausa. A última tela leva ao cartão dos Stories.
 */

const SLIDE_MS = 6000;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Compatibilidade de gosto com um amigo (mesma conta da tela Comparar): só com 3 títulos ou mais avaliados pelos dois */
function compat(a: string, b: string): { pct: number; n: number } | null {
  const ma = marksOf(a), mb = marksOf(b);
  const both = Object.keys(ma).filter(id => BYID[id] && ma[id].r != null && mb[id]?.r != null);
  if (both.length < 3) return null;
  const diff = both.reduce((x, id) => x + Math.abs(ma[id].r! - mb[id].r!), 0) / both.length;
  return { pct: Math.round(100 - diff / 4 * 100), n: both.length };
}

function slidesFor(pid: string): string[] {
  const p = P(pid), s = stats(pid), m = marksOf(pid);
  const ids = Object.keys(m).filter(id => BYID[id]);
  const out: string[] = [];
  const bg = ids.filter(id => posterURL(id)).sort((a, b) => (m[b].d || '').localeCompare(m[a].d || '')).slice(0, 12);
  const wall = `<div class="rc-wall" aria-hidden="true">${bg.map(id => posterHTML(BYID[id])).join('')}</div>`;

  out.push(`${wall}<div class="rc-c"><p class="rc-k">Sua maratona Marvel</p><h2 class="rc-big">${esc(p.name)}</h2>
    <p class="rc-s">${s.first ? `Desde ${fmtDate(s.first)}, no Cronomovie.` : 'O começo da sua maratona.'}</p></div>`);

  const h = hours(s.minutes), days = Math.floor(h / 24);
  out.push(`<div class="rc-c"><p class="rc-k">Até agora</p><h2 class="rc-num">${s.seenAll}</h2><p class="rc-t">${s.seenAll === 1 ? 'título visto' : 'títulos vistos'}</p>
    <p class="rc-s">${h} horas de Marvel${days >= 1 ? `, o mesmo que ${plural(days, 'dia inteiro', 'dias inteiros')} sem parar` : ''}.</p></div>`);

  const d = countdown(DOOMSDAY).d, pct = ESS.length ? s.seenEss / ESS.length : 0;
  out.push(`<div class="rc-c"><p class="rc-k">Rumo a Doutor Destino</p><h2 class="rc-num">${s.seenEss}<small>/${ESS.length}</small></h2><p class="rc-t">essenciais</p>
    <div class="rc-bar"><i style="width:${Math.round(pct * 100)}%"></i></div>
    <p class="rc-s">${released() ? 'Doutor Destino já está nos cinemas.' : s.seenEss >= ESS.length ? `Tudo pronto. Faltam ${plural(d, 'dia', 'dias')} para a estreia.` : `Faltam ${plural(ESS.length - s.seenEss, 'essencial', 'essenciais')} e ${plural(d, 'dia', 'dias')} para a estreia.`}</p></div>`);

  const eras = ERAS.map((e, i) => {
    const all = ITEMS.filter(it => it.e === i && it.id !== 'doomsday'), k = all.filter(it => m[it.id]).length;
    return { name: e.name, k, all: all.length, share: all.length ? k / all.length : 0 };
  }).filter(x => x.k > 0).sort((a, b) => b.share - a.share || b.k - a.k);
  if (eras[0]) out.push(`<div class="rc-c"><p class="rc-k">Sua era</p><h2 class="rc-big">${esc(eras[0].name)}</h2><p class="rc-s">${eras[0].k} de ${eras[0].all} vistos. É a parte da linha do tempo que você mais completou.</p></div>`);

  const top = ids.filter(id => m[id].r != null).sort((a, b) => m[b].r! - m[a].r! || (m[b].d || '').localeCompare(m[a].d || '')).slice(0, 3);
  if (top.length) out.push(`<div class="rc-c"><p class="rc-k">${top.length === 1 ? 'Sua nota mais alta' : 'Suas notas mais altas'}</p>
    <div class="rc-top">${top.map((id, i) => `<div class="rc-pos"><span class="rc-n">${i + 1}</span>${posterHTML(BYID[id])}<b>${esc(BYID[id].t)}</b>${starsHTML(m[id].r!)}</div>`).join('')}</div></div>`);

  const byDay = new Map<string, number>();
  for (const id of ids) if (m[id].d) byDay.set(m[id].d, (byDay.get(m[id].d) || 0) + 1);
  const best = [...byDay].sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] >= 2) out.push(`<div class="rc-c"><p class="rc-k">Seu dia mais maratonado</p><h2 class="rc-big">${fmtDate(best[0])}</h2><p class="rc-s">${best[1]} títulos marcados num dia só.</p></div>`);

  const twin = friendIds().map(f => ({ f, c: compat(pid, f) })).filter((x): x is { f: string; c: { pct: number; n: number } } => !!x.c).sort((a, b) => b.c.pct - a.c.pct || b.c.n - a.c.n)[0];
  if (twin) out.push(`<div class="rc-c"><p class="rc-k">Gosto mais parecido com o seu</p><h2 class="rc-big">${esc(P(twin.f).name)}</h2><p class="rc-s">${twin.c.pct}% de compatibilidade, pelos ${twin.c.n} títulos que vocês dois avaliaram.</p></div>`);

  out.push(`${wall}<div class="rc-c rc-end"><p class="rc-k">Sua maratona</p><h2 class="rc-big">${s.seenAll} títulos, ${h} horas</h2>
    <p class="rc-s">${s.avg != null ? `Nota média ${fmt(s.avg)}. ` : ''}Mostre para os amigos.</p>
    <button type="button" class="btn primary" data-rc-share>Compartilhar nos Stories</button></div>`);
  return out;
}

/** Abre a retrospectiva de quem está na conta. onShare: abre o cartão dos Stories. */
export function openRecap(onShare: () => void) {
  const slides = slidesFor(S.me);
  const el = document.createElement('div');
  el.className = 'rc';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Sua maratona');
  el.innerHTML = `<div class="rc-bars" aria-hidden="true">${slides.map(() => '<span><i></i></span>').join('')}</div>
    <button type="button" class="rc-x" aria-label="Fechar">×</button>
    <div class="rc-stage" aria-live="polite"></div>
    <button type="button" class="rc-prev" aria-label="Anterior"></button><button type="button" class="rc-next" aria-label="Próximo"></button>`;
  const stage = el.querySelector<HTMLElement>('.rc-stage')!, bars = [...el.querySelectorAll<HTMLElement>('.rc-bars span')];
  let i = 0, timer = 0, startedAt = 0, left = SLIDE_MS, paused = false, open = true, pushed = false;

  const show = (k: number) => {
    i = Math.max(0, Math.min(slides.length - 1, k));
    stage.innerHTML = `<div class="rc-slide">${slides[i]}</div>`;
    bars.forEach((b, j) => { b.className = j < i ? 'done' : j === i ? 'now' : ''; });
    left = SLIDE_MS;
    run();
  };
  const run = () => {
    clearTimeout(timer);
    if (paused || i >= slides.length - 1) { el.classList.toggle('rc-last', i >= slides.length - 1); return; }
    el.classList.remove('rc-last');
    startedAt = Date.now();
    timer = window.setTimeout(() => show(i + 1), left);
  };
  const pause = (on: boolean) => {
    if (on === paused) return;
    paused = on;
    el.classList.toggle('rc-paused', on);
    if (on) { clearTimeout(timer); left = Math.max(300, left - (Date.now() - startedAt)); } else run();
  };

  const root = document.documentElement, prev = root.style.overflow;
  const finish = () => {
    if (!open) return;
    open = false;
    clearTimeout(timer);
    removeEventListener('popstate', onPop);
    removeEventListener('keydown', onKey, true);
    el.remove();
    root.style.overflow = prev;
  };
  const onPop = () => { pushed = false; finish(); };
  const close = (then?: () => void) => {
    if (pushed) { pushed = false; history.back(); }
    finish();
    if (then) setTimeout(then, 60);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    else if (e.key === 'ArrowRight') show(i + 1);
    else if (e.key === 'ArrowLeft') show(i - 1);
  };

  // Segurar pausa; tocar avança ou volta
  let downAt = 0, held = false;
  el.addEventListener('pointerdown', e => { if ((e.target as HTMLElement).closest('.rc-x, [data-rc-share]')) return; downAt = Date.now(); held = false; pause(true); });
  el.addEventListener('pointerup', () => { held = downAt > 0 && Date.now() - downAt > 400; downAt = 0; pause(false); });
  el.addEventListener('pointercancel', () => pause(false));
  el.addEventListener('click', e => {
    const t = e.target as HTMLElement;
    if (t.closest('.rc-x')) { close(); return; }
    if (t.closest('[data-rc-share]')) { close(onShare); return; }
    if (held) { held = false; return; } // foi um "segurar", não um toque
    if (t.closest('.rc-prev')) show(i - 1);
    else if (t.closest('.rc-next')) { if (i >= slides.length - 1) close(); else show(i + 1); }
  });

  try { history.pushState({ ...(history.state || {}), recap: true }, ''); pushed = true; } catch { /* sem histórico */ }
  addEventListener('popstate', onPop);
  addEventListener('keydown', onKey, true);
  document.body.append(el);
  root.style.overflow = 'hidden';
  if (reduced()) el.classList.add('rc-still');
  show(0);
  el.querySelector<HTMLElement>('.rc-x')?.focus({ preventScroll: true });
}
