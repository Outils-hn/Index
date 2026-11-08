-- ETAPE 3A : IMPORTER LES COMPTES ET INDEX DANS LE NOUVEAU PROJET.
-- NOUVEAU projet « outils-hn » > SQL Editor > New query.
-- 1) Plus bas, remplace SEULEMENT le mot en majuscules qui est entre les deux $json$ par le contenu de ton fichier « sauvegarde-comptes-index.json ».
-- 2) Run. Le script affiche, pour chaque table, le nombre de lignes attendues et copiees : les deux colonnes doivent etre egales.
-- A lancer APRES l'etape 1 (installation), sur le NOUVEAU projet seulement : il REMPLACE le contenu de ces tables.

create temp table _j as select $json$COLLE_ICI_LE_JSON$json$::jsonb as j;

do $import$
declare t text; cols text; n int;
begin
  if (select j->'users' from _j) is null then raise exception 'JSON incomplet : colle bien tout le contenu du fichier.'; end if;
  truncate public.product_projects, public.products, public.projects, public.suppliers, public.categories cascade;
  -- Comptes : meme identifiant, meme mot de passe (hache), donc personne ne change rien
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    select u.id, coalesce(u.instance_id, '00000000-0000-0000-0000-000000000000'), u.aud, u.role, u.email, u.encrypted_password, u.email_confirmed_at,
           u.raw_app_meta_data, u.raw_user_meta_data, u.created_at, u.updated_at, '', '', '', '', '', '', '', ''
    from jsonb_populate_recordset(null::auth.users, (select j->'users' from _j)) u
    on conflict (id) do nothing;
  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    select i.id, i.user_id, i.identity_data, i.provider, i.provider_id, i.last_sign_in_at, i.created_at, i.updated_at
    from jsonb_populate_recordset(null::auth.identities, (select j->'identities' from _j)) i
    on conflict do nothing;
  -- La creation des comptes a fabrique des profils vides : on les remplace par les vrais (roles, validations)
  delete from public.profiles;

  foreach t in array array['profiles', 'categories', 'suppliers', 'projects', 'products', 'product_projects'] loop
    select string_agg(format('%I', column_name), ', ') into cols from information_schema.columns
      where table_schema = 'public' and table_name = t and is_generated = 'NEVER';
    execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, (select j->%L from _j))', t, cols, cols, t, t);
  end loop;
  -- L'historique ne doit pas contenir ces copies : il repart de zero
  delete from public.historique;
end $import$;

select t as table_copiee,
       jsonb_array_length((select j->t from _j)) as attendues,
       (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', t), false, true, '')))[1]::text::int as copiees
from unnest(array['profiles', 'categories', 'suppliers', 'projects', 'products', 'product_projects']) as t;
