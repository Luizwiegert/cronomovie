import type { SupabaseClient } from '@supabase/supabase-js';
import { AVATARS, avatarFieldHTML, openAvatarChooser, setAvatarField } from './avatars';
import { stashGuest } from './backend-guest';
import { cleanUsername, usernameFieldHTML } from './extras';
import { USERNAME_RE } from './state';

type Mode = 'entrar' | 'criar' | 'esqueci' | 'nova';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

/** Entrar com outras contas. Cada botão só aparece quando aquele login estiver ligado no Supabase. */
type Social = 'google' | 'discord';
const SOCIAL: { id: Social; name: string; logo: string }[] = [
  { id: 'google', name: 'Google', logo: '<svg class="s-logo" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>' },
  { id: 'discord', name: 'Discord', logo: '<svg class="s-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="#5865F2" d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>' },
];
let socialCheck: Promise<Social[]> | undefined, socialOn: Social[] = [];
function socialEnabled(): Promise<Social[]> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined, key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return Promise.resolve([]);
  return socialCheck ??= fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
    .then(r => (r.ok ? r.json() : null))
    .then((st: { external?: Record<string, boolean> } | null) => (socialOn = SOCIAL.filter(p => st?.external?.[p.id]).map(p => p.id)), () => []);
}
const socialHTML = () => `<div class="auth-alt" data-social${socialOn.length ? '' : ' hidden'}>
      ${SOCIAL.map(p => `<button class="btn social" type="button" data-oauth="${p.id}"${socialOn.includes(p.id) ? '' : ' hidden'}>${p.logo}<span>Continuar com o ${p.name}</span></button>`).join('')}
      <p class="auth-or"><span>ou</span></p>
    </div>`;

function friendly(err: unknown, mode: Mode): string {
  const msg = String((err as { message?: string })?.message || err || '');
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha errados.';
  if (/email not confirmed/i.test(msg)) return 'Falta confirmar o seu e-mail pelo link que enviamos. Não chegou? Confira o spam ou reenvie abaixo.';
  if (/already registered|already exists/i.test(msg)) return 'Esse e-mail já tem conta. Use “Entrar”.';
  if (/USERNAME_TAKEN/i.test(msg)) return 'Esse nome de usuário já está em uso. Tente outro.';
  if (/INVALID_INVITE/i.test(msg)) return 'O cadastro está fechado no momento. Tente de novo mais tarde.';
  if (/password.*(at least|6)/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/rate limit|too many/i.test(msg)) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
  if (/invalid.*email|email.*invalid/i.test(msg)) return 'Esse e-mail não parece válido.';
  if (/fetch|network/i.test(msg)) return 'Sem conexão com o servidor. Confira a internet.';
  return mode === 'criar' ? 'Não foi possível criar a conta. Tente de novo.' : 'Algo deu errado. Tente de novo.';
}

export interface AuthOptions {
  /** Veio do link de redefinir senha */
  recovery?: boolean;
  /** Aba que abre primeiro */
  mode?: 'entrar' | 'criar';
  /** Volta para o site aberto (visitante). Sem isso, não mostra o link de voltar. */
  onBack?: () => void;
}

