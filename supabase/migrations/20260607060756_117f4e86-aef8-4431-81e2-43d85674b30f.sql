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
