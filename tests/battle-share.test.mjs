import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";

const ts = createRequire(import.meta.url)("typescript");
const jsx = (type, props) => ({ type, props });
function load(path, imports = {}, globals = {}) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, { exports, require: name => imports[name], URL, URLSearchParams, Error, ...globals });
    return exports;
}
const shareHelpers = load("../lib/battle-share.ts");
const resultsHelpers = load("../lib/battle-results.ts");
const authHelpers = load("../lib/auth-redirect.ts");
const origin = "https://fanwars.example";
function walk(node) {
    if (!node || typeof node !== "object") return [];
    if (typeof node.type === "function") return walk(node.type(node.props));
    return [node, ...[node.props?.children].flat(Infinity).flatMap(walk)];
}

function battlePage({ query = "", myVote = null, user = { id: "fan" }, status = "live", native = false } = {}) {
    const options = [
        { id: 11, battle_id: 1, name: "Chai Gang", position: 1 },
        { id: 12, battle_id: 1, name: "Coffee Crew", position: 2 },
    ];
    const state = [{ id: 1, title: "Chai vs Coffee", status, category: "Lifestyle" },
        options, [], myVote, null, false, false, "", "", ""];
    const calls = { rpc: [], copied: [], shared: [], routes: [] };
    let index = 0;
    const page = load("../app/battle/[id]/page.tsx", {
        "react/jsx-runtime": { jsx, jsxs: jsx },
        react: { Suspense: "suspense", useEffect() {}, useCallback: fn => fn, useState() {
            const i = index++; return [state[i], value => { state[i] = value; }];
        } },
        "next/link": { default: "link" },
        "next/navigation": { useParams: () => ({ id: "1" }), useSearchParams: () => new URLSearchParams(query),
            useRouter: () => ({ push: path => calls.routes.push(path) }) },
        "@/components/fanwars-logo": { default: "logo", FanWarsMark: "mark" },
        "@/components/app-header": { default: "header" },
        "@/components/battle-boost": { default: "boost" },
        "@/components/battle-cover": { default: "cover", SidePhoto: "photo" },
        "@/lib/battle-results": resultsHelpers,
        "@/lib/battle-share": shareHelpers,
        "@/lib/supabase": { supabase: {
            auth: { getUser: async () => ({ data: { user } }) },
            from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { handler: "sharer" } }) }) }) }),
            rpc: async (name, args) => { calls.rpc.push({ name, args }); return { error: null, data: [] }; },
        } },
    }, {
        window: { location: { origin, pathname: "/battle/1", search: query ? `?${query}` : "" } },
        navigator: { clipboard: { writeText: async text => calls.copied.push(text) },
            ...(native ? { share: async data => calls.shared.push(data) } : {}) },
        setTimeout() {}, console: { error() {} },
    });
    const render = () => { index = 0; return walk(page.default()); };
    return { state, calls, render, setQuery(value) { query = value; },
        async boost() { await render().find(node => node.type === "boost").props.onShare(); },
        async share() { await render().find(node => node.type === "button" && node.props.onClick?.name === "handleShare").props.onClick(); },
        voteButtons() { return render().filter(node => node.type === "button" && node.props.onClick?.name !== "handleShare"); },
    };
}

test("Boost shares the sender's recorded side; Share FanWar removes any incoming Boost restriction", async () => {
    for (const myVote of [11, 12]) {
        const ui = battlePage({ query: "boost=999&ref=someone", myVote });
        await ui.boost();
        const boosted = new URL(ui.calls.copied[0]);
        assert.equal(boosted.pathname, "/battle/1");
        assert.equal(boosted.searchParams.get("boost"), String(myVote));
        assert.equal(boosted.searchParams.get("ref"), "sharer");
        await ui.share();
        const shared = new URL(ui.calls.copied[1]);
        assert.equal(shared.searchParams.has("boost"), false);
        assert.equal(shared.searchParams.get("ref"), "sharer");
    }
});

test("Boost requires a vote first and never creates votes merely by sharing", async () => {
    const ui = battlePage(); await ui.boost();
    assert.equal(ui.calls.copied.length, 0);
    assert.match(ui.state[9], /Vote for your side first/);
    await ui.share();
    assert.equal(ui.calls.copied.length, 1);
    assert.equal(ui.calls.rpc.length, 0);
});

