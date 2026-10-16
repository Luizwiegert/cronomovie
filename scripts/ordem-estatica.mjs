// Gera a versão em texto do Cronomovie, para quem lê o site sem rodar JavaScript
// (ChatGPT e outros assistentes de IA, buscadores, leitores de tela antes do app abrir).
// Usa os mesmos dados do app (src/data.ts e src/details.json), então nunca fica desatualizada. Roda antes de cada build.
//  - index.html: a lista vai escondida (classe .sr) dentro de <main id="view">; o app troca esse conteúdo ao abrir
//  - public/ordem-cronologica-marvel.html: página própria, visível, com a mesma lista
//  - public/titulo/<id>.html: uma página por título (posição, sinopse, onde assistir, trailer, episódios, antes e depois)
//  - public/llms-full.txt: tudo em Markdown, para assistentes de IA
//  - public/sitemap.xml: o mapa do site com todas essas páginas
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { ITEMS, ERAS, GROUPS, KIND, TRILHA, DOOMSDAY, CRONO_TOTAL } = await import('../src/data.ts');
const DETAILS = JSON.parse(readFileSync(join(ROOT, 'src', 'details.json'), 'utf8'));
const POSTERS = JSON.parse(readFileSync(join(ROOT, 'src', 'posters.json'), 'utf8'));
const SITE = 'https://cronomovie.com';

