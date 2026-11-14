-- ETAPE 1 : INSTALLER TOUTE LA STRUCTURE DANS LE NOUVEAU PROJET « outils-hn » (Suisse).
-- Supabase > projet outils-hn > SQL Editor > New query > Run. A lancer UNE SEULE FOIS, dans le NOUVEAU projet vide.
-- Ce script regroupe, dans l'ordre, tous les scripts deja passes dans l'ancien projet : Index (fiches, comptes, roles,
-- historique), Access, Check, Masse, Format, Strate, Membrane, Accueil (retours, statistiques). Il ne contient AUCUNE donnee
-- utile (Masse y met seulement quelques exemples, effaces a l'etape d'import). Si une erreur s'affiche, ne relance pas :
-- note le message et dis-le moi.


-- Dossier des fiches techniques (PDF) : public en lecture, comme dans l'ancien projet
insert into storage.buckets (id, name, public) values ('technical-sheets', 'technical-sheets', true) on conflict (id) do nothing;

-- =====================================================================
-- index/supabase/migrations/20260607053736_0c90a499-b8aa-4d44-a283-55d5f31db4a7.sql
-- =====================================================================


CREATE TYPE public.product_category AS ENUM (
  'colles_mastics',
  'fixations_chevilles',
  'membranes_etancheite',
  'profiles_accessoires',
  'isolants'
);

CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  supplier TEXT NOT NULL,
  category public.product_category NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  pdf_path TEXT,
  pdf_filename TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX products_name_idx ON public.products USING gin (to_tsvector('simple', name));
CREATE INDEX products_supplier_idx ON public.products (supplier);
CREATE INDEX products_category_idx ON public.products (category);
CREATE INDEX products_tags_idx ON public.products USING gin (tags);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view products"
  ON public.products FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert products"
  ON public.products FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update products"
  ON public.products FOR UPDATE
  USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can delete products"
  ON public.products FOR DELETE
  USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for the technical-sheets bucket (bucket created via tool)
CREATE POLICY "Public can read tech sheets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'technical-sheets');

CREATE POLICY "Anyone can upload tech sheets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'technical-sheets');

CREATE POLICY "Anyone can update tech sheets"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'technical-sheets');

CREATE POLICY "Anyone can delete tech sheets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'technical-sheets');


-- =====================================================================
-- index/supabase/migrations/20260607055018_0089e64c-8df9-4cf7-8fc3-3504e8614917.sql
-- =====================================================================


-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Products: add created_by
ALTER TABLE public.products
  ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Replace permissive policies with auth-based ones
DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
DROP POLICY IF EXISTS "Anyone can insert products" ON public.products;
DROP POLICY IF EXISTS "Anyone can update products" ON public.products;
DROP POLICY IF EXISTS "Anyone can delete products" ON public.products;

GRANT SELECT ON public.products TO anon;

CREATE POLICY "Products are viewable by everyone"
  ON public.products FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners can update their products"
  ON public.products FOR UPDATE TO authenticated
  USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners can delete their products"
  ON public.products FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- Storage policies for technical-sheets bucket
CREATE POLICY "Public can read technical sheets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'technical-sheets');

CREATE POLICY "Authenticated can upload technical sheets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'technical-sheets');

CREATE POLICY "Authenticated can delete technical sheets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'technical-sheets');


-- =====================================================================
-- index/supabase/migrations/20260607055047_d4dc69f5-fb2d-4c50-b304-82d861e2ef3e.sql
-- =====================================================================


REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;

-- Restrict listing of all bucket files; per-object SELECT remains allowed
DROP POLICY IF EXISTS "Public can read technical sheets" ON storage.objects;
CREATE POLICY "Public can read technical sheet files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'technical-sheets' AND name IS NOT NULL);


-- =====================================================================
-- index/supabase/migrations/20260607060756_117f4e86-aef8-4431-81e2-43d85674b30f.sql
-- =====================================================================

-- Remove permissive anonymous write policies
DROP POLICY IF EXISTS "Anyone can delete tech sheets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update tech sheets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload tech sheets" ON storage.objects;

-- Remove SELECT policies that allow listing the bucket contents.
-- Public buckets serve files via their public URL without needing a SELECT policy.
DROP POLICY IF EXISTS "Public can read tech sheets" ON storage.objects;
DROP POLICY IF EXISTS "Public can read technical sheet files" ON storage.objects;

-- Keep authenticated upload/delete policies as-is (already present):
--   "Authenticated can upload technical sheets" (INSERT, authenticated)
--   "Authenticated can delete technical sheets" (DELETE, authenticated)


-- =====================================================================
-- index/supabase/migrations/20260607062540_7a0b35d9-018d-4458-9420-73b935eac0b6.sql
-- =====================================================================


DROP POLICY IF EXISTS "Owners can delete their products" ON public.products;
DROP POLICY IF EXISTS "Owners can update their products" ON public.products;

CREATE POLICY "Authenticated users can update any product"
ON public.products FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete any product"
ON public.products FOR DELETE TO authenticated
USING (true);


-- =====================================================================
-- index/supabase/migrations/20260607062916_759ffde8-eaaa-4e2f-b454-46a162c56295.sql
-- =====================================================================


ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  fn TEXT := NEW.raw_user_meta_data->>'first_name';
  ln TEXT := NEW.raw_user_meta_data->>'last_name';
  dn TEXT := NULLIF(TRIM(COALESCE(fn,'') || ' ' || COALESCE(ln,'')), '');
BEGIN
  INSERT INTO public.profiles (id, email, display_name, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', dn, split_part(NEW.email, '@', 1)),
    fn,
    ln
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name),
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =====================================================================
-- index/supabase/migrations/20260607063338_ed211e38-c87e-4094-b6c6-3d05e47abe6e.sql
-- =====================================================================


-- 1. Categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories readable by everyone" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update categories" ON public.categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete categories" ON public.categories FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.suppliers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Suppliers readable by everyone" ON public.suppliers FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Seed built-in suppliers
INSERT INTO public.suppliers (name) VALUES
  ('Sika'), ('Bostik'), ('Hilti'), ('Fischer'), ('Soprema'),
  ('Knauf'), ('Rockwool'), ('Saint-Gobain'), ('Wienerberger'),
  ('Tremco'), ('Autre')
ON CONFLICT (name) DO NOTHING;

-- 4. Seed built-in categories (use human-readable labels)
INSERT INTO public.categories (name) VALUES
  ('Colles & Mastics'),
  ('Fixations & Chevilles'),
  ('Membranes & Étanchéité'),
  ('Profilés & Accessoires'),
  ('Isolants')
ON CONFLICT (name) DO NOTHING;

-- 5. Convert products.category from enum to text
ALTER TABLE public.products ALTER COLUMN category TYPE TEXT USING (
  CASE category::text
    WHEN 'colles_mastics' THEN 'Colles & Mastics'
    WHEN 'fixations_chevilles' THEN 'Fixations & Chevilles'
    WHEN 'membranes_etancheite' THEN 'Membranes & Étanchéité'
    WHEN 'profiles_accessoires' THEN 'Profilés & Accessoires'
    WHEN 'isolants' THEN 'Isolants'
    ELSE category::text
  END
);

-- 6. Drop the now-unused enum type
DROP TYPE IF EXISTS public.product_category;

-- 7. Backfill: any supplier or category present in products but missing in tables
INSERT INTO public.suppliers (name)
  SELECT DISTINCT supplier FROM public.products WHERE supplier IS NOT NULL
  ON CONFLICT (name) DO NOTHING;

INSERT INTO public.categories (name)
  SELECT DISTINCT category FROM public.products WHERE category IS NOT NULL
  ON CONFLICT (name) DO NOTHING;


-- =====================================================================
-- index/supabase/migrations/20260607171324_dd5df91e-59be-40df-8a25-4a96bbf7995f.sql
-- =====================================================================

ALTER TABLE public.products ADD COLUMN url text;

-- =====================================================================
-- index/supabase/migrations/20260607172708_96df25c5-89fb-4bbe-8a31-d5eba17851a9.sql
-- =====================================================================

ALTER TABLE public.products ADD COLUMN note text;

-- =====================================================================
-- index/supabase/migrations/20260607191331_bd91920a-64e6-40bc-b870-f03ecd549787.sql
-- =====================================================================


CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero text NOT NULL,
  nom text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.projects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Projects readable by everyone" ON public.projects FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated can insert projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update projects" ON public.projects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete projects" ON public.projects FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.product_projects (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, project_id)
);
GRANT SELECT ON public.product_projects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_projects TO authenticated;
GRANT ALL ON public.product_projects TO service_role;
ALTER TABLE public.product_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Product-projects readable by everyone" ON public.product_projects FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated can insert product-projects" ON public.product_projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can delete product-projects" ON public.product_projects FOR DELETE TO authenticated USING (true);
CREATE INDEX product_projects_project_id_idx ON public.product_projects(project_id);


-- =====================================================================
-- index/supabase/migrations/20260613144545_d4b5144e-7eaa-4d4d-8e84-4e62028ef6d1.sql
-- =====================================================================

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE OR REPLACE VIEW public.public_profiles
  WITH (security_invoker = false) AS
  SELECT id, display_name, first_name, last_name
  FROM public.profiles;

REVOKE ALL ON public.public_profiles FROM PUBLIC;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- =====================================================================
-- index/supabase/migrations/20260614164919_c777cfb5-b971-452e-92d2-3cc4bfd516c5.sql
-- =====================================================================

DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE FUNCTION public.get_public_profiles(_ids uuid[])
RETURNS TABLE(id uuid, display_name text, first_name text, last_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, display_name, first_name, last_name
  FROM public.profiles
  WHERE id = ANY(_ids);
$$;

REVOKE ALL ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO anon, authenticated;

-- =====================================================================
-- index/supabase/migrations/20261029090000_index_v2_corbeille_verification_chantiers.sql
-- =====================================================================

-- Index 2.0
-- 1. Corbeille : une fiche supprimee est d'abord mise de cote 30 jours (deleted_at),
--    son PDF n'est efface qu'au moment de la suppression definitive.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 2. Date de verification separee de la date de modification : corriger une faute
--    de frappe ne remet plus la fiche « a jour » pour un an.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS verified_at timestamptz;
UPDATE public.products SET verified_at = updated_at WHERE verified_at IS NULL;
ALTER TABLE public.products ALTER COLUMN verified_at SET DEFAULT now();

-- 3. Chantiers (numero + nom) visibles seulement par les collegues connectes.
DROP POLICY IF EXISTS "Projects readable by everyone" ON public.projects;
CREATE POLICY "Projects readable by authenticated" ON public.projects FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Product-projects readable by everyone" ON public.product_projects;
CREATE POLICY "Product-projects readable by authenticated" ON public.product_projects FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.projects FROM anon;
REVOKE SELECT ON public.product_projects FROM anon;


-- =====================================================================
-- index/supabase/migrations/20261029120000_index_validation_comptes.sql
-- =====================================================================

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


-- =====================================================================
-- index/supabase/migrations/20261029140000_index_administrateurs.sql
-- =====================================================================

-- Index 2.2 : administrateurs.
-- Seuls les administrateurs voient Configuration > Comptes et peuvent valider un compte,
-- retirer un acces ou nommer un autre administrateur. Un administrateur est toujours valide.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_admin AND approved FROM public.profiles WHERE id = auth.uid()), false);
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- Personne ne peut se donner le role lui-meme (meme protection que pour « approved »)
CREATE OR REPLACE FUNCTION public.protect_approved()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN NEW.approved := false; NEW.is_admin := false;
    ELSIF NEW.approved IS DISTINCT FROM OLD.approved OR NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      RAISE EXCEPTION 'Réservé aux administrateurs';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP FUNCTION IF EXISTS public.list_accounts();
