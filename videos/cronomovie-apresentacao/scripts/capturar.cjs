// Grava as telas reais do Cronomovie (demonstração, dados de exemplo) em alta resolução para o vídeo e o carrossel.
// Uso: node scripts/capturar.cjs   (com a demonstração rodando em http://localhost:5180)
const fs = require('fs');
const path = require('path');
const puppeteer = require(process.env.PUPPETEER || 'puppeteer-core');

const OUT = path.join(__dirname, '..', 'assets', 'telas');
const POST = path.join(__dirname, '..', 'assets', 'cartazes');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(POST, { recursive: true });
const BASE = 'http://localhost:5180';
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--hide-scrollbars', '--force-color-profile=srgb'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'dark' }]);
  // Começa limpo: dados de exemplo restaurados, sem marcas de testes anteriores
  await page.goto(BASE + '/#linha', { waitUntil: 'networkidle0' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(BASE + '/#linha', { waitUntil: 'networkidle0' });
  await wait(5000);
  // Esconde o aviso da demonstração (não faz parte do produto)
  await page.addStyleTag({ content: '.demo-note{display:none!important} .toast{display:none!important}' });
  const shot = async (name, el) => {
    await wait(700);
    const file = path.join(OUT, name + '.png');
    if (el) { const h = await page.$(el); await h.screenshot({ path: file }); } else await page.screenshot({ path: file });
    console.log('ok', name);
  };
  const go = async hash => { await page.evaluate(h => { location.hash = h; }, hash); await wait(1500); await page.evaluate(() => window.scrollTo(0, 0)); };

  // 1. Linha do tempo: o topo (lançamento de Doutor Destino e o progresso)
  await page.evaluate(() => document.querySelector('.rel-dots button')?.click());
  await shot('linha-topo');
  await shot('progresso', '#top .progress, #top .prog, #top section, .prog-card');
  // 2. As fileiras de cartazes
  await page.evaluate(() => { const e = document.querySelector('#eras'); window.scrollTo(0, (e?.getBoundingClientRect().top || 0) + window.scrollY - 70); });
  await shot('linha-fileiras');
  // Ordem dos cartazes na linha do tempo (para a coluna do vídeo)
  const posters = await page.evaluate(() => [...document.querySelectorAll('#eras .p-open[data-open], #eras [data-open]')]
    .map(b => ({ id: b.getAttribute('data-open'), src: b.querySelector('img.p-img')?.getAttribute('src') || '', t: b.querySelector('.p-title b')?.textContent || '' }))
    .filter((x, i, a) => x.src && a.findIndex(y => y.id === x.id) === i));
  fs.writeFileSync(path.join(POST, 'ordem.json'), JSON.stringify(posters, null, 2));
  // 3. Grade (visualização em grade)
  await page.evaluate(() => { document.querySelector('[data-filters]')?.click(); });
  await wait(500);
  await page.evaluate(() => { document.querySelector('[data-seg="view"] [data-v="v"]')?.click(); document.querySelector('[data-filters-close]')?.click(); });
  await wait(800);
  await page.evaluate(() => { const e = document.querySelector('#eras'); window.scrollTo(0, (e?.getBoundingClientRect().top || 0) + window.scrollY - 70); });
  await shot('linha-grade');
  // volta para fileiras
  await page.evaluate(() => { document.querySelector('[data-filters]')?.click(); });
  await wait(400);
  await page.evaluate(() => { document.querySelector('[data-seg="view"] [data-v="h"]')?.click(); document.querySelector('[data-filters-close]')?.click(); });
  await wait(600);
  // 4. Próximo na ordem (botão Marcar como visto)
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('proximo', '.next, .next-up, #top .nx-card, .upnext');
  // 5. Trilha Avengers ligada
  await page.evaluate(() => { const t = document.querySelector('[data-trail]'); t?.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); });
  await shot('trilha-desligada');
  await page.evaluate(() => document.querySelector('[data-trail]')?.click());
  await wait(800);
  await page.evaluate(() => { const t = document.querySelector('[data-trail]'); t?.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); });
  await shot('trilha-ligada');
  await shot('trilha-cartao', '[data-trail]');
  await page.evaluate(() => document.querySelector('[data-trail]')?.click());
  await wait(600);
  // 6. Detalhe de um título (Ultimato): topo e trailer/onde assistir
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.querySelector('[data-open="ultimato"]')?.click());
  await wait(1800);
  await shot('detalhe-topo');
  await page.evaluate(() => { const s = document.querySelector('#modal .m-scroll'), t = document.querySelector('#modal .trailer'); if (s && t) s.scrollTop = t.offsetTop - 140; });
  await wait(1500);
  await shot('detalhe-trailer');
  await page.evaluate(() => { const s = document.querySelector('#modal .m-scroll'), f = document.querySelector('#modal .friends'); if (s && f) s.scrollTop = f.offsetTop - 200; });
  await shot('detalhe-amigos');
  await page.evaluate(() => document.querySelector('#modal [data-close]')?.click());
  await wait(800);
  // 7. Ranking
  await go('#ranking');
  await shot('ranking');
  // 8. Amigos: atividade
  await go('#amigos');
  await shot('amigos-topo');
  await page.evaluate(() => { const f = document.querySelector('.feed'); f?.scrollIntoView({ block: 'start' }); window.scrollBy(0, -90); });
  await shot('amigos-atividade');
  // 9. Perfil
  await go('#perfil');
  await shot('perfil');
  // 10. Notificações
  await page.evaluate(() => document.querySelector('[data-notifs]')?.click());
  await wait(1200);
  await shot('notificacoes');
  await page.evaluate(() => document.querySelector('[data-fs-close]')?.click());
  await wait(800);
  // 11. Cartão dos Stories (a imagem gerada pelo próprio site)
  await go('#perfil');
  await page.evaluate(() => document.querySelector('[data-pf-tab="progresso"]')?.click());
  await wait(500);
  await page.evaluate(() => document.querySelector('[data-story-open]')?.click());
  await wait(6000);
  const b64 = await page.evaluate(async () => {
    const img = document.querySelector('.story-prev');
    if (!img) return null;
    const blob = await fetch(img.src).then(r => r.blob());
    return await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
  });
  if (b64) { fs.writeFileSync(path.join(OUT, 'story.jpg'), Buffer.from(b64, 'base64')); console.log('ok story'); }
  await browser.close();

  // Cartazes em ordem, baixados em boa resolução (w500)
  let n = 0;
  for (const [i, p] of posters.slice(0, 40).entries()) {
    const url = p.src.replace('/w342/', '/w500/');
    const res = await fetch(url);
    if (!res.ok) continue;
    fs.writeFileSync(path.join(POST, String(i).padStart(2, '0') + '-' + p.id + '.jpg'), Buffer.from(await res.arrayBuffer()));
    n++;
  }
  console.log('cartazes', n, 'de', posters.length);
})().catch(e => { console.error(e); process.exit(1); });
