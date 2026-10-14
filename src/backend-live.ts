import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { S, emit, marksOf } from './state';
import type { Backend, Friendship, Mark, Person, Watch } from './state';
import { iso, toast } from './util';
import { photoVersion } from './avatars';
import { takeGuest } from './backend-guest';
import type { GuestData } from './backend-guest';

/** Linhas como vêm do banco */
interface MarkRow { user_id: string; title_id: string; rating: number | null; comment: string; watched_on: string }
interface ProfileRow { id: string; name: string; color?: string; avatar: string | null; username?: string | null; favorite?: string | null; created_at?: string }
interface WatchRow { user_id: string; title_id: string; list: Watch['list']; episodes: string[] }
interface FriendRow { requester: string; addressee: string; status: 'pending' | 'accepted' }

const toMark = (r: MarkRow): Mark => ({ r: r.rating, c: r.comment || '', d: r.watched_on });
const toPerson = (r: ProfileRow): Person => ({ id: r.id, name: r.name, color: r.color || '#6A7080', avatar: r.avatar ?? null, username: r.username ?? null, favorite: r.favorite ?? null });
const toWatch = (r: WatchRow): Watch => ({ list: r.list ?? null, eps: r.episodes || [] });
const toFriend = (r: FriendRow): Friendship => ({ a: r.requester, b: r.addressee, status: r.status });
const PROFILE_COLS = 'id,name,color,avatar,username,favorite,created_at';
/** Escapa % e _ para busca por nome com ilike */
const likeSafe = (q: string) => q.replace(/[\\%_]/g, m => '\\' + m);

/** Cartão público de um perfil, pelo @ (serve também pra quem ainda não tem conta) */
export async function fetchCard(sb: SupabaseClient, username: string): Promise<Person | null> {
  const { data, error } = await sb.rpc('profile_card', { u: username });
  const row = Array.isArray(data) ? data[0] : data;
  return error || !row ? null : toPerson(row as ProfileRow);
}

export interface LiveHooks {
  showLoading(): void;
  showAuth(recovery?: boolean): void;
  /** Sem conta: mostra o site aberto, só para ver */
  showGuest(): void;
  showApp(): void;
  showFatal(msg: string): void;
}

