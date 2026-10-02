import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const ts = createRequire(import.meta.url)("typescript");
function load(path, imports) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, { exports, require: name => imports[name], Error, Promise,
        window: { addEventListener() {}, removeEventListener() {} } });
    return exports;
}
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const walk = node => !node || typeof node !== "object" ? [] :
    [node, ...[node.props?.children].flat(Infinity).flatMap(walk)];

function header({ loggedIn = true, signOutError = null, loading = false } = {}) {
    const state = [loggedIn, loading, 0, "Naveen", false, 0, false, ""];
    const calls = { routes: [], scopes: [], refreshes: 0 };
    let index = 0;
    const effects = [];
    const headerModule = load("../components/app-header.tsx", {
        "react/jsx-runtime": jsx,
        "react": { useState: () => {
            const i = index++; return [state[i], value => { state[i] = typeof value === "function" ? value(state[i]) : value; }];
        }, useEffect: effect => effects.push(effect) },
        "next/link": { default: "link" },
        "@/components/fanwars-logo": { default: "logo" },
        "next/navigation": { usePathname: () => "/home", useRouter: () => ({
            replace: path => calls.routes.push(path), refresh: () => calls.refreshes++,
        }) },
        "@/lib/supabase": { supabase: {
            auth: {
                signOut: async options => { calls.scopes.push(options.scope); return { error: signOutError }; },
                getSession: async () => ({ data: { session: { user: { id: "test-user" } } }, error: null }),
            },
            from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { display_name: "Naveen" } }) }) }) }),
            rpc: async () => ({ data: false, error: null }),
        } },
    });
    return { state, calls, effects, render: () => { index = 0; return walk(headerModule.default()); } };
}

test("restored sessions keep the landing-page logo, feed link, Profile link, and sign-out", async () => {
    const ui = header({ loggedIn: false, loading: true });
    ui.render();
    ui.effects[1]();
    for (let i = 0; i < 8; i++) await Promise.resolve();
    const nodes = ui.render();
    assert.equal(nodes.find(n => n.type === "logo").props.href, "/");
    assert(nodes.some(n => n.type === "link" && n.props.href === "/home"));
    assert.equal(nodes.filter(n => n.type === "link" && n.props.href === "/profile").length, 1);
    const signOut = nodes.find(n => n.type === "button" && n.props.children === "Sign out");
    assert(signOut);
    assert(!signOut.props.className.includes("hidden"));
});

test("successful sign-out clears account controls and returns to the public landing page", async () => {
    const ui = header();
    const button = ui.render().find(n => n.type === "button");
    await button.props.onClick();
    assert.deepEqual(ui.calls.scopes, ["local"]);
    assert.deepEqual(ui.calls.routes, ["/"]);
    assert.equal(ui.calls.refreshes, 1);
    const nodes = ui.render();
    assert.equal(nodes.find(n => n.type === "logo").props.href, "/");
    assert(nodes.some(n => n.type === "link" && n.props.href === "/login"));
    assert(!nodes.some(n => n.type === "link" && n.props.href === "/profile"));
});

test("failed sign-out keeps the session visible and offers a retry", async () => {
    const ui = header({ signOutError: new Error("Network failure") });
    await ui.render().find(n => n.type === "button").props.onClick();
    assert.deepEqual(ui.calls.routes, []);
    assert.equal(ui.state[0], true);
    assert.equal(ui.state[6], false);
    assert.match(ui.state[7], /try again/);
});

function landingPage() {
    const state = [null, [], [], true, null];
    let index = 0, authChanged, unsubscribed = false;
    const effects = [];
    const { default: Landing } = load("../app/page.tsx", {
        "react/jsx-runtime": jsx,
        react: { useEffect: effect => effects.push(effect), useState: () => {
            const i = index++; return [state[i], value => { state[i] = value; }];
        } },
        "next/link": { default: "link" },
        "@/components/fanwars-logo": { default: "logo", FanWarsMark: "mark" },
        "@/components/app-header": { default: "header" },
        "@/components/battle-cover": { default: "cover", SidePhoto: "photo" },
        "@/lib/supabase": { supabase: { auth: { onAuthStateChange: callback => {
            authChanged = callback;
            return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } };
        } } } },
    });
    const render = () => { index = 0; return walk(Landing()); };
    render();
    const cleanup = effects[0]();
    return { render, cleanup, get unsubscribed() { return unsubscribed; },
        auth(event, session) { authChanged(event, session); },
        joins() { return render().filter(node => node.type === "link" && node.props.onClick?.name === "waitForSession"); } };
}

