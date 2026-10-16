-- Cronomovie: curtidas em comentários, central de notificações e notificações no celular (Web Push).
-- Aplicado em 14/10/2026 com a autorização do Luiz. Não apaga dados existentes. Pode rodar de novo sem problema.

create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Curtidas em comentários: só em comentário de amigo, e somem se o comentário mudar ou for apagado
-- ---------------------------------------------------------------------------
create table if not exists public.comment_likes (
  liker uuid not null references public.profiles (id) on delete cascade,
  owner uuid not null references public.profiles (id) on delete cascade,
  title_id text not null check (char_length(title_id) <= 40),
  created_at timestamptz not null default now(),
  primary key (liker, owner, title_id),
  check (liker <> owner)
);
create index if not exists comment_likes_dono on public.comment_likes (owner, title_id);
alter table public.comment_likes enable row level security;

drop policy if exists "vejo curtidas dos comentários que posso ver" on public.comment_likes;
create policy "vejo curtidas dos comentários que posso ver" on public.comment_likes
  for select to authenticated
  using (
    liker = (select auth.uid()) or owner = (select auth.uid())
    or exists (select 1 from public.friendships f where f.status = 'accepted'
      and ((f.requester = (select auth.uid()) and f.addressee = comment_likes.owner)
        or (f.addressee = (select auth.uid()) and f.requester = comment_likes.owner)))
  );
drop policy if exists "curto comentário de amigo" on public.comment_likes;
create policy "curto comentário de amigo" on public.comment_likes
  for insert to authenticated
  with check (
    liker = (select auth.uid())
    and exists (select 1 from public.friendships f where f.status = 'accepted'
      and ((f.requester = (select auth.uid()) and f.addressee = comment_likes.owner)
        or (f.addressee = (select auth.uid()) and f.requester = comment_likes.owner)))
    and exists (select 1 from public.marks m where m.user_id = comment_likes.owner and m.title_id = comment_likes.title_id and m.comment <> '')
  );
drop policy if exists "descurto o que curti" on public.comment_likes;
create policy "descurto o que curti" on public.comment_likes
  for delete to authenticated
  using (liker = (select auth.uid()));
revoke update on public.comment_likes from anon, authenticated;

create or replace function app_private.limpa_curtidas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or new.comment is distinct from old.comment then
    delete from public.comment_likes where owner = old.user_id and title_id = old.title_id;
  end if;
  return null;
end $$;
drop trigger if exists limpa_curtidas on public.marks;
create trigger limpa_curtidas after update of comment or delete on public.marks
  for each row execute function app_private.limpa_curtidas();

-- ---------------------------------------------------------------------------
-- Notificações: pedido recebido, pedido aceito e curtida. Só o banco cria; cada um vê e apaga as suas.
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('request', 'accepted', 'like')),
  title_id text check (title_id is null or char_length(title_id) <= 40),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  pushed_at timestamptz
);
create index if not exists notifications_pessoa on public.notifications (user_id, created_at desc);
create index if not exists notifications_autor on public.notifications (actor_id);
alter table public.notifications enable row level security;
drop policy if exists "vejo as minhas notificações" on public.notifications;
create policy "vejo as minhas notificações" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "apago as minhas notificações" on public.notifications;
create policy "apago as minhas notificações" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));
revoke insert, update on public.notifications from anon, authenticated;

create or replace function app_private.notifica_amizade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, actor_id, kind) values (new.addressee, new.requester, 'request');
  elsif tg_op = 'UPDATE' then
    if new.status = 'accepted' and old.status <> 'accepted' then
      delete from public.notifications where user_id = new.addressee and actor_id = new.requester and kind = 'request';
      insert into public.notifications (user_id, actor_id, kind) values (new.requester, new.addressee, 'accepted');
    end if;
  elsif old.status = 'pending' then
    -- Pedido cancelado ou recusado: a notificação dele some
    delete from public.notifications where user_id = old.addressee and actor_id = old.requester and kind = 'request';
  end if;
  return null;
end $$;
drop trigger if exists notifica_amizade on public.friendships;
create trigger notifica_amizade after insert or update or delete on public.friendships
  for each row execute function app_private.notifica_amizade();

