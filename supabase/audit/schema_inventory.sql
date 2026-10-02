-- METADATA INSPECTION ONLY. Not a migration. Prepared 2026-10-02.
-- Not executed by Codex. Run with existing authorized metadata access.
-- Save results privately under supabase/.captures/ and review for secrets.
-- Queries scoped to public reflect the code's default schema. Extend only
-- after discovering additional application-owned schemas below.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';

-- Runtime and schema discovery. Classify managed/extension/application schemas.
SELECT current_setting('server_version') AS postgres_version,
       current_database() AS database_name, CURRENT_TIMESTAMP AS captured_at;
SELECT nspname AS schema_name, pg_get_userbyid(nspowner) AS owner, nspacl
FROM pg_namespace
WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema'
ORDER BY nspname;
SELECT extname, extversion, n.nspname AS schema_name
FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
ORDER BY extname;

-- Relation kind, ownership, grants, and RLS state (not inferred from policies).
SELECT n.nspname AS schema_name, c.relname, c.relkind,
       pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced,
       c.relacl
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
ORDER BY c.relname;

-- Exact types, defaults, identities, and nullability.
SELECT table_schema, table_name, column_name, ordinal_position,
       data_type, udt_schema, udt_name, is_nullable, column_default,
       is_identity, identity_generation, is_generated, generation_expression,
       character_maximum_length, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- All application constraints, including checks, FKs, and unique constraints.
SELECT n.nspname AS schema_name, c.relname AS relation_name,
       con.conname, con.contype, con.convalidated, con.condeferrable,
       con.condeferred, pg_get_constraintdef(con.oid, true) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
ORDER BY c.relname, con.conname;
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Include managed schemas to identify app-owned Storage/Auth policies.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname IN ('public', 'auth', 'storage')
ORDER BY schemaname, tablename, policyname;

-- Full function definitions are private until reviewed for embedded secrets.
-- This retrieves catalog definitions; it does not call the application RPCs.
SELECT n.nspname AS schema_name, p.proname,
       pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       pg_get_function_arguments(p.oid) AS arguments,
       pg_get_function_result(p.oid) AS return_type,
       pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef AS security_definer, p.provolatile, p.proconfig, p.proacl,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
ORDER BY p.proname, identity_arguments;

-- Definitions for triggers, including application customizations on auth/storage.
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
ORDER BY n.nspname, c.relname, t.tgname;

SELECT schemaname, viewname AS name, definition, 'view' AS kind
FROM pg_views WHERE schemaname = 'public'
UNION ALL
SELECT schemaname, matviewname AS name, definition, 'materialized_view' AS kind
FROM pg_matviews WHERE schemaname = 'public'
ORDER BY name;
SELECT schemaname, sequencename, data_type, start_value,
       min_value, max_value, increment_by, cycle, cache_size
FROM pg_sequences WHERE schemaname = 'public'
ORDER BY sequencename;

-- Type catalog; pg_dump is needed for full domains/composites/dependencies.
SELECT n.nspname AS schema_name, t.typname, t.typtype,
       pg_get_userbyid(t.typowner) AS owner,
       e.enumsortorder, e.enumlabel
FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
LEFT JOIN pg_enum e ON e.enumtypid = t.oid
WHERE n.nspname = 'public'
ORDER BY t.typname, e.enumsortorder;

-- Visibility depends on the inspecting account's permissions.
SELECT grantee, table_schema, table_name, privilege_type, is_grantable
FROM information_schema.table_privileges
WHERE table_schema IN ('public', 'auth', 'storage')
ORDER BY table_schema, table_name, grantee, privilege_type;
SELECT grantee, table_schema, table_name, column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
ORDER BY table_name, column_name, grantee, privilege_type;
SELECT grantee, routine_schema, routine_name, specific_name,
       privilege_type, is_grantable
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
ORDER BY routine_name, specific_name, grantee;
SELECT pg_get_userbyid(d.defaclrole) AS role_name,
       n.nspname AS schema_name, d.defaclobjtype, d.defaclacl
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
ORDER BY role_name, schema_name, d.defaclobjtype;

SELECT pubname, puballtables, pubinsert, pubupdate, pubdelete, pubtruncate
FROM pg_publication ORDER BY pubname;
SELECT pubname, schemaname, tablename
FROM pg_publication_tables ORDER BY pubname, schemaname, tablename;

-- Discover migration history without creating its schema/table.
SELECT n.nspname AS schema_name, c.relname, c.relkind
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'supabase_migrations' ORDER BY c.relname;

ROLLBACK;

-- OPTIONAL: only after existence/column inspection, run separately READ ONLY.
-- SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
-- SELECT id, name, public, file_size_limit, allowed_mime_types
-- FROM storage.buckets WHERE id = 'fanwars-media';
-- If auth/storage triggers point outside public, capture those function bodies
-- and their dependencies separately. This script is an inventory, not a dump.
