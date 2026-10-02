// Local Supabase only. Never reads .env.local or any production credentials.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { clanPage } from "../../tests/clan-join.test.mjs";

const docker = resolve(process.env.LOCALAPPDATA, "Programs/DockerDesktop/resources/bin/docker.exe");
function sql(input) {
    return execFileSync(docker, ["exec", "-i", "supabase_db_fanwars", "psql", "-U", "postgres",
        "-d", "postgres", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
        { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}
const env = JSON.parse(execFileSync(docker, ["inspect", "supabase_auth_fanwars"], { encoding: "utf8" }))[0].Config.Env;
const secret = env.find(value => value.startsWith("GOTRUE_JWT_SECRET="))?.slice("GOTRUE_JWT_SECRET=".length);
assert(secret, "Local JWT secret missing");
const user = randomUUID();
const suffix = user.replaceAll("-", "").slice(0, 16);
function token(role, sub) {
    const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
    const payload = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role, sub, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 300 })}`;
    return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}
const apiKey = token("anon");
const client = createClient("http://127.0.0.1:54321", apiKey, {
    global: { headers: { Authorization: `Bearer ${token("authenticated", user)}` } },
    auth: { persistSession: false, autoRefreshToken: false },
});
let tribeId;
try {
    tribeId = Number(sql(`BEGIN;
        INSERT INTO auth.users(id) VALUES ('${user}');
        INSERT INTO public.profiles(id,username,handler,display_name)
          VALUES ('${user}','join_${suffix}','join_${suffix}','Local Join Test');
        INSERT INTO public.tribes(name) VALUES ('Local Join ${suffix}') RETURNING id;
        COMMIT;`));
    const clanId = Number(sql(`INSERT INTO public.clans(tribe_id,name,created_by)
        VALUES (${tribeId},'Local Join Clan ${suffix}','${user}') RETURNING id;`));
    let rpcError;
    const page = clanPage({ user: { id: user }, rpc: async (name, args) => {
        const result = await client.rpc(name, args);
        rpcError = result.error;
        return result;
    } });
    page.state[0] = { id: clanId, tribe_id: tribeId, name: "Local Join Clan" };
    page.state[1] = { id: tribeId, name: "Local Join Tribe" };
    await page.join();
    const error = rpcError;
    console.log("Actual local Supabase RPC error:", JSON.stringify(error));
    assert.equal(error?.code, "P0001");
    assert.equal(error.message, "Join the Tribe before joining this Clan");
    console.log("Existing page displayed:", page.state[9]);
    assert.equal(page.calls.reloads, 0);
    if (!process.argv.includes("--before-fix")) assert.equal(page.state[9], error.message);
    const denied = await client.from("tribe_members").insert({ user_id: randomUUID(), tribe_id: tribeId });
    assert.equal(denied.error?.code, "42501", "RLS must reject another user's membership");
    const joined = await client.from("tribe_members").insert({ user_id: user, tribe_id: tribeId });
    assert.equal(joined.error, null, "Own Tribe join must pass RLS");
    await page.join();
    assert.equal(page.calls.reloads, 1, "Existing Join handler must succeed after joining the Tribe");
    await page.join();
    assert.equal(page.calls.reloads, 2, "RPC must remain idempotent");
    const memberships = await client.from("clan_members").select("role").eq("clan_id", clanId).eq("user_id", user);
    assert.equal(memberships.error, null);
    assert.equal(memberships.data.length, 1);
    assert.equal(memberships.data[0].role, "member");
    sql(`UPDATE public.clans SET status='disabled' WHERE id=${clanId};`);
    assert.equal((await client.rpc("join_clan", { p_clan_id: clanId })).error?.message, "Clan not found");
    const anon = createClient("http://127.0.0.1:54321", apiKey, { auth: { persistSession: false } });
    assert.equal((await anon.rpc("join_clan", { p_clan_id: clanId })).error?.message, "Not authenticated");
    console.log("PASS: actual page handler, parent Tribe requirement, RLS, member role, duplicate join, disabled Clan and authentication checks.");
} finally {
    // Remove only this run's randomly identified fictional local fixtures.
    sql(`BEGIN;
        DELETE FROM public.tribes WHERE name='Local Join ${suffix}';
        DELETE FROM auth.users WHERE id='${user}';
        COMMIT;`);
}
