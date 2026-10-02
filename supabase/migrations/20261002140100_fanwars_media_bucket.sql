-- Captured media bucket configuration. Preserves an existing bucket unchanged.
BEGIN;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fanwars-media', 'fanwars-media', true, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
COMMIT;
