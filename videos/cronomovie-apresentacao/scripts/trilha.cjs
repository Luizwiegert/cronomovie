// Compõe a trilha original no ElevenLabs Music, com as seções presas às cenas do vídeo.
// Referência de clima: o reel da Amazon que o Luiz mandou (cerca de 103 BPM, quente, groove contínuo,
// efeito em cada passagem e uma parada antes do fecho). Nada da música dele é copiado.
// Uso: node scripts/trilha.cjs <saida.mp3>     (a chave vem de ELEVENLABS_API_KEY e nunca é mostrada)
const fs = require('fs');
const KEY = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY;
const out = process.argv[2] || 'assets/trilha/trilha.mp3';
const sec = (section_name, duration_ms, positive_local_styles, negative_local_styles = []) => ({ section_name, duration_ms, positive_local_styles, negative_local_styles, lines: [] });

const plano = {
  positive_global_styles: ['instrumental', 'modern upbeat commercial pop electronic', 'warm and optimistic', '103 BPM', 'clean punchy drums', 'plucky synths', 'tight claps and finger snaps', 'deep warm bass', 'cinematic polish', 'tech product launch ad'],
  negative_global_styles: ['vocals', 'lyrics', 'choir', 'lo-fi', 'dark', 'horror', 'dubstep wobble', 'guitar solo', 'muddy mix'],
  sections: [
    // 0 a 3,4 s: a pergunta na tela
    sec('Intro question', 3400, ['sparse and suspenseful', 'soft ticking pulse', 'low sub swell', 'anticipation', 'no drums'], ['drums', 'melody']),
    // 3,4 a 14 s: contador, cartazes, celular, marcar como visto
    sec('Groove A', 10600, ['beat drops in on the first beat', 'upbeat groove', 'punchy kick and claps', 'plucky synth hook', 'warm bass line', 'playful and confident']),
    // 14 a 24,4 s: trilha, episódios, trailer, amigos, spoiler
    sec('Groove B', 10400, ['same groove with more energy', 'bright arpeggio layer', 'fuller drums', 'open hi-hats', 'driving forward']),
    // 24,4 a 27,4 s: stories e a subida para o "62"
    sec('Build', 3000, ['rising tension', 'snare roll building up', 'filter sweep riser', 'drums accelerate', 'short silence at the very end before the drop'], ['steady groove']),
    // 27,4 a 30,4 s: o impacto do "62 DIAS"
    sec('Drop', 3000, ['massive cinematic impact on the first beat', 'heroic brass stab', 'big half-time drums', 'sub bass boom', 'triumphant']),
    // 30,4 a 33,4 s: a logo e o endereço
    sec('Outro', 3000, ['resolves to a warm final chord', 'clean ending', 'gentle ringing tail', 'logo sting'], ['drums continuing']),
  ],
};

(async () => {
  if (!KEY) throw new Error('sem chave do ElevenLabs no ambiente');
  const H = { 'xi-api-key': KEY, 'Content-Type': 'application/json' };
  const saldo = async () => { const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: H }); const j = await r.json(); return j.character_count; };
  const antes = await saldo();
  const r = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', { method: 'POST', headers: H, body: JSON.stringify({ model_id: 'music_v1', composition_plan: plano }) });
  if (r.status !== 200) { console.error('erro', r.status, (await r.text()).slice(0, 500)); process.exit(1); }
  fs.mkdirSync(require('path').dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  console.log('salvo', out, '| créditos gastos:', (await saldo()) - antes);
})().catch(e => { console.error('ERRO', e.message); process.exit(1); });