// Revisão editorial da ordem: muda só quando a ordem for conferida de novo (não a cada build)
const REVISAO = { d: 16, m: 10, y: 2026 };
const FONTE = { nome: 'linha do tempo completa do Disney+, publicada pela Marvel em 2 de junho de 2026', url: 'https://www.marvel.com/articles/movies/mcu-timeline-order-disney-plus' };

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hoje = new Date();
const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataLonga = d => `${d.d} de ${MESES[d.m - 1]} de ${d.y}`;
const iso = d => `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
const url = it => `/titulo/${it.id}`;

const principal = ITEMS.filter(it => it.e <= 4);
const paralelos = ITEMS.filter(it => it.e === 5);
const essenciais = ITEMS.filter(it => it.star).length;
const naTrilha = ITEMS.filter(it => TRILHA.has(it.id)).length;
const grupoDe = it => GROUPS.find(g => g.key === it.g);

// mesma regra do app (src/util.ts, dur)
function duracao(it) {
  if (!it.m) return '';
  if (it.k !== 's') return it.m < 60 ? `${it.m} min` : `${Math.floor(it.m / 60)}h${String(it.m % 60).padStart(2, '0')}`;
  return `≈ ${Math.round(it.m / 60)}h`;
}
const quando = it => {
  const ano = it.r.slice(0, 4);
  return it.id === 'doomsday' ? `estreia em ${dataLonga(DOOMSDAY)}` : it.r > mesAtual ? `estreia em ${ano}` : ano;
};
// "filme, 2011 · essencial · Trilha Avengers · Se passa em 1943–45"
function detalhes(it) {
  const partes = [`${KIND[it.k].toLowerCase()}, ${quando(it)}`];
  if (it.star) partes.push('essencial');
  if (TRILHA.has(it.id)) partes.push('Trilha Avengers');
  if (it.n) partes.push(it.n);
  return partes.join(' · ');
}

const resumo = `São ${ITEMS.length} títulos da Marvel no total: ${CRONO_TOTAL - 1} na linha principal antes de Vingadores: Doutor Destino (Avengers: Doomsday), o próprio filme, que estreia nos cinemas do Brasil em ${dataLonga(DOOMSDAY)}, e ${paralelos.length} em universos paralelos (X-Men da Fox, Homem-Aranha da Sony, animações e adaptações independentes). Os ${essenciais} marcados como essenciais são os que não dá para pular. A Trilha Avengers reúne os ${naTrilha} títulos que levam a Doutor Destino.`;
const H1 = 'Ordem cronológica da Marvel: todos os filmes e séries até Vingadores: Doutor Destino';
const comoUsar = 'No Cronomovie você marca o que já viu, vê o próximo título da ordem, liga a Trilha Avengers para ficar só com o essencial, confere onde assistir no Brasil e compara o progresso com os amigos. É grátis.';
const criterio = `A linha principal segue a ${FONTE.nome}, com as séries separadas por temporada. Os títulos que a lista oficial não inclui (as séries da Marvel Television, como Agents of S.H.I.E.L.D. e Agent Carter) ficam na época em que a história se passa, e Helstrom, que fica fora da continuidade do MCU, está nos universos paralelos. Séries que atravessam vários anos têm uma nota quando começam ou terminam em outra época, e as cenas pós-créditos que se passam em outro momento vêm indicadas no título.`;
const revisao = `Ordem revisada em ${dataLonga(REVISAO)}.`;

// O que o site faz depois do login: as IAs e os buscadores não entram em contas, então isto fica descrito em texto
const FUNCIONA = [
  ['Sem conta', 'Qualquer pessoa consulta a ordem completa, busca títulos, filtra por saga e por tipo (filmes, séries, essenciais) e abre a página de cada título. O que for marcado sem conta fica guardado só naquela visita e entra na conta se a pessoa criar uma.'],
  ['Conta grátis', 'Dá para entrar com o Google, com o Discord ou com e-mail e senha. O progresso fica salvo e aparece igual no celular e no computador.'],
  ['Marcar o que já viu', 'Cada cartaz tem um botão de visto, e o topo da linha do tempo mostra o próximo título da ordem, com tipo, duração e se é essencial, e o botão "Marcar como visto". Nas séries, dá para marcar episódio por episódio ou a temporada inteira. Cada título aceita nota de 1 a 5, um comentário curto e as listas "quero ver" e "assistindo".'],
  ['Progresso', `Uma barra mostra quantos dos ${CRONO_TOTAL - 1} títulos da linha principal a pessoa já viu, quantos dos ${essenciais} essenciais, quantas horas de Marvel isso soma e quantas horas de Trilha Avengers faltam até Doutor Destino, com a conta de quanto dá por dia.`],
  ['Trilha Avengers', `Um interruptor deixa na tela só os ${naTrilha} títulos que levam a Vingadores: Doutor Destino, para quem quer maratonar sem se perder.`],
  ['Página de cada título', 'Mostra a sinopse, o trailer, onde assistir no Brasil (dados de streaming do JustWatch), a lista de episódios das séries, a nota dos amigos e os comentários. Comentário com spoiler de algo que a pessoa ainda não viu aparece escondido até ela tocar.'],
  ['Amigos', 'A amizade funciona por pedido e aceite. Dá para buscar pessoas pelo nome ou pelo @, ver a atividade dos amigos e bloquear alguém. O que a pessoa assiste fica visível só para os amigos dela; para os outros, o perfil mostra apenas foto, nome, @, filme favorito e amigos em comum.'],
  ['Ranking', 'Compara a pessoa com os amigos em três critérios: títulos vistos, essenciais vistos e horas assistidas.'],
  ['Lançamentos', 'A contagem regressiva mostra os próximos lançamentos da Marvel, com botão para salvar o lembrete na agenda do celular ou no Google Agenda.'],
  ['No celular', 'O site pode ser instalado como aplicativo na tela inicial e avisa sobre pedidos de amizade e curtidas. Também gera um cartão da maratona para compartilhar nos Stories.'],
];
const PERGUNTAS = [
  ['Qual a ordem certa para assistir à Marvel?', `A que segue a linha do tempo oficial do Disney+, publicada pela Marvel, com as séries por temporada. O Cronomovie usa essa ordem na linha principal, das histórias do passado (como Capitão América: O Primeiro Vingador, que se passa nos anos 1940) até Vingadores: Doutor Destino.`],
  ['O que ver antes de Vingadores: Doutor Destino?', `Os ${essenciais} títulos marcados como essenciais são os que não dá para pular. Para uma maratona mais completa, a Trilha Avengers reúne ${naTrilha} títulos.`],
  ['O Cronomovie é grátis?', 'Sim. O site é gratuito e é um projeto de fãs, sem ligação com a Marvel ou a Disney.'],
  ['Precisa criar conta?', 'Não para consultar a ordem. A conta grátis serve para salvar o que já viu, ver o progresso e comparar com os amigos.'],
];

// ---------- pedaços de HTML ----------
function listaHTML(nivel = 2) {
  const h = `h${nivel}`, li = it => `<li><a href="${url(it)}"><b>${esc(it.t)}</b></a>: ${esc(detalhes(it))}</li>`;
  let out = '';
  ERAS.slice(0, 5).forEach((era, e) => {
    const its = principal.filter(it => it.e === e);
    out += `<${h}>${e + 1}. ${esc(era.name)}</${h}>\n<ol start="${its[0].num}">\n` + its.map(li).join('\n') + '\n</ol>\n';
  });
  out += `<${h}>Universos paralelos</${h}>\n<p>Histórias fora da linha principal. Assista quando quiser; a dica de cada grupo diz onde elas se encaixam.</p>\n`;
  GROUPS.forEach(g => {
    const its = paralelos.filter(it => it.g === g.key);
    if (its.length) out += `<h${nivel + 1}>${esc(g.name)}</h${nivel + 1}>\n<p>${esc(g.hint)}.</p>\n<ul>\n` + its.map(li).join('\n') + '\n</ul>\n';
  });
  return out;
}
function funcionaHTML(nivel = 2) {
  return `<h${nivel}>Como funciona o Cronomovie</h${nivel}>\n` + FUNCIONA.map(([t, d]) => `<h${nivel + 1}>${esc(t)}</h${nivel + 1}>\n<p>${esc(d)}</p>`).join('\n') + '\n'
    + `<h${nivel}>Perguntas frequentes</h${nivel}>\n` + PERGUNTAS.map(([q, a]) => `<h${nivel + 1}>${esc(q)}</h${nivel + 1}>\n<p>${esc(a)}</p>`).join('\n') + '\n';
}
const criterioHTML = `<p>${esc(criterio)}</p>\n<p>${esc(revisao)} Fonte: <a href="${FONTE.url}">${esc(FONTE.nome)}</a>.</p>`;
const ld = o => JSON.stringify(o).replace(/</g, '\\u003c');
const faqLD = ld({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: PERGUNTAS.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });

const MARCA = '<svg class="mark" viewBox="0 0 64 32" aria-hidden="true"><line x1="8" y1="16" x2="48" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".42"/><circle cx="8" cy="16" r="4" fill="currentColor"/><circle cx="24" cy="16" r="4" fill="currentColor"/><circle cx="48" cy="16" r="11" fill="#E5484D"/></svg>';
function paginaHTML({ title, desc, path, img, ogType = 'article', head = '', corpo, rodape = '' }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#0B0B0C">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(title.replace(/ · Cronomovie$/, ''))}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:image" content="${img || `${SITE}/og.png`}">
<meta property="og:locale" content="pt_BR">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..700&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@900&display=block" rel="stylesheet">
<link rel="stylesheet" href="/legal.css">
${head}<style>
main ol, main ul { padding-left: 1.4em; }
main li { margin: .45em 0; }
.cta { display: inline-block; margin: 8px 0 4px; padding: 12px 20px; border-radius: 999px; background: #E5484D; color: #fff; font-weight: 700; text-decoration: none; }
.crumb { font-size: 14px; opacity: .72; margin: 0 0 18px; }
.ficha { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 22px; align-items: start; margin-bottom: 8px; }
.ficha img { width: 150px; height: 225px; object-fit: cover; border-radius: 12px; display: block; }
.ficha h1 { margin-top: 0; }
.meta { font-weight: 600; }
.selo { display: inline-block; margin: 0 6px 6px 0; padding: 3px 10px; border-radius: 999px; font-size: 13px; font-weight: 700; background: rgba(229, 72, 77, .14); color: #F2F1EE; border: 1px solid rgba(229, 72, 77, .5); }
.fonte { font-size: 13px; opacity: .7; }
.vizinhos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 520px) { .ficha { grid-template-columns: 96px minmax(0, 1fr); gap: 16px; } .ficha img { width: 96px; height: 144px; } .vizinhos { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<header class="top"><a class="brand" href="/" aria-label="Cronomovie, início">${MARCA}<span class="wordmark">Crono<span>movie</span></span></a><a class="back" href="/">Abrir o Cronomovie</a></header>
<main>
${corpo}</main>
<footer>Cronomovie é um projeto de fãs, sem ligação com a Marvel ou a Disney. Os nomes, personagens e cartazes pertencem aos seus donos.${rodape} <a href="/privacidade.html">Política de privacidade</a></footer>
</body>
</html>
`;
}

