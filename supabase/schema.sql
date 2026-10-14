-- Cronomovie: banco de dados no Supabase.
-- Cole este arquivo inteiro em SQL Editor > New query e clique em Run.
-- Pode rodar de novo sem problema: ele não apaga dados.

-- ---------------------------------------------------------------------------
-- Código de convite, opcional (fica numa tabela que o site não consegue ler).
-- Vazio = cadastro aberto. Pra fechar por convite: update app_private.settings set invite_code = 'CODIGO' where id;
-- ---------------------------------------------------------------------------
create schema if not exists app_private;

create table if not exists app_private.settings (
  id boolean primary key default true check (id),
  invite_code text
);

insert into app_private.settings (id, invite_code)
values (true, null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 20),
  color text not null default '#0E8A94' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  avatar text check (avatar is null or char_length(avatar) <= 40),
  created_at timestamptz not null default now()
);

-- Quem criou o banco antes da foto de perfil ganha o campo aqui.
alter table public.profiles
  add column if not exists avatar text check (avatar is null or char_length(avatar) <= 40);

-- Nome de usuário único (@). O índice único fica em 004_listas_episodios_usuario.sql.
alter table public.profiles
  add column if not exists username text
  check (username is null or username ~ '^[a-z0-9_.]{3,20}

-- ---------------------------------------------------------------------------
-- O que cada um viu, com nota e comentário
-- ---------------------------------------------------------------------------
create table if not exists public.marks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  title_id text not null check (char_length(title_id) between 1 and 40),
  rating smallint check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 140),
  watched_on date not null default current_date,
  updated_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

-- ---------------------------------------------------------------------------
-- Cria o perfil automaticamente no cadastro e confere o código de convite
-- ---------------------------------------------------------------------------
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

  if uname is not null and (uname !~ '^[a-z0-9_.]{3,20}
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Segurança: todo mundo logado vê tudo, cada um só mexe no que é seu
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.marks enable row level security;

drop policy if exists "perfis visíveis pra turma" on public.profiles;
create policy "perfis visíveis pra turma" on public.profiles
  for select to authenticated using (true);

drop policy if exists "cada um edita o próprio perfil" on public.profiles;
create policy "cada um edita o próprio perfil" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "marcações visíveis pra turma" on public.marks;
create policy "marcações visíveis pra turma" on public.marks
  for select to authenticated using (true);

drop policy if exists "cada um marca o que é seu" on public.marks;
create policy "cada um marca o que é seu" on public.marks
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "cada um altera o que é seu" on public.marks;
create policy "cada um altera o que é seu" on public.marks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "cada um apaga o que é seu" on public.marks;
create policy "cada um apaga o que é seu" on public.marks
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Atualização ao vivo (quando um amigo marca, aparece na hora pra todo mundo)
-- ---------------------------------------------------------------------------
alter table public.marks replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'marks') then
    alter publication supabase_realtime add table public.marks;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;

-- ===========================================================================
-- Amizades (também em 003_amizades.sql)
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- Pedidos de amizade e amizades aceitas
-- ---------------------------------------------------------------------------
create table if not exists public.friendships (
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (requester, addressee),
  check (requester <> addressee)
);

-- Um par só pode ter uma linha, não importa quem pediu.
create unique index if not exists friendships_par
  on public.friendships (least(requester, addressee), greatest(requester, addressee));

alter table public.friendships enable row level security;

drop policy if exists "vejo as minhas amizades" on public.friendships;
create policy "vejo as minhas amizades" on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (requester, addressee));

drop policy if exists "peço amizade em meu nome" on public.friendships;
create policy "peço amizade em meu nome" on public.friendships
  for insert to authenticated
  with check (requester = (select auth.uid()) and status = 'pending');

drop policy if exists "só quem recebeu aceita" on public.friendships;
create policy "só quem recebeu aceita" on public.friendships
  for update to authenticated
  using (addressee = (select auth.uid()) and status = 'pending')
  with check (addressee = (select auth.uid()) and status = 'accepted');

drop policy if exists "qualquer um dos dois desfaz" on public.friendships;
create policy "qualquer um dos dois desfaz" on public.friendships
  for delete to authenticated
  using ((select auth.uid()) in (requester, addressee));

-- Ao aceitar, só dá pra mudar o status e a data da resposta (não dá pra trocar quem é quem).
revoke update on public.friendships from authenticated;
grant update (status, responded_at) on public.friendships to authenticated;

