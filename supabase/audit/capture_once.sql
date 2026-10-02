-- ONE READ-ONLY SELECT. Does not create/change objects or call FanWars RPCs.
-- Run in Supabase SQL Editor once; export the single result row as CSV.
-- Save to supabase/.captures/database_inventory.csv, which Git ignores.
-- Contains schema/function definitions: do not paste the output into chat.
-- Metadata inventory, not a complete pg_dump or an executable baseline.
-- Scope: public definitions plus auth/storage policies and triggers.

WITH
runtime AS (
SELECT current_setting('server_version') AS postgres_version,
       current_database() AS database_name, CURRENT_TIMESTAMP AS captured_at
),

schemas AS (
SELECT nspname AS schema_name, pg_get_userbyid(nspowner) AS owner, nspacl
FROM pg_namespace
WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema'
ORDER BY nspname
),

extensions AS (
SELECT extname, extversion, n.nspname AS schema_name
FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
ORDER BY extname
),

relations AS (
SELECT n.nspname AS schema_name, c.relname, c.relkind,
       pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced,
       c.relacl
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
ORDER BY c.relname
),

columns AS (
SELECT table_schema, table_name, column_name, ordinal_position,
       data_type, udt_schema, udt_name, is_nullable, column_default,
       is_identity, identity_generation, is_generated, generation_expression,
       character_maximum_length, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position
),

constraints AS (
SELECT n.nspname AS schema_name, c.relname AS relation_name,
       con.conname, con.contype, con.convalidated, con.condeferrable,
       con.condeferred, pg_get_constraintdef(con.oid, true) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
ORDER BY c.relname, con.conname
),

indexes AS (
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes WHERE schemaname = 'public'
ORDER BY tablename, indexname
),

policies AS (
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname IN ('public', 'auth', 'storage')
ORDER BY schemaname, tablename, policyname
),

functions AS (
SELECT n.nspname AS schema_name, p.proname,
       pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       pg_get_function_arguments(p.oid) AS arguments,
       pg_get_function_result(p.oid) AS return_type,
       pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef AS security_definer, p.provolatile, p.proconfig, p.proacl,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
ORDER BY p.proname, identity_arguments
),

triggers AS (
SELECT n.nspname AS schema_name, c.relname AS relation_name,
       t.tgname, t.tgenabled,
       fn.nspname AS function_schema, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS function_arguments,
       pg_get_triggerdef(t.oid, true) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_namespace fn ON fn.oid = p.pronamespace
WHERE NOT t.tgisinternal AND n.nspname IN ('public', 'auth', 'storage')
ORDER BY n.nspname, c.relname, t.tgname
),

views AS (
SELECT schemaname, viewname AS name, definition, 'view' AS kind
FROM pg_views WHERE schemaname = 'public'
UNION ALL
SELECT schemaname, matviewname AS name, definition, 'materialized_view' AS kind
FROM pg_matviews WHERE schemaname = 'public'
ORDER BY name
),

sequences AS (
SELECT schemaname, sequencename, data_type, start_value,
       min_value, max_value, increment_by, cycle, cache_size
FROM pg_sequences WHERE schemaname = 'public'
ORDER BY sequencename
),

types AS (
SELECT n.nspname AS schema_name, t.typname, t.typtype,
       pg_get_userbyid(t.typowner) AS owner,
       e.enumsortorder, e.enumlabel
FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
LEFT JOIN pg_enum e ON e.enumtypid = t.oid
WHERE n.nspname = 'public'
ORDER BY t.typname, e.enumsortorder
),

table_grants AS (
SELECT grantee, table_schema, table_name, privilege_type, is_grantable
FROM information_schema.table_privileges
WHERE table_schema IN ('public', 'auth', 'storage')
ORDER BY table_schema, table_name, grantee, privilege_type
),

column_grants AS (
SELECT grantee, table_schema, table_name, column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
ORDER BY table_name, column_name, grantee, privilege_type
),

routine_grants AS (
SELECT grantee, routine_schema, routine_name, specific_name,
       privilege_type, is_grantable
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
ORDER BY routine_name, specific_name, grantee
),

default_privileges AS (
SELECT pg_get_userbyid(d.defaclrole) AS role_name,
       n.nspname AS schema_name, d.defaclobjtype, d.defaclacl
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
ORDER BY role_name, schema_name, d.defaclobjtype
),

publications AS (
SELECT pubname, puballtables, pubinsert, pubupdate, pubdelete, pubtruncate
FROM pg_publication ORDER BY pubname
),

publication_tables AS (
SELECT pubname, schemaname, tablename
FROM pg_publication_tables ORDER BY pubname, schemaname, tablename
),

migration_history_relations AS (
SELECT n.nspname AS schema_name, c.relname, c.relkind
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'supabase_migrations' ORDER BY c.relname
),

storage_bucket AS (
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id = 'fanwars-media'
)

SELECT jsonb_build_object(
  'runtime', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM runtime AS row), '[]'::jsonb),
  'schemas', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM schemas AS row), '[]'::jsonb),
  'extensions', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM extensions AS row), '[]'::jsonb),
  'relations', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM relations AS row), '[]'::jsonb),
  'columns', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM columns AS row), '[]'::jsonb),
  'constraints', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM constraints AS row), '[]'::jsonb),
  'indexes', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM indexes AS row), '[]'::jsonb),
  'policies', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM policies AS row), '[]'::jsonb),
  'functions', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM functions AS row), '[]'::jsonb),
  'triggers', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM triggers AS row), '[]'::jsonb),
  'views', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM views AS row), '[]'::jsonb),
  'sequences', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM sequences AS row), '[]'::jsonb),
  'types', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM types AS row), '[]'::jsonb),
  'table_grants', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM table_grants AS row), '[]'::jsonb),
  'column_grants', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM column_grants AS row), '[]'::jsonb),
  'routine_grants', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM routine_grants AS row), '[]'::jsonb),
  'default_privileges', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM default_privileges AS row), '[]'::jsonb),
  'publications', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM publications AS row), '[]'::jsonb),
  'publication_tables', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM publication_tables AS row), '[]'::jsonb),
  'migration_history_relations', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM migration_history_relations AS row), '[]'::jsonb),
  'storage_bucket', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM storage_bucket AS row), '[]'::jsonb)
)::text AS schema_snapshot;
