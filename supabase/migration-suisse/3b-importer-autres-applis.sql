-- ETAPE 3B : IMPORTER ACCESS, CHECK, MASSE, FORMAT, STRATE, MEMBRANE ET LES RETOURS DANS LE NOUVEAU PROJET.
-- NOUVEAU projet « outils-hn » > SQL Editor > New query.
-- 1) Plus bas, remplace SEULEMENT le mot en majuscules qui est entre les deux $json$ par le contenu de ton fichier « sauvegarde-autres-applis.json ».
-- 2) Run. Le script affiche, pour chaque table, le nombre de lignes attendues et copiees : les deux colonnes doivent etre egales.
-- A lancer APRES l'etape 1 (installation), sur le NOUVEAU projet seulement : il REMPLACE le contenu de ces tables.

create temp table _j as select $json$COLLE_ICI_LE_JSON$json$::jsonb as j;

do $import$
declare t text; cols text; n int;
begin
  if (select j->'access_domaines' from _j) is null then raise exception 'JSON incomplet : colle bien tout le contenu du fichier.'; end if;
  truncate public.retours, public.membrane_catalogue, public.strate_catalogue, public.format_materiaux, public.list_items, public.lists, public.components, public.elements, public.materials, public.check_notes, public.check_membres, public.check_projets, public.access_acces, public.access_fournisseurs, public.access_domaines cascade;
  foreach t in array array['access_domaines', 'access_fournisseurs', 'access_acces', 'check_projets', 'check_membres', 'check_notes', 'materials', 'elements', 'components', 'lists', 'list_items', 'format_materiaux', 'strate_catalogue', 'membrane_catalogue', 'retours'] loop
    select string_agg(format('%I', column_name), ', ') into cols from information_schema.columns
      where table_schema = 'public' and table_name = t and is_generated = 'NEVER';
    -- Pendant la copie, les automatismes de chaque table sont coupes (ils supposent un compte connecte) : on copie les lignes telles quelles
    execute format('alter table public.%I disable trigger user', t);
    execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, (select j->%L from _j))', t, cols, cols, t, t);
    execute format('alter table public.%I enable trigger user', t);
  end loop;
  -- L'historique ne doit pas contenir ces copies : il repart de zero
  delete from public.historique;
end $import$;

select t as table_copiee,
       jsonb_array_length((select j->t from _j)) as attendues,
       (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', t), false, true, '')))[1]::text::int as copiees
from unnest(array['access_domaines', 'access_fournisseurs', 'access_acces', 'check_projets', 'check_membres', 'check_notes', 'materials', 'elements', 'components', 'lists', 'list_items', 'format_materiaux', 'strate_catalogue', 'membrane_catalogue', 'retours']) as t;
