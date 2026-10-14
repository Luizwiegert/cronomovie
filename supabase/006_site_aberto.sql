-- Cronomovie: ajustes pro site aberto ao público.
-- Cole este arquivo inteiro em SQL Editor > New query e clique em Run.
-- Pode rodar de novo sem problema.

-- ---------------------------------------------------------------------------
-- 1. Apaga a conta de teste criada na verificação do cadastro aberto
-- ---------------------------------------------------------------------------
delete from auth.users where email like 'verifica.aberto.%@gmail.com';

-- ---------------------------------------------------------------------------
-- 2. Cadastro: volta a conferir e gravar o @ (a função tinha voltado pra uma versão antiga)
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
  -- Código de convite: só confere se tiver um guardado (hoje o cadastro é aberto).
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
-- 3. Excluir a própria conta (botão em Perfil > Editar perfil)
--    Apaga o usuário; perfil, marcações, listas e amizades vão junto.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Conferência: quantas contas existem e quantas ainda estão sem @
-- ---------------------------------------------------------------------------
select count(*) as contas, count(*) filter (where username is null) as sem_arroba from public.profiles;
