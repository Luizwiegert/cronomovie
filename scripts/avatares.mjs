// Prepara as fotos de perfil: lê avatares/lista.json, recorta cada imagem da pasta avatares/
// em quadrado, tira a borda das que já vêm em círculo e grava em public/avatars/<id>.webp.
// Também gera src/avatars.json, que o site usa pra montar a lista.
// Rode depois de adicionar ou trocar uma foto: npm run avatares
//
// Cada linha da lista: "personagem" é a seção em que a foto aparece (ex.: "Homem-Aranha") e "variacao",
// opcional, é o nome daquela versão (ex.: "Traje preto"). "grupo" é "heroi" ou "vilao".
// "equipe" é a fileira em que o personagem aparece no seletor (ex.: "Vingadores", "X-Men", "Vilões").

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const LISTA = JSON.parse(readFileSync('avatares/lista.json', 'utf8'));
const OUT = 'public/avatars';
const SIZE = 384;
mkdirSync(OUT, { recursive: true });

const ids = new Set();
const usados = new Set();
const saida = [];

for (const a of LISTA) {
  const src = `avatares/${a.arquivo}`;
  const nome = a.variacao ? `${a.personagem}: ${a.variacao}` : a.personagem;
  if (!existsSync(src)) { console.log(`falta  ${a.arquivo} (${nome})`); continue; }
  if (ids.has(a.id)) { console.log(`repetido  id ${a.id}`); continue; }
  ids.add(a.id); usados.add(a.arquivo);

  const img = sharp(src).rotate();
  const { width: w, height: h } = await img.metadata();
  const side = Math.min(w, h);
  const left = Math.round((w - side) / 2);
  const top = h > w ? Math.round((h - side) * (a.topo ?? 0.5)) : Math.round((h - side) / 2);
  // Imagens que já vêm em círculo têm borda (branca ou preta) nos cantos: corta 10% em volta
  // (ou quanto a lista pedir, ex.: "circulo": 0.85).
  const keep = a.circulo === true ? 0.9 : typeof a.circulo === 'number' ? a.circulo : 1;
  const inner = Math.round(side * keep);
  const pad = Math.round((side - inner) / 2);
  // Corte escolhido à mão pra imagens de corpo inteiro: "recorte": [esquerda, topo, tamanho],
  // em frações da imagem (ex.: [0.22, 0.05, 0.56] pega um quadrado de 56% começando em 22% / 5%).
  const box = Array.isArray(a.recorte)
    ? { left: Math.round(w * a.recorte[0]), top: Math.round(h * a.recorte[1]), width: Math.round(side * a.recorte[2]), height: Math.round(side * a.recorte[2]) }
    : { left: left + pad, top: top + pad, width: inner, height: inner };

  await sharp(src).rotate()
    .extract(box)
    .resize(SIZE, SIZE, { fit: 'cover' })
    .webp({ quality: 82 })
    .toFile(`${OUT}/${a.id}.webp`);
  saida.push({ id: a.id, name: nome, char: a.personagem, ...(a.variacao ? { variant: a.variacao } : {}), group: a.grupo === 'vilao' ? 'vilao' : 'heroi', team: a.equipe || (a.grupo === 'vilao' ? 'Vilões' : 'Outros heróis') });
  console.log(`ok     ${a.id.padEnd(22)} ${nome}`);
}

writeFileSync('src/avatars.json', JSON.stringify(saida, null, 2) + '\n');

const sobrando = readdirSync('avatares').filter(f => /\.(jpe?g|png|webp|avif)$/i.test(f) && !usados.has(f));
console.log(`\n${saida.length} fotos prontas em ${OUT}/.`);
if (sobrando.length) console.log('Imagens na pasta que ainda não estão em avatares/lista.json:\n  ' + sobrando.join('\n  '));