create or replace function app_private.notifica_curtida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.notifications n
                   where n.user_id = new.owner and n.actor_id = new.liker and n.kind = 'like' and n.title_id = new.title_id) then
      insert into public.notifications (user_id, actor_id, kind, title_id) values (new.owner, new.liker, 'like', new.title_id);
    end if;
  else
    delete from public.notifications
    where user_id = old.owner and actor_id = old.liker and kind = 'like' and title_id = old.title_id and read_at is null;
  end if;
  return null;
end $$;
drop trigger if exists notifica_curtida on public.comment_likes;
create trigger notifica_curtida after insert or delete on public.comment_likes
  for each row execute function app_private.notifica_curtida();

-- Lista de notificações com o nome e a foto de quem fez (mesmo se a amizade já tiver acabado). Apaga as com mais de 90 dias.
create or replace function public.my_notifications(lim int default 50)
returns table (id bigint, kind text, title_id text, created_at timestamptz, read_at timestamptz,
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
  select n.id, n.kind, n.title_id, n.created_at, n.read_at, p.id, p.name, p.username, p.avatar, p.color
  from public.notifications n join public.profiles p on p.id = n.actor_id
  where n.user_id = me and not app_private.bloqueio(me, n.actor_id)
  order by n.created_at desc
  limit least(greatest(coalesce(lim, 50), 1), 100);
end $$;

create or replace function public.read_notifications()
returns void
language sql
volatile
security definer
set search_path = ''
as $$ update public.notifications set read_at = now() where user_id = (select auth.uid()) and read_at is null $$;

-- Bloquear também apaga as curtidas e as notificações entre as duas pessoas
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
  delete from public.comment_likes c
  where (c.liker = me and c.owner = target) or (c.liker = target and c.owner = me);
  delete from public.notifications n
  where (n.user_id = me and n.actor_id = target) or (n.user_id = target and n.actor_id = me);
end $$;

-- ---------------------------------------------------------------------------
-- Notificações no celular: o aparelho de cada um (inscrição do navegador) e as chaves do servidor
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  endpoint text primary key check (char_length(endpoint) <= 1000),
  user_id uuid not null references public.profiles (id) on delete cascade,
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index if not exists push_pessoa on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "vejo os meus aparelhos" on public.push_subscriptions;
create policy "vejo os meus aparelhos" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.push_subscriptions from anon, authenticated;

-- Chaves do servidor de notificações (criadas pela própria função "push" na primeira vez). Ninguém do site lê.
create table if not exists public.push_keys (
  id int primary key check (id = 1),
  keys jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.push_keys enable row level security;
revoke all on public.push_keys from anon, authenticated;

-- Liga este aparelho à conta (se o aparelho era de outra conta, passa a ser desta)
create or replace function public.save_push(endpoint_url text, key_p256dh text, key_auth text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or endpoint_url !~ '^https://' then return; end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
  values (endpoint_url, me, key_p256dh, key_auth)
  on conflict on constraint push_subscriptions_pkey do update set user_id = me, p256dh = excluded.p256dh, auth = excluded.auth;
end $$;

create or replace function public.drop_push(endpoint_url text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$ delete from public.push_subscriptions s where s.endpoint = endpoint_url and s.user_id = (select auth.uid()) $$;

-- Notificação nova: se a pessoa tem aparelho inscrito, pede para a função "push" enviar
create or replace function app_private.envia_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.push_subscriptions s where s.user_id = new.user_id) then
    perform net.http_post(
      url := 'https://ooqwxqvmnropamwabcsy.supabase.co/functions/v1/push',
      body := jsonb_build_object('id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  end if;
  return null;
exception when others then
  return null; -- o envio nunca impede a notificação de existir
end $$;
drop trigger if exists envia_push on public.notifications;
create trigger envia_push after insert on public.notifications
  for each row execute function app_private.envia_push();

-- ---------------------------------------------------------------------------
-- Permissões das funções e atualização ao vivo
-- ---------------------------------------------------------------------------
revoke all on function public.my_notifications(int) from public, anon;
revoke all on function public.read_notifications() from public, anon;
revoke all on function public.save_push(text, text, text) from public, anon;
revoke all on function public.drop_push(text) from public, anon;
revoke all on function public.block_user(uuid) from public, anon;
grant execute on function public.my_notifications(int) to authenticated;
grant execute on function public.read_notifications() to authenticated;
grant execute on function public.save_push(text, text, text) to authenticated;
grant execute on function public.drop_push(text) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comment_likes') then
    alter publication supabase_realtime add table public.comment_likes;
  end if;
end $$;
