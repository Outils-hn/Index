
DROP POLICY IF EXISTS "Owners can delete their products" ON public.products;
DROP POLICY IF EXISTS "Owners can update their products" ON public.products;

CREATE POLICY "Authenticated users can update any product"
ON public.products FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete any product"
ON public.products FOR DELETE TO authenticated
USING (true);
