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
