import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const ts = createRequire(import.meta.url)("typescript");
const jsx = (type, props) => ({ type, props });

async function loadBattle(response) {
    const state = [];
    const calls = { reads: [], errors: [] };
    const effects = [];
    let index = 0;
    let finishLoading;
    const loaded = new Promise(resolve => { finishLoading = resolve; });
    const imports = {
        "react/jsx-runtime": { jsx, jsxs: jsx },
        react: {
            Suspense: "suspense",
            useState(initial) {
                const i = index++;
                state[i] = initial;
                return [state[i], value => {
                    state[i] = value;
                    if (i === 5 && value === false) finishLoading();
                }];
            },
            useEffect: effect => effects.push(effect),
            useCallback: callback => callback,
        },
        "next/navigation": {
            useParams: () => ({ id: "123" }),
            useRouter: () => ({}),
            useSearchParams: () => new URLSearchParams(),
        },
        "next/link": { default: "link" },
        "@/components/fanwars-logo": { default: "logo", FanWarsMark: "mark" },
        "@/components/app-header": { default: "header" },
        "@/components/battle-boost": { default: "boost" },
        "@/components/battle-cover": { default: "cover", SidePhoto: "photo" },
        "@/lib/battle-share": { getBoostOptionId: () => null },
        "@/lib/battle-results": {},
        "@/lib/supabase": { supabase: {
            from(table) {
                calls.reads.push(table);
                const query = {
                    select: () => query,
                    eq: () => query,
                    maybeSingle: async () => response,
                    single: async () => response.error ? response : {
                        data: null,
                        error: { code: "PGRST116", details: "The result contains 0 rows" },
                    },
                };
                return query;
            },
        } },
    };
    const exports = {};
    vm.runInNewContext(ts.transpileModule(
        readFileSync(new URL("../app/battle/[id]/page.tsx", import.meta.url), "utf8"),
        { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } },
    ).outputText, {
        exports, require: name => imports[name], URLSearchParams,
        console: { error: (...args) => calls.errors.push(args) },
    });
    // Render the Suspense child, then run its initial loading effect.
    exports.default().props.children.type();
    effects[0]();
    await loaded;
    return { state, calls };
}

test("missing or RLS-hidden FanWars finish loading without a console error", async () => {
    const { state, calls } = await loadBattle({ data: null, error: null });
    assert.equal(state[0], null);
    assert.equal(state[5], false);
    assert.match(state[7], /unavailable.*access/);
    assert.equal(state[8], "error");
    assert.deepEqual(calls.errors, []);
    assert.deepEqual(calls.reads, ["battles"]);
});

test("a real database failure still reports an error", async () => {
    const error = { code: "42501", message: "permission denied for table battles" };
    const { state, calls } = await loadBattle({ data: null, error });
    assert.equal(state[5], false);
    assert.equal(state[7], "We couldn't load this FanWar.");
    assert.equal(calls.errors.length, 1);
    assert.equal(calls.errors[0][1], error);
});

test("visible pending FanWars retain the under-review message", async () => {
    const { state, calls } = await loadBattle({ data: { id: 123, status: "pending" }, error: null });
    assert.equal(state[5], false);
    assert.equal(state[7], "This FanWar is currently under review.");
    assert.deepEqual(calls.errors, []);
    assert.deepEqual(calls.reads, ["battles"]);
});
