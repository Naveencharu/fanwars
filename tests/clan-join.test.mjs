import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";

const ts = createRequire(import.meta.url)("typescript");
const jsx = (type, props) => ({ type, props });
const walk = node => !node || typeof node !== "object" ? [] : [node,
    ...[node.props?.children].flat(Infinity).flatMap(walk)];

export function clanPage({ user = { id: "test-user" }, rpc, member = false, joining = false } = {}) {
    const state = [{ id: 42, tribe_id: 7, name: "Test Clan" }, { id: 7, name: "Test Tribe" },
        [], [], user?.id ?? null, member, false, false, joining, ""];
    const calls = { rpc: [], reloads: 0, errors: [] };
    const window = { location: { href: "", reload() { calls.reloads++; } } };
    let index = 0;
    const imports = {
        "react/jsx-runtime": { jsx, jsxs: jsx },
        "react": { useEffect() {}, useState() { const i = index++;
            return [state[i], value => { state[i] = value; }]; } },
        "next/link": { default: "link" },
        "next/navigation": { useParams: () => ({ id: "42" }) },
        "@/components/app-header": { default: "header" },
        "@/components/battle-cover": { default: "cover", SidePhoto: "photo" },
        "@/lib/battle-results": { loadVoteCounts() {} },
        "@/lib/supabase": { supabase: {
            auth: { getUser: async () => ({ data: { user } }) },
            async rpc(name, args) { calls.rpc.push({ name, args }); return rpc ? rpc(name, args) : { error: null }; },
        } },
    };
    const exports = {};
    vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../app/clans/[id]/page.tsx", import.meta.url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, { exports, require: name => imports[name], console: { error: (...args) => calls.errors.push(args) },
        window, encodeURIComponent, Error });
    const render = () => { index = 0; return walk(exports.default()); };
    return { state, calls, window, render, async join() {
        const button = render().find(node => node.type === "button" && node.props.onClick?.name === "handleJoinClan");
        if (button) await button.props.onClick();
    } };
}

test("Clan join preserves the RPC membership error and offers the parent Tribe", async () => {
    const error = { code: "P0001", details: null, hint: null, message: "Join the Tribe before joining this Clan" };
    const ui = clanPage({ rpc: async () => ({ error }) });
    await ui.join();
    assert.equal(ui.state[9], error.message);
    assert.equal(ui.state[8], false);
    assert.equal(ui.calls.reloads, 0);
    assert.equal(ui.calls.errors.length, 0, "Expected RPC rejections must not trigger the development error overlay");
    assert(ui.render().some(node => node.type === "link" && node.props.href === "/tribes/7"
        && node.props.children?.[0] === "Join "));
});

test("Clan join submits the original RPC and reloads after success", async () => {
    const ui = clanPage(); await ui.join();
    assert.equal(ui.calls.rpc[0].name, "join_clan");
    assert.equal(ui.calls.rpc[0].args.p_clan_id, 42);
    assert.equal(ui.calls.reloads, 1);
    assert.equal(ui.state[9], "");
});

test("Clan join retains login redirect and handles unknown errors", async () => {
    const anonymous = clanPage({ user: null }); await anonymous.join();
    assert.equal(anonymous.window.location.href, "/login?redirect=%2Fclans%2F42");
    assert.equal(anonymous.calls.rpc.length, 0);
    for (const error of [null, {}, { message: "" }]) {
        const ui = clanPage({ rpc: async () => { throw error; } }); await ui.join();
        assert.equal(ui.state[9], "Unable to join this Clan.");
        assert.equal(ui.state[8], false);
    }
});

test("Clan join shows other RPC errors and prevents duplicate submission", async () => {
    for (const error of [new Error("Network failed"), { code: "42501", message: "permission denied" }]) {
        const ui = clanPage({ rpc: async () => ({ error }) }); await ui.join();
        assert.equal(ui.state[9], error.message);
        assert.equal(ui.calls.reloads, 0);
    }
    for (const options of [{ member: true }, { joining: true }]) {
        const ui = clanPage(options); await ui.join();
        assert.equal(ui.calls.rpc.length, 0);
    }
});
