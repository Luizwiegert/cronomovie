import { reduced } from './util';

/**
 * Abertura do site: a revelação da logo do Cronomovie, desenhada ao vivo pelo navegador (nítida em qualquer tela).
 * Uma ideia só, a da própria logo: a linha do tempo que chega na estreia. Cada momento nasce do anterior.
 *  1. o símbolo aparece grande no centro: a bolinha vermelha corre a linha e as brancas surgem quando ela passa;
 *  2. ela chega ao fim e cresce (a estreia), e o símbolo recua até o lugar dele, ao lado do nome;
 *  3. as letras do nome sobem de uma máscara, uma a uma;
 *  4. a logo inteira voa até o cabeçalho e vira o logo do site, enquanto o fundo some.
 * Cerca de 3 segundos. Para não travar enquanto o site é montado por baixo, tudo que se mexe é um bloco de HTML
 * animado só em posição, tamanho e opacidade: a placa de vídeo cuida disso sozinha, sem disputar com o resto da página.
 * (Por isso o símbolo aqui é feito de blocos, e não do desenho SVG do cabeçalho: a linha e as bolinhas têm as mesmas medidas.)
 * Sem brilho, partícula, clarão ou dissolve. Tudo é desenhado grande e só diminui, por isso fica nítido.
 * Toca uma vez por sessão do navegador. Em desenvolvimento, ?abertura força tocar de novo.
 * A versão em vídeo (videos/cronomovie-abertura) é a anterior, em 3D, e não acompanha mais esta.
 */

const SEEN = 'moviegram-abertura';

function shouldPlay(): boolean {
  if (reduced()) return false;
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('abertura')) return true;
  try { return !sessionStorage.getItem(SEEN); } catch { return true; }
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const frame = () => new Promise(r => requestAnimationFrame(() => r(null)));

// Curvas: entradas com expo, deslocamentos com in-out; a única mola tem só um leve passo além do ponto.
const E = {
  io: 'cubic-bezier(.65,0,.35,1)',
  expo: 'cubic-bezier(.16,1,.3,1)',
  spring: 'cubic-bezier(.34,1.25,.64,1)',
};
// Momentos (ms)
const T = {
  run: 80, runDur: 680,       // a vermelha corre a linha
  dot2: 360,                  // a vermelha passa pela segunda bolinha branca
  grow: 760,                  // chega ao fim e cresce: a estreia
  pull: 800, pullDur: 640,    // o símbolo recua até o lugar dele
  type: 1180, stagger: 28, typeDur: 600, // as letras sobem quando o símbolo já está quase no lugar
  hand: 2350, handDur: 600,   // a logo vai para o cabeçalho
};
const NAME = ['C', 'r', 'o', 'n', 'o'].map(c => `<span class="l">${c}</span>`).join('')
  + ['m', 'o', 'v', 'i', 'e'].map(c => `<span class="l b">${c}</span>`).join('');

/** Quem precisa esperar a abertura acabar (para não pesar a página enquanto ela toca) usa isto. */
let finishedIntro: Promise<void> = Promise.resolve();
export const introDone = () => finishedIntro;

