// Local Docker only. Never reads an application URL or production credentials.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { readCapture } from "./read_capture.mjs";

const root = resolve(import.meta.dirname, "..");
const docker = resolve(process.env.LOCALAPPDATA, "Programs/DockerDesktop/resources/bin/docker.exe");
const config = readFileSync(resolve(root, "config.toml"), "utf8");
assert(/^project_id = "fanwars"$/m.test(config), "Unexpected local project");
assert(/^major_version = 17$/m.test(config), "Expected PostgreSQL 17");
const container = "supabase_db_fanwars";
const migrated = process.argv.includes("--migrated");
const original = readCapture(resolve(root, ".captures/database_inventory.csv"));
const details = readCapture(resolve(root, ".captures/database_details.csv"));
const baseline = readFileSync(resolve(root, "drafts/baseline_candidate.sql"), "utf8");
for (const [label, file] of [["Source", "database_inventory.csv"], ["Details", "database_details.csv"]]) {
    const hash = createHash("sha256").update(readFileSync(resolve(root, ".captures", file))).digest("hex");
    assert(baseline.includes(`${label} CSV SHA-256: ${hash}`), "Stale baseline draft");
}
const checks = [];
function sql(input) {
    try {
        return execFileSync(docker, ["exec", "-i", container, "psql", "-U", "postgres",
            "-d", "postgres", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
        { input, encoding: "utf8", timeout: 120000, stdio: ["pipe", "pipe", "pipe"] }).trim();
    } catch (error) {
        writeFileSync(resolve(root, ".captures/local_sql_error.txt"), String(error.stderr || error.message));
        throw new Error("Local SQL failed; private diagnostics saved (no captured SQL printed).");
    }
}
function pass(name) { checks.push(name); console.log("PASS: " + name); }
const normalize = (value) => typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : value;
const acl = (value) => [...(value || [])].sort();
const key = (row, fields) => fields.map(f => row[f]).join("|");
function compare(name, expected, actual, keys, fields) {
    for (const row of expected) {
        const found = actual.find(candidate => key(candidate, keys) === key(row, keys));
        assert(found, `Missing local ${name}: ${key(row, keys)}`);
        for (const field of fields) {
            const a = field.endsWith("acl") ? acl(found[field]) : normalize(found[field]);
            const b = field.endsWith("acl") ? acl(row[field]) : normalize(row[field]);
            assert.deepEqual(a, b, `${name} differs: ${key(row, keys)} (${field})`);
        }
    }
    pass(name + " match the captured definitions");
}

try {
    const version = sql("SHOW server_version;");
    assert(version.startsWith("17."), "Local engine must be PostgreSQL 17");
    pass("real Supabase PostgreSQL 17 is reachable");
    // Refuse to overwrite another local application schema. A failed check can
    // resume only against this script's recorded, unchanged baseline replay.
    const tables = Number(sql("SELECT count(*) FROM pg_tables WHERE schemaname='public';"));
    const markerPath = resolve(root, ".captures/local_replay_marker.json");
    const baselineHash = createHash("sha256").update(baseline).digest("hex");
    if (migrated) {
        assert.equal(tables, 12, "Migrated schema table count differs");
        const versions = JSON.parse(sql("SELECT json_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations;"));
        assert.deepEqual(versions, ["20261002140000", "20261002140100", "20261002140200", "20261002140300"], "Local migration history differs");
    } else if (tables === 0) {
        sql("SET fanwars.baseline_target='disposable-local';\n" + baseline);
        writeFileSync(markerPath, JSON.stringify({ container, baselineHash }));
    } else {
        assert(existsSync(markerPath), "Existing local schema has no validation marker; refusing changes");
        const marker = JSON.parse(readFileSync(markerPath, "utf8"));
        assert(marker.container === container && marker.baselineHash === baselineHash && tables === 12,
            "Existing local schema does not match this validation replay; refusing changes");
    }
    pass(migrated ? "four migrations match the local schema history" : "captured baseline replays on fresh Supabase managed schemas");
    const local = JSON.parse(sql(readFileSync(resolve(root, "audit/capture_once.sql"), "utf8")));
    const exact = JSON.parse(sql(readFileSync(resolve(root, "audit/capture_details.sql"), "utf8")));
    writeFileSync(resolve(root, ".captures/local_inventory.json"), JSON.stringify(local, null, 2));
    writeFileSync(resolve(root, ".captures/local_details.json"), JSON.stringify(exact, null, 2));
    assert.equal(local.columns.length, original.columns.length);
    assert.equal(local.constraints.length, original.constraints.length);
    assert.equal(local.indexes.length, original.indexes.length);
    assert.equal(local.functions.length, original.functions.length);
    compare("tables and sequence ownership/RLS/ACLs", original.relations, local.relations,
        ["relname"], ["relkind", "owner", "rls_enabled", "rls_forced", "relacl"]);
    compare("column definitions", original.columns, local.columns,
        ["table_name", "column_name"], ["udt_schema", "udt_name", "is_nullable",
            "column_default", "is_identity", "identity_generation"]);
    // pg_attribute retains holes after DROP COLUMN. Fresh CREATE TABLE preserves
    // logical column order but assigns consecutive physical attribute numbers.
    for (const table of original.relations.filter(r => r.relkind === "r")) {
        const order = rows => rows.filter(c => c.table_name === table.relname)
            .sort((a,b) => a.ordinal_position - b.ordinal_position).map(c => c.column_name);
        assert.deepEqual(order(local.columns), order(original.columns), "Logical column order differs");
    }
    const physicalColumnNumberDifferences = original.columns.filter(c =>
        c.ordinal_position !== local.columns.find(t => t.table_name === c.table_name && t.column_name === c.column_name)?.ordinal_position).length;
    pass("logical column order preserved, excluding historical dropped-column numbering gaps");
    compare("exact column types and identity associations", details.columns, exact.columns,
        ["table_name", "column_name"], ["exact_type", "identity_mode", "generated_mode", "storage_mode",
            "compression_mode", "column_acl", "collation", "identity_sequence", "identity_sequence_name",
            "default_expression", "column_comment"]);
    compare("exact identity sequences", details.sequences, exact.sequences,
        ["sequencename"], ["start_value", "min_value", "max_value", "increment_by", "cache_size", "cycle"]);
    compare("constraints", original.constraints, local.constraints, ["relation_name", "conname"],
        ["contype", "convalidated", "condeferrable", "condeferred", "definition"]);
    compare("indexes", original.indexes, local.indexes, ["tablename", "indexname"], ["indexdef"]);
    const expectedFunctions = original.functions.map(fn => ({ ...fn }));
    if (migrated) {
        const migration = readFileSync(resolve(root, "migrations/20261002140300_public_results_visibility.sql"), "utf8");
        const definition = migration.match(/CREATE OR REPLACE FUNCTION[\s\S]*?\$function\$;/)?.[0];
        assert(definition, "Results migration definition missing");
        expectedFunctions.find(fn => fn.proname === "get_battle_results").definition = definition.replace(/;$/, "");
    }
    compare("functions and execute grants", expectedFunctions, local.functions,
        ["proname", "identity_arguments"], ["definition", "owner", "security_definer", "proacl"]);
    compare("public and Storage policies", original.policies.filter(p => !migrated || p.policyname !== "battle_options_select_live"), local.policies,
        ["schemaname", "tablename", "policyname"], ["cmd", "permissive", "roles", "qual", "with_check"]);
    if (migrated) {
        const policy = local.policies.find(p => p.policyname === "battle_options_select_live" && p.schemaname === "public");
        assert.equal(policy.cmd, "SELECT");
        assert.deepEqual(policy.roles, ["anon", "authenticated"]);
        assert.equal(policy.with_check, null);
        assert(policy.qual.includes("'closed'::text") && policy.qual.includes("'live'::text"), "Closed-option migration missing");
    }
    compare("application triggers", original.triggers.filter(t => t.schema_name === "public"),
        local.triggers.filter(t => t.schema_name === "public"), ["relation_name", "tgname"], ["tgenabled", "definition"]);
    compare("extension prerequisites", original.extensions, local.extensions,
        ["extname"], ["schema_name", "extversion"]);
    compare("publication configuration", original.publications, local.publications,
        ["pubname"], ["puballtables", "pubinsert", "pubupdate", "pubdelete", "pubtruncate"]);
    assert.deepEqual(local.publication_tables, original.publication_tables, "Publication table membership differs");

    // Report infrastructure drift rather than silently changing managed defaults.
    const infrastructureDifferences = [];
    for (const schema of original.schemas.filter(s => s.schema_name === "public")) {
        const target = local.schemas.find(s => s.schema_name === schema.schema_name);
        if (schema.owner !== target?.owner || JSON.stringify(acl(schema.nspacl)) !== JSON.stringify(acl(target?.nspacl)))
            infrastructureDifferences.push("public schema ownership/privileges");
    }
    for (const row of original.default_privileges.filter(r => r.schema_name === "public")) {
        const target = local.default_privileges.find(r => r.role_name === row.role_name &&
            r.schema_name === row.schema_name && r.defaclobjtype === row.defaclobjtype);
        if (JSON.stringify(acl(row.defaclacl)) !== JSON.stringify(acl(target?.defaclacl)))
            infrastructureDifferences.push(`default privileges: ${row.role_name}/${row.defaclobjtype}`);
    }
    for (const row of local.default_privileges.filter(r => r.schema_name === "public")) {
        if (!original.default_privileges.some(r => r.role_name === row.role_name &&
            r.schema_name === row.schema_name && r.defaclobjtype === row.defaclobjtype))
            infrastructureDifferences.push(`additional default privileges: ${row.role_name}/${row.defaclobjtype}`);
    }
    // Bucket configuration is local provisioning, not part of the schema draft.
    const bucket = original.storage_bucket[0];
    assert.equal(bucket.id, "fanwars-media");
    const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
    sql(`INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
        VALUES (${literal(bucket.id)},${literal(bucket.name)},${bucket.public},${bucket.file_size_limit},
        ARRAY[${bucket.allowed_mime_types.map(literal).join(",")}]) ON CONFLICT (id) DO NOTHING;`);
    const localBucket = JSON.parse(sql(`SELECT row_to_json(b) FROM
        (SELECT id,name,public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='fanwars-media') b;`));
    assert.deepEqual(localBucket, bucket, "Local bucket settings differ from capture");
    pass("captured media bucket configuration provisioned locally");
    const proposal = readFileSync(resolve(root, "proposals/closed_fanwar_options.sql"), "utf8")
        .replace(/^BEGIN;\s*$/m, "").replace(/^COMMIT;\s*$/m, "");
    // All fictional records and the proposal roll back. No production data.
    sql(`BEGIN;
        CREATE FUNCTION pg_temp.assert_true(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS
          $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%', message; END IF; END $$;
        INSERT INTO auth.users(id) VALUES ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002');
        INSERT INTO public.profiles(id,username,handler,display_name) VALUES
          ('00000000-0000-4000-8000-000000000001','local_alice','local_alice','Local Alice'),
          ('00000000-0000-4000-8000-000000000002','local_bob','local_bob','Local Bob');
        INSERT INTO public.tribes(id,name) VALUES (9000001,'Local Validation Tribe');
        INSERT INTO public.battles(id,title,category,status,created_by,tribe_id) VALUES
          (9000001,'Local Validation Battle','Test','live','00000000-0000-4000-8000-000000000001',9000001);
        INSERT INTO public.battle_options(id,battle_id,name,position) VALUES
          (9000001,9000001,'Local A',1),(9000002,9000001,'Local B',2);
        SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
        SET LOCAL ROLE authenticated;
        SELECT * FROM public.cast_vote(9000001,9000001);
        DO $$ DECLARE denied boolean:=false; BEGIN
          BEGIN PERFORM public.cast_vote(9000001,9000002); EXCEPTION WHEN OTHERS THEN denied:=true; END;
          PERFORM pg_temp.assert_true(denied,'Duplicate vote was allowed'); END $$;
        SELECT pg_temp.assert_true((SELECT sum(vote_count)=1 FROM public.get_battle_results(9000001)), 'Aggregate vote mismatch');
        SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.votes), 'Raw votes exposed');
        RESET ROLE;
        SET LOCAL request.jwt.claim.sub='';
        SET LOCAL ROLE anon;
        SELECT pg_temp.assert_true((SELECT sum(vote_count)=1 FROM public.get_battle_results(9000001)), 'Anonymous live results failed');
        SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.get_battle_results(9000999)), 'Unknown battle results exposed');
        DO $$ DECLARE denied boolean:=false; BEGIN
          BEGIN PERFORM public.cast_vote(9000001,9000001); EXCEPTION WHEN OTHERS THEN denied:=true; END;
          PERFORM pg_temp.assert_true(denied,'Anonymous live voting allowed'); END $$;
        RESET ROLE;
        SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
        SET LOCAL ROLE authenticated;
        DO $$ DECLARE denied boolean:=false; BEGIN
          BEGIN PERFORM public.approve_fanwar(9000001); EXCEPTION WHEN OTHERS THEN denied:=true; END;
          PERFORM pg_temp.assert_true(denied,'Ordinary user moderated a battle'); END $$;
        WITH changed AS (UPDATE public.profiles SET display_name='Changed' WHERE id='00000000-0000-4000-8000-000000000002' RETURNING id)
          SELECT pg_temp.assert_true((SELECT count(*)=0 FROM changed),'Other profile was editable');
        DO $$ DECLARE denied boolean:=false; BEGIN
          BEGIN PERFORM public.claim_referral('local_alice'); EXCEPTION WHEN OTHERS THEN denied:=true; END;
          PERFORM pg_temp.assert_true(denied,'Self referral was allowed'); END $$;
        SELECT pg_temp.assert_true(public.claim_referral('local_bob') IS NOT NULL,'Referral failed');
        SELECT pg_temp.assert_true(public.claim_referral('local_bob') IS NULL,'Duplicate referral');
        INSERT INTO storage.objects(bucket_id,name) VALUES ('fanwars-media','00000000-0000-4000-8000-000000000001/avatar/test.webp');
        DO $$ DECLARE denied boolean:=false; BEGIN
          BEGIN INSERT INTO storage.objects(bucket_id,name) VALUES ('fanwars-media','00000000-0000-4000-8000-000000000002/avatar/test.webp');
          EXCEPTION WHEN OTHERS THEN denied:=true; END;
          PERFORM pg_temp.assert_true(denied,'Other user Storage folder allowed'); END $$;
        RESET ROLE;
        UPDATE public.battles SET status='closed' WHERE id=9000001;
        SET LOCAL ROLE authenticated;
        SELECT pg_temp.assert_true((SELECT count(*)=${migrated ? 2 : 0} FROM public.battle_options WHERE battle_id=9000001),'Closed options differ');
        SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.get_battle_results(9000001)),'Closed aggregate results failed');
        RESET ROLE;
        ${proposal}
        SET LOCAL ROLE authenticated;
        SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.battle_options WHERE battle_id=9000001),'Closed policy failed');
        SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.votes),'Proposal exposed raw votes');
        RESET ROLE;
        UPDATE public.battles SET status='pending' WHERE id=9000001;
        SET LOCAL ROLE authenticated;
        SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.battle_options WHERE battle_id=9000001),'Pending options exposed');
        SELECT pg_temp.assert_true((SELECT count(*)=${migrated ? 0 : 2} FROM public.get_battle_results(9000001)), 'Pending-results RPC visibility differs');
        RESET ROLE;
        SET LOCAL request.jwt.claim.sub='';
        SET LOCAL ROLE anon;
        SELECT pg_temp.assert_true((SELECT count(*)=${migrated ? 0 : 2} FROM public.get_battle_results(9000001)), 'Anonymous pending results differ');
        RESET ROLE;
        UPDATE public.battles SET status='rejected' WHERE id=9000001;
        SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
        SET LOCAL ROLE authenticated;
        SELECT pg_temp.assert_true((SELECT count(*)=${migrated ? 0 : 2} FROM public.get_battle_results(9000001)), 'Authenticated rejected results differ');
        RESET ROLE;
        SET LOCAL request.jwt.claim.sub='';
        SET LOCAL ROLE anon;
        SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.battle_options WHERE battle_id=9000001),'Rejected options exposed');
        SELECT pg_temp.assert_true((SELECT count(*)=${migrated ? 0 : 2} FROM public.get_battle_results(9000001)), 'Anonymous rejected-results RPC visibility differs');
        DO $$ DECLARE denied boolean:=false; BEGIN
          BEGIN PERFORM public.cast_vote(9000001,9000001); EXCEPTION WHEN OTHERS THEN denied:=true; END;
          PERFORM pg_temp.assert_true(denied,'Anonymous voting allowed'); END $$;
        RESET ROLE;
        UPDATE public.battles SET status='closed' WHERE id=9000001;
        SET LOCAL ROLE anon;
        SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.battle_options WHERE battle_id=9000001),'Anonymous closed options hidden');
        SELECT pg_temp.assert_true((SELECT sum(vote_count)=1 FROM public.get_battle_results(9000001)), 'Anonymous closed scores failed');
        ROLLBACK;`);
    pass("real Auth/Storage role checks, voting/referrals and closed-policy proposal pass with rolled-back fictional records");
    const report = { version, container, migrated, checks, infrastructureDifferences, physicalColumnNumberDifferences,
        existing_findings: migrated ? [] : ["Captured results RPC exposes pending/rejected options. Fixed in the fourth local migration; production not accessed."],
        completed_at: new Date().toISOString(), production_accessed: false,
        limitations: ["No concurrent voting or HTTP/browser integration tested", "Realtime, image proxy, email, Studio, Edge and analytics excluded"] };
    writeFileSync(resolve(root, migrated ? ".captures/local_migration_results.json" : ".captures/local_supabase_results.json"), JSON.stringify(report, null, 2));
    console.log(`Completed ${checks.length} real Supabase checks. Infrastructure differences: ${infrastructureDifferences.length}. Production untouched.`);
} catch (error) {
    writeFileSync(resolve(root, ".captures/local_validation_error.txt"), String(error.stack || error));
    console.error("Validation stopped: " + error.message);
    process.exitCode = 1;
}
