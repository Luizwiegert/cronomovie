// Exporta as 7 imagens do carrossel (1080x1350) e a capa do Reels (1080x1920), de carrossel/*.html
const path = require('path');
const puppeteer = require(process.env.PUPPETEER);
const DIR = path.join(__dirname, '..', 'carrossel');
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
  await p.goto('file:///' + path.join(DIR, 'carrossel.html').replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts.ready);
  const n = await p.$$eval('.slide', s => s.length);
  for (let i = 1; i <= n; i++) {
    const el = await p.$('#s' + i);
    await el.screenshot({ path: path.join(DIR, `carrossel-${i}.png`) });
    console.log('ok', i);
  }
  // capa do Reels (1080x1920)
  await p.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await p.goto('file:///' + path.join(DIR, 'capa.html').replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts.ready);
  await (await p.$('#capa')).screenshot({ path: path.join(DIR, 'capa-reels.png') });
  console.log('ok capa');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
