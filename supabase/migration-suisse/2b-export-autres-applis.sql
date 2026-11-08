-- ETAPE 2B : EXPORTER ACCESS, CHECK, MASSE, FORMAT, STRATE, MEMBRANE ET LES RETOURS DEPUIS L'ANCIEN PROJET.
-- ANCIEN projet (ngfz...) > SQL Editor > New query > Run. Ne modifie rien : lecture seule.
-- Le resultat est UNE seule cellule « sauvegarde » (du JSON) : copie sa valeur dans un fichier « sauvegarde-autres-applis.json »
-- (ou « Download CSV » si le bouton est propose). GARDE CE FICHIER PRIVE et supprime-le une fois la migration finie :
-- il contient des donnees sensibles (les acces fournisseurs dAccess et les notes de Check).

select jsonb_build_object(
  'exporte_le', now(),
  'access_domaines', coalesce((select jsonb_agg(to_jsonb(t)) from public.access_domaines t), '[]'::jsonb),
  'access_fournisseurs', coalesce((select jsonb_agg(to_jsonb(t)) from public.access_fournisseurs t), '[]'::jsonb),
  'access_acces', coalesce((select jsonb_agg(to_jsonb(t)) from public.access_acces t), '[]'::jsonb),
  'check_projets', coalesce((select jsonb_agg(to_jsonb(t)) from public.check_projets t), '[]'::jsonb),
  'check_membres', coalesce((select jsonb_agg(to_jsonb(t)) from public.check_membres t), '[]'::jsonb),
  'check_notes', coalesce((select jsonb_agg(to_jsonb(t)) from public.check_notes t), '[]'::jsonb),
  'materials', coalesce((select jsonb_agg(to_jsonb(t)) from public.materials t), '[]'::jsonb),
  'elements', coalesce((select jsonb_agg(to_jsonb(t)) from public.elements t), '[]'::jsonb),
  'components', coalesce((select jsonb_agg(to_jsonb(t)) from public.components t), '[]'::jsonb),
  'lists', coalesce((select jsonb_agg(to_jsonb(t)) from public.lists t), '[]'::jsonb),
  'list_items', coalesce((select jsonb_agg(to_jsonb(t)) from public.list_items t), '[]'::jsonb),
  'format_materiaux', coalesce((select jsonb_agg(to_jsonb(t)) from public.format_materiaux t), '[]'::jsonb),
  'strate_catalogue', coalesce((select jsonb_agg(to_jsonb(t)) from public.strate_catalogue t), '[]'::jsonb),
  'membrane_catalogue', coalesce((select jsonb_agg(to_jsonb(t)) from public.membrane_catalogue t), '[]'::jsonb),
  'retours', coalesce((select jsonb_agg(to_jsonb(t)) from public.retours t), '[]'::jsonb)
) as sauvegarde;
