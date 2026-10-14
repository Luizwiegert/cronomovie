-- Cronomovie: filme favorito no perfil e link de perfil (compartilhar / convidar amigo).
-- Aplicado em 13/10/2026 pelo conector do Supabase. Pode rodar de novo sem problema.

-- Filme ou série favorita: guarda o id do título (o mesmo usado no site, ex.: "ultimato").
alter table public.profiles
  add column if not exists favorite text check (favorite is null or char_length(favorite) <= 40);

-- Cartão do perfil pra quem abre o link cronomovie.com/?u=<nome de usuário>.
-- Devolve só o que é público (nome, @, foto e favorito) e funciona mesmo sem conta,
-- pra pessoa ver quem a convidou antes de se cadastrar. Marcações e notas continuam só pros amigos.
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
  limit 1
$$;

revoke all on function public.profile_card(text) from public;
grant execute on function public.profile_card(text) to anon, authenticated;
