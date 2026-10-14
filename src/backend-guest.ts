import { S, emit, marksOf, watchOf } from './state';
import type { Backend, Mark, Person, Watch } from './state';
import { iso } from './util';

/**
 * Visitante sem conta: marca, avalia e monta listas normalmente, mas só na memória da página.
 * Nada vai para o banco: ao fechar ou recarregar, as marcações se perdem. A conta serve para salvar,
 * acompanhar depois e adicionar amigos. O que precisa de conta (amigos) chama `ask`.
 */
export function guestBackend(ask: () => void, card: (username: string) => Promise<Person | null> = async () => null): Backend {
  const later = async () => { ask(); };
  return {
    mode: 'guest',
    setMark(titleId, patch) {
      const m = marksOf('');
      if (patch === null) delete m[titleId];
      else m[titleId] = { ...(m[titleId] || { r: null, c: '', d: iso(new Date()) }), ...patch };
      emit();
    },
    setWatch(titleId, patch) {
      const w = watchOf('');
      const next: Watch = { ...(w[titleId] || { list: null, eps: [] }), ...(patch || { list: null, eps: [] }) };
      if (!next.list && !next.eps.length) delete w[titleId]; else w[titleId] = next;
      emit();
    },
    updateProfile: later,
    profileCard: card,
    uploadPhoto: async () => { ask(); throw new Error('sem conta'); },
    usernameAvailable: async () => false,
    signOut: async () => {},
    deleteAccount: later,
    searchPeople: async () => [],
    requestFriend: later,
    acceptFriend: later,
    removeFriend: later,
    switchUser() { /* só na demonstração */ },
    resetDemo() { /* só na demonstração */ },
  };
}

/* ---------- levar para conta o que foi marcado como visitante ---------- */
export interface GuestData { marks: Record<string, Mark>; watch: Record<string, Watch> }

const STASH = 'moviegram-visitante';
const WEEK = 7 * 24 * 60 * 60 * 1000;
const some = (d: GuestData) => Object.keys(d.marks).length + Object.keys(d.watch).length > 0;

/** O que o visitante marcou nesta visita (fica guardado em S com a "pessoa" vazia). */
const inMemory = (): GuestData => ({ marks: { ...(S.marks[''] || {}) }, watch: { ...(S.watch[''] || {}) } });

/** Quantos títulos o visitante mexeu nesta visita */
export const guestCount = () => new Set([...Object.keys(S.marks[''] || {}), ...Object.keys(S.watch[''] || {})]).size;

/**
 * Criou a conta: o link de confirmação abre o site de novo, então o que foi marcado fica guardado
 * neste navegador, preso ao e-mail do cadastro, só até a conta ser confirmada.
 */
export function stashGuest(email: string) {
  const d = inMemory();
  if (!some(d)) return;
  try { localStorage.setItem(STASH, JSON.stringify({ email: email.trim().toLowerCase(), t: Date.now(), ...d })); } catch { /* sem armazenamento */ }
}

/**
 * Entrou: devolve o que deve ir para conta. Vale o que foi marcado nesta mesma visita ou,
 * para quem acabou de confirmar o cadastro, o que ficou guardado com o mesmo e-mail.
 */
export function takeGuest(email: string | undefined): GuestData | null {
  const mem = inMemory();
  let out: GuestData | null = some(mem) ? mem : null;
  try {
    const raw = localStorage.getItem(STASH);
    if (raw) {
      const s = JSON.parse(raw) as GuestData & { email: string; t: number };
      // "*" = foi entrar pelo Google neste navegador: vale para a conta que voltar de lá em até meia hora
      const viaGoogle = s.email === '*' && Date.now() - s.t < 30 * 60 * 1000;
      const mine = viaGoogle || (!!email && s.email === email.trim().toLowerCase() && Date.now() - s.t < WEEK);
      if (mine && !out) out = { marks: s.marks || {}, watch: s.watch || {} };
      if (mine || Date.now() - s.t >= WEEK || (s.email === '*' && !viaGoogle)) localStorage.removeItem(STASH);
    }
  } catch { /* ignorado */ }
  delete S.marks[''];
  delete S.watch[''];
  return out;
}
