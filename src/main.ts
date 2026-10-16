import './style.css';
import { createClient } from '@supabase/supabase-js';
import { showAuth } from './auth';
import { playIntro } from './intro';
import { startDemo } from './backend-demo';
import { guestBackend } from './backend-guest';
import { fetchCard, startLive } from './backend-live';
import { installPosterFallback } from './posters';
import { S, nav } from './state';
import { smooth } from './util';
import { wirePress } from './glass';
import { askAccount, captureInvite, installChanged, showApp, showMessage } from './views';
import { initPWA } from './pwa';

installPosterFallback();
// Botões com toque de vidro líquido (crescem com mola e um brilho segue o dedo)
wirePress();
// Link de perfil (?u=nome): guarda de quem é antes de qualquer tela aparecer
captureInvite();
// Pode ser instalado como app (tela inicial do celular) e receber notificações
initPWA(installChanged);
// A abertura roda por cima enquanto o site carrega por baixo.
void playIntro();

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (url && key) {
  const sb = createClient(url, key);
  // Sem conta, o site abre do mesmo jeito: é possível ver tudo, e a conta só é pedida na hora de marcar.
  const guest = guestBackend(askAccount, u => fetchCard(sb, u));
  const showGuest = () => { S.me = ''; S.backend = guest; showApp(); };
  nav.openAuth = mode => smooth(() => { window.scrollTo(0, 0); showAuth(sb, { mode, onBack: () => smooth(showGuest) }); });
  void startLive(sb, {
    showLoading: () => showMessage('Carregando…', 'Só um instante.'),
    showAuth: recovery => showAuth(sb, { recovery }),
    showGuest,
    showApp,
    showFatal: msg => showMessage('Algo deu errado', msg),
  });
} else {
  startDemo();
  showApp();
}
