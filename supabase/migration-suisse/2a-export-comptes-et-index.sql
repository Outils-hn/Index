-- ETAPE 2A : EXPORTER LES COMPTES ET INDEX DEPUIS L'ANCIEN PROJET.
-- ANCIEN projet (ngfz...) > SQL Editor > New query > Run. Ne modifie rien : lecture seule.
-- Le resultat est UNE seule cellule « sauvegarde » (du JSON) : copie sa valeur dans un fichier « sauvegarde-comptes-index.json »
-- (ou « Download CSV » si le bouton est propose). GARDE CE FICHIER PRIVE et supprime-le une fois la migration finie :
-- il contient des donnees sensibles (adresses email et mots de passe hachees des comptes).

select jsonb_build_object(
  'exporte_le', now(),
  'users', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'instance_id', instance_id, 'aud', aud, 'role', role, 'email', email,
      'encrypted_password', encrypted_password, 'email_confirmed_at', email_confirmed_at, 'raw_app_meta_data', raw_app_meta_data,
      'raw_user_meta_data', raw_user_meta_data, 'created_at', created_at, 'updated_at', updated_at) order by created_at) from auth.users), '[]'::jsonb),
  'identities', coalesce((select jsonb_agg(to_jsonb(i) - 'email' order by i.created_at) from auth.identities i), '[]'::jsonb),
  'profiles', coalesce((select jsonb_agg(to_jsonb(t)) from public.profiles t), '[]'::jsonb),
  'categories', coalesce((select jsonb_agg(to_jsonb(t)) from public.categories t), '[]'::jsonb),
  'suppliers', coalesce((select jsonb_agg(to_jsonb(t)) from public.suppliers t), '[]'::jsonb),
  'projects', coalesce((select jsonb_agg(to_jsonb(t)) from public.projects t), '[]'::jsonb),
  'products', coalesce((select jsonb_agg(to_jsonb(t)) from public.products t), '[]'::jsonb),
  'product_projects', coalesce((select jsonb_agg(to_jsonb(t)) from public.product_projects t), '[]'::jsonb)
) as sauvegarde;
