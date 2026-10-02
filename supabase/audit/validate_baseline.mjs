// Disposable, in-memory PostgreSQL smoke tests. Never connects to Supabase.
// Auth and Storage helpers below are test stubs, not production definitions.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { readCapture } from "./read_capture.mjs";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(resolve(root, ".captures/validation/package.json"));
const { PGlite } = require("@electric-sql/pglite");
const snapshot = readCapture(resolve(root, ".captures/database_inventory.csv"));
const detailsPath = resolve(root, ".captures/database_details.csv");
const hasDetails = existsSync(detailsPath);
if (hasDetails) snapshot.sequences = readCapture(detailsPath).sequences;
const baseline = readFileSync(resolve(root, "drafts/baseline_candidate.sql"), "utf8");
const hashFile = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
assert(baseline.includes("Source CSV SHA-256: " + hashFile(resolve(root, ".captures/database_inventory.csv"))),
    "Draft is stale; regenerate before validation");
if (hasDetails) assert(baseline.includes("Details CSV SHA-256: " + hashFile(detailsPath)),
    "Draft does not include the current supplemental capture; regenerate first");
const db = new PGlite();
const checks = [];
const check = async (name, fn) => { await fn(); checks.push(name); console.log("PASS: " + name); };
const query = async (sql, parameters) => (await db.query(sql, parameters)).rows;
const alice = "00000000-0000-4000-8000-000000000001";
const bob = "00000000-0000-4000-8000-000000000002";
const identity = async (role, user = "") => {
    assert(["postgres", "authenticated", "anon"].includes(role));
    await db.exec("RESET ROLE;");
    await query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user]);
    await db.exec("SET ROLE " + role + ";");
};

