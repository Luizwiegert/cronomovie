-- Cronomovie: perfil e amigos no modelo do Instagram.
-- Busca rápida (com ou sem acento), amigos em comum, sugestões, lista de amigos de um amigo,
-- bloquear e limite de pedidos por dia. Aplicado em 14/10/2026 com a autorização do Luiz.
-- Não apaga dados. Pode rodar de novo sem problema.
--
-- Para desfazer a regra nova de quem vê cada perfil (e voltar a todo mundo logado ver todos):
--   drop policy "vejo o meu perfil e o de quem tem ligação comigo" on public.profiles;
--   create policy "perfis visíveis pra turma" on public.profiles for select to authenticated using (true);

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Busca: texto minúsculo e sem acento ("joao" acha "João"), com índice para ficar rápida com milhares de contas
-- ---------------------------------------------------------------------------
create or replace function app_private.busca(t text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$ select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, ''))) $$;

create index if not exists profiles_busca_nome on public.profiles using gin (app_private.busca(name) extensions.gin_trgm_ops);
create index if not exists profiles_busca_user on public.profiles using gin (lower(username) extensions.gin_trgm_ops);
-- Conta os pedidos enviados no dia (limite contra spam)
create index if not exists friendships_pedidos_do_dia on public.friendships (requester, created_at);

-- ---------------------------------------------------------------------------
-- Bloqueios: quem bloqueia some para a outra pessoa (busca, perfil, sugestões e pedidos)
-- ---------------------------------------------------------------------------
create table if not exists public.blocks (
  blocker uuid not null references public.profiles (id) on delete cascade,
  blocked uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index if not exists blocks_bloqueado on public.blocks (blocked, blocker);

alter table public.blocks enable row level security;
drop policy if exists "vejo quem eu bloqueei" on public.blocks;
create policy "vejo quem eu bloqueei" on public.blocks
  for select to authenticated
  using (blocker = (select auth.uid()));
-- Bloquear e desbloquear passam pelas funções lá embaixo (que também desfazem a amizade)
revoke insert, update, delete on public.blocks from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ajudantes (fora do alcance do site; só as funções daqui usam)
-- ---------------------------------------------------------------------------
-- Amigos aceitos de uma pessoa
create or replace function app_private.amigos(u uuid)
returns table (id uuid)
language sql
stable
set search_path = ''
as $$
  select case when f.requester = u then f.addressee else f.requester end
  from public.friendships f
  where f.status = 'accepted' and (f.requester = u or f.addressee = u)
$$;

-- Existe bloqueio entre as duas pessoas, em qualquer direção?
create or replace function app_private.bloqueio(a uuid, b uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.blocks k where (k.blocker = a and k.blocked = b) or (k.blocker = b and k.blocked = a))
$$;

-- Amigos em comum: quantos são e até 3 deles (para escrever "Ana, Bia e mais 2")
create or replace function app_private.em_comum(me uuid, other uuid)
returns table (total int, ids uuid[])
language sql
stable
set search_path = ''
as $$
  select count(*)::int, coalesce((array_agg(x.id order by p.name))[1:3], '{}')
  from app_private.amigos(other) x
  join app_private.amigos(me) y on y.id = x.id
  join public.profiles p on p.id = x.id
$$;

-- ---------------------------------------------------------------------------
-- Pedido de amizade: não passa se houver bloqueio, e cada conta manda no máximo 50 por dia
-- ---------------------------------------------------------------------------
create or replace function app_private.antes_do_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app_private.bloqueio(new.requester, new.addressee) then
    raise exception 'pedido indisponível' using errcode = 'P0001';
  end if;
  if (select count(*) from public.friendships f
      where f.requester = new.requester and f.created_at > now() - interval '1 day') >= 50 then
    raise exception 'limite de pedidos por dia' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists antes_do_pedido on public.friendships;
create trigger antes_do_pedido before insert on public.friendships
  for each row execute function app_private.antes_do_pedido();

-- ---------------------------------------------------------------------------
-- Quem vê cada perfil direto na tabela: você e quem tem amizade ou pedido com você.
-- Os outros perfis só aparecem pelas funções abaixo (busca, sugestões e perfil), que respeitam os bloqueios.
-- ---------------------------------------------------------------------------
drop policy if exists "perfis visíveis pra turma" on public.profiles;
drop policy if exists "vejo o meu perfil e o de quem tem ligação comigo" on public.profiles;
create policy "vejo o meu perfil e o de quem tem ligação comigo" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.friendships f
      where (f.requester = (select auth.uid()) and f.addressee = profiles.id)
         or (f.addressee = (select auth.uid()) and f.requester = profiles.id)
    )
  );

