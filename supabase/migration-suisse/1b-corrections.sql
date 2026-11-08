-- Corrections du NOUVEAU projet, d'apres la comparaison des deux inventaires.
-- A coller dans le NOUVEAU projet (outils-hn) > SQL Editor > Run. Peut etre relance sans risque.

-- 1) Colonnes presentes dans l'ancien projet et utilisees par les applis (Access, Index)
ALTER TABLE public.access_fournisseurs ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';
ALTER TABLE public.access_fournisseurs ADD COLUMN IF NOT EXISTS telephone text NOT NULL DEFAULT '';
ALTER TABLE public.access_fournisseurs ADD COLUMN IF NOT EXISTS email_technique text NOT NULL DEFAULT '';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS icon text;

-- 2) L'ancien code PIN de Masse n'existe plus dans l'ancien projet : on le retire
DROP FUNCTION IF EXISTS public.verify_pin(text);
DROP FUNCTION IF EXISTS public._check_pin(text);
DROP FUNCTION IF EXISTS public.import_all(text, jsonb);
DROP FUNCTION IF EXISTS public.save_element(text, jsonb);
DROP FUNCTION IF EXISTS public.save_list(text, jsonb);
DROP FUNCTION IF EXISTS public.save_material(text, jsonb);
DROP FUNCTION IF EXISTS public.set_deleted(text, text, uuid, boolean);
DROP FUNCTION IF EXISTS public.format_delete_material(text, text);
DROP FUNCTION IF EXISTS public.format_save_material(text, jsonb);
DROP FUNCTION IF EXISTS public.strate_delete_item(text, text);
DROP FUNCTION IF EXISTS public.strate_save_item(text, text, jsonb);
DROP TABLE IF EXISTS public.app_config;

-- 3) Journal des modifications : le suivi manquait sur 8 tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY public.historique_tables() LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS historique_trg ON public.%I', t);
      EXECUTE format('CREATE TRIGGER historique_trg AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.historique_log()', t);
    END IF;
  END LOOP;
END $$;

-- 4) Fiches PDF : seulement des PDF, 5 Mo maximum (comme avant)
UPDATE storage.buckets SET allowed_mime_types = ARRAY['application/pdf'], file_size_limit = 5242880
WHERE id = 'technical-sheets';

-- Controle
SELECT 'triggers historique' AS controle, count(*) AS n FROM pg_trigger WHERE tgname = 'historique_trg'
UNION ALL SELECT 'fonctions pin restantes', count(*) FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
  WHERE s.nspname='public' AND (p.proname LIKE '%pin%' OR p.proname IN ('save_material','save_element','save_list','import_all','set_deleted'));
