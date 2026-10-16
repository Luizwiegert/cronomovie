/**
 * Cloudflare Turnstile: confere que quem entra, cria conta ou pede senha nova é uma pessoa.
 * Na maioria das vezes não aparece nada; só pede um clique quando desconfia.
 * O Supabase exige o código quando a proteção contra robôs está ligada lá. Sem a chave aqui, nada disso roda.
 */
const SITE_KEY = '0x4AAAAAAFW2jlqQqmc6gpLt';

interface TurnstileApi {
  render(el: HTMLElement, o: Record<string, unknown>): string;
  reset(id?: string): void;
  remove(id: string): void;
}
declare global { interface Window { turnstile?: TurnstileApi } }

export const captchaOn = () => !!SITE_KEY;

let loading: Promise<TurnstileApi | null> | undefined;
function load(): Promise<TurnstileApi | null> {
  if (!SITE_KEY) return Promise.resolve(null);
  return loading ??= new Promise(res => {
    if (window.turnstile) { res(window.turnstile); return; }
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => res(window.turnstile || null);
    s.onerror = () => { loading = undefined; res(null); };
    document.head.appendChild(s);
  });
}

let widget = '', token = '';
const waiting: ((t: string) => void)[] = [];
const give = (t: string) => { token = t; waiting.splice(0).forEach(w => w(t)); };

/** Coloca a verificação no formulário. Chamar de novo sempre que o formulário for redesenhado. */
export async function mountCaptcha(el: HTMLElement | null) {
  const ts = await load();
  if (!ts || !el || !el.isConnected) return;
  if (widget) { try { ts.remove(widget); } catch { /* já tinha saído da tela */ } }
  token = '';
  widget = ts.render(el, {
    sitekey: SITE_KEY, theme: 'dark', language: 'pt-br', appearance: 'interaction-only',
    // A versão normal tem 300 px fixos: em tela estreita, usa a compacta para não empurrar a página para o lado
    size: el.clientWidth >= 300 ? 'flexible' : 'compact',
    callback: give,
    'expired-callback': () => { token = ''; },
    'error-callback': () => { token = ''; },
    // Só ocupa espaço na tela quando precisa do clique da pessoa
    'before-interactive-callback': () => el.classList.add('on'),
    'after-interactive-callback': () => el.classList.remove('on'),
  });
}

/** Código para mandar ao Supabase. Se a verificação ainda estiver rodando, espera até 10 segundos. */
export async function captchaToken(): Promise<string | undefined> {
  if (!SITE_KEY) return undefined;
  if (token) return token;
  const t = await Promise.race([
    new Promise<string>(r => waiting.push(r)),
    new Promise<string>(r => setTimeout(() => r(''), 10000)),
  ]);
  return t || undefined;
}

/** Cada código vale uma vez: depois de usar, pede outro. */
export function resetCaptcha() {
  token = '';
  if (widget) window.turnstile?.reset(widget);
}
