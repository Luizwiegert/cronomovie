// Avisa o Bing (e os outros buscadores do IndexNow) das páginas que mudaram desde o último aviso.
// Roda depois de publicar (npm run publicar). Compara o conteúdo gerado em dist/ com o último envio,
// guardado em .indexnow.json (só neste computador), e manda apenas o que mudou.
// Uso: node scripts/indexnow.mjs [--todos]
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'cronomovie.com';
// A chave é pública por natureza: fica em /<chave>.txt para o buscador conferir que o aviso veio do site
const KEY = readdirSync(join(ROOT, 'public')).map(f => /^([0-9a-f]{32})\.txt$/.exec(f)?.[1]).find(Boolean);
if (!KEY) throw new Error('sem a chave do IndexNow em public/<chave>.txt');

const DIST = join(ROOT, 'dist');
if (!existsSync(join(DIST, 'sitemap.xml'))) throw new Error('rode o build antes (falta dist/sitemap.xml)');
const urls = [...readFileSync(join(DIST, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

// endereço do site → arquivo gerado
const arquivo = u => {
  const p = new URL(u).pathname;
  if (p === '/') return join(DIST, 'index.html');
  return join(DIST, p.endsWith('.html') ? p : `${p}.html`);
};
const ESTADO = join(ROOT, '.indexnow.json');
const antes = existsSync(ESTADO) ? JSON.parse(readFileSync(ESTADO, 'utf8')) : {};
const agora = {};
for (const u of urls) {
  const f = arquivo(u);
  if (existsSync(f)) agora[u] = createHash('sha1').update(readFileSync(f)).digest('hex');
}
const todos = process.argv.includes('--todos');
const mudaram = Object.keys(agora).filter(u => todos || antes[u] !== agora[u]);
if (!mudaram.length) { console.log('IndexNow: nenhuma página mudou desde o último aviso'); process.exit(0); }

const r = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: mudaram.slice(0, 10000) }),
});
// 200 = recebido; 202 = recebido, a chave ainda vai ser conferida
if (r.status !== 200 && r.status !== 202) { console.error(`IndexNow recusou (${r.status}): ${(await r.text()).slice(0, 300)}`); process.exit(1); }
writeFileSync(ESTADO, JSON.stringify(agora, null, 1));
console.log(`IndexNow: ${mudaram.length} página(s) avisada(s) (resposta ${r.status})`);
