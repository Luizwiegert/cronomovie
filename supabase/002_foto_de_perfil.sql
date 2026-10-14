-- ATENÇÃO: arquivo antigo, já aplicado. NÃO rode de novo: ele recria a função de cadastro numa versão
-- anterior (sem o @). A versão atual está em 006_site_aberto.sql e em schema.sql.

-- Cronomovie: foto de perfil (personagem).
-- Rode UMA vez no SQL Editor do Supabase (New query > colar > Run).
-- Não apaga nada: só acrescenta o campo da foto e ensina o cadastro a guardar ela.

alter table public.profiles
  add column if not exists avatar text check (avatar is null or char_length(avatar) <= 40);

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
