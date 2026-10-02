import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const exports = {};
vm.runInNewContext(ts.transpileModule(
    readFileSync(new URL("../lib/battle-results.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText, { exports, Map, Set, Promise, Error });

test("closed FanWars recover both labels in RPC position order, including a tie", () => {
    const results = [
        { option_id: 72, option_name: "Clan A", vote_count: 8 },
        { option_id: 31, option_name: "Clan B", vote_count: 8 },
    ];
    const options = exports.getDisplayOptions(5, "closed", [], results);
    assert.deepEqual(JSON.parse(JSON.stringify(options)), [
        { id: 72, battle_id: 5, name: "Clan A", position: 1 },
        { id: 31, battle_id: 5, name: "Clan B", position: 2 },
    ]);
    const existing = [{ id: 72, battle_id: 5, name: "Clan A", position: 1 }];
    assert.equal(exports.getDisplayOptions(5, "closed", existing, results), existing);
    assert.equal(exports.getDisplayOptions(5, "live", existing, results), existing);
    assert.equal(exports.getDisplayOptions(5, "pending", [], results).length, 0);
});

test("clan totals use aggregate RPC counts beyond the raw-row API limit", async () => {
    const calls = [];
    const counts = await exports.loadVoteCounts({
        async rpc(name, args) {
            calls.push([name, args.p_battle_id]);
            return { error: null, data: [
                { option_id: args.p_battle_id * 2, option_name: "A", vote_count: 1501 },
                { option_id: args.p_battle_id * 2 + 1, option_name: "B", vote_count: 0 },
            ] };
        },
    }, [1, 2, 1]);
    assert.deepEqual(calls, [["get_battle_results", 1], ["get_battle_results", 2]]);
    assert.equal(counts.get(2), 1501);
    assert.equal(counts.get(3), 0);
    assert.equal(counts.get(4), 1501);
});

test("a failed result request is surfaced instead of displaying false zero scores", async () => {
    const error = new Error("Results unavailable");
    await assert.rejects(exports.loadVoteCounts({
        rpc: async () => ({ data: null, error }),
    }, [1]), error);
});
