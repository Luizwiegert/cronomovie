// Abre o vídeo, vai até um instante e diz quais elementos estão num ponto da tela (para achar sobras visuais).
// Uso: node scripts/inspecionar.cjs <segundos> <x> <y> [<x> <y> ...]
const path = require('path');
const http = require('http');
const fs = require('fs');
const puppeteer = require(process.env.PUPPETEER);
const [t, ...pts] = process.argv.slice(2).map(Number);
const root = path.join(__dirname, '..');
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p.endsWith('/') ? p + 'index.html' : p, (e, d) => { if (e) { res.statusCode = 404; res.end(); return; } res.end(d); });
}).listen(5391, async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage();
  await p.setViewport({ width: 1080, height: 1920 });
  p.on('pageerror',e=>console.log('ERRO',e.message)); p.on('console',m=>console.log('LOG',m.text())); await p.evaluateOnNewDocument(() => { window.__timelines = {}; });
  await p.goto('http://localhost:5391/index.html', { waitUntil: 'networkidle0' });
  await new Promise(r=>setTimeout(r,4000)); console.log('DBG', await p.evaluate(()=>JSON.stringify({g: typeof gsap, keys: Object.keys(window.__timelines||{}), fonts: document.fonts.status})));
  const out = await p.evaluate((t, pts) => {
    // fora do HyperFrames ninguém dá o tamanho do quadro: dá aqui
    const r = document.querySelector('#root'); r.style.width = '1080px'; r.style.height = '1920px';
    window.__timelines['cronomovie-apresentacao'].seek(t, false);
    const res = [];
    for (let i = 0; i < pts.length; i += 2) {
      const els = document.elementsFromPoint(pts[i], pts[i + 1]).slice(0, 6).map(e => (e.id ? '#' + e.id : e.className && typeof e.className === 'string' ? '.' + e.className.split(' ').join('.') : e.tagName) + ' op=' + getComputedStyle(e).opacity);
      res.push(`(${pts[i]},${pts[i + 1]}): ${els.join(' | ')}`);
    }
    const story = document.querySelector('#story'), days = document.querySelector('#days');
    res.push('story: ' + JSON.stringify({ op: getComputedStyle(story).opacity, tr: getComputedStyle(story).transform }));
    res.push('days: ' + JSON.stringify({ op: getComputedStyle(days).opacity, tr: getComputedStyle(days).transform, n: getComputedStyle(document.querySelector('#daysN')).transform }));
    res.push('redO: ' + JSON.stringify({ op: getComputedStyle(document.querySelector('#redO')).opacity, tr: getComputedStyle(document.querySelector('#redO')).transform }));
    return res;
  }, t, pts);
  console.log(out.join('\n'));
  await p.screenshot({ path: path.join(root, 'dbg.png') });
  await b.close();
  server.close();
});
