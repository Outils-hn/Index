-- Index 2.1 : inscription libre + validation des comptes.
-- Un nouveau compte peut seulement LIRE (comme un visiteur) tant qu'un collegue deja valide
-- ne l'a pas valide dans Configuration > Comptes. Seuls les comptes valides voient les chantiers
-- et peuvent ajouter, modifier ou supprimer quoi que ce soit.

-- 1. Etat de validation, et comptes existants valides d'office
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;
UPDATE public.profiles SET approved = true WHERE approved = false;

CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT approved FROM public.profiles WHERE id = auth.uid()), false);
$$;
REVOKE ALL ON FUNCTION public.is_approved() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_approved() TO anon, authenticated;

-- 2. Personne ne peut se valider soi-meme : seules les fonctions ci-dessous changent « approved »
CREATE OR REPLACE FUNCTION public.protect_approved()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN NEW.approved := false;
    ELSIF NEW.approved IS DISTINCT FROM OLD.approved THEN RAISE EXCEPTION 'Validation réservée aux comptes validés';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_approved ON public.profiles;
CREATE TRIGGER protect_approved BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_approved();

-- 3. Liste des comptes et validation (reserve aux comptes valides)
CREATE OR REPLACE FUNCTION public.list_accounts()
RETURNS TABLE(id uuid, email text, display_name text, approved boolean, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.email, p.display_name, p.approved, p.created_at
  FROM public.profiles p
  WHERE public.is_approved()
  ORDER BY p.approved, p.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.list_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_accounts() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_account_approved(_id uuid, _approved boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_approved() THEN RAISE EXCEPTION 'Réservé aux comptes validés'; END IF;
  IF _id = auth.uid() AND NOT _approved THEN RAISE EXCEPTION 'Vous ne pouvez pas retirer votre propre accès'; END IF;
  UPDATE public.profiles SET approved = _approved WHERE id = _id;
END $$;
REVOKE ALL ON FUNCTION public.set_account_approved(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_account_approved(uuid, boolean) TO authenticated;

-- 4. Toutes les ecritures (et la lecture des chantiers) reservees aux comptes valides.
--    On retire d'abord TOUTES les anciennes regles d'ecriture de ces tables, quel que soit leur nom.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (tablename IN ('products', 'categories', 'suppliers') AND cmd <> 'SELECT')
        OR tablename IN ('projects', 'product_projects')
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE POLICY "Approved can insert products" ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.is_approved() AND auth.uid() = created_by);
CREATE POLICY "Approved can update products" ON public.products FOR UPDATE TO authenticated
  USING (public.is_approved()) WITH CHECK (public.is_approved());
CREATE POLICY "Approved can delete products" ON public.products FOR DELETE TO authenticated
  USING (public.is_approved());

CREATE POLICY "Approved can insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (public.is_approved());
CREATE POLICY "Approved can update categories" ON public.categories FOR UPDATE TO authenticated USING (public.is_approved()) WITH CHECK (public.is_approved());
CREATE POLICY "Approved can delete categories" ON public.categories FOR DELETE TO authenticated USING (public.is_approved());

CREATE POLICY "Approved can insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.is_approved());
CREATE POLICY "Approved can update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (public.is_approved()) WITH CHECK (public.is_approved());
CREATE POLICY "Approved can delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (public.is_approved());

CREATE POLICY "Approved can read projects" ON public.projects FOR SELECT TO authenticated USING (public.is_approved());
CREATE POLICY "Approved can insert projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (public.is_approved());
CREATE POLICY "Approved can update projects" ON public.projects FOR UPDATE TO authenticated USING (public.is_approved()) WITH CHECK (public.is_approved());
CREATE POLICY "Approved can delete projects" ON public.projects FOR DELETE TO authenticated USING (public.is_approved());

CREATE POLICY "Approved can read product-projects" ON public.product_projects FOR SELECT TO authenticated USING (public.is_approved());
CREATE POLICY "Approved can insert product-projects" ON public.product_projects FOR INSERT TO authenticated WITH CHECK (public.is_approved());
CREATE POLICY "Approved can delete product-projects" ON public.product_projects FOR DELETE TO authenticated USING (public.is_approved());

-- 5. Fichiers PDF : depot et suppression reserves aux comptes valides (lecture publique inchangee)
DROP POLICY IF EXISTS "Authenticated can upload technical sheets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete technical sheets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update technical sheets" ON storage.objects;
CREATE POLICY "Approved can upload technical sheets" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'technical-sheets' AND public.is_approved());
CREATE POLICY "Approved can delete technical sheets" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'technical-sheets' AND public.is_approved());
