-- Cronomovie: foto de perfil enviada pela própria pessoa (galeria ou câmera).
-- Aplicado em 13/10/2026 pelo conector do Supabase. Pode rodar de novo sem problema.
--
-- As fotos ficam no armazenamento do Supabase, no balde "avatars", uma pasta por pessoa:
--   avatars/<id da pessoa>/<versão>.jpg
-- O perfil guarda só "foto:<versão>" na coluna avatar (o site monta o endereço).
-- O site já manda a imagem cortada em 320 x 320, em JPEG; o limite de 200 KB é só uma trava.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 204800, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- O balde é público pra leitura (a foto aparece pros amigos e na busca), mas cada um só
-- lista, envia e apaga dentro da própria pasta.
drop policy if exists "foto de perfil: listar as próprias" on storage.objects;
create policy "foto de perfil: listar as próprias" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "foto de perfil: enviar a própria" on storage.objects;
create policy "foto de perfil: enviar a própria" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "foto de perfil: apagar a própria" on storage.objects;
create policy "foto de perfil: apagar a própria" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
