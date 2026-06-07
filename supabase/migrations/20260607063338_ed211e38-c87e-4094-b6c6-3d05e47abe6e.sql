
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