test("landing Join links wait for the initial session before navigating", () => {
    const ui = landingPage();
    assert.equal(ui.joins().length, 3);
    for (const link of ui.joins()) {
        assert.equal(link.props["aria-disabled"], true);
        let prevented = false;
        link.props.onClick({ preventDefault() { prevented = true; } });
        assert.equal(prevented, true);
    }
    ui.cleanup();
    assert.equal(ui.unsubscribed, true);
});

test("signed-in landing visitors go straight to Home from every Join link", () => {
    const ui = landingPage();
    ui.auth("INITIAL_SESSION", { user: { id: "existing-user" } });
    for (const link of ui.joins()) {
        assert.equal(link.props.href, "/home");
        assert.equal(link.props["aria-disabled"], false);
        link.props.onClick({ preventDefault() { assert.fail("Known session must allow navigation"); } });
    }
    assert(!ui.render().some(node => node.type === "link" && ["/signup", "/login"].includes(node.props.href)));
    assert.equal(ui.joins()[0].props.children[0].trim(), "Join the movement");
});

test("Join the movement opens login for guests while signup links stay available", () => {
    const ui = landingPage();
    ui.auth("INITIAL_SESSION", null);
    assert.equal(ui.joins()[0].props.href, "/login");
    assert.equal(ui.joins()[0].props.children[0].trim(), "Join the movement");
    assert(ui.joins().slice(1).every(link => link.props.href === "/signup"));
    assert(ui.joins().every(link => !link.props["aria-disabled"]));
    assert(ui.render().some(node => node.type === "link" && node.props.href === "/login"));
    ui.auth("SIGNED_IN", { user: { id: "new-user" } });
    assert(ui.joins().every(link => link.props.href === "/home"));
    ui.auth("SIGNED_OUT", null);
    assert.equal(ui.joins()[0].props.href, "/login");
    assert.equal(ui.joins()[0].props.children[0].trim(), "Join the movement");
    assert(ui.joins().slice(1).every(link => link.props.href === "/signup"));
});

test("matchups select two different photos corresponding to their actual sides", () => {
    const { battleCoverSides, sideCoverPath } = load("../lib/battle-cover.ts", {});
    for (const [title, expected] of [
        ["Chai vs Coffee", ["chai", "coffee"]],
        ["Cricket vs Football", ["cricket", "football"]],
        ["Biryani vs Pizza", ["biryani", "pizza"]],
        ["Marvel vs DC", ["marvel", "dc"]],
        ["Android vs iPhone", ["android", "iphone"]],
        ["Coffee vs Chai", ["coffee", "chai"]],
        ["Mountain vs Beaches", ["mountain", "beach"]],
        ["Moutain vs Beaches", ["mountain", "beach"]],
        ["Mac vs Windows", ["mac", "windows"]],
        ["Windows vs Mac", ["windows", "mac"]],
    ]) {
        const sides = battleCoverSides(title);
        assert.equal(sides.length, 2);
        sides.forEach((side, index) => {
            assert.equal(side.image, `/battle-covers/${expected[index]}.jpg`);
            assert(existsSync(new URL(`../public${side.image}`, import.meta.url)));
        });
    }
    const options = battleCoverSides("Chai vs Coffee", ["Chai Gang", "Coffee Crew"]);
    assert.equal(options[0].name, "Chai Gang");
    assert.equal(options[1].image, "/battle-covers/coffee.jpg");
    assert.equal(sideCoverPath("Coffee Crew"), "/battle-covers/coffee.jpg");
    assert.equal(sideCoverPath("Mountain Tribe"), "/battle-covers/mountain.jpg");
    assert.equal(sideCoverPath("Beach Tribe"), "/battle-covers/beach.jpg");
    assert.equal(sideCoverPath("MacBook Crew"), "/battle-covers/mac.jpg");
    assert.equal(sideCoverPath("Windows Warriors"), "/battle-covers/windows.jpg");
    assert.equal(sideCoverPath("Steve Gates"), null);
    assert.equal(sideCoverPath("Unknown sports tribe"), null);
    assert.equal(battleCoverSides("Unrelated matchup")[0].image, null);
});

