-- Cronomovie: cadastro aberto, sem código de convite.
-- Cole este arquivo inteiro em SQL Editor > New query e clique em Run.
-- Quem já tem conta não é afetado.

-- O código passa a ser opcional e fica vazio: sem código guardado, o cadastro não confere nada.
alter table app_private.settings alter column invite_code drop not null;
update app_private.settings set invite_code = null where id;

-- Pra fechar de novo por convite no futuro, é só guardar um código:
--   update app_private.settings set invite_code = 'SEU-CODIGO' where id;
