-- Index 2.17 : historique des modifications + annulation.
-- A coller UNE fois dans Supabase (projet Index) > SQL Editor > Run. Peut etre relance sans risque.
--
-- Chaque ajout, modification ou suppression des donnees communes est note : qui, quand, avant, apres.
-- Tables suivies : fiches, familles et fournisseurs d'Index, annuaire Access (sans les identifiants),
-- bibliotheque de Format, catalogue de Strate, catalogue de Membrane, materiaux/elements/listes de Masse.
-- Les notes de Check et les mots de passe d'Access ne sont JAMAIS gardes dans l'historique.
-- Duree de conservation : 90 jours (nettoyage automatique).
--
-- Droits : tout compte valide VOIT l'historique.
--   Dessinateur : annule seulement SES modifications, et seulement si personne n'a retouche la ligne depuis.
--   Administrateur : annule tout, sauf ce qu'a fait le concepteur.   Concepteur : annule tout.
-- Une annulation est elle-meme notee (on peut donc l'annuler a son tour).

CREATE TABLE IF NOT EXISTS public.historique (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  tbl text NOT NULL,
  ligne text NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  avant jsonb,
  apres jsonb,
  auteur uuid,
  auteur_nom text NOT NULL DEFAULT '',
  annule_le timestamptz,
  annule_par uuid,
  annulation_de bigint
);
CREATE INDEX IF NOT EXISTS historique_ligne_idx ON public.historique (tbl, ligne, id DESC);
CREATE INDEX IF NOT EXISTS historique_at_idx ON public.historique (at DESC);
-- Personne n'y touche directement : tout passe par les fonctions ci-dessous
ALTER TABLE public.historique ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.historique FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.historique TO service_role;

-- Les tables suivies (une seule liste, lue par les declencheurs ET par l'annulation)
CREATE OR REPLACE FUNCTION public.historique_tables()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['products', 'categories', 'suppliers', 'access_domaines', 'access_fournisseurs',
               'format_materiaux', 'strate_catalogue', 'membrane_catalogue',
               'materials', 'elements', 'lists']::text[];
$$;

-- Nom a afficher pour une ligne (selon la table : name, nom, ou data.nom)
CREATE OR REPLACE FUNCTION public.historique_libelle(j jsonb)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(NULLIF(j->>'name', ''), NULLIF(j->>'nom', ''), NULLIF(j->'data'->>'nom', ''),
                  NULLIF(j->'data'->>'name', ''), NULLIF(j->'data'->>'court', ''), j->>'id');
$$;

-- Ce qui a change entre deux versions (un niveau dans « data »), sans la date de mise a jour
CREATE OR REPLACE FUNCTION public.historique_diff(a jsonb, b jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE k text; res jsonb := '{}'::jsonb; sa jsonb; sb jsonb; k2 text;
BEGIN
  IF a IS NULL OR b IS NULL THEN RETURN NULL; END IF;
  FOR k IN SELECT DISTINCT x FROM (SELECT jsonb_object_keys(a) AS x UNION ALL SELECT jsonb_object_keys(b)) s LOOP
    CONTINUE WHEN k IN ('updated_at', 'created_at');
    IF a->k IS DISTINCT FROM b->k THEN
      IF jsonb_typeof(a->k) = 'object' AND jsonb_typeof(b->k) = 'object' THEN
        sa := a->k; sb := b->k;
        FOR k2 IN SELECT DISTINCT y FROM (SELECT jsonb_object_keys(sa) AS y UNION ALL SELECT jsonb_object_keys(sb)) t LOOP
          IF sa->k2 IS DISTINCT FROM sb->k2 THEN
            res := res || jsonb_build_object(k2, jsonb_build_array(sa->k2, sb->k2));
          END IF;
        END LOOP;
      ELSE
        res := res || jsonb_build_object(k, jsonb_build_array(a->k, b->k));
      END IF;
    END IF;
  END LOOP;
  RETURN res;
END $$;

-- Declencheur : note chaque changement
CREATE OR REPLACE FUNCTION public.historique_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  j_old jsonb; j_new jsonb; qui uuid := auth.uid(); nom text; annul bigint;
BEGIN
  IF TG_OP <> 'INSERT' THEN j_old := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN j_new := to_jsonb(NEW); END IF;
  -- Une « modification » qui ne change que la date de mise a jour n'est pas notee
  IF TG_OP = 'UPDATE' AND (j_old - 'updated_at') = (j_new - 'updated_at') THEN RETURN NULL; END IF;
  SELECT COALESCE(NULLIF(display_name, ''), 'Compte') INTO nom FROM public.profiles WHERE id = qui;
  annul := NULLIF(current_setting('historique.annulation_de', true), '')::bigint;
  INSERT INTO public.historique (tbl, ligne, action, avant, apres, auteur, auteur_nom, annulation_de)
  VALUES (TG_TABLE_NAME, COALESCE(j_new->>'id', j_old->>'id'), TG_OP, j_old, j_new, qui,
          CASE WHEN qui IS NULL THEN 'Base de données' ELSE COALESCE(nom, 'Compte') END, annul);
  -- Nettoyage : de temps en temps, on efface ce qui a plus de 90 jours
  IF random() < 0.02 THEN DELETE FROM public.historique WHERE at < now() - interval '90 days'; END IF;
  RETURN NULL;
END $$;

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

-- Peut-on annuler cette ligne d'historique ?
CREATE OR REPLACE FUNCTION public.historique_peut_annuler(h public.historique)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_approved()
    AND h.annule_le IS NULL
    AND h.tbl = ANY (public.historique_tables())
    AND CASE
      WHEN public.is_concepteur() THEN true
      WHEN public.is_admin() THEN NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = h.auteur AND p.role = 'concepteur')
      ELSE h.auteur = auth.uid()
           AND NOT EXISTS (SELECT 1 FROM public.historique n WHERE n.tbl = h.tbl AND n.ligne = h.ligne AND n.id > h.id)
    END;
$$;

-- Liste (plus recent d'abord). _tbl = une table precise, ou NULL pour tout.
DROP FUNCTION IF EXISTS public.historique_lire(text, int);
CREATE FUNCTION public.historique_lire(_tbl text DEFAULT NULL, _limite int DEFAULT 100)
RETURNS TABLE(id bigint, at timestamptz, tbl text, ligne text, action text, libelle text, auteur_nom text,
              diff jsonb, annule boolean, est_annulation boolean, peut_annuler boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT h.id, h.at, h.tbl, h.ligne, h.action,
         public.historique_libelle(COALESCE(h.apres, h.avant)),
         h.auteur_nom,
         CASE WHEN h.action = 'UPDATE' THEN public.historique_diff(h.avant, h.apres) END,
         h.annule_le IS NOT NULL,
         h.annulation_de IS NOT NULL,
         public.historique_peut_annuler(h)
  FROM public.historique h
  WHERE public.is_approved() AND (_tbl IS NULL OR h.tbl = _tbl)
  ORDER BY h.id DESC
  LIMIT LEAST(GREATEST(COALESCE(_limite, 100), 1), 500);
$$;
REVOKE ALL ON FUNCTION public.historique_lire(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.historique_lire(text, int) TO authenticated;

-- Annulation : remet la ligne comme elle etait AVANT ce changement
CREATE OR REPLACE FUNCTION public.historique_annuler(_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h public.historique; cols text; sets text;
BEGIN
  SELECT * INTO h FROM public.historique WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cette modification n''est plus dans l''historique'; END IF;
  IF NOT public.is_approved() THEN RAISE EXCEPTION 'Réservé aux comptes validés'; END IF;
  IF h.annule_le IS NOT NULL THEN RAISE EXCEPTION 'Cette modification est déjà annulée'; END IF;
  IF NOT public.historique_peut_annuler(h) THEN
    RAISE EXCEPTION 'Annulation impossible : la ligne a été retouchée depuis, ou ce n''est pas la vôtre';
  END IF;

  PERFORM set_config('historique.annulation_de', h.id::text, true);
  IF h.action = 'INSERT' THEN
    EXECUTE format('DELETE FROM public.%I WHERE id::text = $1', h.tbl) USING h.ligne;
  ELSE
    SELECT string_agg(format('%I', c.column_name), ', '),
           string_agg(CASE WHEN c.column_name = 'updated_at' THEN 'updated_at = now()'
                           ELSE format('%I = EXCLUDED.%I', c.column_name, c.column_name) END, ', ')
             FILTER (WHERE c.column_name <> 'id')
      INTO cols, sets
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = h.tbl AND c.is_generated = 'NEVER'
        AND c.column_name IN (SELECT jsonb_object_keys(h.avant));
    EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I, $1) ON CONFLICT (id) DO UPDATE SET %s',
                   h.tbl, cols, cols, h.tbl, sets) USING h.avant;
  END IF;
  PERFORM set_config('historique.annulation_de', '', true);
  UPDATE public.historique SET annule_le = now(), annule_par = auth.uid() WHERE id = _id;
END $$;
REVOKE ALL ON FUNCTION public.historique_annuler(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.historique_annuler(bigint) TO authenticated;

-- Controle : une ligne par table suivie
SELECT c.relname AS table_suivie FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
WHERE t.tgname = 'historique_trg' ORDER BY 1;