test("tribe photos keep uploaded covers and fall back without retry loops", () => {
    const coverHelpers = load("../lib/battle-cover.ts", {});
    let failed = [];
    const { SidePhoto } = load("../components/battle-cover.tsx", {
        "react/jsx-runtime": jsx,
        "next/image": { default: "image" },
        "@/lib/battle-cover": coverHelpers,
        "react": { useState: () => [failed, value => { failed = typeof value === "function" ? value(failed) : value; }] },
    });
    const render = () => walk(SidePhoto({ name: "Coffee Crew", image: "https://example.com/crew.jpg", showLabel: false }));
    let photo = render().find(n => n.type === "image");
    assert.equal(photo.props.src, "https://example.com/crew.jpg");
    assert.equal(photo.props.unoptimized, true);
    photo.props.onError();
    photo = render().find(n => n.type === "image");
    assert.equal(photo.props.src, "/battle-covers/coffee.jpg");
    assert.equal(photo.props.unoptimized, false);
    photo.props.onError();
    assert(!render().some(n => n.type === "image"));
});

test("custom communities use their own topic before descriptions and parent tribes", () => {
    const { communityCoverPath } = load("../lib/battle-cover.ts", {});
    for (const [name, description, parent, expected] of [
        ["Coffee Crew", "Cricket fans", "Football Tribe", "coffee"],
        ["Steve Gates", "", "Cricket Nation", "windows"],
        ["Night Owls", "We love coffee", "Chai Gang", "coffee"],
        ["United Crew", "", "Coffee Crew", "coffee"],
        ["New community", "", "", "community"],
        ["Music Heads", "", "", "music"],
        ["Movie Buffs", "", "", "movies"],
        ["Anime Nation", "", "", "anime"],
        ["Gaming Clan", "", "", "gaming"],
        ["Tennis Fans", "", "", "tennis"],
        ["Basketball Crew", "", "", "basketball"],
    ]) {
        const path = communityCoverPath(name, description, parent);
        assert.equal(path, `/battle-covers/${expected}.jpg`);
        assert(existsSync(new URL(`../public${path}`, import.meta.url)));
    }
});

test("Boost opens an invite panel and calls sharing once while busy", async () => {
    const state = [false, false];
    let index = 0, shares = 0, finishShare;
    const { default: Boost } = load("../components/battle-boost.tsx", {
        "react/jsx-runtime": jsx,
        "react": { useState: () => {
            const i = index++; return [state[i], value => { state[i] = typeof value === "function" ? value(state[i]) : value; }];
        } },
    });
    const render = () => { index = 0; return walk(Boost({ closed: false, sideName: "Chai Gang", onShare: () => {
        shares++; return new Promise(resolve => { finishShare = resolve; });
    } })); };
    render().find(n => n.type === "button" && n.props["aria-controls"]).props.onClick();
    const nodes = render();
    assert(nodes.some(n => n.props?.id === "battle-boost-panel"));
    const pending = nodes.find(n => n.props?.children === "Invite fans / copy link").props.onClick();
    const busyButton = render().find(n => n.props?.children === "Opening share...");
    assert.equal(busyButton.props.disabled, true);
    await busyButton.props.onClick();
    assert.equal(shares, 1);
    finishShare(); await pending;
    assert.equal(state[1], false);
    render().find(n => n.props?.children === "Close").props.onClick();
    assert.equal(state[0], false);
});

test("closed battles cannot open Boost", () => {
    const { default: Boost } = load("../components/battle-boost.tsx", {
        "react/jsx-runtime": jsx,
        "react": { useState: () => [false, () => {}] },
    });
    const nodes = walk(Boost({ closed: true, sideName: "Chai Gang", onShare: async () => { throw Error("Unexpected share"); } }));
    assert.equal(nodes.find(n => n.type === "button").props.disabled, true);
    assert(!nodes.some(n => n.props?.id === "battle-boost-panel"));
});

test("Boost panel cannot send an invite until a side has been voted for", async () => {
    let index = 0;
    const state = [false, false];
    let shares = 0;
    const { default: Boost } = load("../components/battle-boost.tsx", {
        "react/jsx-runtime": jsx,
        "react": { useState: () => { const i = index++;
            return [state[i], value => { state[i] = typeof value === "function" ? value(state[i]) : value; }]; } },
    });
    const render = () => { index = 0; return walk(Boost({ closed: false, sideName: null,
        onShare: async () => { shares++; } })); };
    render().find(node => node.props["aria-controls"]).props.onClick();
    const invite = render().find(node => node.props.children === "Invite fans / copy link");
    assert.equal(invite.props.disabled, true);
    await invite.props.onClick();
    assert.equal(shares, 0);
});
