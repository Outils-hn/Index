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
