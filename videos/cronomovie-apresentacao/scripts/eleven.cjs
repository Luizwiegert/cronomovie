// Narração pelo ElevenLabs (a chave vem da variável de ambiente ELEVENLABS_API_KEY e nunca é mostrada).
// Uso: node scripts/eleven.cjs info <voice_id>
//      node scripts/eleven.cjs fala <voice_id> <saida.mp3> "<texto>" ["<texto anterior>"] ["<texto seguinte>"]
const fs = require('fs');
const KEY = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY;
if (!KEY) { console.error('sem chave do ElevenLabs no ambiente'); process.exit(1); }
const API = 'https://api.elevenlabs.io';
const H = { 'xi-api-key': KEY, 'Content-Type': 'application/json' };

async function get(p) {
  const r = await fetch(API + p, { headers: H });
  const t = await r.text();
  return { status: r.status, body: t.startsWith('{') || t.startsWith('[') ? JSON.parse(t) : t };
}

(async () => {
  const [cmd, voice, out, text, prev, next] = process.argv.slice(2);
  if (cmd === 'info') {
    const v = await get('/v1/voices/' + voice);
    if (v.status === 200) {
      const b = v.body;
      console.log('voz:', b.name, '| categoria:', b.category, '| rótulos:', JSON.stringify(b.labels), '| idioma verificado:', JSON.stringify((b.verified_languages || []).map(l => l.language + (l.accent ? '/' + l.accent : ''))));
    } else console.log('voz', v.status, JSON.stringify(v.body).slice(0, 300));
    const s = await get('/v1/user/subscription');
    if (s.status === 200) console.log('plano:', s.body.tier, '| caracteres usados:', s.body.character_count, 'de', s.body.character_limit);
    else console.log('assinatura', s.status, JSON.stringify(s.body).slice(0, 300));
  } else if (cmd === 'fala') {
    const body = {
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
    };
    if (prev) body.previous_text = prev;
    if (next) body.next_text = next;
    const r = await fetch(`${API}/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, { method: 'POST', headers: H, body: JSON.stringify(body) });
    const t = await r.text();
    if (r.status !== 200) { console.error('erro', r.status, t.slice(0, 400)); process.exit(1); }
    const j = JSON.parse(t);
    fs.writeFileSync(out, Buffer.from(j.audio_base64, 'base64'));
    const a = j.alignment || {};
    const ends = a.character_end_times_seconds || [];
    const starts = a.character_start_times_seconds || [];
    fs.writeFileSync(out.replace(/\.mp3$/, '.json'), JSON.stringify({ text, start: starts.find((_, i) => (a.characters[i] || '').trim()) ?? 0, end: ends[ends.length - 1] ?? 0 }));
    console.log('salvo', out, '| fala de', (starts[0] ?? 0).toFixed(2), 'a', (ends[ends.length - 1] ?? 0).toFixed(2), 's');
  }
})().catch(e => { console.error('ERRO', e.message); process.exit(1); });
