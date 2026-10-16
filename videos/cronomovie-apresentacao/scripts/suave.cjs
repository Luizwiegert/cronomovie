// Troca movimentos por left/top (que andam de pixel em pixel) por x/y (suaves), conforme a checagem do HyperFrames.
const fs = require('fs');
const f = require('path').join(__dirname, '..', 'index.html');
let s = fs.readFileSync(f, 'utf8');
let falhas = 0;
const rep = (a, b, all = false) => {
  const n = s.split(a).length - 1;
  if (!n || (!all && n !== 1)) { console.log((n ? 'REPETIDO ' : 'NAO ACHEI ') + a.slice(0, 90)); falhas++; return; }
  s = all ? s.split(a).join(b) : s.replace(a, () => b);
};

// CSS: posição base 0; quem dá o lugar é x/y
rep("#card { left: 90px; top: 560px;", "#card { left: 0; top: 0;");
rep("#trail { left: 90px; top: 600px;", "#trail { left: 0; top: 0;");
rep("#trailer { left: 90px; top: 560px;", "#trailer { left: 0; top: 0;");
rep("#prov { left: 342px; top: 1160px;", "#prov { left: 0; top: 0;");

// linha da logo / linha do tempo
rep("gsap.set('#railG', { left: R0x, top: Y0 - thick0 / 2, width: 0, height: thick0, transformOrigin: '100% 50%' });",
  "gsap.set('#railG', { x: R0x, y: Y0 - thick0 / 2, width: 0, height: thick0, transformOrigin: '100% 50%' });");
rep(".to('#railG', { left: R0x - len0, width: len0, duration: 0.55, ease: 'power3.out' }, 2.05)",
  ".to('#railG', { x: R0x - len0, width: len0, duration: 0.55, ease: 'power3.out' }, 2.05)");
rep(".to('#railG', { left: RVx - len1, top: RVy - th1 / 2, width: len1, height: th1, rotation: 90, duration: 0.95, ease: 'power3.inOut' }, 4.2)",
  ".to('#railG', { x: RVx - len1, y: RVy - th1 / 2, width: len1, height: th1, rotation: 90, duration: 0.95, ease: 'power3.inOut' }, 4.2)");
rep(".to('#railG', { left: CX - len2, top: yEnd - th1 / 2, width: len2, duration: 0.9, ease: 'power3.inOut' }, 7.2)",
  ".to('#railG', { x: CX - len2, y: yEnd - th1 / 2, width: len2, duration: 0.9, ease: 'power3.inOut' }, 7.2)");
rep(".set('#railG', { left: R0x, top: Y0 - thick0 / 2, width: 0, height: thick0, rotation: 0 }, 35.6)",
  ".set('#railG', { x: R0x, y: Y0 - thick0 / 2, width: 0, height: thick0, rotation: 0 }, 35.6)");
rep(".to('#railG', { left: R0x - len0, width: len0, duration: 0.5, ease: 'power3.out' }, 36.25)",
  ".to('#railG', { x: R0x - len0, width: len0, duration: 0.5, ease: 'power3.out' }, 36.25)");

// bolinhas: as 13 dos títulos já nascem no lugar certo (sem andar pela linha)
rep(`          tickEls.forEach((el, i) => {
            const j = chosen.indexOf(i);
            if (j < 0) tl.to(el, { scale: 0, duration: 0.35, ease: 'power2.in' }, 7.1 + (i % 7) * 0.02);
            else tl.to(el, { left: ((y0 + j * step - top2) / len2) * 100 + '%', scale: 1.5, duration: 0.9, ease: 'power3.inOut' }, 7.2);
          });`,
`          tickEls.forEach((el, i) => { tl.to(el, { scale: 0, duration: 0.35, ease: 'power2.in' }, 7.1 + (i % 7) * 0.02); });
          // as bolinhas dos títulos acendem na linha já esticada
          const dots = ITEMS.map((_, j) => {
            const d = document.createElement('div');
            d.className = 'tick';
            d.style.left = ((y0 + j * step - top2) / len2) * 100 + '%';
            ticks.appendChild(d);
            return d;
          });
          gsap.set(dots, { scale: 0 });
          dots.forEach((d, j) => tl.to(d, { scale: 1.6, duration: 0.4, ease: 'back.out(3)' }, 7.75 + j * 0.03));`);
rep(".set(tickEls, { scale: 0 }, 35.6)", ".set(tickEls, { scale: 0 }, 35.6)\n            .set(dots, { scale: 0 }, 35.6)");

// tela e moldura do celular
rep("tl.to('#screen', { left: PX, top: PY, width: PW, height: PH, borderRadius: 58, duration: 1.15, ease: 'power3.inOut' }, 11.0)",
  "tl.to('#screen', { x: PX, y: PY, width: PW, height: PH, borderRadius: 58, duration: 1.15, ease: 'power3.inOut' }, 11.0)");
rep(".fromTo('#bezel', { left: -B, top: -B, width: W + 2 * B, height: H + 2 * B, borderRadius: 0, opacity: 0 },\n              { left: PX - B, top: PY - B, width: PW + 2 * B, height: PH + 2 * B, borderRadius: 74, opacity: 1, duration: 1.15, ease: 'power3.inOut' }, 11.0)",
  ".fromTo('#bezel', { x: -B, y: -B, width: W + 2 * B, height: H + 2 * B, borderRadius: 0, opacity: 0 },\n              { x: PX - B, y: PY - B, width: PW + 2 * B, height: PH + 2 * B, borderRadius: 74, opacity: 1, duration: 1.15, ease: 'power3.inOut' }, 11.0)");
