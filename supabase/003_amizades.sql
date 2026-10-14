-- Cronomovie: amizades.
-- Rode UMA vez no SQL Editor do Supabase (New query > colar > Run).
-- Depois disso, cada um só vê o progresso de quem é amigo. Não apaga nada.

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
