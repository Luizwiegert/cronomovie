// Gera narrado.html: o mesmo vídeo do index.html com a narração por cima, os efeitos 30% mais baixos
// e a trilha abaixando sozinha enquanto a voz fala (assets/trilha/trilha-narrada.wav).
// Uso: node scripts/narrado.cjs [roberta2]
//      depois: npx hyperframes render -c narrado.html ... e apague narrado.html (o lint não aceita dois vídeos principais)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const VOZ = process.argv[2] || 'roberta2';
let s = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// [arquivo, início no vídeo (s)] — cada fala começa logo antes do texto ou da cena correspondente
const TEMPOS = {
  // ElevenLabs, voz Roberta, roteiro 2 (scripts/narrar-eleven.cjs), volume nivelado em assets/voz/roberta2-alta
  roberta2: [
    ['00', 0.12], // Em que ordem ver a Marvel antes de Doutor Destino?
    ['02', 3.45], // Cento e sessenta e dois títulos, todos na ordem certa.
    ['03', 8.3], // Tudo num lugar só.
    ['04', 10.0], // Marque o que você já viu.
    ['06', 12.5], // E veja só o que leva a Doutor Destino.
    ['07', 15.05], // Episódio por episódio.
    ['08', 17.05], // Veja o trailer e onde assistir.
    ['09', 19.4], // Compare o seu progresso com os amigos.
    ['10', 22.05], // Comentário com spoiler fica escondido.
    ['11', 24.4], // E mostre a sua maratona.
    ['12', 27.65], // Faltam sessenta e dois dias.
    ['13', 30.6], // Cronomovie ponto com. É grátis.
  ],
};
const PASTA = VOZ + '-alta';
const dur = f => Math.floor(parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' })) * 100) / 100;
const falas = TEMPOS[VOZ].map(([f, t]) => ({ src: `assets/voz/${PASTA}/${f}.wav`, t }));
falas.forEach((a, i) => {
  a.d = dur(path.join(ROOT, a.src));
  const b = falas[i + 1];
  if (b && a.t + a.d > b.t) console.warn(`aviso: a fala ${i + 1} termina em ${(a.t + a.d).toFixed(2)} s, depois do início da seguinte (${b.t} s)`);
});

// trilha abaixa 7 dB enquanto a voz fala (sobe 0,12 s antes de cada fala e volta em 0,3 s depois)
const rampa = a => `clip(min((t-${(a.t - 0.12).toFixed(2)})/0.12\\,(${(a.t + a.d + 0.3).toFixed(2)}-t)/0.3)\\,0\\,1)`;
const env = falas.map(rampa).reduce((x, y) => `max(${x}\\,${y})`);
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(ROOT, 'assets/trilha/trilha.wav'), '-af', `volume='1-0.55*${env}':eval=frame`,
  '-ar', '48000', path.join(ROOT, 'assets/trilha/trilha-narrada.wav')]);

s = s.replace('src="assets/trilha/trilha.wav"', 'src="assets/trilha/trilha-narrada.wav"');
s = s.replace(/(<audio id="s\d+"[^>]*data-volume=")([\d.]+)(")/g, (_, a, v, b) => a + (Math.round(parseFloat(v) * 0.7 * 100) / 100) + b);
const linhas = falas.map((a, i) =>
  `      <audio id="v${String(i + 1).padStart(2, '0')}" src="${a.src}" data-start="${a.t}" data-duration="${a.d}" data-track-index="6" data-volume="1"></audio>`).join('\n');
const marca = '<audio id="s42"';
const fim = s.indexOf('\n', s.indexOf(marca));
s = s.slice(0, fim + 1) + `      <!-- narração (${VOZ}) -->\n` + linhas + '\n' + s.slice(fim + 1);
s = s.replace('<title>Cronomovie: apresentação</title>', '<title>Cronomovie: apresentação (com narração)</title>');
fs.writeFileSync(path.join(ROOT, 'narrado.html'), s);
console.log('narrado.html pronto com', falas.length, 'falas de', VOZ, '+ trilha com ducking');