rep(".set('#screen', { opacity: 1, scale: 1, left: 0, top: 0, width: W, height: H, borderRadius: 0 }, 35.6)",
  ".set('#screen', { opacity: 1, scale: 1, x: 0, y: 0, width: W, height: H, borderRadius: 0 }, 35.6)");

// ✓ e barra
rep("gsap.set('#fill', { left: bx - 42, top: by - 42, width: 84, height: 84, opacity: 0 });", "gsap.set('#fill', { x: bx - 42, y: by - 42, width: 84, height: 84, opacity: 0 });");
rep(".to('#fill', { left: 150, top: 960, width: 47, height: 18, duration: 0.65, ease: 'power3.inOut' }, 15.35);", ".to('#fill', { x: 150, y: 960, width: 47, height: 18, duration: 0.65, ease: 'power3.inOut' }, 15.35);");
rep("gsap.set('#card', { scaleY: 0.03, scaleX: 0.9, opacity: 0, transformOrigin: '50% 80%' });", "gsap.set('#card', { x: 90, y: 560, scaleY: 0.03, scaleX: 0.9, opacity: 0, transformOrigin: '50% 80%' });");
rep(".to('#fill', { left: tgx, top: tgy, width: tgw, height: tgh, duration: 0.65, ease: 'power3.inOut' }, 18.05)", ".to('#fill', { x: tgx, y: tgy, width: tgw, height: tgh, duration: 0.65, ease: 'power3.inOut' }, 18.05)");
rep(".to('#card', { left: 90, top: 600, width: 900, height: 538, borderRadius: 34, duration: 0.65, ease: 'power3.inOut' }, 18.05);", ".to('#card', { x: 90, y: 600, width: 900, height: 538, borderRadius: 34, duration: 0.65, ease: 'power3.inOut' }, 18.05);");
rep(".to('#ring', { opacity: 1, duration: 0.05 }, 14.6).to('#ring', { scale: 2.1, opacity: 0, duration: 0.6, ease: 'power2.out' }, 14.62);", ".to('#ring', { opacity: 1, duration: 0.05 }, 14.6).to('#ring', { scale: 2.1, opacity: 0, duration: 0.6, ease: 'power2.out' }, 14.66);");

// trilha
rep("gsap.set('#trail', { opacity: 0 });", "gsap.set('#trail', { x: 90, y: 600, opacity: 0 });");
rep(".to('#trail', { left: PX + 16 * k, top: PY + 80 * k, width: 358 * k, height: 358 * k * 642 / 1074, borderRadius: 18, duration: 0.8, ease: 'power3.inOut' }, 20.35)",
  ".to('#trail', { x: PX + 16 * k, y: PY + 80 * k, width: 358 * k, height: 358 * k * 642 / 1074, borderRadius: 18, duration: 0.8, ease: 'power3.inOut' }, 20.35)");

// trailer, play e selo
rep("gsap.set('#trailer', { left: PX + 16 * k, top: PY + 160 * k,", "gsap.set('#trailer', { x: PX + 16 * k, y: PY + 160 * k,");
rep(".to('#trailer', { left: 90, top: 560, width: 900, height: 505, borderRadius: 26, duration: 0.75, ease: 'expo.out' }, 22.55)", ".to('#trailer', { x: 90, y: 560, width: 900, height: 505, borderRadius: 26, duration: 0.75, ease: 'expo.out' }, 22.55)");
rep("gsap.set('#play', { left: 540 - 75, top: 560 + 252 - 75, scale: 0.6, opacity: 0 });", "gsap.set('#play', { x: 540 - 75, y: 560 + 252 - 75, scale: 0.6, opacity: 0 });");
rep(".to('#play', { left: 342, top: 1160, width: 396, height: 158,", ".to('#play', { x: 342, y: 1160, width: 396, height: 158,");
rep("gsap.set('#prov', { opacity: 0 });", "gsap.set('#prov', { x: 342, y: 1160, opacity: 0 });");
rep("tl.to(['#trailer', '#provLabel'], { opacity: 0, y: -30, duration: 0.45, ease: 'power3.in' }, 25.0)", "tl.to(['#trailer', '#provLabel'], { opacity: 0, duration: 0.45, ease: 'power3.in' }, 25.0)");
rep(".to('#prov', { left: 440, top: 760, width: 200, height: 200, borderRadius: 100, duration: 0.6, ease: 'power3.inOut' }, 25.0)", ".to('#prov', { x: 440, y: 760, width: 200, height: 200, borderRadius: 100, duration: 0.6, ease: 'power3.inOut' }, 25.0)");

// amigos
rep("gsap.set(['#avL', '#avC', '#avR'], { left: 440, top: 760, opacity: 0, scale: 1 });", "gsap.set(['#avL', '#avC', '#avR'], { left: 0, top: 0, x: 440, y: 760, opacity: 0, scale: 1 });");
rep(".to('#avL', { left: 145, top: 860, duration: 0.7, ease: 'expo.out' }, 25.75)", ".to('#avL', { x: 145, y: 860, duration: 0.7, ease: 'expo.out' }, 25.75)");
rep(".to('#avR', { left: 735, top: 980, duration: 0.7, ease: 'expo.out' }, 25.75)", ".to('#avR', { x: 735, y: 980, duration: 0.7, ease: 'expo.out' }, 25.75)");
rep(".to('#avC', { left: 440, top: 700, duration: 0.7, ease: 'expo.out' }, 25.75);", ".to('#avC', { x: 440, y: 700, duration: 0.7, ease: 'expo.out' }, 25.75);");
rep(".to('#podium', { opacity: 0, duration: 0.1 }, 29.42);", ".to('#podium', { opacity: 0, duration: 0.1 }, 29.46);");

if (falhas) { console.log('NADA GRAVADO'); process.exit(1); }
fs.writeFileSync(f, s);
console.log('ok');