-- ---------------------------------------------------------------------------
-- Marcações: antes todo mundo via tudo; agora só você e seus amigos
-- ---------------------------------------------------------------------------
drop policy if exists "marcações visíveis pra turma" on public.marks;
drop policy if exists "vejo as minhas e as dos amigos" on public.marks;
create policy "vejo as minhas e as dos amigos" on public.marks
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester = (select auth.uid()) and f.addressee = marks.user_id)
          or (f.addressee = (select auth.uid()) and f.requester = marks.user_id))
    )
  );

-- Perfis (nome e foto) continuam visíveis pra quem está logado: é assim que a busca por nome funciona.

-- ---------------------------------------------------------------------------
-- Atualização ao vivo dos pedidos
-- ---------------------------------------------------------------------------
alter table public.friendships replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friendships') then
    alter publication supabase_realtime add table public.friendships;
  end if;
end $$;
);

-- ---------------------------------------------------------------------------
-- O que cada um viu, com nota e comentário
-- ---------------------------------------------------------------------------
create table if not exists public.marks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  title_id text not null check (char_length(title_id) between 1 and 40),
  rating smallint check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 140),
  watched_on date not null default current_date,
  updated_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

-- ---------------------------------------------------------------------------
-- Cria o perfil automaticamente no cadastro e confere o código de convite
-- ---------------------------------------------------------------------------
create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected text;
begin
  select invite_code into expected from app_private.settings where id;
  if expected is not null
     and upper(coalesce(new.raw_user_meta_data ->> 'invite', '')) <> upper(expected) then
    raise exception 'INVALID_INVITE';
  end if;

  insert into public.profiles (id, name, color, avatar)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), 'Sem nome'), 20),
    coalesce(new.raw_user_meta_data ->> 'color', '#0E8A94'),
    left(nullif(new.raw_user_meta_data ->> 'avatar', ''), 40)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Segurança: todo mundo logado vê tudo, cada um só mexe no que é seu
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.marks enable row level security;

drop policy if exists "perfis visíveis pra turma" on public.profiles;
create policy "perfis visíveis pra turma" on public.profiles
  for select to authenticated using (true);

drop policy if exists "cada um edita o próprio perfil" on public.profiles;
create policy "cada um edita o próprio perfil" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "marcações visíveis pra turma" on public.marks;
create policy "marcações visíveis pra turma" on public.marks
  for select to authenticated using (true);

drop policy if exists "cada um marca o que é seu" on public.marks;
create policy "cada um marca o que é seu" on public.marks
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "cada um altera o que é seu" on public.marks;
create policy "cada um altera o que é seu" on public.marks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "cada um apaga o que é seu" on public.marks;
create policy "cada um apaga o que é seu" on public.marks
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Atualização ao vivo (quando um amigo marca, aparece na hora pra todo mundo)
-- ---------------------------------------------------------------------------
alter table public.marks replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'marks') then
    alter publication supabase_realtime add table public.marks;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;

-- ===========================================================================
-- Amizades (também em 003_amizades.sql)
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- Pedidos de amizade e amizades aceitas
-- ---------------------------------------------------------------------------
create table if not exists public.friendships (
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (requester, addressee),
  check (requester <> addressee)
);

-- Um par só pode ter uma linha, não importa quem pediu.
create unique index if not exists friendships_par
  on public.friendships (least(requester, addressee), greatest(requester, addressee));

alter table public.friendships enable row level security;

drop policy if exists "vejo as minhas amizades" on public.friendships;
create policy "vejo as minhas amizades" on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (requester, addressee));

drop policy if exists "peço amizade em meu nome" on public.friendships;
create policy "peço amizade em meu nome" on public.friendships
  for insert to authenticated
  with check (requester = (select auth.uid()) and status = 'pending');

drop policy if exists "só quem recebeu aceita" on public.friendships;
create policy "só quem recebeu aceita" on public.friendships
  for update to authenticated
  using (addressee = (select auth.uid()) and status = 'pending')
  with check (addressee = (select auth.uid()) and status = 'accepted');

drop policy if exists "qualquer um dos dois desfaz" on public.friendships;
create policy "qualquer um dos dois desfaz" on public.friendships
  for delete to authenticated
  using ((select auth.uid()) in (requester, addressee));

-- Ao aceitar, só dá pra mudar o status e a data da resposta (não dá pra trocar quem é quem).
revoke update on public.friendships from authenticated;
grant update (status, responded_at) on public.friendships to authenticated;

