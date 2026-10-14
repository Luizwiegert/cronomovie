-- Cronomovie: nome do perfil de quem entra pelo Google, Facebook ou Discord.
-- O cadastro por e-mail continua igual (vale o nome que a pessoa escreveu).
-- Discord: usa o apelido de exibição; sem apelido, o nome de usuário sem o "#0" do fim.
-- O nome é cortado em 20 letras (limite do perfil), sem espaço sobrando no fim.

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
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
    rtrim(left(coalesce(
      nullif(trim(new.raw_user_meta_data -> 'custom_claims' ->> 'global_name'), ''),
      nullif(trim(regexp_replace(coalesce(new.raw_user_meta_data ->> 'name', ''), '#[0-9]+$', '')), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      'Sem nome'), 20)),
    coalesce(new.raw_user_meta_data ->> 'color', '#0E8A94'),
    left(nullif(new.raw_user_meta_data ->> 'avatar', ''), 40),
    uname
  );
  return new;
end;
$function$;
