
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;

-- Restrict listing of all bucket files; per-object SELECT remains allowed
DROP POLICY IF EXISTS "Public can read technical sheets" ON storage.objects;
CREATE POLICY "Public can read technical sheet files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'technical-sheets' AND name IS NOT NULL);