// ---------- 1. página inicial: bloco escondido entre os marcadores, dentro de <main id="view"> ----------
const blocoInicio = `<!-- ordem:inicio (gerado por scripts/ordem-estatica.mjs; o app troca este conteúdo ao abrir) -->
      <section class="sr">
<h1>${esc(H1)}</h1>
<p>${esc(resumo)}</p>
<p>${esc(comoUsar)} Versão em texto: <a href="/ordem-cronologica-marvel">ordem cronológica da Marvel</a>.</p>
${criterioHTML}
${funcionaHTML(2)}<h2>A ordem completa</h2>
${listaHTML(3)}      </section>
      <!-- ordem:fim -->`;
const idxPath = join(ROOT, 'index.html');
let idx = readFileSync(idxPath, 'utf8');
const nl = idx.includes('\r\n') ? '\r\n' : '\n';
const bloco = blocoInicio.replace(/\r?\n/g, nl);
if (idx.includes('<!-- ordem:inicio')) {
  idx = idx.replace(/<!-- ordem:inicio[\s\S]*?<!-- ordem:fim -->/, () => bloco);
} else {
  const alvo = '<main id="view"><div class="empty"><p>Carregando</p></div>';
  if (!idx.includes(alvo)) throw new Error('não achei <main id="view"> no index.html');
  idx = idx.replace(alvo, () => `${alvo}${nl}      ${bloco}${nl}      `);
}
writeFileSync(idxPath, idx);

