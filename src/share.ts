import { BYID, DOOMSDAY, ESS, MAIN } from './data';
import { P, marksOf, released, stats } from './state';
import { posterURL } from './posters';
import { countdown, hours } from './util';

/**
 * Imagens e arquivos para levar o Cronomovie para fora do site:
 *  - o cartão vertical dos Stories (1080 x 1920) com o progresso da pessoa;
 *  - o lembrete de estreia para a agenda do celular (.ics) ou para o Google Agenda.
 */

const W = 1080, H = 1920;
const SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, "Segoe UI", Roboto, sans-serif';
const BRAND = '"Big Shoulders Display", "Arial Narrow", Impact, sans-serif';
const RED = '#E5484D', INK = '#F2F1EE', MUTED = 'rgba(242,241,238,.64)', BG = '#0B0B0C';

/** Imagem que pode ir para o canvas sem travar a exportação (o TMDB libera o uso) */
function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise(ok => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    const t = setTimeout(() => ok(null), 6000);
    i.onload = () => { clearTimeout(t); ok(i); };
    i.onerror = () => { clearTimeout(t); ok(null); };
    i.src = src;
  });
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
}

function coverImg(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height), iw = img.width * s, ih = img.height * s;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

/** Símbolo e nome da marca, igual ao topo do site */
function brand(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.7, 1.7);
  ctx.strokeStyle = 'rgba(242,241,238,.42)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(8, 16); ctx.lineTo(48, 16); ctx.stroke();
  ctx.fillStyle = INK;
  for (const cx of [8, 24]) { ctx.beginPath(); ctx.arc(cx, 16, 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(48, 16, 11, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.font = `800 68px ${BRAND}`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK; ctx.fillText('Crono', x + 124, y + 28);
  ctx.fillStyle = RED; ctx.fillText('movie', x + 124 + ctx.measureText('Crono').width, y + 28);
}

/** Quebra o texto em linhas que cabem na largura */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(' ')) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > max && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

/** Cartão dos Stories com o progresso de alguém (o seu, normalmente) */
export async function storyImage(pid: string): Promise<Blob> {
  const p = P(pid), s = stats(pid), m = marksOf(pid);
  await Promise.all([
    document.fonts?.load(`800 68px ${BRAND}`).catch(() => {}),
    document.fonts?.load(`800 200px ${SANS}`).catch(() => {}),
  ]);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);

  // Os cartazes do que a pessoa viu por último, inclinados, apagando para baixo
  const ids = Object.keys(m).filter(id => BYID[id] && posterURL(id)).sort((a, b) => (m[b].d || '').localeCompare(m[a].d || '') || BYID[b].i - BYID[a].i).slice(0, 12);
  // "?cv": o cartaz já mostrado na página ficou guardado sem a liberação de uso; um endereço próprio busca de novo, liberado
  const imgs = (await Promise.all(ids.map(id => loadImg(posterURL(id, 'w342')! + '?cv=1')))).filter((x): x is HTMLImageElement => !!x);
  if (imgs.length >= 3) {
    ctx.save();
    ctx.translate(W / 2, 620);
    ctx.rotate(-0.07);
    const pw = 286, ph = 429, gap = 22, cols = 4, rows = 3;
    const x0 = -(cols * pw + (cols - 1) * gap) / 2, y0 = -(rows * ph + (rows - 1) * gap) / 2;
    // Poucos cartazes: repete para a colagem ficar cheia
    const fill = Array.from({ length: cols * 3 }, (_, k) => imgs[k % imgs.length]);
    fill.forEach((img, k) => {
      const x = x0 + (k % cols) * (pw + gap) + (Math.floor(k / cols) % 2 ? pw / 2 : 0) - pw / 4, y = y0 + Math.floor(k / cols) * (ph + gap);
      ctx.save(); round(ctx, x, y, pw, ph, 16); ctx.clip(); coverImg(ctx, img, x, y, pw, ph); ctx.restore();
    });
    ctx.restore();
    ctx.fillStyle = 'rgba(11,11,12,.35)'; ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createRadialGradient(W * .7, 420, 40, W * .7, 420, 900);
    g.addColorStop(0, 'rgba(229,72,77,.38)'); g.addColorStop(1, 'rgba(229,72,77,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  const fade = ctx.createLinearGradient(0, 520, 0, 1240);
  fade.addColorStop(0, 'rgba(11,11,12,0)'); fade.addColorStop(1, BG);
  ctx.fillStyle = fade; ctx.fillRect(0, 520, W, H - 520);
  const top = ctx.createLinearGradient(0, 0, 0, 260);
  top.addColorStop(0, 'rgba(11,11,12,.85)'); top.addColorStop(1, 'rgba(11,11,12,0)');
  ctx.fillStyle = top; ctx.fillRect(0, 0, W, 260);

  brand(ctx, 72, 92);

  const X = 72, maxW = W - 144;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK; ctx.font = `700 46px ${SANS}`;
  ctx.fillText(p.name, X, 1150);
  if (p.username) { const w = ctx.measureText(p.name).width; ctx.fillStyle = MUTED; ctx.font = `500 40px ${SANS}`; ctx.fillText(`  @${p.username}`, X + w, 1150); }

  // O número grande: quantos da linha do tempo já viu
  ctx.fillStyle = INK; ctx.font = `800 280px ${SANS}`;
  ctx.fillText(String(s.seenMain), X - 8, 1420);
  const nw = ctx.measureText(String(s.seenMain)).width;
  ctx.fillStyle = MUTED; ctx.font = `700 72px ${SANS}`;
  ctx.fillText(`de ${MAIN.length}`, X + nw + 18, 1420);
  ctx.font = `500 44px ${SANS}`;
  ctx.fillText('títulos da linha do tempo da Marvel', X, 1490);

  const frac = MAIN.length ? s.seenMain / MAIN.length : 0;
  ctx.fillStyle = 'rgba(255,255,255,.12)'; round(ctx, X, 1540, maxW, 18, 9); ctx.fill();
  if (frac > 0) { ctx.fillStyle = RED; round(ctx, X, 1540, Math.max(18, maxW * frac), 18, 9); ctx.fill(); }

  ctx.fillStyle = INK; ctx.font = `700 52px ${SANS}`;
  const ess = `${s.seenEss}/${ESS.length}`;
  ctx.fillText(ess, X, 1660);
  const ew = ctx.measureText(ess).width;
  ctx.fillStyle = MUTED; ctx.font = `500 38px ${SANS}`; ctx.fillText('essenciais', X + ew + 14, 1660);
  ctx.fillStyle = INK; ctx.font = `700 52px ${SANS}`;
  const hr = `${hours(s.minutes)} h`, hw = ctx.measureText(hr).width;
  ctx.fillText(hr, X + 520, 1660);
  ctx.fillStyle = MUTED; ctx.font = `500 38px ${SANS}`; ctx.fillText('de Marvel', X + 520 + hw + 14, 1660);
  ctx.font = `700 52px ${SANS}`;

  const d = countdown(DOOMSDAY).d;
  const line = released() ? 'Vingadores: Doutor Destino já está nos cinemas.' : `Faltam ${d} ${d === 1 ? 'dia' : 'dias'} para Vingadores: Doutor Destino.`;
  ctx.fillStyle = INK; ctx.font = `600 40px ${SANS}`;
  wrap(ctx, line, maxW).slice(0, 2).forEach((l, i) => ctx.fillText(l, X, 1752 + i * 52));

  ctx.fillStyle = RED; ctx.font = `700 38px ${SANS}`;
  ctx.fillText(p.username ? `cronomovie.com/@${p.username}` : 'cronomovie.com', X, 1860);

  return new Promise((ok, fail) => c.toBlob(b => (b ? ok(b) : fail(new Error('sem imagem'))), 'image/jpeg', 0.92));
}

/** Baixa um arquivo gerado aqui (imagem, lembrete) */
export function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/* ---------- lembrete de estreia ---------- */
export interface Remind { id: string; t: string; date: { y: number; m: number; d: number; h?: number }; what: string; label: string }

const p2 = (n: number) => String(n).padStart(2, '0');
const stamp = (ms: number) => { const d = new Date(ms); return `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}00Z`; };
/** Início e fim do evento. Com hora: hora de Brasília (UTC-3). Sem hora: o dia inteiro. */
function span(r: Remind) {
  const { y, m, d, h } = r.date;
  if (h != null) { const s = Date.UTC(y, m - 1, d, h + 3); return { start: stamp(s), end: stamp(s + 60 * 60 * 1000), allDay: false }; }
  const n = new Date(Date.UTC(y, m - 1, d + 1));
  return { start: `${y}${p2(m)}${p2(d)}`, end: `${n.getUTCFullYear()}${p2(n.getUTCMonth() + 1)}${p2(n.getUTCDate())}`, allDay: true };
}
const icsEsc = (s: string) => s.replace(/[\\;,]/g, x => '\\' + x).replace(/\n/g, '\\n');

/** Arquivo de agenda: o aviso aparece na véspera e no dia (às 9h, ou 1 hora antes quando tem horário) */
export function icsText(r: Remind): string {
  const sp = span(r), title = `Estreia: ${r.t}`;
  const alarms = (sp.allDay ? ['-PT15H', 'PT9H'] : ['-P1D', '-PT1H'])
    .flatMap(t => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(title)}`, `TRIGGER:${t}`, 'END:VALARM']);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cronomovie//Lembretes//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${r.id}-${sp.start}@cronomovie.com`, `DTSTAMP:${stamp(Date.now())}`,
    sp.allDay ? `DTSTART;VALUE=DATE:${sp.start}` : `DTSTART:${sp.start}`,
    sp.allDay ? `DTEND;VALUE=DATE:${sp.end}` : `DTEND:${sp.end}`,
    `SUMMARY:${icsEsc(title)}`, `DESCRIPTION:${icsEsc(`${r.what}, ${r.label}. Acompanhe a linha do tempo da Marvel em https://cronomovie.com`)}`,
    'URL:https://cronomovie.com/', ...alarms, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
}

export function googleCalURL(r: Remind): string {
  const sp = span(r), u = new URL('https://calendar.google.com/calendar/render');
  u.searchParams.set('action', 'TEMPLATE');
  u.searchParams.set('text', `Estreia: ${r.t}`);
  u.searchParams.set('dates', `${sp.start}/${sp.end}`);
  u.searchParams.set('details', `${r.what}, ${r.label}. https://cronomovie.com`);
  return u.toString();
}

/** Abre o lembrete na agenda do aparelho (no iPhone, a própria Agenda mostra o evento para adicionar) */
export function openICS(r: Remind) {
  const text = icsText(r);
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) { location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(text); return; }
  saveFile(new Blob([text], { type: 'text/calendar;charset=utf-8' }), `estreia-${r.id}.ics`);
}
