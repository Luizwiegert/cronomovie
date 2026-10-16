import { EXTRAS_ORDER, ITEMS } from './data';
import type { Item } from './data';
import { S, emit } from './state';
import type { Backend, Friendship, Mark, Notif, Person, PersonHit, Watch } from './state';
import { hash, iso } from './util';

/**
 * Modo demonstração: roda sem Supabase, com a turma de exemplo e tudo salvo
 * só neste navegador. Liga sozinho quando o .env não tem as chaves.
 */

const PEOPLE: Person[] = [
  { id: 'voce', name: 'Você', color: '#0E8A94', avatar: 'homem-aranha', username: 'voce' },
  { id: 'caio', name: 'Caio', color: '#D1336F', avatar: 'thor', username: 'caio.m' },
  { id: 'tercio', name: 'Tércio', color: '#6366F1', avatar: 'loki', username: 'tercio' },
  { id: 'matheus', name: 'Matheus', color: '#C27C0E', avatar: 'hulk', username: 'matheus_s' },
  { id: 'lucas', name: 'Lucas', color: '#2F9E5B', avatar: 'deadpool', username: 'lucas.r' },
  { id: 'rafael', name: 'Rafael', color: '#2D7FD3', avatar: 'wolverine', username: 'rafa' },
];

// Você é amigo do Caio e do Tércio; o Matheus te mandou um pedido; Lucas e Rafael aparecem nas sugestões
// (amigos dos seus amigos) e na busca.
const FRIENDS: Friendship[] = [
  { a: 'voce', b: 'caio', status: 'accepted' },
  { a: 'tercio', b: 'voce', status: 'accepted' },
  { a: 'caio', b: 'tercio', status: 'accepted' },
  { a: 'matheus', b: 'voce', status: 'pending' },
  { a: 'matheus', b: 'caio', status: 'accepted' },
  { a: 'lucas', b: 'caio', status: 'accepted' },
  { a: 'lucas', b: 'tercio', status: 'accepted' },
  { a: 'rafael', b: 'tercio', status: 'accepted' },
];

const BIAS: Record<string, number> = {
  ultimato: 3, guerrainf: 3, cap2: 2, ragnarok: 2, aranha3: 3, gotg1: 2, guerracivil: 2, vingadores: 2, loki1: 2, deadpool3: 2,
  logan: 3, x2: 1, xdofp: 2, pantera1: 1, gotg3: 2, sm2: 2, wandavision: 1, thunderbolts: 1, dd1: 1,
  thor2: -3, hulk: -2, eternos: -2, thor4: -2, quantumania: -2, marvels: -2, xo: -3, xdp: -3, ff15: -4, novos: -2,
  eco: -1, invasao: -2, hdf2: -1, x3: -1, sm3: -1, asm2: -1,
};
const PBIAS: Record<string, number> = { voce: 0, caio: .6, tercio: -.8, matheus: .3 };
const toStars = (x: number) => Math.max(1, Math.min(5, Math.round(x / 2)));
const SONY = ['sm1', 'sm2', 'sm3', 'asm1', 'asm2'];

function seen(pid: string, it: Item): boolean {
  if (it.id === 'doomsday') return false;
  if (pid === 'voce') return ['hdf1', 'vingadores', 'cap2', 'guerrainf', 'ultimato', 'sm1'].includes(it.id);
  if (pid === 'caio') return (it.e <= 3 && it.k === 'f') || (it.e === 4 && it.star && it.id !== 'thunderbolts') || ['wandavision', 'loki1', 'gotg3'].includes(it.id) || SONY.includes(it.id);
  if (pid === 'tercio') return it.e <= 4 ? !['zombies', 'wonderman', 'ddr2', 'aranha4', 'olhos-wakanda', 'groot', 'shield35', 'defensores'].includes(it.id) : (it.g === 'xmen' || ['sm1', 'sm2', 'asm1'].includes(it.id));
  if (pid === 'matheus') return (it.e <= 2 && it.star) || ['x1', 'x2', 'x3', 'logan', 'dp1', 'dp2', 'aranha3', 'deadpool3', 'gotg1'].includes(it.id);
  return false;
}

const COMMENTS: Record<string, Record<string, string>> = {
  tercio: { ultimato: 'Chorei no final. Sem vergonha nenhuma.', eternos: 'Bonito, mas longo demais.', loki1: 'Não pula: é a base do multiverso.', deadpool3: 'Vê os X-Men antes que fica muito melhor.', thor2: 'Pode pular sem medo.', wandavision: 'Começa estranho, termina perfeito.', thunderbolts: 'Surpreendeu. A Yelena carrega o filme.' },
  caio: { ragnarok: 'Melhor Thor disparado.', guerrainf: 'O estalo me pegou desprevenido.', aranha3: 'Os três juntos. Arrepiei.' },
  matheus: { logan: 'Nem parece filme de herói. Obra-prima.', cap2: 'Melhor filme solo do MCU, fácil.', x2: 'O melhor dos X-Men antigos.' },
};