-- ---------------------------------------------------------------------------
-- Marcações: antes todo mundo via tudo; agora só você e seus amigos
-- ---------------------------------------------------------------------------
drop policy if exists "marcações visíveis pra turma" on public.marks;
drop policy if exists "vejo as minhas e as dos amigos" on public.marks;
create policy "vejo as minhas e as dos amigos" on public.marks
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester = (select auth.uid()) and f.addressee = marks.user_id)
          or (f.addressee = (select auth.uid()) and f.requester = marks.user_id))
    )
  );

-- Perfis (nome e foto) continuam visíveis pra quem está logado: é assim que a busca por nome funciona.

-- ---------------------------------------------------------------------------
-- Atualização ao vivo dos pedidos
-- ---------------------------------------------------------------------------
alter table public.friendships replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friendships') then
    alter publication supabase_realtime add table public.friendships;
  end if;
end $$;

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Segurança: todo mundo logado vê tudo, cada um só mexe no que é seu
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.marks enable row level security;

drop policy if exists "perfis visíveis pra turma" on public.profiles;
create policy "perfis visíveis pra turma" on public.profiles
  for select to authenticated using (true);

drop policy if exists "cada um edita o próprio perfil" on public.profiles;
create policy "cada um edita o próprio perfil" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "marcações visíveis pra turma" on public.marks;
create policy "marcações visíveis pra turma" on public.marks
  for select to authenticated using (true);

drop policy if exists "cada um marca o que é seu" on public.marks;
create policy "cada um marca o que é seu" on public.marks
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "cada um altera o que é seu" on public.marks;
create policy "cada um altera o que é seu" on public.marks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "cada um apaga o que é seu" on public.marks;
create policy "cada um apaga o que é seu" on public.marks
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Atualização ao vivo (quando um amigo marca, aparece na hora pra todo mundo)
-- ---------------------------------------------------------------------------
alter table public.marks replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'marks') then
    alter publication supabase_realtime add table public.marks;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;

-- ===========================================================================
-- Amizades (também em 003_amizades.sql)
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- Pedidos de amizade e amizades aceitas
-- ---------------------------------------------------------------------------
create table if not exists public.friendships (
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (requester, addressee),
  check (requester <> addressee)
);

-- Um par só pode ter uma linha, não importa quem pediu.
create unique index if not exists friendships_par
  on public.friendships (least(requester, addressee), greatest(requester, addressee));

alter table public.friendships enable row level security;

drop policy if exists "vejo as minhas amizades" on public.friendships;
create policy "vejo as minhas amizades" on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (requester, addressee));

drop policy if exists "peço amizade em meu nome" on public.friendships;
create policy "peço amizade em meu nome" on public.friendships
  for insert to authenticated
  with check (requester = (select auth.uid()) and status = 'pending');

drop policy if exists "só quem recebeu aceita" on public.friendships;
create policy "só quem recebeu aceita" on public.friendships
  for update to authenticated
  using (addressee = (select auth.uid()) and status = 'pending')
  with check (addressee = (select auth.uid()) and status = 'accepted');

drop policy if exists "qualquer um dos dois desfaz" on public.friendships;
create policy "qualquer um dos dois desfaz" on public.friendships
  for delete to authenticated
  using ((select auth.uid()) in (requester, addressee));

-- Ao aceitar, só dá pra mudar o status e a data da resposta (não dá pra trocar quem é quem).
revoke update on public.friendships from authenticated;
grant update (status, responded_at) on public.friendships to authenticated;

-- ---------------------------------------------------------------------------
-- Marcações: antes todo mundo via tudo; agora só você e seus amigos
-- ---------------------------------------------------------------------------
drop policy if exists "marcações visíveis pra turma" on public.marks;
drop policy if exists "vejo as minhas e as dos amigos" on public.marks;
create policy "vejo as minhas e as dos amigos" on public.marks
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester = (select auth.uid()) and f.addressee = marks.user_id)
          or (f.addressee = (select auth.uid()) and f.requester = marks.user_id))
    )
  );

-- Perfis (nome e foto) continuam visíveis pra quem está logado: é assim que a busca por nome funciona.

-- ---------------------------------------------------------------------------
-- Atualização ao vivo dos pedidos
-- ---------------------------------------------------------------------------
alter table public.friendships replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friendships') then
    alter publication supabase_realtime add table public.friendships;
  end if;
end $$;
);