export function showAuth(sb: SupabaseClient, opts: AuthOptions = {}) {
  document.body.classList.add('logged-out');
  let mode: Mode = opts.recovery ? 'nova' : opts.mode || 'entrar';
  let avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)].id;

  const form = () => {
    if (mode === 'nova') return `
      <h2>Nova senha</h2>
      <p class="muted">Escolha a senha nova da sua conta.</p>
      <label class="lbl" for="a-pass">Nova senha</label>
      <input id="a-pass" type="password" autocomplete="new-password" minlength="6" required>
      <button class="btn primary big" type="submit">Salvar nova senha</button>`;
    if (mode === 'esqueci') return `
      <h2>Esqueci a senha</h2>
      <p class="muted">Enviamos um link para o seu e-mail, por onde você cria uma senha nova.</p>
      <label class="lbl" for="a-email">E-mail</label>
      <input id="a-email" type="email" autocomplete="email" required>
      <button class="btn primary big" type="submit">Enviar link</button>
      <button class="linkish back" type="button" data-mode="entrar">Voltar para entrar</button>`;
    const tabs = `<div class="seg auth-tabs" role="tablist"><button type="button" role="tab" data-mode="entrar" aria-pressed="${mode === 'entrar'}">Entrar</button><button type="button" role="tab" data-mode="criar" aria-pressed="${mode === 'criar'}">Criar conta</button></div>${socialHTML()}`;
    if (mode === 'criar') return `${tabs}
      <label class="lbl" for="a-name">Seu nome</label>
      <input id="a-name" type="text" autocomplete="nickname" maxlength="20" required placeholder="Como você quer aparecer">
      <label class="lbl" for="a-user">Nome de usuário</label>
      ${usernameFieldHTML('a-user', '')}
      <label class="lbl" for="a-email">E-mail</label>
      <input id="a-email" type="email" autocomplete="email" required>
      <label class="lbl" for="a-pass">Senha</label>
      <input id="a-pass" type="password" autocomplete="new-password" minlength="6" required placeholder="Pelo menos 6 caracteres">
      <span class="lbl">Sua foto de perfil</span>
      ${avatarFieldHTML(avatar)}
      <button class="btn primary big" type="submit">Criar conta</button>
      <p class="auth-legal">Ao criar a conta você concorda com os <a href="/termos.html" target="_blank" rel="noopener">Termos de uso</a> e a <a href="/privacidade.html" target="_blank" rel="noopener">Política de privacidade</a>.</p>`;
    return `${tabs}
      <label class="lbl" for="a-email">E-mail</label>
      <input id="a-email" type="email" autocomplete="email" required>
      <label class="lbl" for="a-pass">Senha</label>
      <input id="a-pass" type="password" autocomplete="current-password" required>
      <button class="btn primary big" type="submit">Entrar</button>
      <button class="linkish back" type="button" data-mode="esqueci">Esqueci minha senha</button>`;
  };

  const view = $('#view');
  view.innerHTML = `<section class="auth">
    <form class="auth-card" id="auth-form" novalidate>
      <div id="auth-fields"></div>
      <p class="auth-msg" id="auth-msg" role="alert" hidden></p>
      <button class="linkish back" type="button" id="auth-resend" hidden>Reenviar e-mail de confirmação</button>
    </form>
    ${opts.onBack ? '<button class="linkish auth-back" type="button" id="auth-back">Voltar para a linha do tempo</button>' : ''}
  </section>`;

  // E-mail que ainda falta confirmar (para poder reenviar o link)
  let pending = '';
  const draw = () => { $('#auth-fields').innerHTML = form(); setMsg(''); };
  const setMsg = (m: string, ok = false, resend = '') => {
    const el = $('#auth-msg');
    el.textContent = m; el.hidden = !m; el.classList.toggle('ok', ok);
    pending = resend;
    $('#auth-resend').hidden = !resend;
  };
  const val = (id: string) => ($<HTMLInputElement>('#' + id)?.value || '').trim();
  draw();
  // Mostra os botões de login ligados sem redesenhar o formulário (não apaga o que a pessoa já digitou)
  void socialEnabled().then(on => {
    if (!on.length) return;
    document.querySelector<HTMLElement>('[data-social]')?.removeAttribute('hidden');
    for (const id of on) document.querySelector<HTMLElement>(`[data-oauth="${id}"]`)?.removeAttribute('hidden');
  });

  $('#auth-back')?.addEventListener('click', () => opts.onBack?.());

  const f = $<HTMLFormElement>('#auth-form');
  f.addEventListener('input', e => {
    const t = e.target as HTMLInputElement;
    if (t.id === 'a-user') { const v = cleanUsername(t.value); if (v !== t.value) t.value = v; }
  });
  f.addEventListener('click', async e => {
    const t = e.target as HTMLElement;
    if (t.closest('#auth-resend')) {
      const email = pending, btn = $<HTMLButtonElement>('#auth-resend');
      if (!email) return;
      btn.disabled = true;
      const { error } = await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: location.origin + location.pathname } });
      btn.disabled = false;
      if (error) setMsg(/rate limit|security purposes|seconds/i.test(error.message) ? 'Espere um minuto antes de pedir de novo.' : 'Não foi possível reenviar agora. Tente de novo em instantes.', false, email);
      else setMsg(`Reenviamos o link para ${email}. Pode levar alguns minutos. Confira também o spam e a aba Promoções.`, true, email);
      return;
    }
    const go = t.closest<HTMLButtonElement>('[data-oauth]');
    if (go) {
      const p = SOCIAL.find(x => x.id === go.dataset.oauth);
      if (!p) return;
      // O que o visitante marcou fica guardado para entrar na conta quando ele voltar do Google ou do Discord
      stashGuest('*');
      go.disabled = true;
      const { error } = await sb.auth.signInWithOAuth({ provider: p.id, options: { redirectTo: location.origin + '/' } });
      if (error) { go.disabled = false; setMsg(`Não foi possível abrir o login do ${p.name}. Tente de novo.`); }
      return;
    }
    const m = t.closest<HTMLElement>('[data-mode]');
    if (m) { mode = m.dataset.mode as Mode; draw(); $<HTMLInputElement>('#a-email, #a-name, #a-pass')?.focus(); return; }
    if (t.closest('[data-av-open]')) openAvatarChooser({ selected: avatar, onPick: id => { avatar = id; setAvatarField(f, avatar); } });
  });

  f.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = f.querySelector<HTMLButtonElement>('button[type=submit]')!;
    const label = btn.textContent;
    const busy = (b: boolean) => { btn.disabled = b; btn.textContent = b ? 'Aguarde…' : label; };
    setMsg('');
    try {
      busy(true);
      if (mode === 'entrar') {
        if (!val('a-email') || !val('a-pass')) { setMsg('Preencha e-mail e senha.'); return; }
        const { error } = await sb.auth.signInWithPassword({ email: val('a-email'), password: val('a-pass') });
        if (error) throw error;
      } else if (mode === 'criar') {
        if (!val('a-name')) { setMsg('Escreva seu nome.'); return; }
        if (!val('a-email')) { setMsg('Escreva seu e-mail.'); return; }
        if (val('a-pass').length < 6) { setMsg('A senha precisa ter pelo menos 6 caracteres.'); return; }
        const username = cleanUsername(val('a-user'));
        if (!USERNAME_RE.test(username)) { setMsg('Escolha um nome de usuário de 3 a 20 caracteres: letras minúsculas, números, ponto ou _.'); return; }
        const { data: free } = await sb.rpc('username_available', { u: username });
        if (free === false) { setMsg('Esse nome de usuário já está em uso. Tente outro.'); return; }
        const { data, error } = await sb.auth.signUp({
          email: val('a-email'), password: val('a-pass'),
          options: { data: { name: val('a-name').slice(0, 20), avatar, username }, emailRedirectTo: location.origin + location.pathname },
        });
        if (error) throw error;
        if (!data.session) {
          const email = val('a-email');
          stashGuest(email);
          mode = 'entrar'; draw();
          setMsg(`Conta criada. Enviamos um link de confirmação para ${email}. Se não chegar em 2 minutos, confira o spam e a aba Promoções, ou reenvie abaixo.`, true, email);
        }
      } else if (mode === 'esqueci') {
        if (!val('a-email')) { setMsg('Escreva seu e-mail.'); return; }
        const { error } = await sb.auth.resetPasswordForEmail(val('a-email'), { redirectTo: location.origin + location.pathname });
        if (error) throw error;
        setMsg('Pronto. Se esse e-mail tiver conta, o link chega em instantes.', true);
      } else {
        if (val('a-pass').length < 6) { setMsg('A senha precisa ter pelo menos 6 caracteres.'); return; }
        const { error } = await sb.auth.updateUser({ password: val('a-pass') });
        if (error) throw error;
        location.replace(location.origin + location.pathname);
      }
    } catch (err) {
      // E-mail ainda não confirmado: oferece reenviar o link
      const unconfirmed = mode === 'entrar' && /email not confirmed/i.test(String((err as { message?: string })?.message || ''));
      setMsg(friendly(err, mode), false, unconfirmed ? val('a-email') : '');
    } finally {
      busy(false);
    }
  });
}