// ---------- 2. página da ordem ----------
writeFileSync(join(ROOT, 'public', 'ordem-cronologica-marvel.html'), paginaHTML({
  title: 'Ordem cronológica da Marvel até Doutor Destino · Cronomovie',
  desc: `A ordem cronológica completa da Marvel: ${ITEMS.length} filmes e séries na ordem oficial do Disney+, com os ${essenciais} essenciais para Vingadores: Doutor Destino.`,
  path: '/ordem-cronologica-marvel',
  head: `<script type="application/ld+json">${faqLD}</script>\n`,
  corpo: `<h1>${esc(H1)}</h1>
<p class="when">${esc(revisao)}</p>
<p>${esc(resumo)}</p>
<p>${esc(comoUsar)}</p>
${criterioHTML}
<p><a class="cta" href="/">Marcar o que já vi</a></p>
${listaHTML(2)}${funcionaHTML(2)}`,
}));

// ---------- 3. uma página por título ----------
const NOISE = /with ads|amazon channel|standard with ads|basic with ads|claro tv\+/i;
const NOMES = { 'Disney Plus': 'Disney+', 'Amazon Prime Video': 'Prime Video' };
const servicos = list => [...new Set((list || []).filter(([n]) => !NOISE.test(n)).map(([n]) => NOMES[n] || n))].slice(0, 6);
const poster = (it, size = 'w342') => (POSTERS[it.id] ? `https://image.tmdb.org/t/p/${size}${POSTERS[it.id]}` : null);
const mesAno = it => { const [y, m] = it.r.split('-').map(Number); return `${MESES[m - 1]} de ${y}`; };

