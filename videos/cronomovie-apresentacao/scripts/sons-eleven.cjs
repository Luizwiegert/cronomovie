// Gera os efeitos sonoros no ElevenLabs (estilo limpo e moderno, como no reel da Amazon de referência).
// Cada som sai sem silêncio no começo (para cair no quadro certo) e com pico em -3 dB.
// Saída: assets/sons-ai/<nome>.wav. Os tiques dos contadores continuam os de scripts/sons.cjs.
// Uso: node scripts/sons-eleven.cjs   (a chave vem de ELEVENLABS_API_KEY e nunca é mostrada)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const KEY = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY;
const OUT = path.join(__dirname, '..', 'assets', 'sons-ai');
fs.mkdirSync(OUT, { recursive: true });

const SONS = [
  ['whoosh-curto', 'quick clean airy swoosh, modern app UI transition, short and crisp', 0.6],
  ['whoosh-medio', 'smooth fast whoosh pass by, sleek tech commercial transition', 0.8],
  ['whoosh-desce', 'long smooth airy whoosh with gentle downward pitch, camera diving fast, cinematic but soft', 1.6],
  ['whoosh-reverso', 'short reverse whoosh swell that builds into a hit, sucking in', 0.7],
  ['acende', 'soft glowing power on, warm low thump with a tiny bright shimmer, sleek tech', 1.0],
  ['toque', 'single crisp smartphone screen tap, clean subtle click', 0.5],
  ['interruptor', 'iOS toggle switch flipping on, crisp mechanical click', 0.5],
  ['check', 'positive success confirmation sound, two quick rising notes, clean modern app UI', 1.0],
  ['notificacao', 'friendly smartphone notification chime, bright and short', 1.0],
  ['assinatura', 'short warm sparkling logo sting chime, elegant shimmer', 1.3],
  ['pop', 'soft bubbly pop, UI element appearing, playful', 0.5],
  ['pop-grave', 'deep soft rounded pop, like a heart icon appearing', 0.5],
  ['subida', 'cinematic riser building tension fast, rising whoosh with pitch going up, ends abruptly', 1.4],
  ['impacto', 'huge cinematic impact boom with deep sub bass hit and shimmering tail, trailer style', 2.4],
];

// Deixa o som pronto: começa 10 ms antes do primeiro instante em que chega a 12 dB do pico
// (deslizes de ar e a subida crescem aos poucos, então só perdem o silêncio puro) e pico em -3 dB.
function prepara(nome, mp3, wav) {
  const pcm = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', mp3, '-ac', '1', '-ar', '48000', '-f', 's16le', '-'], { maxBuffer: 1 << 26 });
  const x = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length >> 1);
  let pk = 1; for (const v of x) pk = Math.max(pk, Math.abs(v));
  const limiar = /whoosh|subida/.test(nome) ? pk * 0.02 : pk * 0.25;
  let i = 0; while (i < x.length && Math.abs(x[i]) < limiar) i++;
  const corte = Math.max(0, i / 48000 - 0.01);
  const ganho = (20 * Math.log10(32767 / pk) - 3).toFixed(2);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', corte.toFixed(3), '-i', mp3, '-af', `volume=${ganho}dB,afade=t=in:d=0.004`, '-ar', '48000', '-ac', '2', wav]);
  console.log(nome, 'cortei', corte.toFixed(3), 's do começo, ganho', ganho, 'dB');
}
if (process.argv[2] === 'refazer') { // só reprocessa os brutos já baixados
  for (const f of fs.readdirSync(path.join(OUT, 'brutos'))) prepara(f.replace('.mp3', ''), path.join(OUT, 'brutos', f), path.join(OUT, f.replace('.mp3', '.wav')));
  process.exit(0);
}

(async () => {
  if (!KEY) throw new Error('sem chave do ElevenLabs no ambiente');
  for (const [nome, prompt, dur] of SONS) {
    const wav = path.join(OUT, nome + '.wav');
    if (fs.existsSync(wav)) { console.log('já existe', nome); continue; }
    const bruto = path.join(OUT, 'brutos', nome + '.mp3');
    if (fs.existsSync(bruto)) { prepara(nome, bruto, wav); continue; }
    const r = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
      method: 'POST', headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: prompt, duration_seconds: dur, prompt_influence: 0.6 }),
    });
    if (r.status !== 200) { console.error(nome, 'erro', r.status, (await r.text()).slice(0, 300)); continue; }
    fs.mkdirSync(path.join(OUT, 'brutos'), { recursive: true });
    const mp3 = path.join(OUT, 'brutos', nome + '.mp3');
    fs.writeFileSync(mp3, Buffer.from(await r.arrayBuffer()));
    prepara(nome, mp3, wav);
  }
})().catch(e => { console.error('ERRO', e.message); process.exit(1); });
