// Recortes de elementos das telas e as posições deles (em px da tela de 390x844) para os encaixes do vídeo.
const fs = require('fs');
const path = require('path');
const puppeteer = require(process.env.PUPPETEER || 'puppeteer-core');
const OUT = path.join(__dirname, '..', 'assets', 'recortes');
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
const rects = {};

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--hide-scrollbars'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto('http://localhost:5180/#linha', { waitUntil: 'networkidle0' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto('http://localhost:5180/#linha', { waitUntil: 'networkidle0' });
  await wait(5000);
  await page.addStyleTag({ content: '.demo-note{display:none!important} .toast{display:none!important}' });
  await page.evaluate(() => document.querySelector('.rel-dots button')?.click());
  await wait(800);
  const rect = async (name, sel) => {
    rects[name] = await page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, sel);
  };
  const crop = async (name, sel) => { const h = await page.$(sel); if (!h) { console.log('sem', name); return; } await h.screenshot({ path: path.join(OUT, name + '.png') }); console.log('ok', name); };

  // Tela "linha-topo": onde ficam o botão Marcar como visto e o progresso
  await rect('linha-topo:marcar', '.next button, [data-toggle]');
  await rect('linha-topo:progresso', '.prog, .progress, #top .prog-card');
  await crop('proximo', '.next');
  // Cartão da Trilha, desligado e ligado
  await page.evaluate(() => { const t = document.querySelector('[data-trail]'); t.scrollIntoView({ block: 'center' }); });
  await wait(500);
  await crop('trilha-off', '[data-trail]');
  await page.evaluate(() => document.querySelector('[data-trail]').click());
  await wait(900);
  await page.evaluate(() => { const t = document.querySelector('[data-trail]'); t.scrollIntoView({ block: 'center' }); });
  await wait(500);
  await crop('trilha-on', '[data-trail]');
  await page.evaluate(() => document.querySelector('[data-trail]').click());
  await wait(600);
  // Detalhe: trailer e onde assistir
  await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('[data-open="ultimato"]').click(); });
  await wait(1800);
  await page.evaluate(() => { const s = document.querySelector('#modal .m-scroll'), t = document.querySelector('#modal .trailer'); s.scrollTop = t.offsetTop - 140; });
  await wait(1800);
  await crop('trailer', '#modal .trailer');
  await crop('onde-assistir', '#modal .provs');
  await crop('provedor', '#modal .prov');
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'posicoes.json'), JSON.stringify(rects, null, 2));
  console.log(JSON.stringify(rects));
})().catch(e => { console.error(e); process.exit(1); });
