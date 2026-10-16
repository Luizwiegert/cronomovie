// Cliente mínimo do servidor MCP do VoiceStudio (http://127.0.0.1:3900/mcp/), sem depender da conexão do Claude.
// Uso: node scripts/voz.cjs tools                      -> lista as ferramentas
//      node scripts/voz.cjs call <ferramenta> '<json>'  -> chama uma ferramenta e mostra o resultado
const URL = 'http://127.0.0.1:3900/mcp/';
const BASE = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'X-OmniVoice-Client-Id': 'claude-code' };
let session = null, id = 0;

async function rpc(method, params, notify = false) {
  const headers = { ...BASE, ...(session ? { 'mcp-session-id': session } : {}) };
  const body = notify ? { jsonrpc: '2.0', method, params } : { jsonrpc: '2.0', id: ++id, method, params };
  const res = await fetch(URL, { method: 'POST', headers, body: JSON.stringify(body) });
  session = res.headers.get('mcp-session-id') || session;
  if (notify) return null;
  const text = await res.text();
  const lines = text.split('\n').filter(l => l.startsWith('data:'));
  const msg = lines.length ? JSON.parse(lines[lines.length - 1].slice(5)) : JSON.parse(text);
  if (msg.error) throw new Error(JSON.stringify(msg.error));
  return msg.result;
}

(async () => {
  await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'claude-code', version: '1' } });
  await rpc('notifications/initialized', {}, true);
  const [cmd, name, args] = process.argv.slice(2);
  if (cmd === 'tools') {
    const r = await rpc('tools/list', {});
    for (const t of r.tools) console.log(`- ${t.name}: ${(t.description || '').split('\n')[0].slice(0, 160)}\n    params: ${Object.keys(t.inputSchema?.properties || {}).join(', ')}`);
  } else if (cmd === 'schema') {
    const r = await rpc('tools/list', {});
    console.log(JSON.stringify(r.tools.find(t => t.name === name), null, 2));
  } else if (cmd === 'call') {
    const r = await rpc('tools/call', { name, arguments: JSON.parse(args || '{}') });
    console.log(JSON.stringify(r, null, 2).slice(0, 6000));
  } else if (cmd === 'fala') {
    // node scripts/voz.cjs fala <saida.wav> '<json de generate_speech>'
    const out = name;
    const r = await rpc('tools/call', { name: 'generate_speech', arguments: JSON.parse(args) });
    const fs = require('fs');
    let saved = false;
    for (const c of r.content || []) {
      const b64 = c.resource?.blob || c.data || null;
      if (b64) { fs.writeFileSync(out, Buffer.from(b64, 'base64')); saved = true; }
      else if (c.type === 'text') console.log(c.text.slice(0, 400));
    }
    // modo 'files': o VoiceStudio salva o WAV na pasta dele e devolve o caminho
    if (!saved) {
      for (const c of r.content || []) {
        try { const j = JSON.parse(c.text); if (j.output_path) { fs.copyFileSync(j.output_path, out); saved = true; console.log('duração', j.audio_duration_s, 's, gerado em', j.generation_time_s, 's'); } } catch {}
      }
    }
    if (!saved) {
      const txt = JSON.stringify(r);
      const m = /"(?:audio_base64|audio|wav_base64)"\s*:\s*\\?"([A-Za-z0-9+/=]{200,})/.exec(txt);
      if (m) { fs.writeFileSync(out, Buffer.from(m[1], 'base64')); saved = true; }
    }
    console.log(saved ? 'salvo ' + out : 'sem áudio na resposta: ' + JSON.stringify(r).slice(0, 800));
  }
})().catch(e => { console.error('ERRO', e.message); process.exit(1); });
