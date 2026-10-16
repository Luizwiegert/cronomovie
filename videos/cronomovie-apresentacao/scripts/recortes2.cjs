// Recortes para as cenas novas: lista de episódios, comentário escondido (spoiler) e o cartão de lançamento.
const fs = require('fs');
const path = require('path');
const puppeteer = require(process.env.PUPPETEER);
const OUT = path.join(__dirname, '..', 'assets', 'recortes');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--hide-scrollbars'] });
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.goto('http://localhost:5180/#linha', { waitUntil: 'networkidle0' });
  await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await p.goto('http://localhost:5180/#linha', { waitUntil: 'networkidle0' });
  await wait(5000);
  await p.addStyleTag({ content: '.demo-note{display:none!important} .toast{display:none!important}' });
  const crop = async (name, sel) => { const h = await p.$(sel); if (!h) { console.log('sem', name); return; } await h.screenshot({ path: path.join(OUT, name + '.png') }); console.log('ok', name); };
  // cartão de lançamento (Doutor Destino)
  await p.evaluate(() => document.querySelector('.rel-dots button')?.click());
  await wait(900);
  await crop('lancamento', '#top .cdown');
  // Loki: episódios e o comentário escondido do Tércio
  await p.evaluate(() => document.querySelector('[data-open="loki1"]')?.click());
  await wait(1800);
  await p.evaluate(() => { const s = document.querySelector('#modal .m-scroll'), e = document.querySelector('#modal details, #modal .eps, #modal .season'); if (s && e) s.scrollTop = e.offsetTop - 120; });
  await wait(900);
  await p.evaluate(() => { const d = document.querySelector('#modal details'); if (d && !d.open) d.open = true; });
  await wait(600);
  await crop('episodios', '#modal details, #modal .season');
  await p.evaluate(() => { const s = document.querySelector('#modal .m-scroll'), f = document.querySelector('#modal .fc.spoil'); if (s && f) s.scrollTop = f.closest('li').offsetTop - 200; });
  await wait(900);
  await crop('spoiler', '#modal .friends');
  // o mesmo comentário depois de tocar (revelado)
  await p.evaluate(() => document.querySelector('#modal .fc.spoil')?.click());
  await wait(500);
  await crop('spoiler-aberto', '#modal .friends');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
