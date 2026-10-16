-- Métricas do Cronomovie: só leitura e só contagens, sem dados pessoais.
-- Rodar no Supabase (projeto ooqwxqvmnropamwabcsy). Comparar com a base registrada em 15/10/2026 23:22
-- (13 contas, 9 com marcação, 245 títulos marcados).

-- 1. Contas e uso: quem marca, quanto marca, quem volta e quanto demora a primeira marcação
with por_conta as (
  select u.id, u.created_at,
         count(m.title_id) as marcados,
         count(distinct (m.updated_at at time zone 'America/Sao_Paulo')::date) as dias_ativos,
         min(m.updated_at) as primeira_marca
  from auth.users u left join public.marks m on m.user_id = u.id
  group by u.id, u.created_at
)
select
  count(*) as contas,
  count(*) filter (where created_at >= now() - interval '7 days') as contas_novas_7d,
  count(*) filter (where marcados > 0) as marcaram_algo,
  count(*) filter (where marcados >= 10) as marcaram_10_ou_mais,
  count(*) filter (where dias_ativos >= 2) as voltaram_outro_dia,
  round(avg(marcados) filter (where marcados > 0), 1) as media_titulos_por_quem_marcou,
  round((percentile_cont(0.5) within group (order by extract(epoch from (primeira_marca - created_at)) / 60)
    filter (where primeira_marca is not null))::numeric, 1) as minutos_ate_primeira_marca_mediana
from por_conta;

-- 2. Contas novas por dia e por forma de entrar
select (created_at at time zone 'America/Sao_Paulo')::date as dia,
       count(*) as contas_novas,
       count(*) filter (where raw_app_meta_data->>'provider' = 'google') as google,
       count(*) filter (where raw_app_meta_data->>'provider' = 'discord') as discord,
       count(*) filter (where raw_app_meta_data->>'provider' = 'email') as email
from auth.users group by 1 order by 1 desc limit 14;

-- 3. Atividade: marcações e contas ativas nos últimos 7 dias
select count(*) filter (where updated_at >= now() - interval '7 days') as marcados_7d,
       count(distinct user_id) filter (where updated_at >= now() - interval '7 days') as contas_ativas_7d,
       count(*) as marcados_total
from public.marks;
