-- Norm categories
CREATE TABLE public.norm_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  icon text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.norm_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.norm_categories TO authenticated;
GRANT ALL ON public.norm_categories TO service_role;

ALTER TABLE public.norm_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Norm categories readable by everyone"
  ON public.norm_categories FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can insert norm categories"
  ON public.norm_categories FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update norm categories"
  ON public.norm_categories FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete norm categories"
  ON public.norm_categories FOR DELETE TO authenticated
  USING (true);

CREATE TRIGGER update_norm_categories_updated_at
  BEFORE UPDATE ON public.norm_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Norms (regulatory documents)
CREATE TABLE public.norms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source text,
  category text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  domain text,
  pdf_path text,
  pdf_filename text,
  url text,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.norms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.norms TO authenticated;
GRANT ALL ON public.norms TO service_role;

ALTER TABLE public.norms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Norms readable by everyone"
  ON public.norms FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can insert norms"
  ON public.norms FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated can update norms"
  ON public.norms FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete norms"
  ON public.norms FOR DELETE TO authenticated
  USING (true);

CREATE TRIGGER update_norms_updated_at
  BEFORE UPDATE ON public.norms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX norms_category_idx ON public.norms (category);
CREATE INDEX norms_updated_at_idx ON public.norms (updated_at DESC);

-- Seed default norm categories
INSERT INTO public.norm_categories (name, icon) VALUES
  ('DTU', 'BookOpen'),
  ('Normes NF', 'BadgeCheck'),
  ('Règles professionnelles', 'Scale')
ON CONFLICT (name) DO NOTHING;