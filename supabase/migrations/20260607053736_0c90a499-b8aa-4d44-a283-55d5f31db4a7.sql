
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