export async function startLive(sb: SupabaseClient, hooks: LiveHooks) {
  let channel: RealtimeChannel | null = null;
  let current: string | null = null;
  let lastLoad = 0;
  /** Veio do link de redefinir senha: mostra o formulário de nova senha em vez do app */
  let recovering = /type=recovery/.test(location.hash + location.search);
  /** Escritas minhas ainda a caminho, por título: ignora o eco do tempo real enquanto isso */
  const pending = new Map<string, number>();
  const queue = new Map<string, Promise<void>>();

  async function loadAll() {
    // Amizades primeiro: elas dizem de quem são os perfis que interessam.
    const { data: fr, error: fe } = await sb.from('friendships').select('requester,addressee,status');
    if (fe) throw fe;
    const friendships = (fr as FriendRow[]).map(toFriend);
    const ids = [...new Set([S.me, ...friendships.flatMap(f => [f.a, f.b])])];
    const { data: profiles, error: pe } = await sb.from('profiles').select(PROFILE_COLS).in('id', ids);
    if (pe) throw pe;
    // O banco só devolve as suas marcações e as dos seus amigos.
    const rows: MarkRow[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('marks').select('user_id,title_id,rating,comment,watched_on').range(from, from + 999);
      if (error) throw error;
      rows.push(...(data as MarkRow[]));
      if (!data || data.length < 1000) break;
    }
    const { data: ws, error: we } = await sb.from('watch_state').select('user_id,title_id,list,episodes');
    if (we) throw we;
    const watch: Record<string, Record<string, Watch>> = {};
    for (const r of ws as WatchRow[]) (watch[r.user_id] ||= {})[r.title_id] = toWatch(r);
    S.watch = watch;
    S.people = (profiles as ProfileRow[]).map(toPerson);
    S.friendships = friendships;
    const marks: Record<string, Record<string, Mark>> = {};
    for (const r of rows) (marks[r.user_id] ||= {})[r.title_id] = toMark(r);
    S.marks = marks;
    lastLoad = Date.now();
  }

  function subscribe() {
    channel?.unsubscribe();
    channel = sb.channel('turma')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marks' }, p => {
        if (p.eventType === 'DELETE') {
          const o = p.old as Partial<MarkRow>;
          if (!o.user_id || !o.title_id) { void resync(); return; }
          if (o.user_id === S.me && pending.get(o.title_id)) return;
          delete marksOf(o.user_id)[o.title_id];
        } else {
          const n = p.new as MarkRow;
          if (n.user_id === S.me && pending.get(n.title_id)) return;
          marksOf(n.user_id)[n.title_id] = toMark(n);
        }
        emit();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, p => {
        if (p.eventType === 'DELETE') {
          const id = (p.old as Partial<ProfileRow>).id;
          S.people = S.people.filter(x => x.id !== id);
        } else {
          // Só interessa quem você já conhece (você, amigos e pedidos).
          const n = toPerson(p.new as ProfileRow);
          const i = S.people.findIndex(x => x.id === n.id);
          if (i < 0) return;
          S.people[i] = n;
        }
        emit();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watch_state' }, p => {
        if (p.eventType === 'DELETE') {
          const o = p.old as Partial<WatchRow>;
          if (!o.user_id || !o.title_id) { void resync(); return; }
          if (o.user_id === S.me && pending.get('w:' + o.title_id)) return;
          delete (S.watch[o.user_id] || {})[o.title_id];
        } else {
          const n = p.new as WatchRow;
          if (n.user_id === S.me && pending.get('w:' + n.title_id)) return;
          (S.watch[n.user_id] ||= {})[n.title_id] = toWatch(n);
        }
        emit();
      })
      // Pedido novo, aceito ou desfeito: recarrega tudo (amigo novo traz as marcações dele).
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => { void resync(); })
      .subscribe();
  }

  async function resync() {
    try { await loadAll(); emit(); } catch { /* tenta de novo na próxima vez que a aba voltar */ }
  }

  /** Grava o estado local atual daquele título (sempre o mais recente, em fila). */
  function write(titleId: string) {
    pending.set(titleId, (pending.get(titleId) || 0) + 1);
    const prev = queue.get(titleId) || Promise.resolve();
    const next = prev.then(async () => {
      const m = marksOf(S.me)[titleId];
      const res = m
        ? await sb.from('marks').upsert({ user_id: S.me, title_id: titleId, rating: m.r, comment: m.c, watched_on: m.d, updated_at: new Date().toISOString() }, { onConflict: 'user_id,title_id' })
        : await sb.from('marks').delete().match({ user_id: S.me, title_id: titleId });
      if (res.error) throw res.error;
    }).catch(() => {
      toast('Não foi possível salvar. Confira a internet e tente de novo.');
      void resync();
    }).finally(() => {
      const left = (pending.get(titleId) || 1) - 1;
      if (left) pending.set(titleId, left); else pending.delete(titleId);
    });
    queue.set(titleId, next);
  }

  /** Apaga do servidor as fotos enviadas que não são mais a do perfil (keep = valor atual do perfil) */
  async function cleanPhotos(keep: string | null) {
    const cur = photoVersion(keep);
    const { data } = await sb.storage.from('avatars').list(S.me);
    const old = (data || []).filter(f => f.name !== `${cur}.jpg`).map(f => `${S.me}/${f.name}`);
    if (old.length) await sb.storage.from('avatars').remove(old);
  }

  const backend: Backend = {
    mode: 'live',
    setMark(titleId, patch) {
      const m = marksOf(S.me);
      if (patch === null) delete m[titleId];
      else m[titleId] = { ...(m[titleId] || { r: null, c: '', d: iso(new Date()) }), ...patch };
      emit();
      write(titleId);
    },
    async updateProfile(name, avatar, username, favorite) {
      const patch: Record<string, unknown> = { name, avatar };
      if (username !== undefined) patch.username = username;
      if (favorite !== undefined) patch.favorite = favorite;
      const { error } = await sb.from('profiles').update(patch).eq('id', S.me);
      if (error) {
        toast(/duplicate|unique/i.test(error.message) ? 'Esse nome de usuário já está em uso.' : 'Não foi possível salvar o perfil.');
        throw error;
      }
      const p = S.people.find(x => x.id === S.me);
      if (p) { p.name = name; p.avatar = avatar; if (username !== undefined) p.username = username; if (favorite !== undefined) p.favorite = favorite; }
      emit();
      void cleanPhotos(avatar).catch(() => {});
    },
    profileCard: u => fetchCard(sb, u),
    async uploadPhoto(photo) {
      const ver = Date.now().toString(36);
      const { error } = await sb.storage.from('avatars').upload(`${S.me}/${ver}.jpg`, photo, { contentType: 'image/jpeg', cacheControl: '31536000' });
      if (error) { toast('Não foi possível enviar a foto. Tente de novo.'); throw error; }
      return `foto:${ver}`;
    },
    setWatch(titleId, patch) {
      const w = (S.watch[S.me] ||= {});
      const next: Watch = { ...(w[titleId] || { list: null, eps: [] }), ...(patch || { list: null, eps: [] }) };
      const empty = !next.list && !next.eps.length;
      if (empty) delete w[titleId]; else w[titleId] = next;
      emit();
      const key = 'w:' + titleId;
      pending.set(key, (pending.get(key) || 0) + 1);
      const prev = queue.get(key) || Promise.resolve();
      queue.set(key, prev.then(async () => {
        const cur = (S.watch[S.me] || {})[titleId];
        const res = cur
          ? await sb.from('watch_state').upsert({ user_id: S.me, title_id: titleId, list: cur.list, episodes: cur.eps, updated_at: new Date().toISOString() }, { onConflict: 'user_id,title_id' })
          : await sb.from('watch_state').delete().match({ user_id: S.me, title_id: titleId });
        if (res.error) throw res.error;
      }).catch(() => { toast('Não foi possível salvar. Confira a internet.'); void resync(); })
        .finally(() => { const left = (pending.get(key) || 1) - 1; if (left) pending.set(key, left); else pending.delete(key); }));
    },
    async usernameAvailable(u) {
      const { data, error } = await sb.rpc('username_available', { u });
      return !error && data === true;
    },
    async signOut() { await sb.auth.signOut(); },
    async deleteAccount() {
      // As fotos enviadas ficam fora do banco: saem antes, enquanto a conta ainda pode apagá-las.
      await cleanPhotos(null).catch(() => {});
      const { error } = await sb.rpc('delete_my_account');
      if (error) { toast('Não foi possível excluir a conta agora. Tente de novo.'); throw error; }
      await sb.auth.signOut().catch(() => {});
    },
    async searchPeople(q) {
      const k = likeSafe(q.replace(/^@/, '').replace(/[,()"']/g, ' ').trim());
      const { data, error } = await sb.from('profiles').select(PROFILE_COLS)
        .or(`name.ilike.%${k}%,username.ilike.%${k}%`).neq('id', S.me).order('name').limit(20);
      if (error) { toast('Não foi possível buscar agora. Tente de novo.'); return []; }
      return (data as ProfileRow[]).map(toPerson);
    },
    async requestFriend(p) {
      const theirs = S.friendships.find(f => f.a === p.id && f.b === S.me && f.status === 'pending');
      if (theirs) return backend.acceptFriend(p.id);
      if (!S.people.some(x => x.id === p.id)) S.people.push(p);
      S.friendships.push({ a: S.me, b: p.id, status: 'pending' });
      emit();
      const { error } = await sb.from('friendships').insert({ requester: S.me, addressee: p.id });
      if (error) {
        toast(/duplicate|unique/i.test(error.message) ? 'Já existe um pedido entre vocês.' : 'Não foi possível enviar o pedido.');
        await resync();
        throw error;
      }
    },
    async acceptFriend(id) {
      const f = S.friendships.find(x => x.a === id && x.b === S.me);
      if (f) { f.status = 'accepted'; emit(); }
      const { error } = await sb.from('friendships').update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('requester', id).eq('addressee', S.me);
      if (error) toast('Não foi possível aceitar agora.');
      await resync(); // traz as marcações do amigo novo
    },
    async removeFriend(id) {
      S.friendships = S.friendships.filter(x => !((x.a === S.me && x.b === id) || (x.b === S.me && x.a === id)));
      delete S.marks[id];
      delete S.watch[id];
      emit();
      const { error } = await sb.from('friendships').delete()
        .or(`and(requester.eq.${S.me},addressee.eq.${id}),and(requester.eq.${id},addressee.eq.${S.me})`);
      if (error) { toast('Não foi possível desfazer agora.'); await resync(); }
    },
    switchUser() { /* só na demonstração */ },
    resetDemo() { /* só na demonstração */ },
  };

  /** Salva na conta o que a pessoa marcou antes de entrar (sem passar por cima do que a conta já tem). */
  function adopt(d: GuestData) {
    const mine = marksOf(S.me), w = S.watch[S.me] || {};
    let n = 0;
    for (const [id, m] of Object.entries(d.marks)) if (!mine[id]) { backend.setMark(id, m); n++; }
    for (const [id, x] of Object.entries(d.watch)) if (!mine[id] && !w[id]) { backend.setWatch(id, x); if (!d.marks[id]) n++; }
    if (n) toast(n === 1 ? 'O título que você marcou antes de entrar foi salvo na sua conta.' : `Os ${n} títulos que você marcou antes de entrar foram salvos na sua conta.`);
  }

  async function enter(uid: string, email?: string) {
    if (current === uid) return;
    current = uid;
    const carry = takeGuest(email);
    hooks.showLoading();
    try {
      S.me = uid;
      S.backend = backend;
      await loadAll();
      if (recovering) return;
      if (!S.people.some(p => p.id === uid)) {
        hooks.showFatal('Sua conta existe, mas o perfil não foi criado. Confira se o arquivo supabase/schema.sql foi rodado no Supabase.');
        return;
      }
      subscribe();
      hooks.showApp();
      if (carry) adopt(carry);
    } catch {
      current = null;
      hooks.showFatal('Não foi possível carregar os seus dados. Confira a conexão e recarregue a página.');
    }
  }

  function leave() {
    channel?.unsubscribe();
    channel = null;
    current = null;
    S.me = ''; S.people = []; S.marks = {}; S.friendships = []; S.watch = {};
  }

  sb.auth.onAuthStateChange((event, session) => {
    // Chamadas ao Supabase dentro deste callback podem travar: adia para o próximo ciclo.
    setTimeout(() => {
      if (event === 'PASSWORD_RECOVERY' || (recovering && session)) { recovering = true; hooks.showAuth(true); return; }
      if (event === 'SIGNED_OUT' || !session) { leave(); hooks.showGuest(); return; }
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') void enter(session.user.id, session.user.email);
    }, 0);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && current && Date.now() - lastLoad > 60_000) void resync();
  });
}
