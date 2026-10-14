-- Cronomovie: listas (quero ver / assistindo agora), episódios vistos e nome de usuário único.
-- Rode UMA vez no SQL Editor do Supabase (New query > colar > Run). Não apaga nada.

-- ---------------------------------------------------------------------------
-- Listas e episódios: uma linha por pessoa e título
-- ---------------------------------------------------------------------------
create table if not exists public.watch_state (
  user_id uuid not null references public.profiles (id) on delete cascade,
  title_id text not null check (char_length(title_id) between 1 and 40),
  list text check (list in ('quero', 'assistindo')),
  -- episódios vistos, no formato "temporada:episódio" (ex.: "0:3" = 1ª temporada da lista, episódio 3)
  episodes text[] not null default '{}' check (cardinality(episodes) <= 400),
  updated_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

alter table public.watch_state enable row level security;

drop policy if exists "vejo as minhas listas e as dos amigos" on public.watch_state;
create policy "vejo as minhas listas e as dos amigos" on public.watch_state
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester = (select auth.uid()) and f.addressee = watch_state.user_id)
          or (f.addressee = (select auth.uid()) and f.requester = watch_state.user_id))
    )
  );

drop policy if exists "cada um cria o seu" on public.watch_state;
create policy "cada um cria o seu" on public.watch_state
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "cada um muda o seu" on public.watch_state;
create policy "cada um muda o seu" on public.watch_state
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "cada um apaga o seu" on public.watch_state;
create policy "cada um apaga o seu" on public.watch_state
  for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.watch_state replica identity full;

-- ---------------------------------------------------------------------------
-- Nome de usuário único (@)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists username text
  check (username is null or username ~ '^[a-z0-9_.]{3,20}$');

create unique index if not exists profiles_username_unico on public.profiles (lower(username));

-- Deixa o cadastro checar se o @ está livre antes de criar a conta.
create or replace function public.username_available(u text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select lower(u) ~ '^[a-z0-9_.]{3,20}$'
     and not exists (select 1 from public.profiles where lower(username) = lower(u));
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- Cadastro: além do nome e da foto, grava o @ escolhido.
create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected text;
  uname text := lower(nullif(trim(new.raw_user_meta_data ->> 'username'), ''));
begin
  select invite_code into expected from app_private.settings where id;
  if expected is not null
     and upper(coalesce(new.raw_user_meta_data ->> 'invite', '')) <> upper(expected) then
    raise exception 'INVALID_INVITE';
  end if;

  if uname is not null and (uname !~ '^[a-z0-9_.]{3,20}$'
     or exists (select 1 from public.profiles where lower(username) = uname)) then
    raise exception 'USERNAME_TAKEN';
  end if;

  insert into public.profiles (id, name, color, avatar, username)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), 'Sem nome'), 20),
    coalesce(new.raw_user_meta_data ->> 'color', '#0E8A94'),
    left(nullif(new.raw_user_meta_data ->> 'avatar', ''), 40),
    uname
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atualização ao vivo
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'watch_state') then
    alter publication supabase_realtime add table public.watch_state;
  end if;
end $$;
