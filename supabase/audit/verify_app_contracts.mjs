// Compare static Supabase calls with captured metadata. No DB connection.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { readCapture } from "./read_capture.mjs";

const root = resolve(import.meta.dirname, "../..");
const require = createRequire(resolve(root, "package.json"));
const ts = require("typescript");
const capture = readCapture(resolve(root, "supabase/.captures/database_inventory.csv"));
const relations = new Map(capture.relations.map((row) => [row.relname, row]));
const tables = new Set(), functions = new Set(), checkedColumns = new Set();
const problems = [];
function files(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = resolve(dir, entry.name);
        return entry.isDirectory() ? files(path) : /\.tsx?$/.test(path) ? [path] : [];
    });
}
function text(node) {
    return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;
}
function fromRelation(node) {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return null;
    if (node.expression.name.text === "from") return text(node.arguments[0]);
    return fromRelation(node.expression.expression);
}
function verifyColumn(table, column) {
    if (!column || column === "*" || table === "fanwars-media") return;
    checkedColumns.add(table + "." + column);
    if (!capture.columns.some((row) => row.table_name === table && row.column_name === column)) {
        problems.push("Missing column: " + table + "." + column);
    }
}
for (const file of ["app", "components", "lib"].flatMap((dir) => files(resolve(root, dir)))) {
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    function visit(node) {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
            const method = node.expression.name.text;
            const name = text(node.arguments[0]);
            if (method === "from" && name && name !== "fanwars-media") {
                tables.add(name);
                if (!relations.has(name)) problems.push("Missing relation: " + name);
            }
            if (method === "rpc" && name) {
                functions.add(name);
                const candidates = capture.functions.filter((row) => row.proname === name);
                if (!candidates.length) problems.push("Missing RPC: " + name);
                const argumentNode = node.arguments[1];
                const keys = argumentNode && ts.isObjectLiteralExpression(argumentNode) ?
                    argumentNode.properties.map((property) => property.name?.getText(source).replace(/^['"]|['"]$/g, "")) : [];
                if (candidates.length && !candidates.some((fn) => {
                    const expected = fn.identity_arguments.split(",").map((arg) => arg.trim().split(/\s+/)[0]).filter(Boolean);
                    return keys.every((key) => expected.includes(key));
                })) problems.push("RPC parameter mismatch: " + name);
            }
            const table = fromRelation(node.expression.expression);
            if (table && table !== "fanwars-media") {
                if (method === "select" && name) {
                    for (const column of name.split(",").map((part) => part.trim())) {
                        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(column)) verifyColumn(table, column);
                    }
                } else if (["eq", "in", "order", "neq", "is"].includes(method)) verifyColumn(table, name);
                else if (["insert", "update", "upsert"].includes(method) && node.arguments[0] &&
                    ts.isObjectLiteralExpression(node.arguments[0])) {
                    for (const property of node.arguments[0].properties) verifyColumn(table, property.name?.getText(source));
                }
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(source);
}
const result = { tables: [...tables].sort(), rpcs: [...functions].sort(),
    checked_columns: [...checkedColumns].sort(), problems: [...new Set(problems)],
    scope: "Static literal table/column/RPC argument checks; dynamic fields and SQL return-shape semantics require separate review" };
writeFileSync(resolve(root, "supabase/.captures/app_contract_results.json"), JSON.stringify(result, null, 2));
console.log(`Compared ${tables.size} relation names, ${functions.size} RPC names/argument keys, ` +
    `${checkedColumns.size} literal column references. Missing/mismatched objects: ${result.problems.length}.`);
assert.equal(result.problems.length, 0, "See private app_contract_results.json for mismatches");