-- ---------------------------------------------------------------------------
-- Busca de pessoas: @ exato primeiro, depois quem começa com o texto, depois quem tem mais amigos em comum
-- ---------------------------------------------------------------------------
create or replace function public.search_people(q text, lim int default 20, off int default 0)
returns table (id uuid, name text, username text, avatar text, favorite text, color text, mutual int, mutual_ids uuid[])
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := (select auth.uid());
  k text := app_private.busca(btrim(regexp_replace(coalesce(q, ''), '^\s*@', '')));
  esc text;
begin
  if me is null or char_length(k) < 2 then return; end if;
  lim := least(greatest(coalesce(lim, 20), 1), 50);
  off := least(greatest(coalesce(off, 0), 0), 500);
  esc := replace(replace(replace(k, '\', '\\'), '%', '\%'), '_', '\_');
  return query
  with cand as (
    select p.id, p.name, p.username, p.avatar, p.favorite, p.color,
      case
        when lower(p.username) = k then 0
        when lower(p.username) like esc || '%' then 1
        when app_private.busca(p.name) like esc || '%' or app_private.busca(p.name) like '% ' || esc || '%' then 2
        else 3
      end as rk
    from public.profiles p
    where p.id <> me
      and (app_private.busca(p.name) like '%' || esc || '%' or lower(p.username) like '%' || esc || '%')
      and not app_private.bloqueio(me, p.id)
    order by rk, p.name
    limit 200
  )
  select c.id, c.name, c.username, c.avatar, c.favorite, c.color, m.total, m.ids
  from cand c cross join lateral app_private.em_comum(me, c.id) m
  order by c.rk, m.total desc, c.name
  limit lim offset off;
end $$;

-- ---------------------------------------------------------------------------
-- Pessoas que talvez você conheça: amigos dos seus amigos, quem tem mais amigos em comum primeiro
-- ---------------------------------------------------------------------------
create or replace function public.people_suggestions(lim int default 12)
returns table (id uuid, name text, username text, avatar text, favorite text, color text, mutual int, mutual_ids uuid[])
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := (select auth.uid());
begin
  if me is null then return; end if;
  lim := least(greatest(coalesce(lim, 12), 1), 30);
  return query
  with meus as (select a.id from app_private.amigos(me) a),
  fof as (
    select b.id as cand, count(*)::int as total, (array_agg(m.id))[1:3] as ids
    from meus m cross join lateral app_private.amigos(m.id) b
    where b.id <> me
    group by b.id
  )
  select p.id, p.name, p.username, p.avatar, p.favorite, p.color, f.total, f.ids
  from fof f join public.profiles p on p.id = f.cand
  where not exists (
      select 1 from public.friendships x
      where (x.requester = me and x.addressee = f.cand) or (x.addressee = me and x.requester = f.cand)
    )
    and not app_private.bloqueio(me, f.cand)
  order by f.total desc, p.name
  limit lim;
end $$;

-- ---------------------------------------------------------------------------
-- Cabeçalho de um perfil: foto, nome, @ e favorito para qualquer conta (menos com bloqueio).
-- O número de amigos só aparece para a própria pessoa e para os amigos dela.
-- ---------------------------------------------------------------------------
create or replace function public.profile_info(target uuid)
returns table (id uuid, name text, username text, avatar text, favorite text, color text, friends int, mutual int, mutual_ids uuid[])
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := (select auth.uid());
  perto boolean;
begin
  if me is null or target is null or app_private.bloqueio(me, target) then return; end if;
  perto := target = me or exists (select 1 from app_private.amigos(me) a where a.id = target);
  return query
  select p.id, p.name, p.username, p.avatar, p.favorite, p.color,
    case when perto then (select count(*)::int from app_private.amigos(target)) end,
    m.total, m.ids
  from public.profiles p cross join lateral app_private.em_comum(me, target) m
  where p.id = target;
end $$;

-- ---------------------------------------------------------------------------
-- Lista de amigos de alguém: só a própria pessoa e os amigos dela veem. Busca pelo nome e vem em páginas.
-- ---------------------------------------------------------------------------
create or replace function public.friends_list(target uuid, q text default '', lim int default 30, off int default 0)
returns table (id uuid, name text, username text, avatar text, favorite text, color text, in_common boolean, total int)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := (select auth.uid());
  k text := app_private.busca(btrim(regexp_replace(coalesce(q, ''), '^\s*@', '')));
  esc text;
begin
  if me is null or target is null then return; end if;
  if target <> me and not exists (select 1 from app_private.amigos(me) a where a.id = target) then return; end if;
  lim := least(greatest(coalesce(lim, 30), 1), 60);
  off := greatest(coalesce(off, 0), 0);
  esc := replace(replace(replace(k, '\', '\\'), '%', '\%'), '_', '\_');
  return query
  with meus as (select a.id from app_private.amigos(me) a),
  lst as (
    select p.id, p.name, p.username, p.avatar, p.favorite, p.color,
      (p.id = me or exists (select 1 from meus mi where mi.id = p.id)) as comum
    from app_private.amigos(target) f join public.profiles p on p.id = f.id
    where (k = '' or app_private.busca(p.name) like '%' || esc || '%' or lower(p.username) like '%' || esc || '%')
      and not app_private.bloqueio(me, p.id)
  )
  select l.id, l.name, l.username, l.avatar, l.favorite, l.color, l.comum, (count(*) over ())::int
  from lst l
  order by (l.id = me) desc, l.comum desc, l.name
  limit lim offset off;
end $$;

-- ---------------------------------------------------------------------------
-- Bloquear, desbloquear e a lista de quem você bloqueou
-- ---------------------------------------------------------------------------
create or replace function public.block_user(target uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or target is null or target = me then return; end if;
  insert into public.blocks (blocker, blocked) values (me, target) on conflict do nothing;
  delete from public.friendships f
  where (f.requester = me and f.addressee = target) or (f.requester = target and f.addressee = me);
end $$;

create or replace function public.unblock_user(target uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$ delete from public.blocks b where b.blocker = (select auth.uid()) and b.blocked = target $$;

create or replace function public.blocked_list()
returns table (id uuid, name text, username text, avatar text, favorite text, color text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.username, p.avatar, p.favorite, p.color
  from public.blocks b join public.profiles p on p.id = b.blocked
  where b.blocker = (select auth.uid())
  order by b.created_at desc
$$;

-- O cartão do link de perfil (?u= e /@usuario) também some para quem foi bloqueado
create or replace function public.profile_card(u text)
returns table (id uuid, name text, username text, avatar text, favorite text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.username, p.avatar, p.favorite
  from public.profiles p
  where p.username is not null and lower(p.username) = lower(trim(u))
    and ((select auth.uid()) is null or not app_private.bloqueio((select auth.uid()), p.id))
  limit 1
$$;

-- Só quem está logado usa as funções novas (o cartão do link continua aberto para quem não tem conta)
revoke all on function public.search_people(text, int, int) from public, anon;
revoke all on function public.people_suggestions(int) from public, anon;
revoke all on function public.profile_info(uuid) from public, anon;
revoke all on function public.friends_list(uuid, text, int, int) from public, anon;
revoke all on function public.block_user(uuid) from public, anon;
revoke all on function public.unblock_user(uuid) from public, anon;
revoke all on function public.blocked_list() from public, anon;
grant execute on function public.search_people(text, int, int) to authenticated;
grant execute on function public.people_suggestions(int) to authenticated;
grant execute on function public.profile_info(uuid) to authenticated;
grant execute on function public.friends_list(uuid, text, int, int) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.blocked_list() to authenticated;
revoke all on function public.profile_card(text) from public;
grant execute on function public.profile_card(text) to anon, authenticated;
