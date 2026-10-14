import { reduced } from './util';

/**
 * Abertura do site: a revelação da logo do Cronomovie, desenhada ao vivo pelo navegador (nítida em qualquer tela),
 * sobre fundo liso: sem granulado, vinheta, névoa ou poeira.
 * É a mesma animação da composição do HyperFrames em videos/cronomovie-abertura (lá ela vira vídeo):
 *  1. a câmera passa colada nas letras gigantes do nome, inclinadas em 3D, com um brilho metálico correndo por dentro;
 *  2. ela recua e assenta de frente, e as letras ganham as cores da marca;
 *  3. as bolinhas do símbolo entram: a vermelha corre pela linha, as brancas pulam quando ela passa, e ela estoura no fim;
 *  4. um brilho varre o nome, as bolinhas fazem uma onda e a logo segura.
 * Toca uma vez por sessão do navegador. Em desenvolvimento, ?abertura força tocar de novo.
 */

const SEEN = 'moviegram-abertura';

function shouldPlay(): boolean {
  if (reduced()) return false;
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('abertura')) return true;
  try { return !sessionStorage.getItem(SEEN); } catch { return true; }
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

// Curvas (as mesmas da composição, em cubic-bezier)
const E = {
  p1io: 'cubic-bezier(.45,0,.55,1)',
  p3io: 'cubic-bezier(.65,0,.35,1)',
  p2o: 'cubic-bezier(.22,.61,.36,1)',
  expo: 'cubic-bezier(.16,1,.3,1)',
  back: 'cubic-bezier(.34,1.8,.64,1)',
  sine: 'cubic-bezier(.37,0,.63,1)',
  sineOut: 'cubic-bezier(.61,1,.88,1)',
};
// Momentos (ms), iguais aos da composição
const RUN = 520; // quanto a bolinha vermelha leva pra correr a linha
const T = { fly: 120, settle: 1250, colors: 1700, mark: 1820, premiere: 1820 + RUN, shine: 2900, end: 4300 };

