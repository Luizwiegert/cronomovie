// Fotografa a tela de entrar do site no ar (só abre a tela; nada é preenchido nem enviado).
// Saída: assets/telas/login.png (tela inteira) e assets/recortes/login.png (só o cartão).
const path = require('path');
const puppeteer = require(process.env.PUPPETEER);
const A = path.join(__dirname, '..', 'assets');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--hide-scrollbars'] });
  const p = await b.newPage();
  await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.goto('https://cronomovie.com/', { waitUntil: 'networkidle0' });
  await wait(4000);
  await p.evaluate(() => document.querySelector('[data-auth="entrar"]')?.click());
  await wait(3000);
  await p.screenshot({ path: path.join(A, 'telas', 'login.png') });
  const card = await p.$('.auth-card');
  if (card) { await card.screenshot({ path: path.join(A, 'recortes', 'login.png') }); console.log('ok cartão'); } else console.log('sem cartão');
  console.log(await p.evaluate(() => [...document.querySelectorAll('.auth-card button:not([hidden])')].map(x => x.textContent.trim()).join(' | ')));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
