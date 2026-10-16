-- Cronomovie: índice recomendado pelo Supabase (aplicado em 14/10/2026, autorizado pelo usuário).
-- Deixa rápida a busca de amizades pelo lado de quem recebeu o pedido, usada pelas regras
-- que mostram as marcações e listas só para os amigos.

create index if not exists friendships_addressee_idx on public.friendships (addressee, requester);