export function playIntro(): Promise<void> {
  if (!shouldPlay()) return Promise.resolve();
  try { sessionStorage.setItem(SEEN, '1'); } catch { /* sem sessão, toca mesmo assim */ }

  const root = document.createElement('div');
  root.className = 'intro';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <div class="iv-scene"><div class="iv-rig"><div class="iv-lockup">
      <div class="iv-markbox">
        <svg class="iv-mark" viewBox="0 0 64 32"><line x1="8" y1="16" x2="48" y2="16"/><circle class="n1" cx="8" cy="16" r="4"/><circle class="n2" cx="24" cy="16" r="4"/><circle class="ring" cx="48" cy="16" r="11"/><circle class="n3" cx="48" cy="16" r="11"/></svg>
        <div class="iv-flare"></div>
      </div>
      <div class="iv-wordmark">
        <span class="iv-word iv-solid"><span>Crono</span><span class="b">movie</span></span>
        <span class="iv-word iv-over iv-chrome">Cronomovie</span>
        <span class="iv-word iv-over iv-shine">Cronomovie</span>
      </div>
    </div></div></div>`;
  const skip = document.createElement('button');
  skip.className = 'intro-skip';
  skip.type = 'button';
  skip.textContent = 'Pular abertura';
  document.body.append(root, skip);
  document.documentElement.classList.add('intro-on');

  let done = false;
  let resolve!: () => void;
  const finished = new Promise<void>(r => { resolve = r; });
  const end = async (fast: boolean) => {
    if (done) return;
    done = true;
    skip.remove();
    await root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fast ? 220 : 550, easing: 'ease', fill: 'forwards' }).finished.catch(() => {});
    root.remove();
    document.documentElement.classList.remove('intro-on');
    removeEventListener('keydown', onKey);
    resolve();
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') void end(true); };
  skip.addEventListener('click', () => void end(true));
  addEventListener('keydown', onKey);

  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector(s) as unknown as T;

  void (async () => {
    // As posições dependem da largura do nome: espera a fonte da marca (no máximo 1,5 s).
    await Promise.race([document.fonts.load('900 100px "Big Shoulders Display"').catch(() => {}), wait(1500)]);
    if (done) return;

    const lockup = $('.iv-lockup'), lr = lockup.getBoundingClientRect(), wr = $('.iv-wordmark').getBoundingClientRect();
    const cx = lr.left + lr.width / 2;
    // A câmera começa colada no começo do nome e viaja até o fim dele.
    const BIG = innerHeight > innerWidth ? 3.8 : 3.3;
    const X0 = -BIG * (wr.left + wr.width * 0.27 - cx), X1 = -BIG * (wr.left + wr.width * 0.78 - cx);
    const cam = (x: number, z: number, y: number, rx: number, s: number) => `translate3d(${x.toFixed(1)}px,0,0) rotate(${z}deg) rotateY(${y}deg) rotateX(${rx}deg) scale(${s})`;

    // Quantos pixels vale cada unidade do desenho do símbolo (ele tem 64 unidades de largura)
    const mu = $('.iv-markbox').getBoundingClientRect().width / 64;
    const line = $<SVGLineElement>('.iv-mark line'), len = line.getTotalLength();
    line.style.strokeDasharray = `${len}`;

    const A = (el: Element, kf: Keyframe[], delay: number, duration: number, easing = 'linear', fill: FillMode = 'both') =>
      el.animate(kf, { delay, duration, easing, fill });

    /* 1. voo colado nas letras, com o brilho metálico correndo por dentro; 2. a câmera recua e assenta de frente */
    const total = T.settle + 1100;
    $('.iv-rig').animate([
      { transform: cam(X0, -9, -16, 56, BIG), offset: 0 },
      { transform: cam(X0, -9, -16, 56, BIG), offset: T.fly / total, easing: E.p1io },
      { transform: cam(X1, -5, 9, 56, BIG), offset: T.settle / total, easing: E.p3io },
      { transform: cam(0, 0, 0, 0, 1), offset: 1 },
    ], { duration: total, fill: 'both' });
    A(lockup, [{ opacity: 0 }, { opacity: 1 }], T.fly, 300, 'ease-out');
    A($('.iv-chrome'), [{ backgroundPosition: '100% 50%' }, { backgroundPosition: '0% 50%' }], T.fly, 2100);
    A($('.iv-solid'), [{ opacity: 0 }, { opacity: 1 }], T.colors, 450, E.p1io);
    $('.iv-chrome').animate([{ opacity: 1 }, { opacity: 0 }], { delay: T.colors + 50, duration: 500, easing: E.p1io, fill: 'forwards' });

    /* 3. as bolinhas: a vermelha nasce pequena na ponta e corre pela linha; as brancas pulam quando ela passa;
          no fim da linha ela cresce e estoura */
    const n1 = $('.iv-mark .n1'), n2 = $('.iv-mark .n2'), n3 = $('.iv-mark .n3');
    const far = `translateX(${(-40 * mu).toFixed(1)}px)`; // a ponta esquerda da linha, vista do lugar final da vermelha
    const hop = (h: number) => `translateY(${(-h * mu).toFixed(1)}px)`;
    A(line, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], T.mark, RUN, E.p3io);
    A(n3, [
      { transform: `${far} scale(0)`, offset: 0, easing: E.expo },
      { transform: `${far} scale(.36)`, offset: 110 / (110 + RUN + 420), easing: E.p3io },
      { transform: 'translateX(0px) scale(.36)', offset: (110 + RUN) / (110 + RUN + 420), easing: E.expo },
      { transform: 'translateX(0px) scale(1)', offset: 1 },
    ], T.mark - 110, 110 + RUN + 420);
    A(n1, [{ transform: 'translateY(0px) scale(0)' }, { transform: `${hop(4)} scale(1.12)`, offset: 0.45 }, { transform: 'translateY(0px) scale(1)' }], T.mark + 60, 360, E.p2o);
    A(n2, [{ transform: 'translateY(0px) scale(0)' }, { transform: `${hop(5)} scale(1.15)`, offset: 0.45 }, { transform: 'translateY(0px) scale(1)' }], T.mark + 230, 380, E.p2o);
    A($('.iv-mark .ring'), [{ transform: 'scale(1)', opacity: 0.85 }, { transform: 'scale(3.2)', opacity: 0 }], T.premiere + 40, 850, E.sineOut, 'none');
    A($('.iv-flare'), [{ transform: 'scaleX(.05)', opacity: 1 }, { transform: 'scaleX(1)', opacity: 0 }], T.premiere, 750, E.p2o, 'none');

    /* 4. um brilho varre o nome, as três bolinhas fazem uma onda, e a logo segura com uma aproximação leve */
    A($('.iv-shine'), [{ backgroundPosition: '100% 50%' }, { backgroundPosition: '0% 50%' }], T.shine, 850, E.sine);
    [n1, n2, n3].forEach((n, i) => A(n, [{ transform: 'translateY(0px) scale(1)' }, { transform: `${hop(4.5)} scale(1)` }, { transform: 'translateY(0px) scale(1)' }], T.shine + 200 + i * 90, 340, E.sine, 'none'));
    A($('.iv-wordmark'), [{ transform: 'scale(1)' }, { transform: 'scale(1.02)' }], total, T.end - total, E.sineOut);

    await wait(T.end);
    void end(false);
  })();

  return finished;
}
