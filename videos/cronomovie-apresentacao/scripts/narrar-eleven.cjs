// Gera a narração no ElevenLabs, frase por frase, com a frase anterior e a seguinte como contexto
// (a entonação fica contínua, como se fosse uma leitura só). Saída: assets/voz/<pasta>/NN.mp3 + NN.json
// Uso: node scripts/narrar-eleven.cjs <voice_id> <pasta>
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const [voice = 'RGymW84CSmfVugnA5tvA', pasta = 'roberta2'] = process.argv.slice(2);
const DIR = path.join(__dirname, '..', 'assets', 'voz', pasta);
fs.mkdirSync(DIR, { recursive: true });

// "Crono múvi": grafia só para a voz pronunciar a marca como "movie" em inglês
// Roteiro 2 (15/10): abre com a pergunta do gancho, sem a marca no começo; só frases completas
// (frases soltas terminadas em vírgula soaram cortadas, e "sem spoiler" saiu atropelado)
const FALAS = [
  ['00', 'Em que ordem assistir à Marvel antes de Doutor Destino?'],
  ['02', 'Cento e sessenta e dois títulos, todos na ordem certa.'],
  ['03', 'Tudo num lugar só.'],
  ['04', 'Marque o que você já viu.'],
  ['06', 'E veja só o que leva a Doutor Destino.'],
  ['07', 'Episódio por episódio.'],
  ['08', 'Veja o trailer e onde assistir.'],
  ['09', 'Compare o seu progresso com os amigos.'],
  ['10', 'Comentário com spoiler fica escondido.'],
  ['11', 'E mostre a sua maratona.'],
  ['12', 'Faltam sessenta e dois dias.'],
  ['13', 'Crono múvi ponto com. É grátis.'],
];
FALAS.forEach(([n, texto], i) => {
  const out = path.join(DIR, n + '.mp3');
  if (fs.existsSync(out)) { console.log('já existe', n); return; }
  const prev = i > 0 ? FALAS[i - 1][1] : '';
  const next = i < FALAS.length - 1 ? FALAS[i + 1][1] : '';
  const r = execFileSync('node', [path.join(__dirname, 'eleven.cjs'), 'fala', voice, out, texto, prev, next], { encoding: 'utf8' });
  process.stdout.write(n + ' ' + r);
});