-- ---------------------------------------------------------------------------
-- O que cada um viu, com nota e comentário
-- ---------------------------------------------------------------------------
create table if not exists public.marks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  title_id text not null check (char_length(title_id) between 1 and 40),
  rating smallint check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 140),
  watched_on date not null default current_date,
  updated_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

-- ---------------------------------------------------------------------------
-- Cria o perfil automaticamente no cadastro e confere o código de convite
-- ---------------------------------------------------------------------------
create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected text;
begin
  select invite_code into expected from app_private.settings where id;
  if expected is not null
     and upper(coalesce(new.raw_user_meta_data ->> 'invite', '')) <> upper(expected) then
    raise exception 'INVALID_INVITE';
  end if;

  insert into public.profiles (id, name, color, avatar)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), 'Sem nome'), 20),
    coalesce(new.raw_user_meta_data ->> 'color', '#0E8A94'),
    left(nullif(new.raw_user_meta_data ->> 'avatar', ''), 40)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Segurança: todo mundo logado vê tudo, cada um só mexe no que é seu
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.marks enable row level security;

drop policy if exists "perfis visíveis pra turma" on public.profiles;
create policy "perfis visíveis pra turma" on public.profiles
  for select to authenticated using (true);

drop policy if exists "cada um edita o próprio perfil" on public.profiles;
create policy "cada um edita o próprio perfil" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "marcações visíveis pra turma" on public.marks;
create policy "marcações visíveis pra turma" on public.marks
  for select to authenticated using (true);

drop policy if exists "cada um marca o que é seu" on public.marks;
create policy "cada um marca o que é seu" on public.marks
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "cada um altera o que é seu" on public.marks;
create policy "cada um altera o que é seu" on public.marks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "cada um apaga o que é seu" on public.marks;
create policy "cada um apaga o que é seu" on public.marks
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Atualização ao vivo (quando um amigo marca, aparece na hora pra todo mundo)
-- ---------------------------------------------------------------------------
alter table public.marks replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'marks') then
    alter publication supabase_realtime add table public.marks;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;

-- ===========================================================================
-- Amizades (também em 003_amizades.sql)
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- Pedidos de amizade e amizades aceitas
-- ---------------------------------------------------------------------------
create table if not exists public.friendships (
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (requester, addressee),
  check (requester <> addressee)
);

-- Um par só pode ter uma linha, não importa quem pediu.
create unique index if not exists friendships_par
  on public.friendships (least(requester, addressee), greatest(requester, addressee));

alter table public.friendships enable row level security;

drop policy if exists "vejo as minhas amizades" on public.friendships;
create policy "vejo as minhas amizades" on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (requester, addressee));

drop policy if exists "peço amizade em meu nome" on public.friendships;
create policy "peço amizade em meu nome" on public.friendships
  for insert to authenticated
  with check (requester = (select auth.uid()) and status = 'pending');

drop policy if exists "só quem recebeu aceita" on public.friendships;
create policy "só quem recebeu aceita" on public.friendships
  for update to authenticated
  using (addressee = (select auth.uid()) and status = 'pending')
  with check (addressee = (select auth.uid()) and status = 'accepted');

drop policy if exists "qualquer um dos dois desfaz" on public.friendships;
create policy "qualquer um dos dois desfaz" on public.friendships
  for delete to authenticated
  using ((select auth.uid()) in (requester, addressee));

-- Ao aceitar, só dá pra mudar o status e a data da resposta (não dá pra trocar quem é quem).
revoke update on public.friendships from authenticated;
grant update (status, responded_at) on public.friendships to authenticated;

-- ---------------------------------------------------------------------------
-- Marcações: antes todo mundo via tudo; agora só você e seus amigos
-- ---------------------------------------------------------------------------
drop policy if exists "marcações visíveis pra turma" on public.marks;
drop policy if exists "vejo as minhas e as dos amigos" on public.marks;
create policy "vejo as minhas e as dos amigos" on public.marks
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester = (select auth.uid()) and f.addressee = marks.user_id)
          or (f.addressee = (select auth.uid()) and f.requester = marks.user_id))
    )
  );

-- Perfis (nome e foto) continuam visíveis pra quem está logado: é assim que a busca por nome funciona.

-- ---------------------------------------------------------------------------
-- Atualização ao vivo dos pedidos
-- ---------------------------------------------------------------------------
alter table public.friendships replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friendships') then
    alter publication supabase_realtime add table public.friendships;
  end if;
end $$;
