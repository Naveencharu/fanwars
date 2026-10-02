import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";

const ts = createRequire(import.meta.url)("typescript");
const jsx = (type, props) => ({ type, props });
const walk = node => !node || typeof node !== "object" ? [] : [node,
    ...[node.props?.children].flat(Infinity).flatMap(walk)];
const own = { id: 11, tribe_id: 2, name: "Coffee United", created_by: "test-user" };
const opponent = { id: 12, tribe_id: 2, name: "Espresso Crew", created_by: "other-user" };

function form({ kind = "clan", tribeId = 2, captain = true } = {}) {
    const state = [[], "", "Best brew?", [], false, "Pick your side", "Lifestyle", "", "",
        true, false, "", false, "", null, [], [], "", ""];
    const calls = { reads: [], rpc: [], routes: [] };
    let index = 0, effect;
    let finishLoading;
    const loaded = new Promise(resolve => { finishLoading = resolve; });
    const imports = {
        "react/jsx-runtime": { jsx, jsxs: jsx },
        "react": { useEffect: fn => { effect = fn; }, useState: () => {
            const i = index++;
            return [state[i], value => { state[i] = typeof value === "function" ? value(state[i]) : value;
                if (i === 9 && value === false) finishLoading(); }];
        } },
        "next/link": { default: "link" },
        "next/navigation": { useRouter: () => ({ replace: path => calls.routes.push(path) }) },
        "@/components/app-header": { default: "header" },
        "@/components/image-upload": { default: "upload" },
        "@/lib/supabase": { supabase: {
            auth: { getUser: async () => ({ data: { user: { id: "test-user" } } }) },
            from(table) {
                const filters = [];
                calls.reads.push({ table, filters });
                const query = { select() { return query; }, eq(key, value) { filters.push([key, value]); return query; },
                    order() { return query; }, then(resolve) {
                        let rows = table === "tribes" ? [{ id: 2, name: "Coffee Crew" }, { id: 3, name: "Cricket Nation" }]
                            : table === "clans" ? [own, opponent, { ...opponent, id: 99, tribe_id: 3 }]
                            : captain ? [{ clan_id: 11, user_id: "test-user", role: "captain" }] : [];
                        rows = rows.filter(row => filters.every(([key, value]) => key === "status" || row[key] === value));
                        return Promise.resolve({ data: rows, error: null }).then(resolve);
                    } };
                return query;
            },
            async rpc(name, args) { calls.rpc.push({ name, args }); return { data: name === "get_or_create_tribe" ? 2 : 123, error: null }; },
        } },
    };
    const exports = {};
    vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../components/fanwar-form.tsx", import.meta.url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, { exports, require: name => imports[name], console: { error() {} }, encodeURIComponent, setTimeout });
    const render = () => { index = 0; return walk(exports.default({ kind, tribeId })); };
    return { state, calls, render, async load() { render(); effect(); await loaded; },
        async submit() { await render().find(node => node.type === "button" && node.props.onClick?.name === "handleCreate").props.onClick(); } };
}

test("general FanWar creation has no clan picker or clan database dependency", async () => {
    const ui = form({ kind: "open" });
    await ui.load();
    assert.deepEqual(ui.calls.reads.map(read => read.table), ["tribes"]);
    assert.equal(ui.render().filter(node => node.type === "select").length, 0);
    ui.state[1] = "Coffee Crew"; ui.state[7] = "Chai"; ui.state[8] = "Coffee";
    await ui.submit();
    assert.deepEqual(ui.calls.rpc.map(call => call.name), ["get_or_create_tribe", "create_fanwar"]);
});

test("clan challenge locks its tribe, filters clans and submits within that tribe", async () => {
    const ui = form(); await ui.load();
    assert(ui.calls.reads.find(read => read.table === "clans").filters.some(([key, value]) => key === "tribe_id" && value === 2));
    assert.deepEqual(Array.from(ui.state[15], clan => clan.id), [11, 12]);
    const tribeInput = ui.render().find(node => node.type === "input" && node.props.value === "Coffee Crew");
    assert.equal(tribeInput.props.readOnly, true);
    tribeInput.props.onChange({ target: { value: "Cricket Nation" } });
    assert.equal(ui.state[1], "Coffee Crew");
    ui.state[17] = "11"; ui.state[18] = "12"; ui.state[7] = own.name; ui.state[8] = opponent.name;
    await ui.submit();
    assert.deepEqual(ui.calls.rpc.map(call => call.name), ["create_fanwar", "set_fanwar_clans"]);
    assert.equal(ui.calls.rpc[0].args.p_tribe_id, 2);
    assert.equal(ui.calls.rpc[1].args.p_clan_a_id, 11);
    assert(ui.render().some(node => node.type === "link" && node.props.href === "/tribes/2"));
});

test("non-captains and cross-tribe or identical clans cannot create a challenge", async () => {
    for (const setup of ["non-captain", "cross-tribe", "same-clan"]) {
        const ui = form({ captain: setup !== "non-captain" }); await ui.load();
        ui.state[17] = "11"; ui.state[18] = setup === "same-clan" ? "11" : "12";
        ui.state[7] = "Own side"; ui.state[8] = "Other side";
        if (setup === "cross-tribe") ui.state[15] = [own, { ...opponent, tribe_id: 3 }];
        await ui.submit();
        assert.equal(ui.calls.rpc.length, 0);
        assert.match(ui.state[11], /different opponent from this Tribe/);
    }
});

test("an invalid tribe cannot start a challenge", async () => {
    const ui = form({ tribeId: NaN }); await ui.load();
    assert.match(ui.state[11], /Tribe could not be found/);
    assert.deepEqual(ui.calls.reads.map(read => read.table), ["tribes"]);
    await ui.submit();
    assert.equal(ui.calls.rpc.length, 0);
});
