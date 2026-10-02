import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

// Run the real page handlers with fake auth/database services, without live writes.
function loadModule(relativePath, imports = {}, globals = {}) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    const { outputText } = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    });
    const exports = {};
    vm.runInNewContext(outputText, {
        exports, module: { exports }, URL, URLSearchParams, Error,
        require(name) {
            if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
            return imports[name];
        },
        ...globals,
    });
    return exports;
}

const redirectModule = loadModule("../lib/auth-redirect.ts");
const origin = "https://fanwars.example";

test("auth destinations preserve battles, query strings, and one referral", () => {
    const destination = redirectModule.getAuthDestination;
    assert.equal(destination(null, "fan", origin), "/home");
    assert.equal(destination("/battle/6?mode=live#results", "fan", origin),
        "/battle/6?mode=live&ref=fan#results");
    assert.equal(destination("/battle/6?ref=original", "fan", origin),
        "/battle/6?ref=original");
});

test("external, executable, and malformed destinations fall back to the feed", () => {
    for (const redirect of ["https://other.example/battle/6", "//other.example",
        "javascript:alert(1)", "https://[", `${origin}//other.example`]) {
        assert.equal(redirectModule.getAuthDestination(redirect, null, origin), "/home");
    }
});

function onboarding({ existing = false, referralError = null, insertError = null,
    authError = null, query = "" } = {}) {
    const state = ["Naveen", "naveen", "Naveen", false, false, ""];
    const calls = { inserts: [], referrals: [], destinations: [], logs: [] };
    let stateIndex = 0;
    const supabase = {
        auth: { getUser: async () => ({ data: { user: { id: "test-user" } }, error: authError }) },
        from(table) {
            assert.equal(table, "profiles");
            return {
                select: () => ({ eq: () => ({ maybeSingle: async () => ({
                    data: existing ? { id: "test-user" } : null, error: null,
                }) }) }),
                async insert(profile) {
                    calls.inserts.push(profile);
                    if (!insertError) existing = true;
                    return { error: insertError };
                },
            };
        },
        async rpc(name, args) {
            calls.referrals.push({ name, args });
            return { error: referralError };
        },
    };
    const jsx = (type, props) => ({ type, props });
    const page = loadModule("../app/onboarding/page.tsx", {
        react: {
            Suspense: "suspense", useEffect() {},
            useState() {
                const index = stateIndex++;
                return [state[index], (value) => { state[index] = value; }];
            },
        },
        "react/jsx-runtime": { jsx, jsxs: jsx },
        "next/navigation": {
            useRouter: () => ({ replace: (url) => calls.destinations.push(url) }),
            useSearchParams: () => new URLSearchParams(query),
        },
        "@/lib/supabase": { supabase },
        "@/lib/auth-redirect": redirectModule,
    }, {
        window: { location: { origin } },
        console: { error: (...args) => calls.logs.push(args) },
    });
    function findForm(node) {
        if (!node || typeof node !== "object") return;
        if (node?.type === "form") return node;
        const children = node?.props?.children;
        for (const child of [children].flat()) {
            const form = findForm(child);
            if (form) return form;
        }
    }
    return {
        state, calls,
        async submit() {
            stateIndex = 0;
            const content = page.default().props.children.type();
            await findForm(content).props.onSubmit({ preventDefault() {} });
        },
    };
}

test("new profiles land on the feed and can safely retry", async () => {
    const flow = onboarding();
    await flow.submit();
    await flow.submit();
    assert.equal(flow.calls.inserts.length, 1);
    assert.deepEqual(flow.calls.destinations, ["/home", "/home"]);
    assert.equal(flow.state[4], false);
});

test("referral failure does not block a saved profile or the original battle", async () => {
    const flow = onboarding({ query: "ref=friend&redirect=%2Fbattle%2F6",
        referralError: new Error("Referral service unavailable") });
    await flow.submit();
    assert.deepEqual(flow.calls.destinations, ["/battle/6?ref=friend"]);
    assert.equal(flow.calls.referrals.length, 1);
    assert.equal(flow.calls.logs.length, 1);
    assert.equal(flow.state[5], "");
    assert.equal(flow.state[4], false);
});

test("duplicate handles show a useful error and allow another attempt", async () => {
    const flow = onboarding({ insertError: { code: "23505" } });
    await flow.submit();
    assert.match(flow.state[5], /already taken/);
    assert.deepEqual(flow.calls.destinations, []);
    assert.equal(flow.state[4], false);
});

test("expired authentication does not create profiles or claim referrals", async () => {
    const flow = onboarding({ authError: new Error("Expired"), query: "ref=friend" });
    await flow.submit();
    assert.match(flow.state[5], /session has expired/);
    assert.equal(flow.calls.inserts.length, 0);
    assert.equal(flow.calls.referrals.length, 0);
    assert.equal(flow.state[4], false);
});
