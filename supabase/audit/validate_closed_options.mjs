// In-memory policy check using fake records. No production connection.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { readCapture } from "./read_capture.mjs";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(resolve(root, ".captures/validation/package.json"));
const { PGlite } = require("@electric-sql/pglite");
const policy = readCapture(resolve(root, ".captures/database_inventory.csv"))
    .policies.find((p) => p.policyname === "battle_options_select_live");
assert.equal(policy.cmd, "SELECT");
assert.deepEqual(policy.roles, ["anon", "authenticated"]);
const db = new PGlite();
try {
    await db.exec(`
        CREATE ROLE anon NOLOGIN;
        CREATE ROLE authenticated NOLOGIN;
        CREATE TABLE public.battles (id bigint PRIMARY KEY, status text);
        CREATE TABLE public.battle_options (id bigint PRIMARY KEY, battle_id bigint);
        CREATE TABLE public.votes (id bigint PRIMARY KEY);
        ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.battle_options ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
        CREATE POLICY battles_public ON public.battles FOR SELECT
          TO anon, authenticated USING (status IN ('live', 'closed'));
        CREATE POLICY battle_options_select_live ON public.battle_options FOR SELECT
          TO anon, authenticated USING (${policy.qual});
        GRANT SELECT ON public.battles, public.battle_options, public.votes TO anon, authenticated;
        INSERT INTO public.battles VALUES (1, 'live'), (2, 'closed'), (3, 'pending'), (4, 'rejected');
        INSERT INTO public.battle_options VALUES (10, 1), (20, 2), (30, 3), (40, 4);
        INSERT INTO public.votes VALUES (1);
        SET ROLE anon;
    `);
    assert.deepEqual((await db.query("SELECT id FROM public.battle_options ORDER BY id")).rows.map(r => r.id), [10]);
    await db.exec("RESET ROLE;");
    await db.exec(readFileSync(resolve(root, "proposals/closed_fanwar_options.sql"), "utf8"));
    for (const role of ["anon", "authenticated"]) {
        await db.exec(`SET ROLE ${role};`);
        assert.deepEqual((await db.query("SELECT id FROM public.battle_options ORDER BY id")).rows.map(r => r.id), [10, 20]);
        assert.equal((await db.query("SELECT * FROM public.votes")).rows.length, 0);
        await db.exec("RESET ROLE;");
    }
    console.log("PASS: live and closed options visible; pending/rejected options and vote rows private for both API roles.");
} finally {
    await db.close();
}
