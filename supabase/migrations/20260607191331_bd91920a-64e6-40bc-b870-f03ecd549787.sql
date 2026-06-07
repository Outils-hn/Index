
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