// vizinhos: na linha principal, a ordem cronológica; nos universos paralelos, a ordem dentro do grupo
const seqDe = it => (it.e <= 4 ? principal : paralelos.filter(x => x.g === it.g));
rmSync(join(ROOT, 'public', 'titulo'), { recursive: true, force: true });
mkdirSync(join(ROOT, 'public', 'titulo'), { recursive: true });
for (const it of ITEMS) {
  const d = DETAILS[it.id] || {}, seq = seqDe(it), k = seq.indexOf(it);
  const antes = seq[k - 1], depois = seq[k + 1];
  const g = grupoDe(it), era = it.e <= 4 ? ERAS[it.e] : null;
  const tipo = KIND[it.k], lanc = it.id === 'doomsday' ? `estreia em ${dataLonga(DOOMSDAY)}` : it.r > mesAtual ? `estreia em ${mesAno(it)}` : `lançado em ${mesAno(it)}`;
  const posicao = it.e <= 4
    ? `${it.num}º de ${CRONO_TOTAL} na ordem cronológica da Marvel (parte ${it.e + 1}, ${era.name})`
    : `Universo paralelo, no grupo ${g.name}. ${g.hint}.`;
  const selos = [it.star ? 'Essencial' : '', TRILHA.has(it.id) ? 'Trilha Avengers' : '', it.opt ? 'Opcional' : ''].filter(Boolean);
  const assin = servicos(d.prov?.s), alug = servicos(d.prov?.r), compra = servicos(d.prov?.b);
  const onde = assin.length || alug.length || compra.length
    ? [assin.length ? `<p><b>Assinatura:</b> ${esc(assin.join(', '))}</p>` : '', alug.length ? `<p><b>Aluguel:</b> ${esc(alug.join(', '))}</p>` : '', compra.length ? `<p><b>Compra:</b> ${esc(compra.join(', '))}</p>` : ''].join('\n')
    : '<p>Ainda sem opção de streaming no Brasil.</p>';
  const eps = (d.seasons || []).map(s => `<h3>${esc(s.label)}</h3>\n<ol>\n${s.eps.map(([n, min]) => `<li>${esc(n)}${min ? ` (${min} min)` : ''}</li>`).join('\n')}\n</ol>`).join('\n');
  const img = poster(it), imgG = poster(it, 'w500');
  const desc = `${it.t} (${tipo.toLowerCase()}, ${it.r.slice(0, 4)}): ${it.e <= 4 ? `${it.num}º título na ordem cronológica da Marvel` : `universo paralelo (${g.name})`}. Veja o que vem antes e depois, onde assistir no Brasil${d.tr ? ' e o trailer' : ''}.`;
  const tituloLD = ld({
    '@context': 'https://schema.org', '@type': it.k === 's' ? 'TVSeries' : 'Movie', name: it.t, url: `${SITE}${url(it)}`,
    ...(it.r <= mesAtual ? { datePublished: it.r } : {}), ...(img ? { image: imgG } : {}), ...(d.ov ? { description: d.ov } : {}),
  });
  const trilhaLD = ld({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Cronomovie', item: `${SITE}/` },
    { '@type': 'ListItem', position: 2, name: 'Ordem cronológica da Marvel', item: `${SITE}/ordem-cronologica-marvel` },
    { '@type': 'ListItem', position: 3, name: it.t, item: `${SITE}${url(it)}` },
  ] });
  const vizinho = (x, rot) => (x ? `<p><span class="fonte">${rot}</span><br><a href="${url(x)}"><b>${esc(x.t)}</b></a></p>` : `<p><span class="fonte">${rot}</span><br>${it.e <= 4 && rot === 'Depois' ? 'Fim da linha principal' : '—'}</p>`);
  const corpo = `<p class="crumb"><a href="/ordem-cronologica-marvel">Ordem cronológica da Marvel</a> › ${esc(era ? era.name : `Universos paralelos: ${g.name}`)}</p>
<div class="ficha">${img ? `<img src="${img}" alt="Cartaz de ${esc(it.t)}" width="150" height="225" loading="eager">` : ''}<div>
<h1>${esc(it.t)}</h1>
<p class="meta">${esc([tipo, lanc, duracao(it)].filter(Boolean).join(' · '))}</p>
<p>${selos.map(s => `<span class="selo">${esc(s)}</span>`).join('')}</p>
<p>${esc(posicao)}</p>
${it.n ? `<p><b>Nota:</b> ${esc(it.n)}</p>` : ''}
<p><a class="cta" href="/?t=${it.id}">Marcar como visto no Cronomovie</a></p>
</div></div>
${d.ov ? `<h2>Sinopse</h2>\n<p>${esc(d.ov)}</p>` : ''}
<h2>Onde assistir no Brasil</h2>
${onde}
${d.prov?.link ? `<p class="fonte">Dados de streaming: JustWatch. <a href="${esc(d.prov.link)}" rel="nofollow">Ver todas as opções</a></p>` : ''}
${d.tr ? `<h2>Trailer</h2>\n<p><a href="https://www.youtube.com/watch?v=${esc(d.tr)}" rel="nofollow">Assistir ao trailer no YouTube</a></p>` : ''}
${eps ? `<h2>Episódios</h2>\n${eps}` : ''}
<h2>${it.e <= 4 ? 'Na ordem cronológica' : 'No mesmo grupo'}</h2>
<div class="vizinhos">${vizinho(antes, 'Antes')}${vizinho(depois, 'Depois')}</div>
<p><a href="/ordem-cronologica-marvel">Ver a ordem completa</a></p>`;
  writeFileSync(join(ROOT, 'public', 'titulo', `${it.id}.html`), paginaHTML({
    title: `${it.t} na ordem cronológica da Marvel · Cronomovie`, desc, path: url(it), img: imgG, ogType: it.k === 's' ? 'video.tv_show' : 'video.movie',
    head: `<script type="application/ld+json">${tituloLD}</script>\n<script type="application/ld+json">${trilhaLD}</script>\n`,
    corpo, rodape: ' Sinopses e cartazes: TMDB (este site usa a API do TMDB, mas não é endossado nem certificado pelo TMDB).',
  }));
}

