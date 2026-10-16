import { reduced } from './util';

/**
 * Vidro líquido, no estilo do iOS 26.
 *  - Barra de abas do celular: uma lente de vidro fica sob a aba aberta. Tocar em outra aba faz a lente deslizar
 *    até lá, esticando no meio do caminho. Arrastar o dedo pela barra faz a lente seguir o dedo, um pouco maior e
 *    mais clara, passando da borda como borracha; ao soltar, ela encaixa na aba mais próxima e abre essa aba.
 *  - Botões: ao encostar, o botão cresce um pouco com uma mola e um brilho acompanha o dedo dentro dele.
 * Só posição, tamanho e opacidade, para ficar fluido. Quem pediu menos movimento vê a lente parada, sem esses efeitos.
 */

const SPRING = 'cubic-bezier(.34,1.45,.55,1)';
const mobile = () => matchMedia('(max-width:760px)').matches;

let bar: HTMLElement | null = null, lens: HTMLElement | null = null;
let lensX = 0, lensW = 0, lastTab = '';

const items = () => [...(bar?.querySelectorAll<HTMLAnchorElement>('a[data-tab]') || [])];
const slotX = (a: HTMLElement) => a.getBoundingClientRect().left - bar!.getBoundingClientRect().left;
const tr = (x: number, s = 1, sx = 1) => `translate3d(${x.toFixed(1)}px,0,0) scale(${(s * sx).toFixed(3)},${s.toFixed(3)})`;

function ensureLens(): boolean {
  if (lens && bar?.contains(lens)) return true;
  bar = document.querySelector<HTMLElement>('.tabs');
  if (!bar) return false;
  lens = document.createElement('span');
  lens.className = 'tab-lens';
  lens.setAttribute('aria-hidden', 'true');
  bar.prepend(lens);
  wireDrag();
  addEventListener('resize', () => syncTabLens(false));
  return true;
}

/** Coloca a lente sob a aba aberta. Chamado a cada desenho da barra; desliza quando a aba muda. */
export function syncTabLens(animate = true) {
  if (!ensureLens() || !bar || !lens) return;
  if (!mobile()) { lens.hidden = true; return; }
  const cur = bar.querySelector<HTMLElement>('a[aria-current="page"]');
  if (!cur) { lens.hidden = true; return; }
  lens.hidden = false;
  const w = cur.getBoundingClientRect().width;
  if (w !== lensW) { lensW = w; lens.style.width = `${w}px`; }
  const to = slotX(cur), from = lensX, tab = cur.dataset.tab || '';
  const moved = tab !== lastTab && lastTab !== '';
  lastTab = tab;
  lensX = to;
  if (animate && moved && !reduced() && Math.abs(to - from) > 1) {
    // Desliza esticando no meio do caminho, como uma gota, e assenta com uma mola
    const stretch = 1 + Math.min(0.32, Math.abs(to - from) / w * 0.12);
    lens.animate([
      { transform: tr(from) },
      { transform: tr(from + (to - from) * 0.55, 1, stretch), offset: 0.45 },
      { transform: tr(to) },
    ], { duration: 520, easing: SPRING });
  }
  lens.style.transform = tr(to);
}

/** Arrastar o dedo pela barra: a lente segue, maior e mais clara, e encaixa na aba mais próxima ao soltar. */
function wireDrag() {
  if (!bar || !lens) return;
  let down: { id: number; x0: number; moved: boolean } | null = null;
  let near: HTMLElement | null = null;

  const rubber = (d: number) => 16 * (1 - Math.exp(-d / 36));
  const follow = (cx: number) => {
    if (!bar || !lens) return;
    const br = bar.getBoundingClientRect(), list = items();
    const min = slotX(list[0]), max = slotX(list[list.length - 1]);
    let x = cx - br.left - lensW / 2;
    if (x < min) x = min - rubber(min - x);
    if (x > max) x = max + rubber(x - max);
    lens.style.transform = tr(x, 1.1);
    // A aba sob a lente cresce um pouco, como sob uma lupa
    const center = x + lensW / 2;
    const n = list.reduce((a, b) => Math.abs(slotX(b) + lensW / 2 - center) < Math.abs(slotX(a) + lensW / 2 - center) ? b : a);
    if (n !== near) { near?.classList.remove('near'); n.classList.add('near'); near = n; }
  };
  const release = (go: boolean) => {
    if (!bar || !lens) return;
    lens.classList.remove('drag');
    const target = near;
    near?.classList.remove('near');
    near = null;
    if (go && target && target.getAttribute('aria-current') !== 'page') {
      target.click();
    } else syncTabLens(false);
  };

  bar.addEventListener('pointerdown', e => {
    if (!mobile() || reduced() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    down = { id: e.pointerId, x0: e.clientX, moved: false };
  });
  bar.addEventListener('pointermove', e => {
    if (!down || e.pointerId !== down.id) return;
    if (!down.moved) {
      if (Math.abs(e.clientX - down.x0) < 8) return;
      // Virou arrasto: a barra segura o dedo (toque simples continua sendo um clique normal na aba)
      down.moved = true;
      try { bar!.setPointerCapture(e.pointerId); } catch { /* sem captura, o arrasto continua funcionando dentro da barra */ }
      lens!.classList.add('drag');
    }
    follow(e.clientX);
  });
  bar.addEventListener('pointerup', e => {
    if (!down || e.pointerId !== down.id) return;
    const moved = down.moved;
    down = null;
    if (moved) release(true);
  });
  bar.addEventListener('pointercancel', () => { if (down?.moved) release(false); down = null; });
}

/** Botões: ao encostar, crescem um pouco com uma mola, e um brilho acompanha o dedo. */
export function wirePress() {
  const SEL = '.btn, .chip, .seg button';
  let cur: HTMLElement | null = null;
  const at = (el: HTMLElement, e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--px', `${(e.clientX - r.left).toFixed(0)}px`);
    el.style.setProperty('--py', `${(e.clientY - r.top).toFixed(0)}px`);
  };
  const up = () => { cur?.classList.remove('is-press'); cur = null; };
  document.addEventListener('pointerdown', e => {
    if (reduced() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const el = (e.target as Element | null)?.closest<HTMLElement>(SEL);
    if (!el || (el as HTMLButtonElement).disabled) return;
    cur = el;
    at(el, e);
    el.classList.add('is-press');
  }, { passive: true });
  document.addEventListener('pointermove', e => { if (cur) at(cur, e); }, { passive: true });
  document.addEventListener('pointerup', up, { passive: true });
  document.addEventListener('pointercancel', up, { passive: true });
}
