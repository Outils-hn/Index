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
