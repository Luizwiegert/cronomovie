/**
 * Cronomovie como app: o site pode ser instalado na tela inicial do celular (abre em tela cheia, sem a barra do navegador).
 *  - Android e Chrome do computador: o próprio navegador oferece "Instalar app" (evento beforeinstallprompt).
 *  - iPhone: a Apple não deixa o site pedir; a pessoa usa Compartilhar, Adicionar à Tela de Início. O site só explica o caminho.
 * O trabalhador (public/sw.js) também recebe as notificações.
 */

interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

const LATER = 'cronomovie-instalar-depois';
const VISITS = 'cronomovie-visitas';
let deferred: InstallEvent | null = null;
let changed: () => void = () => {};

/** Aberto pelo ícone da tela inicial? */
export const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/** Navegador de dentro de outro app (Instagram, TikTok, Facebook): de lá não dá para instalar */
const inApp = () => /Instagram|FBAN|FBAV|TikTok|musical_ly|Bytedance|Line\//i.test(navigator.userAgent);
const phone = () => matchMedia('(max-width:760px)').matches || /Android|iPhone|iPod/.test(navigator.userAgent);

export function initPWA(onChange: () => void) {
  changed = onChange;
  if ('serviceWorker' in navigator) {
    const reg = () => navigator.serviceWorker.register('/sw.js').catch(() => {});
    if (document.readyState === 'complete') void reg(); else addEventListener('load', () => void reg(), { once: true });
  }
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as InstallEvent; changed(); });
  addEventListener('appinstalled', () => { deferred = null; changed(); });
  // Conta as visitas (uma por sessão): o convite para instalar só aparece a partir da segunda
  try {
    if (!sessionStorage.getItem(VISITS)) {
      sessionStorage.setItem(VISITS, '1');
      localStorage.setItem(VISITS, String(Number(localStorage.getItem(VISITS) || 0) + 1));
    }
  } catch { /* sem armazenamento: não conta */ }
}

/** Dá para instalar daqui? ('prompt' = o navegador oferece; 'ios' = pelo Compartilhar; 'menu' = pelo menu do navegador) */
export function installWay(): 'prompt' | 'ios' | 'menu' | null {
  if (standalone() || inApp()) return null;
  if (deferred) return 'prompt';
  if (isIOS()) return 'ios';
  return phone() ? 'menu' : null;
}

/** Mostrar o convite no topo da linha do tempo? Só no celular, da segunda visita em diante, e não se a pessoa dispensou há menos de 30 dias. */
export function offerInstall(): boolean {
  if (!phone() || !installWay()) return false;
  try {
    const later = Number(localStorage.getItem(LATER) || 0);
    if (Date.now() - later < 30 * 24 * 60 * 60 * 1000) return false;
    return Number(localStorage.getItem(VISITS) || 0) >= 2;
  } catch { return false; }
}
export function dismissInstall() {
  try { localStorage.setItem(LATER, String(Date.now())); } catch { /* ignorado */ }
}

/* ---------- notificações no celular (Web Push) ---------- */
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** Situação das notificações neste aparelho. 'install' = iPhone fora do app instalado (lá a Apple não deixa). */
export async function pushStatus(): Promise<'on' | 'off' | 'denied' | 'install' | 'unsupported'> {
  if (isIOS() && !standalone()) return 'install';
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration().catch(() => undefined);
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

const fromB64 = (s: string) => {
  const raw = atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
};
let pushReady: { reg: ServiceWorkerRegistration; key: Uint8Array<ArrayBuffer> } | null = null;

/** Deixa tudo pronto antes do toque (o iPhone só aceita o pedido de permissão direto no toque, sem esperar a internet) */
export async function preparePush(getKey: () => Promise<string | null>): Promise<boolean> {
  if (!pushSupported()) return false;
  const [reg, key] = await Promise.all([navigator.serviceWorker.ready, getKey().catch(() => null)]);
  if (!key) return false;
  pushReady = { reg, key: fromB64(key) };
  return true;
}

/** Pede a permissão e inscreve o aparelho (chamar direto no toque do botão) */
export async function enablePush(save: (s: PushSubscriptionJSON) => Promise<void>): Promise<'on' | 'denied' | 'error'> {
  if (!pushReady) return 'error';
  try {
    const sub = await pushReady.reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushReady.key });
    await save(sub.toJSON());
    return 'on';
  } catch {
    return 'Notification' in window && Notification.permission === 'denied' ? 'denied' : 'error';
  }
}

export async function disablePush(drop: (endpoint: string) => Promise<void>) {
  const reg = await navigator.serviceWorker.getRegistration().catch(() => undefined);
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  if (!sub) return;
  await drop(sub.endpoint).catch(() => {});
  await sub.unsubscribe().catch(() => false);
}

/** Abre o pedido de instalação do navegador. Devolve true se a pessoa instalou. */
export async function promptInstall(): Promise<boolean> {
  const d = deferred;
  if (!d) return false;
  deferred = null;
  await d.prompt();
  const r = await d.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
  changed();
  return r.outcome === 'accepted';
}