CREATE FUNCTION public.list_accounts()
RETURNS TABLE(id uuid, email text, display_name text, approved boolean, is_admin boolean, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.email, p.display_name, p.approved, p.is_admin, p.created_at
  FROM public.profiles p
  WHERE public.is_admin()
  ORDER BY p.approved, p.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.list_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_accounts() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_account_approved(_id uuid, _approved boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  IF _id = auth.uid() AND NOT _approved THEN RAISE EXCEPTION 'Vous ne pouvez pas retirer votre propre accès'; END IF;
  -- Retirer l'acces retire aussi le role d'administrateur
  UPDATE public.profiles SET approved = _approved, is_admin = CASE WHEN _approved THEN is_admin ELSE false END WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.set_account_admin(_id uuid, _admin boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  IF _id = auth.uid() AND NOT _admin THEN RAISE EXCEPTION 'Vous ne pouvez pas retirer votre propre rôle d''administrateur'; END IF;
  -- Un administrateur est toujours valide
  UPDATE public.profiles SET is_admin = _admin, approved = CASE WHEN _admin THEN true ELSE approved END WHERE id = _id;
END $$;
REVOKE ALL ON FUNCTION public.set_account_admin(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_account_admin(uuid, boolean) TO authenticated;


-- =====================================================================
-- index/supabase/migrations/20261104170000_index_roles.sql
-- =====================================================================

-- Index 2.14 : rôles des comptes (dessinateur / administrateur / concepteur).
-- « is_admin » reste la source des droits d'administration existants : il vaut vrai pour
-- administrateur ET concepteur, donc rien ne change pour le reste des applis.
-- Le rôle « concepteur » ne s'attribue que par SQL (ce script), jamais depuis l'écran.
-- Les adresses email ne sont visibles que par le concepteur.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'dessinateur';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('dessinateur', 'administrateur', 'concepteur'));

-- Les administrateurs actuels gardent leur rôle
UPDATE public.profiles SET role = 'administrateur' WHERE is_admin AND role = 'dessinateur';

CREATE OR REPLACE FUNCTION public.is_concepteur()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT role = 'concepteur' AND approved FROM public.profiles WHERE id = auth.uid()), false);
$$;
REVOKE ALL ON FUNCTION public.is_concepteur() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_concepteur() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.mon_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT CASE WHEN approved THEN role ELSE NULL END FROM public.profiles WHERE id = auth.uid()), NULL);
$$;
REVOKE ALL ON FUNCTION public.mon_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mon_role() TO anon, authenticated;

-- Personne ne peut se donner un rôle lui-même
CREATE OR REPLACE FUNCTION public.protect_approved()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN NEW.approved := false; NEW.is_admin := false; NEW.role := 'dessinateur';
    ELSIF NEW.approved IS DISTINCT FROM OLD.approved OR NEW.is_admin IS DISTINCT FROM OLD.is_admin OR NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Réservé aux administrateurs';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Liste des comptes : les administrateurs la voient, mais l'email seulement le concepteur
