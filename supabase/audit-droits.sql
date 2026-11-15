-- Audit des droits Supabase (lecture seule : ne modifie rien).
-- A lancer dans le SQL Editor, une partie a la fois, puis copier le resultat.

-- ===== PARTIE 1 : RLS et politiques des tables =====
select 'RLS' as section, c.relname as objet,
       case when c.relrowsecurity then 'active' else 'DESACTIVEE' end as detail
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
union all
select 'POLITIQUE', tablename || ' / ' || policyname,
       cmd || ' | roles=' || array_to_string(roles, ',') ||
       ' | using=' || coalesce(qual, '-') || ' | check=' || coalesce(with_check, '-')
from pg_policies where schemaname = 'public'
order by 1, 2;

-- ===== PARTIE 2 : stockage (buckets, politiques) et vues =====
select 'BUCKET' as section, id as objet, 'public=' || public as detail
from storage.buckets
union all
select 'STORAGE', policyname,
       cmd || ' | roles=' || array_to_string(roles, ',') ||
       ' | using=' || coalesce(qual, '-') || ' | check=' || coalesce(with_check, '-')
from pg_policies where schemaname = 'storage' and tablename = 'objects'
union all
select 'VUE', c.relname,
       'security_invoker=' || coalesce((select option_value from pg_options_to_table(c.reloptions) where option_name = 'security_invoker'), 'non (droits du proprietaire)')
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v'
order by 1, 2;

-- ===== PARTIE 3 : code des fonctions sensibles (gardes internes) =====
select p.proname as fonction, pg_get_functiondef(p.oid) as code
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('reinitialiser_mdp', 'mon_mdp_provisoire', 'premiere_connexion_faite', 'mon_role',
                    'set_account_admin', 'set_account_approved', 'list_accounts', 'export_complet', 'import_all')
order by 1;
