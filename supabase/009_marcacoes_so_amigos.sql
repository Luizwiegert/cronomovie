-- Cronomovie: marcações visíveis só para a própria pessoa e os amigos aceitos.
-- A regra antiga ("marcações visíveis pra turma", liberada para qualquer conta) tinha voltado ao banco
-- e passava por cima da regra de amigos. Aplicada em 14/10/2026 (autorizada pelo usuário).
-- Para desfazer: create policy "marcações visíveis pra turma" on public.marks for select to authenticated using (true);

drop policy if exists "marcações visíveis pra turma" on public.marks;