const RANGE: Record<string, [string, string]> = {
  voce: ['2026-09-01', '2026-09-23'], caio: ['2026-05-02', '2026-09-21'],
  tercio: ['2026-02-10', '2026-09-22'], matheus: ['2026-07-12', '2026-09-19'],
};

function buildMock() {
  const marks: Record<string, Record<string, Mark>> = {};
  for (const p of PEOPLE) {
    marks[p.id] = {};
    const list = [...EXTRAS_ORDER, ...ITEMS.filter(it => it.e <= 4)].filter(it => seen(p.id, it));
    const [a, b] = (RANGE[p.id] || ['2026-09-01', '2026-09-20']).map(s => new Date(s + 'T12:00:00').getTime());
    list.forEach((it, k) => {
      const h = hash('n:' + p.id + it.id);
      const base = 7 + (BIAS[it.id] || 0) + PBIAS[p.id] + (hash(p.id + ':' + it.id) % 5) - 2;
      marks[p.id][it.id] = {
        r: p.id === 'tercio' && it.k !== 'f' && h % 6 === 0 ? null : toStars(base),
        c: COMMENTS[p.id]?.[it.id] || '',
        d: iso(new Date(a + (b - a) * (list.length > 1 ? k / (list.length - 1) : 1))),
      };
    });
  }
  // Listas e episódios de exemplo
  const watch: Record<string, Record<string, Watch>> = {
    voce: { loki1: { list: 'assistindo', eps: ['0:1', '0:2', '0:3'] }, estranho2: { list: 'quero', eps: [] }, wakanda: { list: 'quero', eps: [] } },
    caio: { falcao: { list: 'assistindo', eps: ['0:1', '0:2', '0:3', '0:4'] }, aranha4: { list: 'quero', eps: [] } },
    tercio: { ddr2: { list: 'assistindo', eps: ['0:1', '0:2'] } },
  };
  return { me: 'voce', marks, watch, prof: {} as Record<string, { name: string; avatar: string | null; username?: string | null; favorite?: string | null }>, friends: FRIENDS.map(f => ({ ...f })), blocks: [] as [string, string][], likes: { 'tercio|thunderbolts': ['caio'], 'tercio|ultimato': ['caio', 'matheus'] } as Record<string, string[]>, seen: false };
}

const KEY = 'moviegram-demo-v6';