export function playIntro(): Promise<void> {
  if (!shouldPlay()) return Promise.resolve();
  try { sessionStorage.setItem(SEEN, '1'); } catch { /* sem sessão, toca mesmo assim */ }

  const root = document.createElement('div');
  root.className = 'intro';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <div class="iv-bg"></div>
    <div class="iv-stage"><div class="iv-lockup">
      <div class="iv-markbox"><div class="iv-markbig">
        <i class="iv-line"></i><i class="iv-dot d1"></i><i class="iv-dot d2"></i><i class="iv-dot d3"></i>
      </div></div>
      <div class="iv-wordmark">${NAME}</div>
    </div></div>`;
  const skip = document.createElement('button');
  skip.className = 'intro-skip';
  skip.type = 'button';
  skip.textContent = 'Pular abertura';
  document.body.append(root, skip);
  document.documentElement.classList.add('intro-on');

  let done = false;
  let resolve!: () => void;
  const finished = new Promise<void>(r => { resolve = r; });
  finishedIntro = finished;
  const end = async (fast: boolean) => {
    if (done) return;
    done = true;
    skip.remove();
    // No fim normal, o logo do cabeçalho já está no lugar exato da logo da abertura: as duas trocam sem salto.
    document.documentElement.classList.remove('intro-on');
    const out = root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fast ? 220 : 160, easing: 'ease', fill: 'forwards' }).finished.catch(() => {});
    // Se o navegador pausar a animação (aba em segundo plano), a abertura não fica presa na tela
    await Promise.race([out, wait(400)]);
    root.remove();
    removeEventListener('keydown', onKey);
    resolve();
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') void end(true); };
  skip.addEventListener('click', () => void end(true));
  addEventListener('keydown', onKey);

  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector(s) as unknown as T;
  const A = (el: Element, kf: Keyframe[], delay: number, duration: number, easing = 'linear', fill: FillMode = 'both') =>
    el.animate(kf, { delay, duration, easing, fill });

  void (async () => {
    // As posições dependem da largura do nome: espera a fonte da marca (no máximo 1,2 s)
    // e dois quadros, para a primeira montagem da página por baixo já ter acontecido.
    await Promise.race([document.fonts.load('900 100px "Big Shoulders Display"').catch(() => {}), wait(1200)]);
    await Promise.race([(async () => { await frame(); await frame(); })(), wait(120)]);
    if (done) return;

    const lockup = $('.iv-lockup'), big = $('.iv-markbig');
    const box = $('.iv-markbox').getBoundingClientRect(), bigW = big.getBoundingClientRect().width;
    const S = bigW / box.width, u = bigW / 64; // u = uma unidade do desenho do símbolo (64 de largura)
    // Do lugar final dele até o centro da tela
    const dx = innerWidth / 2 - (box.left + box.width / 2), dy = innerHeight / 2 - (box.top + box.height / 2);
    const at = (x: number, y: number, s: number) => `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${s})`;

    A(lockup, [{ opacity: 0 }, { opacity: 1 }], 0, 120, 'ease-out');

    /* 1. o símbolo grande no centro: a vermelha corre a linha (a linha cresce junto, com a mesma curva)
          e as brancas surgem quando ela passa */
    A(big, [{ transform: at(dx, dy, 1) }, { transform: at(dx, dy, 1) }], 0, 1);
    A($('.iv-line'), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], T.run, T.runDur, E.io);
    const red = $('.d3');
    A(red, [{ transform: at(-40 * u, 0, .45) }, { transform: at(0, 0, .45) }], T.run, T.runDur, E.io);
    A($('.d1'), [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], 40, 300, E.spring);
    A($('.d2'), [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], T.dot2, 300, E.spring);

    /* 2. a estreia: ela cresce no fim da linha, e o símbolo recua até o lugar dele ao lado do nome */
    A(red, [{ transform: at(0, 0, .45) }, { transform: at(0, 0, 1) }], T.grow, 420, E.expo, 'forwards');
    A(big, [{ transform: at(dx, dy, 1) }, { transform: at(0, 0, 1 / S) }], T.pull, T.pullDur, E.io, 'forwards');

    /* 3. o nome: cada letra sobe de dentro de uma máscara */
    root.querySelectorAll('.iv-wordmark .l').forEach((l, i) =>
      A(l, [{ transform: 'translate3d(0,110%,0)' }, { transform: 'translate3d(0,0,0)' }], T.type + i * T.stagger, T.typeDur, E.expo));

    /* 4. a logo vai até o logo do cabeçalho (mesmo desenho e proporções) e o fundo some */
    await wait(T.hand);
    if (done) return;
    const brand = document.querySelector('.bar .brand');
    const mark = brand?.querySelector('.mark')?.getBoundingClientRect(), word = brand?.querySelector('.wordmark')?.getBoundingClientRect();
    if (mark && word && mark.width > 0) {
      const lr = lockup.getBoundingClientRect();
      const s = (word.right - mark.left) / lr.width;
      const tx = mark.left - lr.left, ty = (mark.top + mark.height / 2) - (lr.top + (lr.height * s) / 2);
      lockup.animate([{ transform: at(0, 0, 1) }, { transform: at(tx, ty, s) }], { duration: T.handDur, easing: E.io, fill: 'forwards' });
    }
    $('.iv-bg').animate([{ opacity: 1 }, { opacity: 0 }], { delay: 60, duration: T.handDur - 80, easing: 'ease', fill: 'forwards' });
    await wait(T.handDur);
    void end(false);
  })();

  return finished;
}
