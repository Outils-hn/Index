-- INVENTAIRE (lecture seule, ne modifie rien) : decrit la structure du projet Supabase (tables, colonnes, fonctions,
-- regles de securite, droits, declencheurs, nombre de lignes). A lancer dans l'ANCIEN projet puis dans le NOUVEAU,
-- pour comparer les deux. Supabase > SQL Editor > New query > Run. Le resultat est UNE cellule de JSON : copie sa valeur
-- (ou « Download CSV ») dans un fichier. Aucune donnee personnelle : seulement des noms et des totaux.

select jsonb_pretty(jsonb_build_object(
  'colonnes', (select jsonb_agg(jsonb_build_object('t', table_name, 'c', column_name, 'type', data_type, 'nul', is_nullable, 'def', column_default) order by table_name, column_name)
               from information_schema.columns where table_schema = 'public'),
  'rls', (select jsonb_agg(jsonb_build_object('t', c.relname, 'rls', c.relrowsecurity) order by c.relname)
          from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'),
  'fonctions', (select jsonb_agg(jsonb_build_object('f', p.proname, 'args', pg_get_function_identity_arguments(p.oid), 'definer', p.prosecdef,
                                                    'corps', md5(p.prosrc), 'res', pg_get_function_result(p.oid)) order by p.proname, pg_get_function_identity_arguments(p.oid))
                from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'),
  'regles', (select jsonb_agg(jsonb_build_object('t', tablename, 'n', policyname, 'cmd', cmd, 'roles', roles, 'qual', qual, 'check', with_check) order by schemaname, tablename, policyname)
             from pg_policies where schemaname in ('public', 'storage')),
  'droits_tables', (select jsonb_agg(jsonb_build_object('t', table_name, 'r', grantee, 'p', privilege_type) order by table_name, grantee, privilege_type)
                    from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon', 'authenticated')),
  'droits_fonctions', (select jsonb_agg(jsonb_build_object('f', routine_name, 'r', grantee) order by routine_name, grantee)
                       from information_schema.routine_privileges where routine_schema = 'public' and grantee in ('anon', 'authenticated') and privilege_type = 'EXECUTE'),
  'declencheurs', (select jsonb_agg(jsonb_build_object('t', event_object_schema || '.' || event_object_table, 'n', trigger_name, 'ev', event_manipulation) order by 1, 2)
                   from information_schema.triggers where event_object_schema in ('public', 'auth') and trigger_name not like 'RI_%'),
  'buckets', (select jsonb_agg(jsonb_build_object('id', id, 'public', public, 'limite', file_size_limit, 'types', allowed_mime_types) order by id) from storage.buckets),
  'lignes', (select jsonb_object_agg(relname, (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', relname), false, true, '')))[1]::text::int)
             from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'),
  'comptes', (select count(*) from auth.users),
  'pdf', (select count(*) from storage.objects where bucket_id = 'technical-sheets')
)) as inventaire;
