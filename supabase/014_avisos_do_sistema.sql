-- Cronomovie: avisos do próprio site, para dar motivo de voltar (16/10/2026, aprovado pelo Luiz).
--  - estreia do dia (episódio novo, filme nos cinemas), tirada de app_private.lancamentos
--  - marcos da contagem até Doutor Destino (60, 30, 14, 7, 3 dias e véspera)
--  - aos domingos, lembrete para quem tem o celular inscrito e não marcou nada na semana
-- Só recebe quem já marcou algum título. Os avisos entram em public.notifications, então aparecem na central
-- de notificações e, pelo gatilho envia_push (013), chegam ao celular de quem ativou.

-- ---------------------------------------------------------------------------
-- Notificações do sistema: sem autor e com o texto pronto
-- ---------------------------------------------------------------------------
alter table public.notifications alter column actor_id drop not null;
alter table public.notifications add column if not exists info text check (info is null or char_length(info) <= 200);
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('request', 'accepted', 'like', 'release', 'countdown', 'weekly'));
-- aviso de pessoa precisa de autor; aviso do sistema precisa de texto
alter table public.notifications drop constraint if exists notifications_autor_ou_texto;
alter table public.notifications add constraint notifications_autor_ou_texto
  check ((kind in ('request', 'accepted', 'like') and actor_id is not null) or (kind in ('release', 'countdown', 'weekly') and info is not null));

-- Lista de notificações: agora com o texto e com os avisos do sistema (sem autor)
drop function if exists public.my_notifications(int);
create function public.my_notifications(lim int default 50)
returns table (id bigint, kind text, title_id text, info text, created_at timestamptz, read_at timestamptz,
               actor_id uuid, name text, username text, avatar text, color text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := (select auth.uid());
begin
  if me is null then return; end if;
  delete from public.notifications n where n.user_id = me and n.created_at < now() - interval '90 days';
  return query
  select n.id, n.kind, n.title_id, n.info, n.created_at, n.read_at, n.actor_id, p.name, p.username, p.avatar, p.color
  from public.notifications n left join public.profiles p on p.id = n.actor_id
  where n.user_id = me and (n.actor_id is null or not app_private.bloqueio(me, n.actor_id))
  order by n.created_at desc
  limit least(greatest(coalesce(lim, 50), 1), 100);
end $$;
revoke all on function public.my_notifications(int) from public, anon;
grant execute on function public.my_notifications(int) to authenticated;

-- ---------------------------------------------------------------------------
-- Lançamentos com data certa (gerados de RELEASES em src/data.ts por scripts/lancamentos-sql.mjs)
-- ---------------------------------------------------------------------------
create table if not exists app_private.lancamentos (
  id bigint generated always as identity primary key,
  title_id text not null check (char_length(title_id) <= 40),
  quando timestamptz not null,
  texto text not null check (char_length(texto) <= 200)
);
-- gerado por scripts/lancamentos-sql.mjs a partir de RELEASES (src/data.ts)
delete from app_private.lancamentos;
insert into app_private.lancamentos (title_id, quando, texto) values
  ('visionquest', make_timestamptz(2026, 10, 20, 22, 0, 0, 'America/Sao_Paulo'), 'Hoje às 22h: VisionQuest, episódios 3 e 4 no Disney+.'),
  ('visionquest', make_timestamptz(2026, 10, 27, 22, 0, 0, 'America/Sao_Paulo'), 'Hoje às 22h: VisionQuest, episódios 5 e 6 no Disney+.'),
  ('visionquest', make_timestamptz(2026, 11, 3, 23, 0, 0, 'America/Sao_Paulo'), 'Hoje às 23h: VisionQuest, episódio 7 no Disney+.'),
  ('visionquest', make_timestamptz(2026, 11, 10, 23, 0, 0, 'America/Sao_Paulo'), 'Hoje às 23h: VisionQuest, último episódio no Disney+.'),
  ('doomsday', make_timestamptz(2026, 12, 17, 0, 0, 0, 'America/Sao_Paulo'), 'Hoje estreia Vingadores: Doutor Destino nos cinemas.'),
  ('amigao', make_timestamptz(2027, 1, 13, 0, 0, 0, 'America/Sao_Paulo'), 'Hoje: Seu Amigão da Vizinhança: Homem-Aranha, 2ª temporada no Disney+.'),
  ('aranhaverso3', make_timestamptz(2027, 6, 17, 0, 0, 0, 'America/Sao_Paulo'), 'Hoje estreia Homem-Aranha: Além do Aranhaverso nos cinemas.'),
  ('secretwars', make_timestamptz(2027, 12, 16, 0, 0, 0, 'America/Sao_Paulo'), 'Hoje estreia Vingadores: Guerras Secretas nos cinemas.');

-- ---------------------------------------------------------------------------
-- Cria os avisos do dia. Roda uma vez por dia (10h de Brasília); rodar de novo no mesmo dia não duplica nada.
-- ---------------------------------------------------------------------------
create or replace function app_private.cria_avisos()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  estreia date;
  faltam int;
  r record;
begin
  -- 1. Estreias e episódios de hoje, para quem usa o site (marcou ao menos um título)
  for r in select l.title_id, l.texto from app_private.lancamentos l
           where (l.quando at time zone 'America/Sao_Paulo')::date = hoje loop
    insert into public.notifications (user_id, kind, title_id, info)
    select u.user_id, 'release', r.title_id, r.texto
    from (select distinct m.user_id from public.marks m) u
    where not exists (select 1 from public.notifications n
                      where n.user_id = u.user_id and n.kind = 'release' and n.title_id = r.title_id and n.info = r.texto);
  end loop;

  -- 2. Marcos da contagem até Doutor Destino
  select (l.quando at time zone 'America/Sao_Paulo')::date into estreia
  from app_private.lancamentos l where l.title_id = 'doomsday' order by l.quando limit 1;
  if estreia is not null then
    faltam := estreia - hoje;
    if faltam in (60, 30, 14, 7, 3, 1) then
      insert into public.notifications (user_id, kind, title_id, info)
      select u.user_id, 'countdown', 'doomsday',
             case when faltam = 1 then 'Amanhã estreia Vingadores: Doutor Destino. Já viu o essencial?'
                  else format('Faltam %s dias para Vingadores: Doutor Destino.', faltam) end
      from (select distinct m.user_id from public.marks m) u
      where not exists (select 1 from public.notifications n
                        where n.user_id = u.user_id and n.kind = 'countdown' and n.created_at > now() - interval '20 hours');
    end if;
  end if;

  -- 3. Domingo: quem tem o celular inscrito e não marcou nada nos últimos 3 dias recebe um lembrete
  if extract(dow from hoje) = 0 and estreia is not null and estreia > hoje then
    insert into public.notifications (user_id, kind, info)
    select m.user_id, 'weekly',
           format('Você já viu %s títulos da Marvel. Faltam %s dias para Doutor Destino: que tal o próximo da ordem hoje?', count(*), estreia - hoje)
    from public.marks m
    where exists (select 1 from public.push_subscriptions s where s.user_id = m.user_id)
    group by m.user_id
    having max(m.updated_at) < now() - interval '3 days'
       and not exists (select 1 from public.notifications n
                       where n.user_id = m.user_id and n.kind = 'weekly' and n.created_at > now() - interval '6 days');
  end if;
end $$;
revoke all on function app_private.cria_avisos() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Agenda: todo dia às 13h UTC (10h de Brasília)
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'cronomovie-avisos';
select cron.schedule('cronomovie-avisos', '0 13 * * *', 'select app_private.cria_avisos()');