try {
    await db.exec(`
        CREATE ROLE anon NOLOGIN;
        CREATE ROLE authenticated NOLOGIN;
        CREATE ROLE service_role NOLOGIN BYPASSRLS;
        CREATE SCHEMA auth;
        CREATE SCHEMA storage;
        CREATE TABLE auth.users (id uuid PRIMARY KEY);
        CREATE TABLE storage.objects (id uuid DEFAULT gen_random_uuid(), bucket_id text, name text);
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
          $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS
          $$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1)-1] $$;
        ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
        GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;
        GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated, service_role;
    `);

    await check("draft refuses replay without explicit disposable-target setting", async () => {
        await assert.rejects(db.exec(baseline), (error) => error.code === "P0001");
        await db.exec("ROLLBACK;");
        const rows = await query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'");
        assert.equal(rows[0].n, 0);
    });
    await db.exec("SET fanwars.baseline_target = 'disposable-local';");
    await check("entire draft replays in a fresh PostgreSQL engine", () => db.exec(baseline));
    const version = (await query("SHOW server_version"))[0].server_version;

    await check("tables, indexes, constraints, functions and policies match capture counts", async () => {
        const counts = (await query(`SELECT
            (SELECT count(*)::int FROM pg_tables WHERE schemaname='public') AS tables,
            (SELECT count(*)::int FROM pg_indexes WHERE schemaname='public') AS indexes,
            (SELECT count(*)::int FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
              WHERE n.nspname='public' AND c.contype <> 'n') AS constraints,
            (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
              WHERE n.nspname='public') AS functions,
            (SELECT count(*)::int FROM pg_policies WHERE schemaname IN ('public','storage')) AS policies
        `))[0];
        assert.equal(counts.tables, 12);
        assert.equal(counts.indexes, snapshot.indexes.length);
        assert.equal(counts.constraints, snapshot.constraints.length);
        assert.equal(counts.functions, snapshot.functions.length);
        assert.equal(counts.policies, snapshot.policies.length);
    });
    await check("captured sequence bounds and RLS flags retain captured values", async () => {
        const sequences = await query(`SELECT sequencename, start_value::text, min_value::text,
            max_value::text, increment_by::text, cache_size::text, cycle
            FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename`);
        for (const sequence of sequences) {
            const original = snapshot.sequences.find((row) => row.sequencename === sequence.sequencename);
            for (const key of ["start_value", "min_value", "max_value", "increment_by", "cache_size", "cycle"]) {
                // JSONB dashboard export rounded some bigint maxima before CSV
                // export. Those maxima are not evidence of exact production values.
                if (!hasDetails && key === "max_value" && BigInt(original[key]) > 9223372036854775807n) continue;
                assert.equal(sequence[key], original[key]);
            }
        }
        const relations = await query(`SELECT c.relname, c.relrowsecurity AS rls_enabled,
            c.relforcerowsecurity AS rls_forced FROM pg_class c
            JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'`);
        for (const relation of relations) {
            const original = snapshot.relations.find((row) => row.relname === relation.relname);
            assert.equal(relation.rls_enabled, original.rls_enabled);
            assert.equal(relation.rls_forced, original.rls_forced);
        }
    });
    await check("function definitions and application ACLs match the captured definitions", async () => {
        const functions = await query(`SELECT p.proname,
            pg_get_function_identity_arguments(p.oid) AS identity_arguments,
            pg_get_functiondef(p.oid) AS definition, p.proacl
            FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'`);
        const normalize = (text) => text.replace(/\r\n/g, "\n").trim();
        const acl = (entries) => [...(entries || [])].sort();
        for (const fn of functions) {
            const original = snapshot.functions.find((row) => row.proname === fn.proname &&
                row.identity_arguments === fn.identity_arguments);
            assert(original, "Unexpected function");
            assert.equal(normalize(fn.definition), normalize(original.definition), "Function definition differs: " + fn.proname);
            assert.deepEqual(acl(fn.proacl), acl(original.proacl), "Function ACL differs: " + fn.proname);
        }
        const relations = await query(`SELECT c.relname, c.relacl FROM pg_class c
            JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','S')`);
        for (const relation of relations) {
            const original = snapshot.relations.find((row) => row.relname === relation.relname);
            assert.deepEqual(acl(relation.relacl), acl(original.relacl), "Relation ACL differs: " + relation.relname);
        }
    });

    // Fictional local-only fixtures. No production data is read or imported.
    await query("INSERT INTO auth.users(id) VALUES ($1), ($2)", [alice, bob]);
    await query(`INSERT INTO public.profiles(id, username, handler, display_name)
        VALUES ($1, 'local_alice', 'local_alice', 'Local Alice'),
               ($2, 'local_bob', 'local_bob', 'Local Bob')`, [alice, bob]);
    const tribe = (await query("INSERT INTO public.tribes(name) VALUES ('Local Test Tribe') RETURNING id"))[0].id;
    const battle = (await query(`INSERT INTO public.battles(title, category, status, created_by, tribe_id)
        VALUES ('Local Test Battle', 'Test', 'live', $1, $2) RETURNING id`, [alice, tribe]))[0].id;
    const options = await query(`INSERT INTO public.battle_options(battle_id, name, position)
        VALUES ($1, 'Local A', 1), ($1, 'Local B', 2) RETURNING id`, [battle]);

    await identity("authenticated", alice);
    await check("authenticated vote is recorded and a duplicate vote is rejected", async () => {
        const vote = await query("SELECT * FROM public.cast_vote($1, $2)", [battle, options[0].id]);
        assert.equal(vote.length, 1);
        await assert.rejects(query("SELECT * FROM public.cast_vote($1, $2)", [battle, options[1].id]));
        const results = await query("SELECT * FROM public.get_battle_results($1)", [battle]);
        assert.equal(results.reduce((sum, row) => sum + Number(row.vote_count), 0), 1);
    });
    await check("ordinary users cannot moderate or edit another user's profile", async () => {
        await assert.rejects(query("SELECT public.approve_fanwar($1)", [battle]));
        const changed = await query("UPDATE public.profiles SET display_name='Changed' WHERE id=$1 RETURNING id", [bob]);
        assert.equal(changed.length, 0);
    });
    await check("self-referral is rejected and repeat referral claims are idempotent", async () => {
        await assert.rejects(query("SELECT public.claim_referral('local_alice')"));
        const first = (await query("SELECT public.claim_referral('local_bob') AS id"))[0].id;
        assert.notEqual(first, null);
        const second = (await query("SELECT public.claim_referral('local_bob') AS id"))[0].id;
        assert.equal(second, null);
    });
    await check("capture reproduces raw-vote visibility issue on clan pages", async () => {
        assert.equal((await query("SELECT count(*)::int AS n FROM public.votes"))[0].n, 0);
        const totals = await query("SELECT * FROM public.get_battle_results($1)", [battle]);
        assert.equal(totals.reduce((sum, row) => sum + Number(row.vote_count), 0), 1);
    });
    await check("captured Storage policies enforce the user folder for inserts", async () => {
        await query("INSERT INTO storage.objects(bucket_id, name) VALUES ('fanwars-media', $1)", [alice + "/avatar/test.webp"]);
        await assert.rejects(query("INSERT INTO storage.objects(bucket_id, name) VALUES ('fanwars-media', $1)", [bob + "/avatar/test.webp"]));
    });
    await check("capture reproduces missing option access on closed battles", async () => {
        await identity("postgres");
        await query("UPDATE public.battles SET status='closed' WHERE id=$1", [battle]);
        await identity("authenticated", alice);
        assert.equal((await query("SELECT id FROM public.battles WHERE id=$1", [battle])).length, 1);
        assert.equal((await query("SELECT id FROM public.battle_options WHERE battle_id=$1", [battle])).length, 0);
        assert.equal((await query("SELECT * FROM public.get_battle_results($1)", [battle])).length, 2);
    });
    await identity("anon");
    await check("anonymous users cannot cast votes", async () => {
        await assert.rejects(query("SELECT * FROM public.cast_vote($1, $2)", [battle, options[0].id]));
    });

    const report = { engine: "PGlite", engine_version: version, checks,
        scope: "Disposable PostgreSQL with Auth/Storage stubs; not full Supabase integration or concurrency testing",
        sequence_bounds_verified: hasDetails,
        source: "database_inventory.csv", completed_at: new Date().toISOString() };
    writeFileSync(resolve(root, ".captures/validation_results.json"), JSON.stringify(report, null, 2));
    console.log(`Completed ${checks.length} checks using PostgreSQL ${version}. Production was not accessed.`);
} catch (error) {
    // Avoid dumping captured SQL through database error objects.
    console.error("Local validation failed: " + (error.code || error.name || "unknown") +
        "; check private diagnostics before promoting the draft.");
    writeFileSync(resolve(root, ".captures/validation_error.txt"), String(error.stack || error));
    process.exitCode = 1;
} finally {
    await db.close();
}