export function startDemo() {
  let data: ReturnType<typeof buildMock>;
  try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { data = null as never; }
  if (!data || !data.marks || !data.friends || !data.watch || !data.blocks || !data.likes || !PEOPLE.some(p => p.id === data.me)) data = buildMock();

  const apply = () => {
    S.me = data.me;
    S.people = PEOPLE.map(p => ({ ...p, ...(data.prof[p.id] || {}) }));
    S.marks = data.marks;
    S.friendships = data.friends;
    S.watch = data.watch;
    S.likes = data.likes;
    S.unread = data.seen ? 0 : 2;
  };
  const pair = (x: Friendship, id: string) => (x.a === data.me && x.b === id) || (x.b === data.me && x.a === id);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignorado */ } };
  const n = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const person = (id: string) => S.people.find(p => p.id === id)!;
  const friendsOf = (id: string) => data.friends.filter(f => f.status === 'accepted' && (f.a === id || f.b === id)).map(f => (f.a === id ? f.b : f.a));
  const blocked = (a: string, b: string) => data.blocks.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const related = (id: string) => data.friends.some(f => pair(f, id));
  /** Amigos em comum com você: quantos e até 3 (por nome) */
  const hit = (p: Person): PersonHit => {
    const mine = new Set(friendsOf(data.me)), common = friendsOf(p.id).filter(id => mine.has(id)).sort((x, y) => person(x).name.localeCompare(person(y).name, 'pt'));
    return { ...p, mutual: common.length, mutualIds: common.slice(0, 3) };
  };

  const backend: Backend = {
    mode: 'demo',
    setMark(titleId, patch) {
      const m = data.marks[data.me] || (data.marks[data.me] = {});
      if (patch === null) delete m[titleId];
      else m[titleId] = { ...(m[titleId] || { r: null, c: '', d: iso(new Date()) }), ...patch };
      save(); apply(); emit();
    },
    async updateProfile(name, avatar, username, favorite) {
      const cur = S.people.find(p => p.id === data.me);
      data.prof[data.me] = { name, avatar, username: username ?? cur?.username ?? null, favorite: favorite === undefined ? cur?.favorite ?? null : favorite };
      save(); apply(); emit();
    },
    // Sem servidor: a foto vai embutida no próprio perfil, guardado neste navegador
    uploadPhoto: photo => new Promise<string>((ok, fail) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = () => fail(r.error);
      r.readAsDataURL(photo);
    }),
    setWatch(titleId, patch) {
      const w = data.watch[data.me] || (data.watch[data.me] = {});
      const next: Watch = { ...(w[titleId] || { list: null, eps: [] }), ...(patch || { list: null, eps: [] }) };
      if (!next.list && !next.eps.length) delete w[titleId]; else w[titleId] = next;
      save(); apply(); emit();
    },
    async profileCard(u) { return S.people.find(p => (p.username || '').toLowerCase() === u.toLowerCase()) || null; },
    async usernameAvailable(u) { return !S.people.some(p => p.id !== data.me && (p.username || '').toLowerCase() === u.toLowerCase()); },
    async signOut() { /* não existe na demonstração */ },
    async deleteAccount() { /* não existe na demonstração */ },
    async searchPeople(q, offset = 0) {
      const k = n(q.trim().replace(/^@/, ''));
      if (k.length < 2) return [];
      const rank = (p: Person) => (p.username === k ? 0 : (p.username || '').startsWith(k) ? 1 : n(p.name).startsWith(k) ? 2 : 3);
      return S.people.filter(p => p.id !== data.me && !blocked(data.me, p.id) && (n(p.name).includes(k) || (p.username || '').includes(k)))
        .map(hit).sort((a, b) => rank(a) - rank(b) || b.mutual - a.mutual || a.name.localeCompare(b.name, 'pt')).slice(offset, offset + 20);
    },
    async suggestions() {
      const mine = friendsOf(data.me);
      const ids = [...new Set(mine.flatMap(friendsOf))].filter(id => id !== data.me && !related(id) && !blocked(data.me, id));
      return ids.map(id => hit(person(id))).sort((a, b) => b.mutual - a.mutual || a.name.localeCompare(b.name, 'pt'));
    },
    async profileInfo(id) {
      if (!PEOPLE.some(p => p.id === id) || blocked(data.me, id)) return null;
      const h = hit(person(id)), close = id === data.me || friendsOf(data.me).includes(id);
      return { person: person(id), friends: close ? friendsOf(id).length : null, mutual: h.mutual, mutualIds: h.mutualIds };
    },
    async friendsList(id, q, offset) {
      if (id !== data.me && !friendsOf(data.me).includes(id)) return { people: [], total: 0 };
      const mine = new Set([data.me, ...friendsOf(data.me)]), k = n(q.trim().replace(/^@/, ''));
      const all = friendsOf(id).filter(x => !blocked(data.me, x)).map(person)
        .filter(p => !k || n(p.name).includes(k) || (p.username || '').includes(k))
        .map(p => ({ ...p, common: mine.has(p.id) }))
        .sort((a, b) => Number(b.id === data.me) - Number(a.id === data.me) || Number(b.common) - Number(a.common) || a.name.localeCompare(b.name, 'pt'));
      return { people: all.slice(offset, offset + 30), total: all.length };
    },
    async block(id) {
      if (!blocked(data.me, id)) data.blocks.push([data.me, id]);
      data.friends = data.friends.filter(x => !pair(x, id));
      save(); apply(); emit();
    },
    async unblock(id) {
      data.blocks = data.blocks.filter(([x, y]) => !(x === data.me && y === id));
      save(); apply(); emit();
    },
    async blockedList() { return data.blocks.filter(([x]) => x === data.me).map(([, y]) => person(y)); },
    async like(owner, titleId, on) {
      const k = `${owner}|${titleId}`, list = data.likes[k] || [];
      data.likes[k] = on ? [...list.filter(x => x !== data.me), data.me] : list.filter(x => x !== data.me);
      save(); apply(); emit();
    },
    // Notificações de exemplo: o pedido do Matheus e o Caio aceitando a amizade
    async notifications() {
      const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
      const list: Notif[] = [];
      for (const f of data.friends) if (f.status === 'pending' && f.b === data.me) list.push({ id: list.length + 1, kind: 'request', titleId: null, at: ago(2), read: data.seen, actor: person(f.a) });
      if (friendsOf(data.me).includes('caio')) list.push({ id: 90, kind: 'accepted', titleId: null, at: ago(26), read: data.seen, actor: person('caio') });
      return list;
    },
    async readNotifications() { data.seen = true; save(); apply(); emit(); },
    async pushKey() { return null; },
    async savePush() { /* não existe na demonstração */ },
    async dropPush() { /* não existe na demonstração */ },
    async requestFriend(p) {
      const theirs = data.friends.find(f => f.a === p.id && f.b === data.me && f.status === 'pending');
      if (theirs) theirs.status = 'accepted';
      else if (!data.friends.some(f => pair(f, p.id))) data.friends.push({ a: data.me, b: p.id, status: 'pending' });
      save(); apply(); emit();
    },
    async acceptFriend(id) {
      const f = data.friends.find(x => x.a === id && x.b === data.me);
      if (f) f.status = 'accepted';
      save(); apply(); emit();
    },
    async removeFriend(id) {
      data.friends = data.friends.filter(x => !pair(x, id));
      save(); apply(); emit();
    },
    switchUser(id) { data.me = id; save(); apply(); emit(); },
    resetDemo() { data = buildMock(); save(); apply(); emit(); },
  };

  S.backend = backend;
  apply();
}
