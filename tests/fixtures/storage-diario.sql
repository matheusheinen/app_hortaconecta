-- Fixture apenas para testar policies SQL. Não emula a API/serviço Storage.
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (
 id text PRIMARY KEY, name text NOT NULL, public boolean NOT NULL DEFAULT false,
 file_size_limit bigint, allowed_mime_types text[]
);
CREATE TABLE storage.objects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text REFERENCES storage.buckets(id),
 name text NOT NULL, metadata jsonb, UNIQUE(bucket_id,name)
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated;
