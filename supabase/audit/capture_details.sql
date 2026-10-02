-- ONE READ-ONLY metadata query; no application records or RPC calls.
-- Export its result as CSV to supabase/.captures/database_details.csv.
-- Returning JSON as TEXT prevents dashboard JavaScript from rounding bigint.
WITH
sequences AS (
  SELECT schemaname, sequencename, data_type,
         start_value::text AS start_value, min_value::text AS min_value,
         max_value::text AS max_value, increment_by::text AS increment_by,
         cycle, cache_size::text AS cache_size
  FROM pg_sequences WHERE schemaname = 'public'
  ORDER BY sequencename
),
columns AS (
  SELECT c.relname AS table_name, a.attname AS column_name,
         format_type(a.atttypid, a.atttypmod) AS exact_type,
         a.attidentity AS identity_mode, a.attgenerated AS generated_mode,
         a.attstorage AS storage_mode, a.attcompression AS compression_mode,
         a.attacl AS column_acl,
         CASE WHEN a.attcollation = 0 THEN NULL
              ELSE format('%I.%I', cn.nspname, col.collname) END AS collation,
         pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) AS identity_sequence,
         sc.relname AS identity_sequence_name,
         pg_get_expr(ad.adbin, ad.adrelid) AS default_expression,
         col_description(c.oid, a.attnum) AS column_comment
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid
  LEFT JOIN pg_collation col ON col.oid = a.attcollation
  LEFT JOIN pg_namespace cn ON cn.oid = col.collnamespace
  LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
  LEFT JOIN pg_class sc ON sc.oid = to_regclass(
    pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname)
  )
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
    AND a.attnum > 0 AND NOT a.attisdropped
  ORDER BY c.relname, a.attnum
),
relations AS (
  SELECT c.relname, c.relkind, c.relpersistence, c.reloptions,
         c.relispartition, ts.spcname AS tablespace,
         obj_description(c.oid, 'pg_class') AS relation_comment
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_tablespace ts ON ts.oid = c.reltablespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
  ORDER BY c.relname
),
dependencies AS (
  SELECT d.deptype,
         pg_describe_object(d.classid, d.objid, d.objsubid) AS object,
         pg_describe_object(d.refclassid, d.refobjid, d.refobjsubid) AS referenced_object
  FROM pg_depend d
  WHERE (d.classid = 'pg_class'::regclass AND d.objid IN (
    SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public'
  )) OR (d.classid = 'pg_proc'::regclass AND d.objid IN (
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
  ))
  ORDER BY object, referenced_object
)
SELECT jsonb_build_object(
  'captured_at', CURRENT_TIMESTAMP,
  'sequences', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM sequences r), '[]'::jsonb),
  'columns', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM columns r), '[]'::jsonb),
  'relations', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM relations r), '[]'::jsonb),
  'dependencies', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM dependencies r), '[]'::jsonb)
)::text AS schema_snapshot;
