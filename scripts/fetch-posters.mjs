// Busca os cartazes oficiais no TMDB e grava em src/posters.json
// (e as imagens de fundo, usadas na abertura, em src/backdrops.json).
// Rode uma vez (e de novo quando quiser atualizar): npm run posters
// Precisa da chave do TMDB no arquivo .env.local:
//   TMDB_TOKEN=...   (o "Token de leitura da API", recomendado)
//   ou TMDB_API_KEY=... (a "Chave da API")
// A chave só é usada aqui no seu computador; ela não vai pro site.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

for (const file of ['.env.local', '.env']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const TOKEN = process.env.TMDB_TOKEN;
const KEY = process.env.TMDB_API_KEY;
if (!TOKEN && !KEY) {
  console.error('Falta a chave do TMDB. Coloque TMDB_TOKEN=... no arquivo .env.local e rode de novo.');
  process.exit(1);
}

// id no app -> [tipo, título em inglês (ou o número do título no TMDB), ano, temporada]
const Q = {
  'olhos-wakanda': ['tv', 'Eyes of Wakanda', 2025],
  cap1: ['movie', 'Captain America: The First Avenger', 2011],
  'agent-carter': ['tv', "Marvel's Agent Carter", 2015],
  capita: ['movie', 'Captain Marvel', 2019],
  hdf1: ['movie', 'Iron Man', 2008],
  hdf2: ['movie', 'Iron Man 2', 2010],
  hulk: ['movie', 'The Incredible Hulk', 2008],
  thor1: ['movie', 'Thor', 2011],
  vingadores: ['movie', 'The Avengers', 2012],
  hdf3: ['movie', 'Iron Man 3', 2013],
  thor2: ['movie', 'Thor: The Dark World', 2013],
  shield1: ['tv', "Marvel's Agents of S.H.I.E.L.D.", 2013, 1],
  cap2: ['movie', 'Captain America: The Winter Soldier', 2014],
  gotg1: ['movie', 'Guardians of the Galaxy', 2014],
  groot: ['tv', 'I Am Groot', 2022],
  gotg2: ['movie', 'Guardians of the Galaxy Vol. 2', 2017],
  shield2: ['tv', "Marvel's Agents of S.H.I.E.L.D.", 2013, 2],
  dd1: ['tv', "Marvel's Daredevil", 2015, 1],
  jj: ['tv', "Marvel's Jessica Jones", 2015, 1],
  ultron: ['movie', 'Avengers: Age of Ultron', 2015],
  formiga1: ['movie', 'Ant-Man', 2015],
  dd2: ['tv', "Marvel's Daredevil", 2015, 2],
  lc1: ['tv', "Marvel's Luke Cage", 2016, 1],
  if1: ['tv', "Marvel's Iron Fist", 2017, 1],
  defensores: ['tv', "Marvel's The Defenders", 2017],
  pun1: ['tv', "Marvel's The Punisher", 2017, 1],
  jj2: ['tv', "Marvel's Jessica Jones", 2015, 2],
  lc2: ['tv', "Marvel's Luke Cage", 2016, 2],
  if2: ['tv', "Marvel's Iron Fist", 2017, 2],
  dd3: ['tv', "Marvel's Daredevil", 2015, 3],
  pun2: ['tv', "Marvel's The Punisher", 2017, 2],
  jj3: ['tv', "Marvel's Jessica Jones", 2015, 3],
  shield35: ['tv', "Marvel's Agents of S.H.I.E.L.D.", 2013, 3],
  guerracivil: ['movie', 'Captain America: Civil War', 2016],
  viuva: ['movie', 'Black Widow', 2021],
  pantera1: ['movie', 'Black Panther', 2018],
  aranha1: ['movie', 'Spider-Man: Homecoming', 2017],
  estranho1: ['movie', 'Doctor Strange', 2016],
  ragnarok: ['movie', 'Thor: Ragnarok', 2017],
  formiga2: ['movie', 'Ant-Man and the Wasp', 2018],
  guerrainf: ['movie', 'Avengers: Infinity War', 2018],
  ultimato: ['movie', 'Avengers: Endgame', 2019],
  loki1: ['tv', 'Loki', 2021, 1],
  whatif1: ['tv', 'What If...?', 2021, 1],
  wandavision: ['tv', 'WandaVision', 2021],
  falcao: ['tv', 'The Falcon and the Winter Soldier', 2021],
  shangchi: ['movie', 'Shang-Chi and the Legend of the Ten Rings', 2021],
  eternos: ['movie', 'Eternals', 2021],
  aranha2: ['movie', 'Spider-Man: Far From Home', 2019],
  aranha3: ['movie', 'Spider-Man: No Way Home', 2021],
  gaviao: ['tv', 'Hawkeye', 2021],
  eco: ['tv', 'Echo', 2024],
  estranho2: ['movie', 'Doctor Strange in the Multiverse of Madness', 2022],
  cavaleiro: ['tv', 'Moon Knight', 2022],
  msmarvel: ['tv', 'Ms. Marvel', 2022],
  thor4: ['movie', 'Thor: Love and Thunder', 2022],
  lobisomem: ['movie', 'Werewolf by Night', 2022],
  mulherhulk: ['tv', 'She-Hulk: Attorney at Law', 2022],
  wakanda: ['movie', 'Black Panther: Wakanda Forever', 2022],
  invasao: ['tv', 'Secret Invasion', 2023],
  festas: ['movie', 'The Guardians of the Galaxy Holiday Special', 2022],
  quantumania: ['movie', 'Ant-Man and the Wasp: Quantumania', 2023],
  gotg3: ['movie', 'Guardians of the Galaxy Vol. 3', 2023],
  marvels: ['movie', 'The Marvels', 2023],
  loki2: ['tv', 'Loki', 2021, 2],
  whatif23: ['tv', 'What If...?', 2021, 2],
  zombies: ['tv', 'Marvel Zombies', 2025],
  agatha: ['tv', 'Agatha All Along', 2024],
  ironheart: ['tv', 'Ironheart', 2025],
  deadpool3: ['movie', 'Deadpool & Wolverine', 2024],
  ddr1: ['tv', 'Daredevil: Born Again', 2025, 1],
  cap4: ['movie', 'Captain America: Brave New World', 2025],
  thunderbolts: ['movie', 'Thunderbolts*', 2025],
  ddr2: ['tv', 'Daredevil: Born Again', 2025, 2],
  'justiceiro-especial': ['movie', 'The Punisher: One Last Kill', 2026],
  wonderman: ['tv', 'Wonder Man', 2026],
  quarteto: ['movie', 'The Fantastic Four: First Steps', 2025],
  aranha4: ['movie', 'Spider-Man: Brand New Day', 2026],
  visionquest: ['tv', 'VisionQuest', 2026],
  inumanos: ['tv', "Marvel's Inhumans", 2017],
  fugitivos: ['tv', "Marvel's Runaways", 2017],
  'manto-adaga': ['tv', "Marvel's Cloak & Dagger", 2018],
  shield67: ['tv', "Marvel's Agents of S.H.I.E.L.D.", 2013, 6],
  helstrom: ['tv', 'Helstrom', 2020],
  dd03: ['movie', 'Daredevil', 2003],
  venom1: ['movie', 'Venom', 2018],
  venom2: ['movie', 'Venom: Let There Be Carnage', 2021],
  morbius: ['movie', 'Morbius', 2022],
  'madame-teia': ['movie', 'Madame Web', 2024],
  venom3: ['movie', 'Venom: The Last Dance', 2024],
  kraven: ['movie', 'Kraven the Hunter', 2024],
  'xmen-tas': ['tv', 'X-Men', 1992],
  xmen97: ['tv', "X-Men '97", 2024],
  aranhaverso1: ['movie', 'Spider-Man: Into the Spider-Verse', 2018],
  aranhaverso2: ['movie', 'Spider-Man: Across the Spider-Verse', 2023],
  amigao: ['tv', 'Your Friendly Neighborhood Spider-Man', 2025],
  hulk03: ['movie', 'Hulk', 2003],
  pun04: ['movie', 'The Punisher', 2004],
  gr07: ['movie', 'Ghost Rider', 2007],
  pun08: ['movie', 'Punisher: War Zone', 2008],
  gr12: ['movie', 'Ghost Rider: Spirit of Vengeance', 2012],
  legion: ['tv', 'Legion', 2017],
  gifted: ['tv', 'The Gifted', 2017],
  ff94: ['tv', 2901], aranha94: ['tv', 888], hulk96: ['tv', 6332], surfista98: ['tv', 1130], 'aranha-ilimitado': ['tv', 10079],
  'xmen-evolution': ['tv', 668], 'ff-wgh': ['tv', 132], espetacular: ['tv', 3854], 'wolverine-xmen': ['tv', 6549],
  'hdf-armored': ['tv', 7330], esquadrao: ['tv', 21781], emh: ['tv', 33623], 'marvel-anime': ['tv', 45418], ultimate: ['tv', 34391],
  'vingadores-unidos': ['tv', 59427], 'hulk-smash': ['tv', 40044], 'gotg-anim': ['tv', 63181], aranha2017: ['tv', 72705],
  modok: ['tv', 111312], 'hit-monkey': ['tv', 133903],
  supremos1: ['movie', 'Ultimate Avengers', 2006], supremos2: ['movie', 14611], 'hdf-invencivel': ['movie', 13647], estranho07: ['movie', 14830],
  'novos-vingadores': ['movie', 14613], 'hulk-wolverine': ['movie', 15257], 'hulk-thor': ['movie', 101907], 'planeta-hulk': ['movie', 30675],
  'thor-asgard': ['movie', 63686], 'ferro-hulk': ['movie', 230896], 'ferro-cap': ['movie', 284274], 'hulk-monstros': ['movie', 422153],
  rising: ['movie', 491633],
  doomsday: ['movie', 'Avengers: Doomsday', 2026],
  x1: ['movie', 'X-Men', 2000],
  x2: ['movie', 'X2', 2003],
  x3: ['movie', 'X-Men: The Last Stand', 2006],
  xo: ['movie', 'X-Men Origins: Wolverine', 2009],
  xfc: ['movie', 'X-Men: First Class', 2011],
  wolv2: ['movie', 'The Wolverine', 2013],
  xdofp: ['movie', 'X-Men: Days of Future Past', 2014],
  dp1: ['movie', 'Deadpool', 2016],
  xapoc: ['movie', 'X-Men: Apocalypse', 2016],
  logan: ['movie', 'Logan', 2017],
  dp2: ['movie', 'Deadpool 2', 2018],
  xdp: ['movie', 'Dark Phoenix', 2019],
  novos: ['movie', 'The New Mutants', 2020],
  sm1: ['movie', 'Spider-Man', 2002],
  sm2: ['movie', 'Spider-Man 2', 2004],
  sm3: ['movie', 'Spider-Man 3', 2007],
  asm1: ['movie', 'The Amazing Spider-Man', 2012],
  asm2: ['movie', 'The Amazing Spider-Man 2', 2014],
  blade1: ['movie', 'Blade', 1998],
  blade2: ['movie', 'Blade II', 2002],
  blade3: ['movie', 'Blade: Trinity', 2004],
  elektra: ['movie', 'Elektra', 2005],
  ff05: ['movie', 'Fantastic Four', 2005],
  ff07: ['movie', 'Fantastic Four: Rise of the Silver Surfer', 2007],
  ff15: ['movie', 'Fantastic Four', 2015],
};

async function tmdb(path, params = {}) {
  const url = new URL('https://api.themoviedb.org/3' + path);
  for (const [k, v] of Object.entries({ language: 'pt-BR', ...params })) if (v !== undefined) url.searchParams.set(k, String(v));
  if (!TOKEN) url.searchParams.set('api_key', KEY);
  const res = await fetch(url, { headers: TOKEN ? { Authorization: `Bearer ${TOKEN}`, accept: 'application/json' } : { accept: 'application/json' } });
  if (res.status === 401) throw new Error('A chave do TMDB foi recusada. Confira o valor no .env.local.');
  if (!res.ok) throw new Error(`TMDB respondeu ${res.status} em ${path}`);
  return res.json();
}

const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

async function find(type, title, year) {
  // Número = id do próprio TMDB: vai direto, sem depender da busca pelo nome
  if (typeof title === 'number') return tmdb(`/${type}/${title}`).catch(() => null);
  const yearKey = type === 'movie' ? 'year' : 'first_air_date_year';
  let { results } = await tmdb(`/search/${type}`, { query: title, [yearKey]: year });
  if (!results?.length) ({ results } = await tmdb(`/search/${type}`, { query: title }));
  if (!results?.length) return null;
  const exact = results.find(r => norm(r.original_title || r.original_name || '') === norm(title));
  return exact || results[0];
}

// Próximo grande filme depois de Doomsday (a contagem troca pra ele na estreia).
Q.secretwars = ['movie', 'Avengers: Secret Wars', 2027];
// Lançamentos que aparecem na faixa "Lançamentos" e ainda não estão na lista de títulos
Q.aranhaverso3 = ['movie', 911916];
Q.xmen2028 = ['movie', 1293690];
Q.gr2028 = ['movie', 1738010];
Q.bp3 = ['movie', 1386618];
Q.ddr3 = ['tv', 'Daredevil: Born Again', 2025, 3];

// Temporadas de cada série, pra marcar episódio por episódio.
// Número = temporada da própria série; [título, ano, temporada, rótulo] = temporada de outra série (pacotes).
const SEASONS = {
  'olhos-wakanda': [1], 'agent-carter': [1, 2], shield1: [1], groot: [1, 2], shield2: [2], dd1: [1], jj: [1],
  dd2: [2], shield35: [3, 4, 5], loki1: [1], whatif1: [1], wandavision: [1], falcao: [1], gaviao: [1], eco: [1],
  cavaleiro: [1], msmarvel: [1], mulherhulk: [1], invasao: [1], loki2: [2], whatif23: [2, 3], zombies: [1],
  agatha: [1], ironheart: [1], ddr1: [1], ddr2: [2], wonderman: [1], visionquest: [1],
  inumanos: [1], fugitivos: [1, 2, 3], 'manto-adaga': [1, 2], shield67: [6, 7], helstrom: [1],
  'xmen-tas': [1, 2, 3, 4, 5], xmen97: [1, 2], amigao: [1, 2], legion: [1, 2, 3], gifted: [1, 2],
  ff94: [1, 2], aranha94: [1, 2, 3, 4, 5], hulk96: [1, 2], surfista98: [1], 'aranha-ilimitado': [1], 'xmen-evolution': [1, 2, 3, 4],
  'ff-wgh': [1], espetacular: [1, 2], 'wolverine-xmen': [1], 'hdf-armored': [1, 2], esquadrao: [1, 2], emh: [1, 2],
  ultimate: [1, 2, 3, 4], 'vingadores-unidos': [1, 2, 3, 4, 5], 'hulk-smash': [1, 2], 'gotg-anim': [1, 2, 3], aranha2017: [1, 2, 3],
  modok: [1], 'hit-monkey': [1, 2],
  'marvel-anime': [[45418, 2010, 1, 'Homem de Ferro'], [38247, 2011, 1, 'Wolverine'], [43146, 2011, 1, 'X-Men'], [62798, 2011, 1, 'Blade']],
  lc1: [1], if1: [1], defensores: [1], pun1: [1], jj2: [2], lc2: [2], if2: [2], dd3: [3], pun2: [2], jj3: [3],
};

/** Onde assistir no Brasil: assinatura, grátis, aluguel e compra (dados da JustWatch via TMDB). */
async function providers(type, id) {
  const r = await tmdb(`/${type}/${id}/watch/providers`, { language: undefined }).catch(() => null);
  const br = r?.results?.BR;
  if (!br) return null;
  const pick = list => (list || []).sort((a, b) => a.display_priority - b.display_priority).map(p => [p.provider_name, p.logo_path]);
  const out = { link: br.link };
  const s = [...pick(br.flatrate), ...pick(br.free), ...pick(br.ads)];
  if (s.length) out.s = s.filter((p, i) => s.findIndex(q => q[0] === p[0]) === i);
  if (br.rent?.length) out.r = pick(br.rent);
  if (br.buy?.length) out.b = pick(br.buy);
  return out.s || out.r || out.b ? out : null;
}

async function episodes(showId, season) {
  const s = await tmdb(`/tv/${showId}/season/${season}`).catch(() => null);
  return (s?.episodes || []).map(e => [e.name || `Episódio ${e.episode_number}`, e.runtime || null]);
}

/** Trailer oficial no YouTube: em português (dublado ou legendado) quando existe; senão, o original. */
async function trailer(type, id, season) {
  const base = season ? `/tv/${id}/season/${season}/videos` : `/${type}/${id}/videos`;
  for (const lang of ['pt-BR', 'en-US']) {
    const r = await tmdb(base, { language: lang }).catch(() => null);
    const vids = (r?.results || []).filter(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'));
    vids.sort((a, b) => (b.type === 'Trailer') - (a.type === 'Trailer') || (b.official === true) - (a.official === true)
      || (b.size || 0) - (a.size || 0) || String(b.published_at).localeCompare(String(a.published_at)));
    if (vids[0]) return vids[0].key;
  }
  // Temporada sem trailer próprio: usa o da série
  return season ? trailer(type, id) : null;
}

// Só os trailers: node scripts/fetch-posters.mjs --trailers (não mexe nos cartazes nem no resto dos detalhes)
if (process.argv.includes('--trailers')) {
  const det = JSON.parse(readFileSync('src/details.json', 'utf8'));
  let n = 0;
  for (const [id, [type, title, year, season]] of Object.entries(Q)) {
    try {
      const hit = await find(type, title, year);
      if (!hit) { console.log('sem ', id, '(não encontrado)'); continue; }
      const key = await trailer(type, hit.id, season);
      if (key) { (det[id] ||= {}).tr = key; n++; console.log('ok  ', id.padEnd(16), key); } else console.log('sem ', id);
    } catch (e) { console.error(id, e.message); }
  }
  writeFileSync('src/details.json', JSON.stringify(det) + '\n');
  console.log(`\n${n} trailers salvos em src/details.json.`);
  process.exit(0);
}

const out = {};
const backs = {};
const details = {};
const missing = [];
for (const [id, [type, title, year, season]] of Object.entries(Q)) {
  try {
    const hit = await find(type, title, year);
    if (!hit) { missing.push(`${id} (${title}): não encontrado`); continue; }
    let path = hit.poster_path;
    let overview = '';
    if (season) {
      const s = await tmdb(`/tv/${hit.id}/season/${season}`).catch(() => null);
      if (s?.poster_path) path = s.poster_path;
      overview = s?.overview || '';
    }
    if (path) out[id] = path; else missing.push(`${id} (${title}): sem cartaz ainda`);
    if (hit.backdrop_path) backs[id] = hit.backdrop_path;

    // Sinopse em português; sem ela, em inglês.
    overview ||= hit.overview || '';
    if (!overview) overview = (await tmdb(`/${type}/${hit.id}`, { language: 'en-US' }).catch(() => null))?.overview || '';
    const d = { ov: overview };
    const prov = await providers(type, hit.id);
    if (prov) d.prov = prov;
    const tr = await trailer(type, hit.id, season);
    if (tr) d.tr = tr;

    if (SEASONS[id]) {
      d.seasons = [];
      for (const sn of SEASONS[id]) {
        if (typeof sn === 'number') {
          const eps = await episodes(hit.id, sn);
          if (eps.length) d.seasons.push({ label: `Temporada ${sn}`, eps });
        }
        else {
          const other = await find('tv', sn[0], sn[1]);
          if (other) d.seasons.push({ label: sn[3], eps: await episodes(other.id, sn[2]) });
        }
      }
    }
    details[id] = d;
    const eps = d.seasons ? ` · ${d.seasons.reduce((a, s) => a + s.eps.length, 0)} episódios` : '';
    console.log(`${path ? 'ok  ' : 'sem '} ${id.padEnd(14)} ${hit.title || hit.name}${d.prov?.s ? ' · ' + d.prov.s.map(p => p[0]).join(', ') : ''}${eps}`);
  } catch (e) {
    console.error(e.message);
    if (/recusada/.test(e.message)) process.exit(1);
    missing.push(`${id} (${title}): erro`);
  }
}

writeFileSync('src/posters.json', JSON.stringify(out, null, 2) + '\n');
writeFileSync('src/backdrops.json', JSON.stringify(backs, null, 2) + '\n');
writeFileSync('src/details.json', JSON.stringify(details) + '\n');
console.log(`\n${Object.keys(out).length} cartazes salvos em src/posters.json, sinopses e onde assistir em src/details.json.`);
if (missing.length) console.log('Ficam com a ilustração gerada:\n  ' + missing.join('\n  '));