test("Boost recipients can submit only the invited side; normal shares allow either side", async () => {
    for (const target of [11, 12]) {
        const ui = battlePage({ query: `boost=${target}` });
        const buttons = ui.voteButtons();
        assert.equal(buttons.length, 2);
        const allowed = buttons[target === 11 ? 0 : 1];
        const blocked = buttons[target === 11 ? 1 : 0];
        assert.equal(allowed.props.disabled, false);
        assert.equal(blocked.props.disabled, true);
        await blocked.props.onClick(); // The handler must also reject forced calls.
        assert.equal(ui.calls.rpc.length, 0);
        await allowed.props.onClick();
        assert.equal(ui.calls.rpc[0].name, "cast_vote");
        assert.equal(ui.calls.rpc[0].args.p_option_id, target);
        assert.equal(ui.calls.rpc[0].args.p_battle_id, 1);
        assert.equal(ui.state[3], target);
        await ui.boost();
        assert.equal(new URL(ui.calls.copied[0]).searchParams.get("boost"), String(target));
    }
    for (const index of [0, 1]) {
        const ui = battlePage();
        assert(ui.voteButtons().every(button => !button.props.disabled));
        await ui.voteButtons()[index].props.onClick();
        assert.equal(ui.calls.rpc[0].args.p_option_id, index === 0 ? 11 : 12);
    }
});

test("invalid, duplicate and foreign-option Boost links cannot submit either side", async () => {
    for (const value of ["", "999", "-11", "11.5", "1e1", "NaN", "9007199254740993", "11&boost=12"]) {
        const ui = battlePage({ query: `boost=${value}` });
        assert(ui.voteButtons().every(button => button.props.disabled));
        for (const button of ui.voteButtons()) await button.props.onClick();
        assert.equal(ui.calls.rpc.length, 0);
        assert.match(ui.state[7], /invalid/);
    }
});

test("Boost restriction survives login and the existing signup/onboarding destination helper", async () => {
    const ui = battlePage({ user: null, query: "boost=12&ref=friend" });
    await ui.voteButtons()[1].props.onClick();
    assert.equal(ui.calls.rpc.length, 0);
    const login = new URL(ui.calls.routes[0], origin);
    assert.equal(login.pathname, "/login");
    assert.equal(login.searchParams.get("redirect"), "/battle/1?boost=12&ref=friend");
    assert.equal(authHelpers.getAuthDestination(login.searchParams.get("redirect"), login.searchParams.get("ref"), origin),
        "/battle/1?boost=12&ref=friend");
});

test("query-only navigation updates the permitted side without reloading the battle", () => {
    const ui = battlePage({ query: "boost=11" });
    assert.equal(ui.voteButtons()[1].props.disabled, true);
    ui.setQuery("boost=12");
    assert.equal(ui.voteButtons()[0].props.disabled, true);
    assert.equal(ui.voteButtons()[1].props.disabled, false);
    ui.setQuery("");
    assert(ui.voteButtons().every(button => !button.props.disabled));
});

test("native Boost sharing names the side and ordinary sharing stays neutral", async () => {
    const ui = battlePage({ myVote: 12, native: true });
    await ui.boost(); await ui.share();
    assert.match(ui.calls.shared[0].text, /Back Coffee Crew/);
    assert.equal(new URL(ui.calls.shared[0].url).searchParams.get("boost"), "12");
    assert.equal(new URL(ui.calls.shared[1].url).searchParams.has("boost"), false);
    assert.equal(ui.calls.rpc.length, 0);
});

test("closed FanWars and existing votes remain locked on Boost invites", async () => {
    const closed = battlePage({ query: "boost=11", status: "closed", myVote: 11 });
    assert.equal(closed.voteButtons().length, 0);
    await closed.boost();
    assert.equal(closed.calls.copied.length, 0);
    const voted = battlePage({ query: "boost=11", myVote: 12 });
    assert.equal(voted.voteButtons().length, 0);
    assert.equal(voted.state[3], 12);
    assert.equal(voted.calls.rpc.length, 0);
});