// ---------- 4. tudo em Markdown para assistentes de IA ----------
let md = `# Ordem cronológica da Marvel (Cronomovie)\n\n> ${resumo}\n\nFonte: ${SITE} (gerado em ${hoje.toISOString().slice(0, 10)}). ${comoUsar}\n\n## Critério da ordem\n\n${criterio}\n\n${revisao} Fonte: ${FONTE.nome} (${FONTE.url}).\n\n`;
md += `## Como funciona o Cronomovie\n\n` + FUNCIONA.map(([t, d]) => `- **${t}:** ${d}`).join('\n') + '\n\n';
md += `## Perguntas frequentes\n\n` + PERGUNTAS.map(([q, a]) => `**${q}** ${a}`).join('\n\n') + '\n\n';
md += `## A ordem completa\n\nCada título tem uma página com posição, sinopse, onde assistir, trailer e episódios (link ao lado).\n\n`;
ERAS.slice(0, 5).forEach((era, e) => {
  md += `### ${e + 1}. ${era.name}\n\n` + principal.filter(it => it.e === e).map(it => `${it.num}. ${it.t}: ${detalhes(it)} (${SITE}${url(it)})`).join('\n') + '\n\n';
});
md += `### Universos paralelos\n\n`;
GROUPS.forEach(g => {
  const its = paralelos.filter(it => it.g === g.key);
  if (its.length) md += `#### ${g.name}\n\n${g.hint}.\n\n` + its.map(it => `- ${it.t}: ${detalhes(it)} (${SITE}${url(it)})`).join('\n') + '\n\n';
});
writeFileSync(join(ROOT, 'public', 'llms-full.txt'), md.trimEnd() + '\n');

// ---------- 5. mapa do site ----------
const u = (loc, lastmod, pri, freq) => `  <url>\n    <loc>${SITE}${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n${freq ? `    <changefreq>${freq}</changefreq>\n` : ''}    <priority>${pri}</priority>\n  </url>`;
const rev = iso(REVISAO);
writeFileSync(join(ROOT, 'public', 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[u('/', rev, '1.0', 'weekly'), u('/ordem-cronologica-marvel', rev, '0.9', 'weekly'), ...ITEMS.map(it => u(url(it), rev, it.e <= 4 ? '0.7' : '0.5')),
  u('/privacidade.html', '2026-10-13', '0.3'), u('/termos.html', '2026-10-13', '0.3')].join('\n')}
</urlset>
`);

console.log(`ordem estática: ${principal.length} na linha principal, ${paralelos.length} em universos paralelos, ${ITEMS.length} páginas de título (página inicial, /ordem-cronologica-marvel, /titulo/*, llms-full.txt e sitemap.xml)`);
