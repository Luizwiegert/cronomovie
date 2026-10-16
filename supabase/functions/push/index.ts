// Cronomovie: envia as notificações para o celular (Web Push).
// - GET: devolve a chave pública do servidor (o site usa para inscrever o aparelho). Cria o par de chaves na primeira vez.
// - POST { id }: o banco chama quando nasce uma notificação (gatilho envia_push). Só envia notificação que existe
//   e ainda não foi enviada, então chamar com um número qualquer não faz nada além disso.
// Publicada sem exigir login (verify_jwt = false) por causa do banco e do GET público; a proteção é a conferência acima.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as webpush from 'jsr:@negrel/webpush@0.5.0';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

let server: webpush.ApplicationServer | null = null;
let publicKey = '';

async function app(): Promise<webpush.ApplicationServer> {
  if (server) return server;
  let { data } = await sb.from('push_keys').select('keys').eq('id', 1).maybeSingle();
  if (!data) {
    const fresh = await webpush.exportVapidKeys(await webpush.generateVapidKeys({ extractable: true }));
    const ins = await sb.from('push_keys').insert({ id: 1, keys: fresh });
    // Se outra chamada criou ao mesmo tempo, vale a que ficou gravada
    ({ data } = ins.error ? await sb.from('push_keys').select('keys').eq('id', 1).single() : { data: { keys: fresh } });
  }
  const vapidKeys = await webpush.importVapidKeys(data!.keys as webpush.ExportedVapidKeys, { extractable: false });
  publicKey = await webpush.exportApplicationServerKey(vapidKeys);
  server = await webpush.ApplicationServer.new({ contactInformation: 'https://cronomovie.com', vapidKeys });
  return server;
}

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', ...extra } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    const as = await app();
    if (req.method === 'GET') return json({ key: publicKey }, 200, { 'Cache-Control': 'public, max-age=3600' });
    if (req.method !== 'POST') return json({ error: 'método não aceito' }, 405);

    const { id } = await req.json().catch(() => ({ id: null }));
    if (!Number.isInteger(id)) return json({ error: 'id inválido' }, 400);
    // Marca como enviada antes de enviar: chamadas repetidas não mandam duas vezes
    const { data: n } = await sb.from('notifications').update({ pushed_at: new Date().toISOString() })
      .eq('id', id).is('pushed_at', null).select('id,user_id,actor_id,kind').maybeSingle();
    if (!n) return json({ sent: 0 });

    const [{ data: actor }, { data: subs }] = await Promise.all([
      sb.from('profiles').select('name').eq('id', n.actor_id).maybeSingle(),
      sb.from('push_subscriptions').select('endpoint,p256dh,auth').eq('user_id', n.user_id),
    ]);
    if (!subs?.length) return json({ sent: 0 });
    const name = actor?.name || 'Alguém';
    const body = n.kind === 'request' ? `${name} enviou um pedido de amizade.`
      : n.kind === 'accepted' ? `${name} aceitou seu pedido de amizade.`
      : `${name} curtiu seu comentário.`;
    const payload = JSON.stringify({ title: 'Cronomovie', body, url: n.kind === 'like' ? '/#perfil' : '/#amigos', tag: `${n.kind}-${n.actor_id}` });

    let sent = 0;
    await Promise.all(subs.map(async s => {
      try {
        await as.subscribe({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }).pushTextMessage(payload, { ttl: 3 * 24 * 60 * 60 });
        sent++;
      } catch (e) {
        // Aparelho que cancelou ou trocou de inscrição: sai da lista
        if (e instanceof webpush.PushMessageError && (e.isGone() || e.response.status === 404)) {
          await sb.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        }
      }
    }));
    return json({ sent });
  } catch {
    return json({ error: 'falha ao enviar' }, 500);
  }
});