DROP FUNCTION IF EXISTS public.list_accounts();
CREATE FUNCTION public.list_accounts()
RETURNS TABLE(id uuid, email text, display_name text, approved boolean, is_admin boolean, role text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, CASE WHEN public.is_concepteur() THEN p.email ELSE NULL END, p.display_name, p.approved, p.is_admin, p.role, p.created_at
  FROM public.profiles p
  WHERE public.is_admin()
  ORDER BY p.approved, p.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.list_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_accounts() TO authenticated;

-- Valider / retirer l'accès : un administrateur ne touche jamais au compte du concepteur
CREATE OR REPLACE FUNCTION public.set_account_approved(_id uuid, _approved boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  IF _id = auth.uid() AND NOT _approved THEN RAISE EXCEPTION 'Vous ne pouvez pas retirer votre propre accès'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _id AND role = 'concepteur') THEN RAISE EXCEPTION 'Le compte du concepteur ne peut pas être modifié'; END IF;
  -- Retirer l'accès retire aussi le rôle d'administrateur
  UPDATE public.profiles SET approved = _approved,
    is_admin = CASE WHEN _approved THEN is_admin ELSE false END,
    role = CASE WHEN _approved THEN role ELSE 'dessinateur' END
  WHERE id = _id;
END $$;

-- Nommer / retirer un administrateur : réservé au concepteur
CREATE OR REPLACE FUNCTION public.set_account_admin(_id uuid, _admin boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_concepteur() THEN RAISE EXCEPTION 'Réservé au concepteur'; END IF;
  IF _id = auth.uid() THEN RAISE EXCEPTION 'Vous ne pouvez pas modifier votre propre rôle'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _id AND role = 'concepteur') THEN RAISE EXCEPTION 'Le compte du concepteur ne peut pas être modifié'; END IF;
  UPDATE public.profiles SET is_admin = _admin, role = CASE WHEN _admin THEN 'administrateur' ELSE 'dessinateur' END,
    approved = CASE WHEN _admin THEN true ELSE approved END
  WHERE id = _id;
END $$;
REVOKE ALL ON FUNCTION public.set_account_admin(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_account_admin(uuid, boolean) TO authenticated;

-- Changer l'adresse email d'un compte (dans Supabase ou ailleurs) met aussi à jour le profil.
-- Le rôle est attaché à l'identifiant du compte, pas à l'adresse : il suit donc le changement.
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sync_profile_email ON auth.users;
CREATE TRIGGER trg_sync_profile_email AFTER UPDATE OF email ON auth.users
  FOR EACH ROW WHEN (OLD.email IS DISTINCT FROM NEW.email) EXECUTE FUNCTION public.sync_profile_email();

-- Le concepteur : à désigner une seule fois, par l'adresse actuelle du compte
UPDATE public.profiles SET role = 'concepteur', is_admin = true, approved = true WHERE lower(email) = lower('h.naegellen@gmail.com');

-- Contrôle : une ligne « concepteur » attendue
SELECT email, role, approved, is_admin FROM public.profiles WHERE role <> 'dessinateur' ORDER BY role;


-- =====================================================================
-- index/supabase/migrations/20261108130000_index_historique.sql
-- =====================================================================

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


-- =====================================================================
-- masse/supabase/migration-vers-index/1-installer-dans-index.sql
-- =====================================================================

-- ETAPE 1 : INSTALLER MASSE, FORMAT ET STRATE DANS LE PROJET D'INDEX (ngfz...).
-- Supabase > projet d'INDEX > SQL Editor > New query > Run. A lancer UNE SEULE FOIS.
-- Aucun nom ne rentre en conflit avec Index, Access ou Check (leurs tables : products, categories, suppliers,
-- profiles, projects, product_projects, check_*, access_*). Si Masse est deja installe, le script s'arrete tout de suite.

do $$ begin
  if to_regclass('public.materials') is not null or to_regclass('public.app_config') is not null then
    raise exception 'Masse est deja installe dans ce projet : rien n''a ete modifie.';
  end if;
end $$;

-- =====================================================================
-- Masse : tables, regles d'acces, fonctions PIN
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'autre',
  mode text not null default 'density',
  value numeric not null default 0,
  source text not null default '',
  note text not null default '',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.elements (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  length_mm numeric not null default 1000,
  height_mm numeric not null default 1000,
  markup_pct numeric not null default 5,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.components (
  id uuid primary key default gen_random_uuid(),
  element_id uuid not null references public.elements(id) on delete cascade,
  material_id uuid not null references public.materials(id),
  position int not null default 0,
  label text not null default '',
  thickness_mm numeric not null default 0,
  faces numeric not null default 1,
  length_m numeric not null default 0,
  count numeric not null default 1,
  custom_area_m2 numeric,
  glass_composition text not null default '',
  created_at timestamptz not null default now()
);
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  element_id uuid not null references public.elements(id),
  quantity numeric not null default 1,
  position int not null default 0
);
create table public.app_config (
  id int primary key default 1 check (id = 1),
  pin_hash text,
  failed_attempts int not null default 0,
  locked_until timestamptz
);
insert into public.app_config (id) values (1);

grant select on public.materials, public.elements, public.components, public.lists, public.list_items to anon, authenticated;
grant all on public.materials, public.elements, public.components, public.lists, public.list_items, public.app_config to service_role;

alter table public.materials enable row level security;
alter table public.elements enable row level security;
alter table public.components enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.app_config enable row level security;

create policy "read materials" on public.materials for select to anon, authenticated using (true);
create policy "read elements" on public.elements for select to anon, authenticated using (true);
create policy "read components" on public.components for select to anon, authenticated using (true);
create policy "read lists" on public.lists for select to anon, authenticated using (true);
create policy "read list_items" on public.list_items for select to anon, authenticated using (true);

-- PIN check: never raises, so the failure counter persists
create or replace function public._check_pin(p_pin text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare c public.app_config;
begin
  select * into c from public.app_config where id = 1 for update;
  if c.pin_hash is null then return 'Aucun PIN n''est défini. Définissez-le dans l''éditeur SQL Supabase.'; end if;
  if c.locked_until is not null and c.locked_until > now() then
    return 'Trop d''essais incorrects. Réessayez après ' || to_char(c.locked_until at time zone 'Europe/Zurich', 'HH24:MI') || '.';
  end if;
  if crypt(coalesce(p_pin,''), c.pin_hash) = c.pin_hash then
    update public.app_config set failed_attempts = 0, locked_until = null where id = 1;
    return null;
  end if;
  update public.app_config set failed_attempts = c.failed_attempts + 1,
    locked_until = case when c.failed_attempts + 1 >= 5 then now() + interval '5 minutes' else null end,
    failed_attempts = case when c.failed_attempts + 1 >= 5 then 0 else c.failed_attempts + 1 end
  where id = 1;
  if c.failed_attempts + 1 >= 5 then return 'PIN incorrect. Modifications bloquées pendant 5 minutes.'; end if;
  return 'PIN incorrect (' || (5 - c.failed_attempts - 1) || ' essai(s) restant(s)).';
end $$;
revoke all on function public._check_pin(text) from public, anon, authenticated;

create or replace function public._purge_trash() returns void
language sql security definer set search_path = public as $$
  delete from public.lists where deleted_at < now() - interval '30 days';
  delete from public.list_items where element_id in (select id from public.elements where deleted_at < now() - interval '30 days');
  delete from public.elements where deleted_at < now() - interval '30 days';
  delete from public.materials m where deleted_at < now() - interval '30 days'
    and not exists (select 1 from public.components c where c.material_id = m.id);
$$;
revoke all on function public._purge_trash() from public, anon, authenticated;

create or replace function public.verify_pin(p_pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text;
begin e := public._check_pin(p_pin);
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.save_material(p_pin text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text; v_id uuid;
begin e := public._check_pin(p_pin);
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  if coalesce(trim(p->>'name'),'') = '' then return jsonb_build_object('ok', false, 'error', 'Le nom est obligatoire.'); end if;
  if p->>'mode' not in ('density','surface','linear','unit') then return jsonb_build_object('ok', false, 'error', 'Mode de calcul invalide.'); end if;
  v_id := nullif(p->>'id','')::uuid;
  if v_id is null then
    insert into public.materials (name, category, mode, value, source, note)
    values (trim(p->>'name'), coalesce(p->>'category','autre'), p->>'mode', coalesce((p->>'value')::numeric,0), coalesce(p->>'source',''), coalesce(p->>'note',''))
    returning id into v_id;
  else
    update public.materials set name = trim(p->>'name'), category = coalesce(p->>'category','autre'), mode = p->>'mode',
      value = coalesce((p->>'value')::numeric,0), source = coalesce(p->>'source',''), note = coalesce(p->>'note',''), updated_at = now()
    where id = v_id;
  end if;
  perform public._purge_trash();
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.save_element(p_pin text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text; v_id uuid; c jsonb; i int := 0;
begin e := public._check_pin(p_pin);
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  if coalesce(trim(p->>'name'),'') = '' then return jsonb_build_object('ok', false, 'error', 'Le nom est obligatoire.'); end if;
  v_id := nullif(p->>'id','')::uuid;
  if v_id is null then
    insert into public.elements (name, description, length_mm, height_mm, markup_pct)
    values (trim(p->>'name'), coalesce(p->>'description',''), coalesce((p->>'length_mm')::numeric,0), coalesce((p->>'height_mm')::numeric,0), coalesce((p->>'markup_pct')::numeric,5))
    returning id into v_id;
  else
    update public.elements set name = trim(p->>'name'), description = coalesce(p->>'description',''),
      length_mm = coalesce((p->>'length_mm')::numeric,0), height_mm = coalesce((p->>'height_mm')::numeric,0),
      markup_pct = coalesce((p->>'markup_pct')::numeric,5), updated_at = now()
    where id = v_id;
    delete from public.components where element_id = v_id;
  end if;
  for c in select * from jsonb_array_elements(coalesce(p->'components','[]'::jsonb)) loop
    insert into public.components (element_id, material_id, position, label, thickness_mm, faces, length_m, count, custom_area_m2, glass_composition)
    values (v_id, (c->>'material_id')::uuid, i, coalesce(c->>'label',''), coalesce((c->>'thickness_mm')::numeric,0), coalesce((c->>'faces')::numeric,1),
      coalesce((c->>'length_m')::numeric,0), coalesce((c->>'count')::numeric,1), nullif(c->>'custom_area_m2','')::numeric, coalesce(c->>'glass_composition',''));
    i := i + 1;
  end loop;
  perform public._purge_trash();
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.save_list(p_pin text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text; v_id uuid; c jsonb; i int := 0;
begin e := public._check_pin(p_pin);
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  if coalesce(trim(p->>'name'),'') = '' then return jsonb_build_object('ok', false, 'error', 'Le nom est obligatoire.'); end if;
  v_id := nullif(p->>'id','')::uuid;
  if v_id is null then
    insert into public.lists (name) values (trim(p->>'name')) returning id into v_id;
  else
    update public.lists set name = trim(p->>'name'), updated_at = now() where id = v_id;
    delete from public.list_items where list_id = v_id;
  end if;
  for c in select * from jsonb_array_elements(coalesce(p->'items','[]'::jsonb)) loop
    insert into public.list_items (list_id, element_id, quantity, position)
    values (v_id, (c->>'element_id')::uuid, coalesce((c->>'quantity')::numeric,1), i);
    i := i + 1;
  end loop;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.set_deleted(p_pin text, p_table text, p_id uuid, p_deleted boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text;
begin e := public._check_pin(p_pin);
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  if p_table = 'materials' then
    if p_deleted and exists (select 1 from public.components c join public.elements el on el.id = c.element_id
                             where c.material_id = p_id and el.deleted_at is null) then
      return jsonb_build_object('ok', false, 'error', 'Ce matériau est utilisé dans un élément : suppression impossible.');
    end if;
    update public.materials set deleted_at = case when p_deleted then now() end, updated_at = now() where id = p_id;
  elsif p_table = 'elements' then
    if not p_deleted and exists (select 1 from public.components c join public.materials m on m.id = c.material_id
                                 where c.element_id = p_id and m.deleted_at is not null) then
      return jsonb_build_object('ok', false, 'error', 'Restaurez d''abord les matériaux utilisés par cet élément.');
    end if;
    update public.elements set deleted_at = case when p_deleted then now() end, updated_at = now() where id = p_id;
  elsif p_table = 'lists' then
    update public.lists set deleted_at = case when p_deleted then now() end, updated_at = now() where id = p_id;
  else
    return jsonb_build_object('ok', false, 'error', 'Table inconnue.');
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.import_all(p_pin text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text; r jsonb; n int := 0;
begin e := public._check_pin(p_pin);
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  for r in select * from jsonb_array_elements(coalesce(p->'materials','[]')) loop
    insert into public.materials (id, name, category, mode, value, source, note, deleted_at, updated_at)
    values ((r->>'id')::uuid, r->>'name', coalesce(r->>'category','autre'), r->>'mode', (r->>'value')::numeric, coalesce(r->>'source',''), coalesce(r->>'note',''), (r->>'deleted_at')::timestamptz, coalesce((r->>'updated_at')::timestamptz, now()))
    on conflict (id) do update set name = excluded.name, category = excluded.category, mode = excluded.mode, value = excluded.value,
      source = excluded.source, note = excluded.note, deleted_at = excluded.deleted_at, updated_at = excluded.updated_at;
    n := n + 1;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p->'elements','[]')) loop
    insert into public.elements (id, name, description, length_mm, height_mm, markup_pct, deleted_at, updated_at)
    values ((r->>'id')::uuid, r->>'name', coalesce(r->>'description',''), (r->>'length_mm')::numeric, (r->>'height_mm')::numeric, coalesce((r->>'markup_pct')::numeric,5), (r->>'deleted_at')::timestamptz, coalesce((r->>'updated_at')::timestamptz, now()))
    on conflict (id) do update set name = excluded.name, description = excluded.description, length_mm = excluded.length_mm,
      height_mm = excluded.height_mm, markup_pct = excluded.markup_pct, deleted_at = excluded.deleted_at, updated_at = excluded.updated_at;
    delete from public.components where element_id = (r->>'id')::uuid;
    n := n + 1;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p->'components','[]')) loop
    insert into public.components (element_id, material_id, position, label, thickness_mm, faces, length_m, count, custom_area_m2, glass_composition)
    values ((r->>'element_id')::uuid, (r->>'material_id')::uuid, coalesce((r->>'position')::int,0), coalesce(r->>'label',''), coalesce((r->>'thickness_mm')::numeric,0),
      coalesce((r->>'faces')::numeric,1), coalesce((r->>'length_m')::numeric,0), coalesce((r->>'count')::numeric,1), nullif(r->>'custom_area_m2','')::numeric, coalesce(r->>'glass_composition',''));
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p->'lists','[]')) loop
    insert into public.lists (id, name, deleted_at, updated_at)
    values ((r->>'id')::uuid, r->>'name', (r->>'deleted_at')::timestamptz, coalesce((r->>'updated_at')::timestamptz, now()))
    on conflict (id) do update set name = excluded.name, deleted_at = excluded.deleted_at, updated_at = excluded.updated_at;
    delete from public.list_items where list_id = (r->>'id')::uuid;
    n := n + 1;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p->'list_items','[]')) loop
    insert into public.list_items (list_id, element_id, quantity, position)
    values ((r->>'list_id')::uuid, (r->>'element_id')::uuid, coalesce((r->>'quantity')::numeric,1), coalesce((r->>'position')::int,0));
  end loop;
  return jsonb_build_object('ok', true, 'count', n);
end $$;

grant execute on function public.verify_pin(text), public.save_material(text, jsonb), public.save_element(text, jsonb),
  public.save_list(text, jsonb), public.set_deleted(text, text, uuid, boolean), public.import_all(text, jsonb) to anon, authenticated;

insert into public.materials (name, category, mode, value, source) values
('Aluminium','metal','density',2700,'valeur standard à vérifier'),
('Acier','metal','density',7850,'valeur standard à vérifier'),
('Inox','metal','density',7900,'valeur standard à vérifier'),
('Zinc','metal','density',7200,'valeur standard à vérifier'),
('Cuivre','metal','density',8900,'valeur standard à vérifier'),
('Verre','verre','density',2500,'valeur standard à vérifier'),
('Intercalaire PVB','verre','density',1070,'valeur standard à vérifier'),
('Laine de roche','isolant','density',100,'valeur standard à vérifier'),
('Laine de verre','isolant','density',20,'valeur standard à vérifier'),
('PIR','isolant','density',32,'valeur standard à vérifier'),
('EPS','isolant','density',20,'valeur standard à vérifier'),
('XPS','isolant','density',35,'valeur standard à vérifier'),
('Panneau composite alu 4 mm','panneau','surface',7.6,'valeur standard à vérifier'),
('Plaque de plâtre 12,5 mm','panneau','surface',9,'valeur standard à vérifier');

-- =====================================================================
-- Masse : correctif du blocage apres 5 PIN faux
-- =====================================================================
-- Correctif : le blocage apres 5 PIN faux ne fonctionnait pas.
-- L'ancienne version modifiait deux fois la colonne failed_attempts dans le meme
-- UPDATE : Postgres refusait la requete, la fonction plantait, et le compteur
-- d'essais ne bougeait jamais (essais illimites + message technique a l'ecran).
create or replace function public._check_pin(p_pin text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  c public.app_config;
  v_attempts int;
begin
  select * into c from public.app_config where id = 1 for update;
  if c.pin_hash is null then
    return 'Aucun PIN n''est défini. Définissez-le dans l''éditeur SQL Supabase.';
  end if;
  if c.locked_until is not null and c.locked_until > now() then
    return 'Trop d''essais incorrects. Réessayez après '
      || to_char(c.locked_until at time zone 'Europe/Zurich', 'HH24:MI') || '.';
  end if;
  if crypt(coalesce(p_pin, ''), c.pin_hash) = c.pin_hash then
    update public.app_config set failed_attempts = 0, locked_until = null where id = 1;
    return null;
  end if;

  v_attempts := c.failed_attempts + 1;
  if v_attempts >= 5 then
    -- 5e erreur : on bloque 5 minutes et on remet le compteur a zero pour la suite
    update public.app_config set failed_attempts = 0, locked_until = now() + interval '5 minutes' where id = 1;
    return 'PIN incorrect. Modifications bloquées pendant 5 minutes.';
  end if;
  update public.app_config set failed_attempts = v_attempts, locked_until = null where id = 1;
  return 'PIN incorrect (' || (5 - v_attempts) || ' essai(s) restant(s)).';
end $$;
revoke all on function public._check_pin(text) from public, anon, authenticated;

-- Correctif : la purge de la corbeille (30 jours) retirait en silence les lignes
-- des listes qui utilisaient l'element purge -> le poids d'une livraison baissait
-- sans prevenir. Desormais un element reste conserve tant qu'une liste
-- (meme a la corbeille) l'utilise ; la liste l'affiche "dans la corbeille".
create or replace function public._purge_trash() returns void
language sql security definer set search_path = public as $$
  delete from public.lists where deleted_at < now() - interval '30 days';
  delete from public.elements e where e.deleted_at < now() - interval '30 days'
    and not exists (select 1 from public.list_items li where li.element_id = e.id);
  delete from public.materials m where m.deleted_at < now() - interval '30 days'
    and not exists (select 1 from public.components c where c.material_id = m.id);
$$;
revoke all on function public._purge_trash() from public, anon, authenticated;

-- =====================================================================
-- Masse : lien des materiaux vers Index
-- =====================================================================
-- Masse : lien de chaque materiau vers sa fiche technique dans Index.
-- A coller UNE FOIS dans Supabase (projet de Masse) > SQL Editor > New query > Run.
-- Relancer le script ne casse rien.

alter table public.materials add column if not exists index_id text;
alter table public.materials add column if not exists index_name text;

create or replace function public.save_material(p_pin text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text; v_id uuid;
begin e := public._check_pin(p_pin);
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  if coalesce(trim(p->>'name'),'') = '' then return jsonb_build_object('ok', false, 'error', 'Le nom est obligatoire.'); end if;
  if p->>'mode' not in ('density','surface','linear','unit') then return jsonb_build_object('ok', false, 'error', 'Mode de calcul invalide.'); end if;
  v_id := nullif(p->>'id','')::uuid;
  if v_id is null then
    insert into public.materials (name, category, mode, value, source, note, index_id, index_name)
    values (trim(p->>'name'), coalesce(p->>'category','autre'), p->>'mode', coalesce((p->>'value')::numeric,0), coalesce(p->>'source',''), coalesce(p->>'note',''),
            nullif(p->>'index_id',''), nullif(p->>'index_name',''))
    returning id into v_id;
  else
    update public.materials set name = trim(p->>'name'), category = coalesce(p->>'category','autre'), mode = p->>'mode',
      value = coalesce((p->>'value')::numeric,0), source = coalesce(p->>'source',''), note = coalesce(p->>'note',''),
      index_id = nullif(p->>'index_id',''), index_name = nullif(p->>'index_name',''), updated_at = now()
    where id = v_id;
  end if;
  perform public._purge_trash();
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- =====================================================================
-- Format : bibliotheque commune
-- =====================================================================
-- Bibliotheque commune de Format : a coller UNE FOIS dans Supabase (projet de Masse)
-- > SQL Editor > New query > Run. Rien d'autre a faire ; relancer le script ne casse rien.
--
-- - Une table « format_materiaux » : un materiau par ligne (formats, epaisseur, trait de coupe...).
-- - LES PRIX NE SONT JAMAIS ENREGISTRES : la base les retire meme si l'appli en envoyait.
-- - Lecture libre ; creation, modification et suppression protegees par le PIN de Masse
--   (meme code, memes 5 essais avant blocage 5 minutes : fonction public._check_pin).
-- - Une suppression met le materiau a la corbeille (deleted_at) : les projets qui
--   l'utilisent encore le gardent sur leur poste.

create table if not exists public.format_materiaux (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.format_materiaux enable row level security;
grant select on public.format_materiaux to anon, authenticated;
grant all on public.format_materiaux to service_role;
drop policy if exists "lecture bibliotheque format" on public.format_materiaux;
create policy "lecture bibliotheque format" on public.format_materiaux for select to anon, authenticated using (true);

-- Retire le champ « price » de chaque format d'un tableau situe a ce chemin du JSON
create or replace function public._format_retirer_prix(p jsonb, chemin text[]) returns jsonb
language sql immutable set search_path = public as $$
  select case when jsonb_typeof(p #> chemin) = 'array'
    then jsonb_set(p, chemin, (select coalesce(jsonb_agg(f - 'price'), '[]'::jsonb) from jsonb_array_elements(p #> chemin) f))
    else p end
$$;
revoke all on function public._format_retirer_prix(jsonb, text[]) from public, anon, authenticated;

create or replace function public.format_save_material(p_pin text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text; v_id text := p->>'id'; v_data jsonb;
begin
  e := public._check_pin(p_pin);
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  if coalesce(v_id, '') = '' or length(v_id) > 100 then return jsonb_build_object('ok', false, 'error', 'Matériau invalide.'); end if;
  if coalesce(trim(p->>'name'), '') = '' then return jsonb_build_object('ok', false, 'error', 'Le nom est obligatoire.'); end if;
  if octet_length(p::text) > 20000 then return jsonb_build_object('ok', false, 'error', 'Matériau trop volumineux.'); end if;
  v_data := public._format_retirer_prix(public._format_retirer_prix(p, '{supply,formats}'), '{supplyValues,catalog,formats}');
  insert into public.format_materiaux (id, data, updated_at, deleted_at) values (v_id, v_data, now(), null)
  on conflict (id) do update set data = excluded.data, updated_at = now(), deleted_at = null;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.format_delete_material(p_pin text, p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text;
begin
  e := public._check_pin(p_pin);
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  update public.format_materiaux set deleted_at = now(), updated_at = now() where id = p_id;
  -- Corbeille videe apres 90 jours
  delete from public.format_materiaux where deleted_at < now() - interval '90 days';
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.format_save_material(text, jsonb), public.format_delete_material(text, text) to anon, authenticated;

-- =====================================================================
-- Strate : catalogue commun
-- =====================================================================
-- Catalogue commun de Strate : a coller UNE FOIS dans Supabase (projet de Masse)
-- > SQL Editor > New query > Run. Relancer le script ne casse rien.
--
-- - Une table « strate_catalogue » : un produit d'isolant ou un systeme de fixation par ligne
--   (epaisseurs, m2 par colis, colis par palette, prix catalogue, articles HFT...).
-- - Lecture libre ; partage, mise a jour et retrait proteges par le PIN de Masse
--   (meme code, memes 5 essais avant blocage 5 minutes : fonction public._check_pin).
-- - Un retrait met l'element a la corbeille (deleted_at) : les postes qui l'utilisent
--   dans une commande le gardent.

create table if not exists public.strate_catalogue (
  id text primary key,
  kind text not null check (kind in ('produit', 'fixation')),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.strate_catalogue enable row level security;
grant select on public.strate_catalogue to anon, authenticated;
grant all on public.strate_catalogue to service_role;
drop policy if exists "lecture catalogue strate" on public.strate_catalogue;
create policy "lecture catalogue strate" on public.strate_catalogue for select to anon, authenticated using (true);

create or replace function public.strate_save_item(p_pin text, p_kind text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text; v_id text := p->>'id';
begin
  e := public._check_pin(p_pin);
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  if p_kind not in ('produit', 'fixation') then return jsonb_build_object('ok', false, 'error', 'Type inconnu.'); end if;
  if coalesce(v_id, '') = '' or length(v_id) > 100 then return jsonb_build_object('ok', false, 'error', 'Élément invalide.'); end if;
  if coalesce(trim(p->>'name'), '') = '' then return jsonb_build_object('ok', false, 'error', 'Le nom est obligatoire.'); end if;
  if octet_length(p::text) > 50000 then return jsonb_build_object('ok', false, 'error', 'Élément trop volumineux.'); end if;
  insert into public.strate_catalogue (id, kind, data, updated_at, deleted_at) values (v_id, p_kind, p, now(), null)
  on conflict (id) do update set kind = excluded.kind, data = excluded.data, updated_at = now(), deleted_at = null;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.strate_delete_item(p_pin text, p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text;
begin
  e := public._check_pin(p_pin);
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  update public.strate_catalogue set deleted_at = now(), updated_at = now() where id = p_id;
  -- Corbeille videe apres 90 jours
  delete from public.strate_catalogue where deleted_at < now() - interval '90 days';
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.strate_save_item(text, text, jsonb), public.strate_delete_item(text, text) from public;
grant execute on function public.strate_save_item(text, text, jsonb), public.strate_delete_item(text, text) to anon, authenticated;

-- =====================================================================
-- PIN : definis-le toi-meme (remplace 1234 par ton code), meme principe qu'avant.
-- Ne le laisse pas dans un fichier : c'est le seul endroit ou il apparait.
-- =====================================================================
-- update public.app_config set pin_hash = extensions.crypt('1234', extensions.gen_salt('bf')) where id = 1;


-- =====================================================================
-- masse/supabase/masse-comptes.sql
-- =====================================================================

-- Masse 2.8 : l'ecriture passe par le COMPTE Index (connecte + valide) au lieu du code PIN.
-- A coller UNE FOIS dans Supabase (projet Index) > SQL Editor > New query > Run.
-- Colle le CONTENU de ce fichier (pas son nom). Relancer ne casse rien.
-- Les anciennes fonctions a PIN restent en place (Format et Strate les utilisent encore).

create or replace function public._check_acces() returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return 'Connectez-vous avec votre compte Index pour modifier.'; end if;
  if not public.is_approved() then return 'Votre compte Index n''est pas encore valide : un administrateur doit l''approuver.'; end if;
  return null;
end $$;
revoke all on function public._check_acces() from public, anon, authenticated;

create or replace function public.save_material(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text; v_id uuid;
begin e := public._check_acces();
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  if coalesce(trim(p->>'name'),'') = '' then return jsonb_build_object('ok', false, 'error', 'Le nom est obligatoire.'); end if;
  if p->>'mode' not in ('density','surface','linear','unit') then return jsonb_build_object('ok', false, 'error', 'Mode de calcul invalide.'); end if;
  v_id := nullif(p->>'id','')::uuid;
  if v_id is null then
    insert into public.materials (name, category, mode, value, source, note, index_id, index_name)
    values (trim(p->>'name'), coalesce(p->>'category','autre'), p->>'mode', coalesce((p->>'value')::numeric,0), coalesce(p->>'source',''), coalesce(p->>'note',''),
            nullif(p->>'index_id',''), nullif(p->>'index_name',''))
    returning id into v_id;
  else
    update public.materials set name = trim(p->>'name'), category = coalesce(p->>'category','autre'), mode = p->>'mode',
      value = coalesce((p->>'value')::numeric,0), source = coalesce(p->>'source',''), note = coalesce(p->>'note',''),
      index_id = nullif(p->>'index_id',''), index_name = nullif(p->>'index_name',''), updated_at = now()
    where id = v_id;
  end if;
  perform public._purge_trash();
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.save_element(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text; v_id uuid; c jsonb; i int := 0;
begin e := public._check_acces();
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  if coalesce(trim(p->>'name'),'') = '' then return jsonb_build_object('ok', false, 'error', 'Le nom est obligatoire.'); end if;
  v_id := nullif(p->>'id','')::uuid;
  if v_id is null then
    insert into public.elements (name, description, length_mm, height_mm, markup_pct)
    values (trim(p->>'name'), coalesce(p->>'description',''), coalesce((p->>'length_mm')::numeric,0), coalesce((p->>'height_mm')::numeric,0), coalesce((p->>'markup_pct')::numeric,5))
    returning id into v_id;
  else
    update public.elements set name = trim(p->>'name'), description = coalesce(p->>'description',''),
      length_mm = coalesce((p->>'length_mm')::numeric,0), height_mm = coalesce((p->>'height_mm')::numeric,0),
      markup_pct = coalesce((p->>'markup_pct')::numeric,5), updated_at = now()
    where id = v_id;
    delete from public.components where element_id = v_id;
  end if;
  for c in select * from jsonb_array_elements(coalesce(p->'components','[]'::jsonb)) loop
    insert into public.components (element_id, material_id, position, label, thickness_mm, faces, length_m, count, custom_area_m2, glass_composition)
    values (v_id, (c->>'material_id')::uuid, i, coalesce(c->>'label',''), coalesce((c->>'thickness_mm')::numeric,0), coalesce((c->>'faces')::numeric,1),
      coalesce((c->>'length_m')::numeric,0), coalesce((c->>'count')::numeric,1), nullif(c->>'custom_area_m2','')::numeric, coalesce(c->>'glass_composition',''));
    i := i + 1;
  end loop;
  perform public._purge_trash();
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.save_list(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text; v_id uuid; c jsonb; i int := 0;
begin e := public._check_acces();
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  if coalesce(trim(p->>'name'),'') = '' then return jsonb_build_object('ok', false, 'error', 'Le nom est obligatoire.'); end if;
  v_id := nullif(p->>'id','')::uuid;
  if v_id is null then
    insert into public.lists (name) values (trim(p->>'name')) returning id into v_id;
  else
    update public.lists set name = trim(p->>'name'), updated_at = now() where id = v_id;
    delete from public.list_items where list_id = v_id;
  end if;
  for c in select * from jsonb_array_elements(coalesce(p->'items','[]'::jsonb)) loop
    insert into public.list_items (list_id, element_id, quantity, position)
    values (v_id, (c->>'element_id')::uuid, coalesce((c->>'quantity')::numeric,1), i);
    i := i + 1;
  end loop;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.set_deleted(p_table text, p_id uuid, p_deleted boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text;
begin e := public._check_acces();
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  if p_table = 'materials' then
    if p_deleted and exists (select 1 from public.components c join public.elements el on el.id = c.element_id
                             where c.material_id = p_id and el.deleted_at is null) then
      return jsonb_build_object('ok', false, 'error', 'Ce matériau est utilisé dans un élément : suppression impossible.');
    end if;
    update public.materials set deleted_at = case when p_deleted then now() end, updated_at = now() where id = p_id;
  elsif p_table = 'elements' then
    if not p_deleted and exists (select 1 from public.components c join public.materials m on m.id = c.material_id
                                 where c.element_id = p_id and m.deleted_at is not null) then
      return jsonb_build_object('ok', false, 'error', 'Restaurez d''abord les matériaux utilisés par cet élément.');
    end if;
    update public.elements set deleted_at = case when p_deleted then now() end, updated_at = now() where id = p_id;
  elsif p_table = 'lists' then
    update public.lists set deleted_at = case when p_deleted then now() end, updated_at = now() where id = p_id;
  else
    return jsonb_build_object('ok', false, 'error', 'Table inconnue.');
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.import_all(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text; r jsonb; n int := 0;
begin e := public._check_acces();
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  for r in select * from jsonb_array_elements(coalesce(p->'materials','[]')) loop
    insert into public.materials (id, name, category, mode, value, source, note, deleted_at, updated_at)
    values ((r->>'id')::uuid, r->>'name', coalesce(r->>'category','autre'), r->>'mode', (r->>'value')::numeric, coalesce(r->>'source',''), coalesce(r->>'note',''), (r->>'deleted_at')::timestamptz, coalesce((r->>'updated_at')::timestamptz, now()))
    on conflict (id) do update set name = excluded.name, category = excluded.category, mode = excluded.mode, value = excluded.value,
      source = excluded.source, note = excluded.note, deleted_at = excluded.deleted_at, updated_at = excluded.updated_at;
    n := n + 1;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p->'elements','[]')) loop
    insert into public.elements (id, name, description, length_mm, height_mm, markup_pct, deleted_at, updated_at)
    values ((r->>'id')::uuid, r->>'name', coalesce(r->>'description',''), (r->>'length_mm')::numeric, (r->>'height_mm')::numeric, coalesce((r->>'markup_pct')::numeric,5), (r->>'deleted_at')::timestamptz, coalesce((r->>'updated_at')::timestamptz, now()))
    on conflict (id) do update set name = excluded.name, description = excluded.description, length_mm = excluded.length_mm,
      height_mm = excluded.height_mm, markup_pct = excluded.markup_pct, deleted_at = excluded.deleted_at, updated_at = excluded.updated_at;
    delete from public.components where element_id = (r->>'id')::uuid;
    n := n + 1;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p->'components','[]')) loop
    insert into public.components (element_id, material_id, position, label, thickness_mm, faces, length_m, count, custom_area_m2, glass_composition)
    values ((r->>'element_id')::uuid, (r->>'material_id')::uuid, coalesce((r->>'position')::int,0), coalesce(r->>'label',''), coalesce((r->>'thickness_mm')::numeric,0),
      coalesce((r->>'faces')::numeric,1), coalesce((r->>'length_m')::numeric,0), coalesce((r->>'count')::numeric,1), nullif(r->>'custom_area_m2','')::numeric, coalesce(r->>'glass_composition',''));
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p->'lists','[]')) loop
    insert into public.lists (id, name, deleted_at, updated_at)
    values ((r->>'id')::uuid, r->>'name', (r->>'deleted_at')::timestamptz, coalesce((r->>'updated_at')::timestamptz, now()))
    on conflict (id) do update set name = excluded.name, deleted_at = excluded.deleted_at, updated_at = excluded.updated_at;
    delete from public.list_items where list_id = (r->>'id')::uuid;
    n := n + 1;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p->'list_items','[]')) loop
    insert into public.list_items (list_id, element_id, quantity, position)
    values ((r->>'list_id')::uuid, (r->>'element_id')::uuid, coalesce((r->>'quantity')::numeric,1), coalesce((r->>'position')::int,0));
  end loop;
  return jsonb_build_object('ok', true, 'count', n);
end $$;

grant execute on function public.save_material(jsonb), public.save_element(jsonb), public.save_list(jsonb),
  public.set_deleted(text, uuid, boolean), public.import_all(jsonb) to authenticated;


-- =====================================================================
-- masse/supabase/masse-liens-index.sql
-- =====================================================================

-- Masse : lien de chaque materiau vers sa fiche technique dans Index.
-- A coller UNE FOIS dans Supabase (projet de Masse) > SQL Editor > New query > Run.
-- Relancer le script ne casse rien.

alter table public.materials add column if not exists index_id text;
alter table public.materials add column if not exists index_name text;

create or replace function public.save_material(p_pin text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text; v_id uuid;
begin e := public._check_pin(p_pin);
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  if coalesce(trim(p->>'name'),'') = '' then return jsonb_build_object('ok', false, 'error', 'Le nom est obligatoire.'); end if;
  if p->>'mode' not in ('density','surface','linear','unit') then return jsonb_build_object('ok', false, 'error', 'Mode de calcul invalide.'); end if;
  v_id := nullif(p->>'id','')::uuid;
  if v_id is null then
    insert into public.materials (name, category, mode, value, source, note, index_id, index_name)
    values (trim(p->>'name'), coalesce(p->>'category','autre'), p->>'mode', coalesce((p->>'value')::numeric,0), coalesce(p->>'source',''), coalesce(p->>'note',''),
            nullif(p->>'index_id',''), nullif(p->>'index_name',''))
    returning id into v_id;
  else
    update public.materials set name = trim(p->>'name'), category = coalesce(p->>'category','autre'), mode = p->>'mode',
      value = coalesce((p->>'value')::numeric,0), source = coalesce(p->>'source',''), note = coalesce(p->>'note',''),
      index_id = nullif(p->>'index_id',''), index_name = nullif(p->>'index_name',''), updated_at = now()
    where id = v_id;
  end if;
  perform public._purge_trash();
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;


-- =====================================================================
-- format/supabase/format-comptes.sql
-- =====================================================================

-- Format 2.8 : la modification de la bibliotheque commune passe par le COMPTE Index
-- (connecte + valide) au lieu du code PIN. A coller dans Supabase (projet Index) > SQL Editor > Run.
-- Colle le CONTENU du fichier, pas son nom. Relancer ne casse rien.
-- Les anciennes fonctions a PIN restent en place le temps de la transition.

create or replace function public._check_acces() returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return 'Connectez-vous avec votre compte Index pour modifier.'; end if;
  if not public.is_approved() then return 'Votre compte Index n''est pas encore valide : un administrateur doit l''approuver.'; end if;
  return null;
end $$;
revoke all on function public._check_acces() from public, anon, authenticated;

create or replace function public.format_save_material(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text; v_id text := p->>'id'; v_data jsonb;
begin
  e := public._check_acces();
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  if coalesce(v_id, '') = '' or length(v_id) > 100 then return jsonb_build_object('ok', false, 'error', 'Matériau invalide.'); end if;
  if coalesce(trim(p->>'name'), '') = '' then return jsonb_build_object('ok', false, 'error', 'Le nom est obligatoire.'); end if;
  if octet_length(p::text) > 20000 then return jsonb_build_object('ok', false, 'error', 'Matériau trop volumineux.'); end if;
  v_data := public._format_retirer_prix(public._format_retirer_prix(p, '{supply,formats}'), '{supplyValues,catalog,formats}');
  insert into public.format_materiaux (id, data, updated_at, deleted_at) values (v_id, v_data, now(), null)
  on conflict (id) do update set data = excluded.data, updated_at = now(), deleted_at = null;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.format_delete_material(p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text;
begin
  e := public._check_acces();
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  update public.format_materiaux set deleted_at = now(), updated_at = now() where id = p_id;
  -- Corbeille videe apres 90 jours
  delete from public.format_materiaux where deleted_at < now() - interval '90 days';
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.format_save_material(jsonb), public.format_delete_material(text) to authenticated;


-- =====================================================================
-- strate/supabase/strate-comptes.sql
-- =====================================================================

-- Strate 15.7 : comptes Index a la place du PIN, et PRIX reserves aux comptes valides.
-- A coller dans Supabase (projet Index) > SQL Editor > Run. Colle le CONTENU du fichier, pas son nom.
-- Relancer ne casse rien.
--
-- - Modification du catalogue : compte connecte et valide (fonctions sans PIN).
-- - Lecture : la table n'est plus lisible par le public ; la fonction strate_lire() renvoie le catalogue
--   SANS les prix (prix des epaisseurs et prix des articles de fixation) tant qu'on n'a pas un compte valide.
-- - Les anciennes fonctions a PIN restent le temps de la transition.

create or replace function public._check_acces() returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return 'Connectez-vous avec votre compte Index pour modifier.'; end if;
  if not public.is_approved() then return 'Votre compte Index n''est pas encore valide : un administrateur doit l''approuver.'; end if;
  return null;
end $$;
revoke all on function public._check_acces() from public, anon, authenticated;

-- Lecture reservee aux comptes valides ; le public passe par strate_lire() (sans prix)
revoke select on public.strate_catalogue from anon;
drop policy if exists "lecture catalogue strate" on public.strate_catalogue;
create policy "lecture catalogue strate" on public.strate_catalogue for select to authenticated using (public.is_approved());

create or replace function public._strate_sans_prix(k text, d jsonb) returns jsonb
language sql immutable set search_path = public as $$
  select case
    when k = 'produit' and jsonb_typeof(d->'thicknesses') = 'array'
      then jsonb_set(d, '{thicknesses}', (select coalesce(jsonb_agg(t - 'price'), '[]'::jsonb) from jsonb_array_elements(d->'thicknesses') t))
    when k = 'fixation' and jsonb_typeof(d->'articles') = 'array'
      then jsonb_set(d, '{articles}', (select coalesce(jsonb_agg(a - 'price100'), '[]'::jsonb) from jsonb_array_elements(d->'articles') a))
    else d end
$$;
revoke all on function public._strate_sans_prix(text, jsonb) from public, anon, authenticated;

create or replace function public.strate_lire() returns table (id text, kind text, data jsonb, updated_at timestamptz, deleted_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.kind,
         case when public.is_approved() then c.data else public._strate_sans_prix(c.kind, c.data) end,
         c.updated_at, c.deleted_at
  from public.strate_catalogue c
$$;
revoke all on function public.strate_lire() from public;
grant execute on function public.strate_lire() to anon, authenticated;

create or replace function public.strate_save_item(p_kind text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text; v_id text := p->>'id';
begin
  e := public._check_acces();
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  if p_kind not in ('produit', 'fixation') then return jsonb_build_object('ok', false, 'error', 'Type inconnu.'); end if;
  if coalesce(v_id, '') = '' or length(v_id) > 100 then return jsonb_build_object('ok', false, 'error', 'Élément invalide.'); end if;
  if coalesce(trim(p->>'name'), '') = '' then return jsonb_build_object('ok', false, 'error', 'Le nom est obligatoire.'); end if;
  if octet_length(p::text) > 50000 then return jsonb_build_object('ok', false, 'error', 'Élément trop volumineux.'); end if;
  insert into public.strate_catalogue (id, kind, data, updated_at, deleted_at) values (v_id, p_kind, p, now(), null)
  on conflict (id) do update set kind = excluded.kind, data = excluded.data, updated_at = now(), deleted_at = null;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.strate_delete_item(p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text;
begin
  e := public._check_acces();
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  update public.strate_catalogue set deleted_at = now(), updated_at = now() where id = p_id;
  -- Corbeille videe apres 90 jours
  delete from public.strate_catalogue where deleted_at < now() - interval '90 days';
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.strate_save_item(text, jsonb), public.strate_delete_item(text) to authenticated;


-- =====================================================================
-- access/supabase/access-index.sql
-- =====================================================================

-- Access dans le projet Supabase d'INDEX (memes comptes que Index) : a coller UNE FOIS dans
-- Supabase > projet d'Index > SQL Editor > New query > Run. Relancer le script ne casse rien.
--
-- - « access_domaines » et « access_fournisseurs » : lecture libre (noms, liens, notes),
--   ajout / modification / suppression reserves aux comptes VALIDES dans Index.
-- - « access_acces » : identifiants des sites fournisseurs.
--     proprietaire vide  = acces du bureau, visible et modifiable par tous les comptes valides ;
--     proprietaire = moi = acces perso, visible et modifiable par moi seul.
--   Jamais lisible sans compte valide.

create table if not exists public.access_domaines (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique check (length(trim(nom)) between 1 and 60),
  ordre int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.access_fournisseurs (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (length(trim(nom)) between 1 and 120),
  domaine_id uuid not null references public.access_domaines(id) on delete restrict,
  site text not null default '' check (site = '' or (site ~* '^https?://' and length(site) <= 500)),
  site_cao text not null default '' check (site_cao = '' or (site_cao ~* '^https?://' and length(site_cao) <= 500)),
  notes text not null default '' check (length(notes) <= 2000),
  updated_at timestamptz not null default now()
);

create table if not exists public.access_acces (
  id uuid primary key default gen_random_uuid(),
  fournisseur_id uuid not null references public.access_fournisseurs(id) on delete cascade,
  proprietaire uuid references auth.users(id) on delete cascade,
  identifiant text not null default '' check (length(identifiant) <= 200),
  mot_de_passe text not null default '' check (length(mot_de_passe) <= 200),
  updated_at timestamptz not null default now()
);
-- Un seul acces bureau et un seul acces perso par personne, pour chaque fournisseur
create unique index if not exists access_acces_bureau on public.access_acces (fournisseur_id) where proprietaire is null;
create unique index if not exists access_acces_perso on public.access_acces (fournisseur_id, proprietaire) where proprietaire is not null;

alter table public.access_domaines enable row level security;
alter table public.access_fournisseurs enable row level security;
alter table public.access_acces enable row level security;

grant select on public.access_domaines, public.access_fournisseurs to anon;
grant select, insert, update, delete on public.access_domaines, public.access_fournisseurs, public.access_acces to authenticated;
revoke all on public.access_acces from anon;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' and tablename in ('access_domaines', 'access_fournisseurs', 'access_acces') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Domaines et fournisseurs : lecture libre, modifications par les comptes valides
create policy "lecture domaines" on public.access_domaines for select to anon, authenticated using (true);
create policy "ecriture domaines" on public.access_domaines for all to authenticated using (public.is_approved()) with check (public.is_approved());
create policy "lecture fournisseurs" on public.access_fournisseurs for select to anon, authenticated using (true);
create policy "ecriture fournisseurs" on public.access_fournisseurs for all to authenticated using (public.is_approved()) with check (public.is_approved());

-- Acces : comptes valides seulement ; le bureau pour tous, le perso pour son proprietaire
create policy "lecture acces" on public.access_acces for select to authenticated
  using (public.is_approved() and (proprietaire is null or proprietaire = auth.uid()));
create policy "ajout acces" on public.access_acces for insert to authenticated
  with check (public.is_approved() and (proprietaire is null or proprietaire = auth.uid()));
create policy "modif acces" on public.access_acces for update to authenticated
  using (public.is_approved() and (proprietaire is null or proprietaire = auth.uid()))
  with check (public.is_approved() and (proprietaire is null or proprietaire = auth.uid()));
create policy "retrait acces" on public.access_acces for delete to authenticated
  using (public.is_approved() and (proprietaire is null or proprietaire = auth.uid()));


-- =====================================================================
-- access/supabase/migrations/20261105090000_access_contact.sql
-- =====================================================================

-- Access 2.11 : personne de contact (nom, prenom, telephone). L'ancienne colonne email_technique est conservee.
alter table public.access_fournisseurs
  add column if not exists contact_nom text not null default '',
  add column if not exists contact_prenom text not null default '',
  add column if not exists contact_telephone text not null default '';


-- =====================================================================
-- access/supabase/migrations/20261105100000_access_contact_email.sql
-- =====================================================================

-- Access 2.12 : email de la personne de contact.
alter table public.access_fournisseurs add column if not exists contact_email text not null default '';


-- =====================================================================
-- check/supabase/check-index.sql
-- =====================================================================

-- Check dans le projet Supabase d'INDEX (memes comptes que Index et Access) : a coller UNE FOIS dans
-- Supabase > projet d'Index > SQL Editor > New query > Run. Relancer le script ne casse rien.
--
-- - « check_projets » : les projets de Check, chacun avec son equipe (« check_membres »).
--   On entre dans une equipe sur invitation d'un membre ; le createur est le premier membre.
-- - « check_notes » : une note sans projet est PERSO (visible par son auteur seul) ;
--   une note de projet est visible et modifiable par toute l'equipe du projet.
--   « pour » = la personne a qui la note est confiee (membre du projet).
-- - Tout est reserve aux comptes VALIDES dans Index. Corbeille videe apres 30 jours.

create table if not exists public.check_projets (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (length(trim(nom)) between 1 and 80),
  numero text not null default '' check (length(numero) <= 30),
  cree_par uuid not null default auth.uid() references auth.users(id) on delete set null,
  archive boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.check_projets alter column cree_par drop not null;

create table if not exists public.check_membres (
  projet_id uuid not null references public.check_projets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ajoute_par uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (projet_id, user_id)
);

create table if not exists public.check_notes (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid references public.check_projets(id) on delete cascade,
  auteur uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pour uuid references auth.users(id) on delete set null,
  texte text not null check (length(trim(texte)) between 1 and 4000),
  statut text not null default 'todo' check (statut in ('todo', 'in_progress', 'waiting', 'done')),
  echeance date,
  flash boolean not null default false,
  archive boolean not null default false,
  ordre double precision not null default 0,
  regle_le timestamptz,
  supprime_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Reponse a une note reglee (3.0) : facultative, 500 caracteres au plus.
alter table public.check_notes add column if not exists reponse text;
alter table public.check_notes drop constraint if exists check_notes_reponse_longueur;
alter table public.check_notes add constraint check_notes_reponse_longueur check (reponse is null or length(reponse) <= 500);
create index if not exists check_notes_projet on public.check_notes (projet_id);
create index if not exists check_notes_pour on public.check_notes (pour);

-- Membre d'un projet ? (SECURITY DEFINER : evite que les regles se lisent elles-memes en boucle)
create or replace function public.check_est_membre(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.check_membres where projet_id = p and user_id = auth.uid())
$$;
revoke all on function public.check_est_membre(uuid) from public;
grant execute on function public.check_est_membre(uuid) to authenticated;

-- Un compte est-il valide ? (SECURITY DEFINER : chacun ne voit que son propre profil, la regle d'invitation ne peut pas lire celui des autres)
create or replace function public.check_compte_valide(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = u and approved)
$$;
revoke all on function public.check_compte_valide(uuid) from public;
grant execute on function public.check_compte_valide(uuid) to authenticated;

-- Comptes valides proposes a l'invitation (nom lisible, jamais rien d'autre que nom + email)
create or replace function public.check_comptes() returns table (id uuid, nom text, email text)
language sql stable security definer set search_path = public as $$
  select p.id,
         coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), nullif(p.display_name, ''), p.email),
         p.email
  from public.profiles p
  where p.approved and public.is_approved()
  order by 2
$$;
revoke all on function public.check_comptes() from public;
grant execute on function public.check_comptes() to authenticated;

-- Le createur d'un projet en devient automatiquement membre
create or replace function public.check_projet_createur() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.check_membres (projet_id, user_id, ajoute_par) values (new.id, auth.uid(), auth.uid())
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists check_projet_createur on public.check_projets;
create trigger check_projet_createur after insert on public.check_projets
  for each row execute function public.check_projet_createur();

-- Note : « pour » doit etre membre du projet (ou soi-meme pour une note perso), dates tenues a jour
create or replace function public.check_note_controle() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.pour is not null then
    if new.projet_id is null and new.pour <> new.auteur then
      raise exception 'Une note perso ne peut pas être confiée à quelqu''un d''autre';
    end if;
    if new.projet_id is not null and not exists (select 1 from public.check_membres where projet_id = new.projet_id and user_id = new.pour) then
      raise exception 'La personne choisie ne fait pas partie de l''équipe du projet';
    end if;
  end if;
  if tg_op = 'UPDATE' then
    new.auteur := old.auteur; -- l'auteur ne change jamais
    new.updated_at := now();
  end if;
  if new.statut = 'done' and (tg_op = 'INSERT' or old.statut <> 'done') then new.regle_le := now(); end if;
  if new.statut <> 'done' then new.regle_le := null; end if;
  return new;
end $$;
drop trigger if exists check_note_controle on public.check_notes;
create trigger check_note_controle before insert or update on public.check_notes
  for each row execute function public.check_note_controle();

alter table public.check_projets enable row level security;
alter table public.check_membres enable row level security;
alter table public.check_notes enable row level security;
revoke all on public.check_projets, public.check_membres, public.check_notes from anon;
grant select, insert, update, delete on public.check_projets, public.check_membres, public.check_notes to authenticated;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' and tablename in ('check_projets', 'check_membres', 'check_notes') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Projets : visibles et modifiables par l'equipe ; creation par tout compte valide ; suppression par le createur
create policy "projets lecture" on public.check_projets for select to authenticated
  using (public.is_approved() and (public.check_est_membre(id) or cree_par = auth.uid()));
create policy "projets creation" on public.check_projets for insert to authenticated
  with check (public.is_approved() and cree_par = auth.uid());
create policy "projets modif" on public.check_projets for update to authenticated
  using (public.is_approved() and public.check_est_membre(id)) with check (public.is_approved() and public.check_est_membre(id));
create policy "projets suppression" on public.check_projets for delete to authenticated
  using (public.is_approved() and cree_par = auth.uid());

-- Equipes : un membre voit l'equipe, invite un compte valide, retire quelqu'un ou quitte le projet
create policy "membres lecture" on public.check_membres for select to authenticated
  using (public.is_approved() and public.check_est_membre(projet_id));
create policy "membres invitation" on public.check_membres for insert to authenticated
  with check (public.is_approved() and public.check_est_membre(projet_id) and ajoute_par = auth.uid()
              and public.check_compte_valide(user_id));
create policy "membres retrait" on public.check_membres for delete to authenticated
  using (public.is_approved() and public.check_est_membre(projet_id));

-- Notes : perso = son auteur ; projet = l'equipe
create policy "notes lecture" on public.check_notes for select to authenticated
  using (public.is_approved() and ((projet_id is null and auteur = auth.uid()) or public.check_est_membre(projet_id)));
create policy "notes creation" on public.check_notes for insert to authenticated
  with check (public.is_approved() and auteur = auth.uid() and (projet_id is null or public.check_est_membre(projet_id)));
create policy "notes modif" on public.check_notes for update to authenticated
  using (public.is_approved() and ((projet_id is null and auteur = auth.uid()) or public.check_est_membre(projet_id)))
  with check (public.is_approved() and ((projet_id is null and auteur = auth.uid()) or public.check_est_membre(projet_id)));
create policy "notes suppression" on public.check_notes for delete to authenticated
  using (public.is_approved() and ((projet_id is null and auteur = auth.uid()) or public.check_est_membre(projet_id)));

-- Corbeille videe apres 30 jours (appelee par l'appli a l'ouverture)
create or replace function public.check_vider_corbeille() returns void
language sql security definer set search_path = public as $$
  delete from public.check_notes where supprime_le < now() - interval '30 days'
    and ((projet_id is null and auteur = auth.uid()) or public.check_est_membre(projet_id))
$$;
revoke all on function public.check_vider_corbeille() from public;
grant execute on function public.check_vider_corbeille() to authenticated;

-- Mises a jour en direct : ce qu'un collegue change apparait sans recharger (les regles ci-dessus s'appliquent)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'check_notes') then
    alter publication supabase_realtime add table public.check_notes;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'check_membres') then
    alter publication supabase_realtime add table public.check_membres;
  end if;
end $$;


-- =====================================================================
-- membrane/supabase/membrane-catalogue.sql
-- =====================================================================

-- Catalogue commun de Membrane : a coller UNE FOIS dans Supabase (projet Index, le meme que Strate)
-- > SQL Editor > New query > colle le CONTENU de ce fichier > Run. Relancer le script ne casse rien.
--
-- - Une table « membrane_catalogue » : un produit (membrane) par ligne : nom, fournisseur, role, largeurs
--   en stock et sur demande, longueur du rouleau, lien vers la fiche technique d'Index.
-- - Lecture libre (pas de prix dans ce catalogue) ; envoi et retrait : compte Index valide
--   (meme controle que Strate : fonction public._check_acces(), creee par strate-comptes.sql).
-- - Un retrait met le produit a la corbeille (deleted_at) : les postes qui l'utilisent dans une commande le gardent.
-- - Les 3 produits Sika d'origine sont deja dans le catalogue pour tout le monde.

create table if not exists public.membrane_catalogue (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.membrane_catalogue enable row level security;
grant select on public.membrane_catalogue to anon, authenticated;
grant all on public.membrane_catalogue to service_role;
drop policy if exists "lecture catalogue membrane" on public.membrane_catalogue;
create policy "lecture catalogue membrane" on public.membrane_catalogue for select to anon, authenticated using (true);

create or replace function public.membrane_save_item(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text; v_id text := p->>'id';
begin
  e := public._check_acces();
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  if coalesce(v_id, '') = '' or length(v_id) > 100 then return jsonb_build_object('ok', false, 'error', 'Produit invalide.'); end if;
  if coalesce(trim(p->>'nom'), '') = '' then return jsonb_build_object('ok', false, 'error', 'Le nom est obligatoire.'); end if;
  if jsonb_typeof(p->'largeurs') is distinct from 'array' or jsonb_array_length(p->'largeurs') = 0 then
    return jsonb_build_object('ok', false, 'error', 'Indiquez au moins une largeur.');
  end if;
  if octet_length(p::text) > 20000 then return jsonb_build_object('ok', false, 'error', 'Produit trop volumineux.'); end if;
  insert into public.membrane_catalogue (id, data, updated_at, deleted_at) values (v_id, p, now(), null)
  on conflict (id) do update set data = excluded.data, updated_at = now(), deleted_at = null;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.membrane_delete_item(p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text;
begin
  e := public._check_acces();
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  update public.membrane_catalogue set deleted_at = now(), updated_at = now() where id = p_id;
  -- Corbeille videe apres 90 jours
  delete from public.membrane_catalogue where deleted_at < now() - interval '90 days';
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.membrane_save_item(jsonb), public.membrane_delete_item(text) from public;
grant execute on function public.membrane_save_item(jsonb), public.membrane_delete_item(text) to anon, authenticated;

-- Produits d'origine (Sika) : ajoutes seulement s'ils n'existent pas deja
insert into public.membrane_catalogue (id, data) values
  ('outplus', '{"id": "outplus", "nom": "SikaMembran Outdoor plus", "court": "Outdoor plus", "fournisseur": "Sika", "role": "pare-pluie", "largeurs": [100, 150, 200, 250, 300, 1400], "surDemande": [1400], "rouleauM": 25, "sd": 4}'::jsonb),
  ('uni', '{"id": "uni", "nom": "SikaMembran Universal", "court": "Universal", "fournisseur": "Sika", "role": "pare-vapeur", "largeurs": [100, 150, 200, 250, 300, 350, 1400], "surDemande": [1400], "rouleauM": 25, "sd": 60}'::jsonb),
  ('unisb', '{"id": "unisb", "nom": "SikaMembran Universal SB", "court": "Universal SB", "fournisseur": "Sika", "role": "une face autocollante", "largeurs": [100, 150, 200, 250, 350], "surDemande": [250, 350], "rouleauM": 25, "sd": 60, "autocollant": "face"}'::jsonb)
on conflict (id) do nothing;

-- Colle d'origine (Membrane 1.9 : la colle fait partie de la bibliotheque)
insert into public.membrane_catalogue (id, data) values
  ('colle444', '{"id": "colle444", "type": "colle", "nom": "SikaBond-444 Membrane Fix", "court": "SikaBond-444", "fournisseur": "Sika", "ml": 600, "metres": 10, "metresMin": 7.5, "parCarton": 20, "cordonMm": 45}'::jsonb)
on conflict (id) do nothing;

-- Active+, Active SB+, Active FSB+ (Membrane 1.10)
insert into public.membrane_catalogue (id, data) values
  ('acplus', '{"id": "acplus", "nom": "SikaMembran Active+", "court": "Active+", "fournisseur": "Sika", "role": "freine-vapeur", "largeurs": [100, 150, 200, 250, 300, 1500], "surDemande": [250, 300], "rouleauM": 25, "sd": "0,5 à 20"}'::jsonb),
  ('acsb', '{"id": "acsb", "nom": "SikaMembran Active SB+", "court": "Active SB+", "fournisseur": "Sika", "role": "freine-vapeur, une face autocollante", "largeurs": [100, 150, 200], "surDemande": [], "rouleauM": 25, "sd": "0,5 à 20", "autocollant": "face"}'::jsonb),
  ('acfsb', '{"id": "acfsb", "nom": "SikaMembran Active FSB+", "court": "Active FSB+", "fournisseur": "Sika", "role": "freine-vapeur, autocollante", "largeurs": [80, 100, 150, 200, 250, 300, 350], "surDemande": [], "rouleauM": 25, "sd": "0,5 à 20", "autocollant": true}'::jsonb)
on conflict (id) do nothing;


-- =====================================================================
-- membrane/supabase/membrane-universal-sb.sql
-- =====================================================================

-- Membrane 1.8 : a coller UNE fois dans Supabase (projet Index) > SQL Editor > Run.
-- Ajoute la SikaMembran Universal SB (autocollante), la valeur sd de Universal et d'Outdoor plus,
-- et retire la SikaMembran Outdoor (non vendue en Suisse). Peut etre relance sans risque.

-- 1) Universal SB (ajoutee seulement si elle n'existe pas)
insert into public.membrane_catalogue (id, data) values
  ('unisb', '{"id": "unisb", "nom": "SikaMembran Universal SB", "court": "Universal SB", "fournisseur": "Sika", "role": "autocollante", "largeurs": [100, 150, 200, 250, 350], "surDemande": [250, 350], "rouleauM": 25, "sd": 60, "autocollant": true}'::jsonb)
on conflict (id) do nothing;

-- 2) Valeur sd (en m) des deux produits deja la
update public.membrane_catalogue set data = data || '{"sd": 4}'::jsonb, updated_at = now() where id = 'outplus' and not (data ? 'sd');
update public.membrane_catalogue set data = data || '{"sd": 60}'::jsonb, updated_at = now() where id = 'uni' and not (data ? 'sd');

-- 3) Retrait de la SikaMembran Outdoor (mise a la corbeille, comme le bouton « Retirer pour l'equipe »)
update public.membrane_catalogue set deleted_at = now(), updated_at = now() where id = 'out' and deleted_at is null;


-- =====================================================================
-- membrane/supabase/membrane-colle.sql
-- =====================================================================

-- Membrane 1.9 : a coller UNE fois dans Supabase (projet Index) > SQL Editor > Run.
-- Partage la colle d'origine avec l'equipe (elle fait maintenant partie de la bibliotheque).
-- Sans ce script, Membrane marche quand meme : la colle d'origine est simplement « sur ce poste seulement ».
-- Peut etre relance sans risque.
insert into public.membrane_catalogue (id, data) values
  ('colle444', '{"id": "colle444", "type": "colle", "nom": "SikaBond-444 Membrane Fix", "court": "SikaBond-444", "fournisseur": "Sika", "ml": 600, "metres": 10, "metresMin": 7.5, "parCarton": 20, "cordonMm": 45}'::jsonb)
on conflict (id) do nothing;


-- =====================================================================
-- membrane/supabase/membrane-active.sql
-- =====================================================================

-- Membrane 1.10 : a coller UNE fois dans Supabase (projet Index) > SQL Editor > Run.
-- Ajoute Active+, Active SB+ et Active FSB+, et corrige la Universal SB : elle n'est autocollante que sur UNE face,
-- l'autre face se colle (donc un cordon de colle de moins, pas aucun). Peut etre relance sans risque.

insert into public.membrane_catalogue (id, data) values
  ('acplus', '{"id": "acplus", "nom": "SikaMembran Active+", "court": "Active+", "fournisseur": "Sika", "role": "freine-vapeur", "largeurs": [100, 150, 200, 250, 300, 1500], "surDemande": [250, 300], "rouleauM": 25, "sd": "0,5 à 20"}'::jsonb),
  ('acsb', '{"id": "acsb", "nom": "SikaMembran Active SB+", "court": "Active SB+", "fournisseur": "Sika", "role": "freine-vapeur, une face autocollante", "largeurs": [100, 150, 200], "surDemande": [], "rouleauM": 25, "sd": "0,5 à 20", "autocollant": "face"}'::jsonb),
  ('acfsb', '{"id": "acfsb", "nom": "SikaMembran Active FSB+", "court": "Active FSB+", "fournisseur": "Sika", "role": "freine-vapeur, autocollante", "largeurs": [80, 100, 150, 200, 250, 300, 350], "surDemande": [], "rouleauM": 25, "sd": "0,5 à 20", "autocollant": true}'::jsonb)
on conflict (id) do nothing;

-- Universal SB : une face autocollante
update public.membrane_catalogue
set data = data || '{"autocollant": "face", "role": "une face autocollante"}'::jsonb, updated_at = now()
where id = 'unisb' and (data->>'autocollant') is distinct from 'face';


-- =====================================================================
-- outils-hn.github.io/supabase/retours.sql
-- =====================================================================

-- Retours de l'equipe (idees et bugs) pour toutes les applis : a coller UNE FOIS dans
-- Supabase > projet d'INDEX > SQL Editor > New query > Run. Relancer le script ne casse rien.
--
-- - Envoi SANS compte depuis n'importe quelle appli, par la fonction « retour_envoyer »
--   (controles : longueur, appli connue, 30 retours maximum par heure pour tout le monde, pas de doublon).
-- - Liste lisible par tout le monde (page Retours de l'Accueil) : chacun voit si un bug est deja signale.
-- - « Moi aussi » : +1 sur un retour existant.
-- - Statut et reponse : seulement les ADMINISTRATEURS d'Index (fonction public.is_admin()).

create table if not exists public.retours (
  id uuid primary key default gen_random_uuid(),
  app text not null check (app in ('Access', 'Check', 'Format', 'Index', 'Linear', 'Masse', 'Strate', 'Trame', 'Accueil')),
  type text not null check (type in ('idee', 'bug')),
  texte text not null check (length(trim(texte)) between 5 and 2000),
  nom text not null default '' check (length(nom) <= 60),
  page text not null default '' check (length(page) <= 300),
  version text not null default '' check (length(version) <= 20),
  navigateur text not null default '' check (length(navigateur) <= 200),
  statut text not null default 'nouveau' check (statut in ('nouveau', 'prevu', 'en_cours', 'fait', 'refuse')),
  reponse text not null default '' check (length(reponse) <= 1000),
  moi_aussi int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists retours_date on public.retours (created_at desc);

alter table public.retours enable row level security;
revoke all on public.retours from anon, authenticated;
grant select on public.retours to anon, authenticated;
grant all on public.retours to service_role;
drop policy if exists "retours lecture" on public.retours;
create policy "retours lecture" on public.retours for select to anon, authenticated using (true);

create or replace function public.retour_envoyer(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_texte text := trim(coalesce(p->>'texte', ''));
begin
  if length(v_texte) < 5 then return jsonb_build_object('ok', false, 'error', 'Décrivez un peu plus (5 caractères au moins).'); end if;
  if length(v_texte) > 2000 then return jsonb_build_object('ok', false, 'error', 'Texte trop long (2000 caractères au plus).'); end if;
  if coalesce(p->>'app', '') not in ('Access', 'Check', 'Format', 'Index', 'Linear', 'Masse', 'Strate', 'Trame', 'Accueil') then return jsonb_build_object('ok', false, 'error', 'Appli inconnue.'); end if;
  if coalesce(p->>'type', '') not in ('idee', 'bug') then return jsonb_build_object('ok', false, 'error', 'Type inconnu.'); end if;
  -- Garde-fous anti-spam : debit global et doublons exacts
  if (select count(*) from retours where created_at > now() - interval '1 hour') >= 30 then
    return jsonb_build_object('ok', false, 'error', 'Beaucoup de retours en ce moment : réessayez dans une heure.');
  end if;
  if exists (select 1 from retours where lower(texte) = lower(v_texte) and created_at > now() - interval '1 day') then
    return jsonb_build_object('ok', false, 'error', 'Ce retour a déjà été envoyé.');
  end if;
  insert into retours (app, type, texte, nom, page, version, navigateur)
  values (p->>'app', p->>'type', v_texte, left(trim(coalesce(p->>'nom', '')), 60), left(coalesce(p->>'page', ''), 300),
          left(coalesce(p->>'version', ''), 20), left(coalesce(p->>'navigateur', ''), 200))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.retour_moi_aussi(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  update retours set moi_aussi = moi_aussi + 1 where id = p_id and statut not in ('fait', 'refuse');
  return jsonb_build_object('ok', found);
end $$;

-- Administrateurs d'Index : statut et reponse, ou suppression (spam)
create or replace function public.retour_traiter(p_id uuid, p_statut text, p_reponse text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Réservé aux administrateurs d''Index.'); end if;
  if p_statut not in ('nouveau', 'prevu', 'en_cours', 'fait', 'refuse') then return jsonb_build_object('ok', false, 'error', 'Statut inconnu.'); end if;
  update retours set statut = p_statut, reponse = left(coalesce(p_reponse, ''), 1000), updated_at = now() where id = p_id;
  return jsonb_build_object('ok', found);
end $$;

create or replace function public.retour_supprimer(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Réservé aux administrateurs d''Index.'); end if;
  delete from retours where id = p_id;
  return jsonb_build_object('ok', found);
end $$;

revoke all on function public.retour_envoyer(jsonb), public.retour_moi_aussi(uuid), public.retour_traiter(uuid, text, text), public.retour_supprimer(uuid) from public;
grant execute on function public.retour_envoyer(jsonb), public.retour_moi_aussi(uuid) to anon, authenticated;
grant execute on function public.retour_traiter(uuid, text, text), public.retour_supprimer(uuid) to authenticated;


-- =====================================================================
-- outils-hn.github.io/supabase/stats-accueil.sql
-- =====================================================================

-- Accueil 1.8 : statistiques, reservees au concepteur. Aucune donnee personnelle : seulement des totaux.
-- (Sans ce script l'onglet « Statistiques » reste simplement cache.)
create or replace function public.stats_accueil() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  j30 timestamptz := now() - interval '30 days';
  r jsonb;
begin
  if not public.is_concepteur() then raise exception 'Reserve au concepteur'; end if;
  select jsonb_build_object(
    'comptes', jsonb_build_object(
      'total', (select count(*) from profiles),
      'valides', (select count(*) from profiles where approved),
      'attente', (select count(*) from profiles where not approved),
      'concepteur', (select count(*) from profiles where approved and role = 'concepteur'),
      'administrateur', (select count(*) from profiles where approved and role = 'administrateur'),
      'dessinateur', (select count(*) from profiles where approved and role = 'dessinateur')),
    'derniers', coalesce((select jsonb_agg(jsonb_build_object('email', email, 'le', created_at) order by created_at desc)
                          from (select email, created_at from profiles order by created_at desc limit 3) x), '[]'::jsonb),
    'retours', jsonb_build_object(
      'total', (select count(*) from retours),
      'nouveaux', (select count(*) from retours where statut = 'nouveau')),
    'applis', jsonb_build_array(
      jsonb_build_object('nom', 'Index', 'total', (select count(*) from products where deleted_at is null),
        'mois', (select count(*) from products where deleted_at is null and created_at >= j30),
        'a_verifier', (select count(*) from products where deleted_at is null and coalesce(verified_at, updated_at) < now() - interval '12 months')),
      jsonb_build_object('nom', 'Access', 'total', (select count(*) from access_fournisseurs),
        'mois', (select count(*) from access_fournisseurs where updated_at >= j30)),
      jsonb_build_object('nom', 'Check', 'total', (select count(*) from check_notes where supprime_le is null),
        'mois', (select count(*) from check_notes where supprime_le is null and created_at >= j30)),
      jsonb_build_object('nom', 'Masse', 'total', (select count(*) from materials where deleted_at is null) + (select count(*) from elements where deleted_at is null),
        'mois', (select count(*) from materials where deleted_at is null and created_at >= j30) + (select count(*) from elements where deleted_at is null and created_at >= j30)),
      jsonb_build_object('nom', 'Format', 'total', (select count(*) from format_materiaux where deleted_at is null),
        'mois', (select count(*) from format_materiaux where deleted_at is null and updated_at >= j30)),
      jsonb_build_object('nom', 'Strate', 'total', (select count(*) from strate_catalogue where deleted_at is null),
        'mois', (select count(*) from strate_catalogue where deleted_at is null and updated_at >= j30)))
  ) into r;
  return r;
end $$;
revoke all on function public.stats_accueil() from public;
grant execute on function public.stats_accueil() to authenticated;
