// Offline conversion of reviewed capture metadata into a LOCAL-ONLY draft.
// No database connection or subprocess execution occurs in this script.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { readCapture } from "./read_capture.mjs";

const root = resolve(import.meta.dirname, "..");
const snapshot = readCapture(resolve(root, ".captures/database_inventory.csv"));
const captured = JSON.stringify(snapshot);
const detailsPath = resolve(root, ".captures/database_details.csv");
const details = existsSync(detailsPath) ? readCapture(detailsPath) : null;
if (details) {
    assert.equal(details.relations.length, snapshot.relations.length, "Relation inventory changed between captures");
    assert.equal(details.columns.length, snapshot.columns.length, "Column inventory changed between captures");
    assert.deepEqual(details.relations.map((row) => row.relname).sort(),
        snapshot.relations.map((row) => row.relname).sort(), "Relation names changed");
    assert.equal(details.sequences.length, snapshot.sequences.length, "Sequence inventory changed");
    assert(details.relations.every((row) => row.relpersistence === "p" &&
        !row.relispartition && !row.reloptions && !row.tablespace),
        "Non-default table properties need a schema dump");
    assert(details.columns.every((row) => !row.column_acl && !row.compression_mode),
        "Column privileges/compression require additional DDL handling");
    snapshot.sequences = details.sequences;
}
const rawCsv = readFileSync(resolve(root, ".captures/database_inventory.csv"));
const digest = createHash("sha256").update(rawCsv).digest("hex");
const detailsDigest = details ? createHash("sha256").update(readFileSync(detailsPath)).digest("hex") : null;
const quote = (name) => '"' + name.replaceAll('"', '""') + '"';
const qualified = (schema, name) => `${quote(schema)}.${quote(name)}`;
const tables = snapshot.relations.filter((row) => row.relkind === "r");
assert(snapshot.relations.every((row) => ["r", "S"].includes(row.relkind)),
    "Other relation kinds need a schema dump before draft generation");
assert.equal(snapshot.views.length, 0, "Views require separate handling");
assert(snapshot.types.every((row) => ["b", "c"].includes(row.typtype)),
    "Custom enums/domains require their complete definitions");
assert(snapshot.columns.every((row) => row.is_generated === "NEVER"),
    "Generated columns require separate handling");
const suspectedSecrets = /eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}|sb_secret_[A-Za-z0-9]+|postgres(?:ql)?:\/\/|(?:password|api_key|service_role_key)\s*[:=]\s*'[^']+'/i;
assert(!suspectedSecrets.test(captured), "Review potential embedded secrets privately first");

const sql = [
    "-- LOCAL-ONLY BASELINE CANDIDATE. NOT A VALIDATED MIGRATION.",
    "-- Do not run on production or place in supabase/migrations yet.",
    `-- Source CSV SHA-256: ${digest}`,
    `-- Details CSV SHA-256: ${detailsDigest || "not supplied"}`,
    `-- Captured PostgreSQL: ${snapshot.runtime[0].postgres_version}`,
    "-- Requires fresh Supabase PostgreSQL 17 infrastructure, auth/storage schemas",
    "-- and existing postgres/anon/authenticated/service_role roles.",
    "-- Omits managed objects, global default privileges, bucket provisioning,",
    "-- and all application data. See CAPTURE_REVIEW.md for capture limitations.",
    "-- Before LOCAL replay only, set fanwars.baseline_target = 'disposable-local'.",
    "BEGIN;",
    "DO $guard$ BEGIN",
    "  IF current_setting('fanwars.baseline_target', true) IS DISTINCT FROM 'disposable-local' THEN",
    "    RAISE EXCEPTION 'Refusing replay: explicitly identify a disposable local target first';",
    "  END IF;",
    "END $guard$;",
    "SET LOCAL search_path = public, pg_catalog;",
    "\n-- Application tables and identity sequences",
];

const typeMap = { int8: "bigint", int4: "integer", text: "text",
    uuid: "uuid", timestamptz: "timestamp with time zone" };
const usedSequences = new Set();
const roundedSequenceBounds = [];
for (const table of tables) {
    const columns = snapshot.columns.filter((c) => c.table_name === table.relname)
        .sort((a, b) => a.ordinal_position - b.ordinal_position);
    assert(columns.length, "Missing columns for " + table.relname);
    const definitions = columns.map((c) => {
        assert(c.udt_schema === "pg_catalog" && typeMap[c.udt_name],
            "Unsupported captured type; obtain a schema dump");
        const exactColumn = details?.columns.find((row) => row.table_name === table.relname && row.column_name === c.column_name);
        if (details) {
            assert(exactColumn, "Column names changed between captures");
            assert.equal(exactColumn.exact_type, typeMap[c.udt_name], "Column type changed or requires fuller capture");
            assert.equal(exactColumn.default_expression, c.column_default, "Column default changed between captures");
            assert(!exactColumn.collation || ["pg_catalog.default", 'pg_catalog."default"'].includes(exactColumn.collation),
                "Custom collation requires separate handling");
            assert.equal(exactColumn.storage_mode, c.udt_name === "text" ? "x" : "p",
                "Non-default column storage requires separate handling");
        }
        let definition = `  ${quote(c.column_name)} ${typeMap[c.udt_name]}`;
        if (c.is_identity === "YES") {
            assert(["ALWAYS", "BY DEFAULT"].includes(c.identity_generation));
            // The capture lacks pg_depend ownership. This name mapping is an
            // explicit draft assumption, not proof of production dependency.
            const name = exactColumn?.identity_sequence_name || `${table.relname}_${c.column_name}_seq`;
            const sequence = snapshot.sequences.find((s) => s.sequencename === name);
            assert(sequence, "Identity sequence mapping needs further capture");
            for (const key of ["start_value", "min_value", "max_value", "increment_by", "cache_size"]) {
                assert(/^-?\d+$/.test(sequence[key]), "Invalid sequence bound");
                BigInt(sequence[key]);
            }
            usedSequences.add(name);
            const exactMaximum = BigInt(sequence.max_value) <= 9223372036854775807n;
            if (!exactMaximum) roundedSequenceBounds.push(name);
            definition += ` GENERATED ${c.identity_generation} AS IDENTITY (` +
                `SEQUENCE NAME ${qualified("public", name)} ` +
                `START WITH ${sequence.start_value} INCREMENT BY ${sequence.increment_by} ` +
                `MINVALUE ${sequence.min_value} ${exactMaximum ? "MAXVALUE " + sequence.max_value : "NO MAXVALUE"} ` +
                `CACHE ${sequence.cache_size} ${sequence.cycle ? "CYCLE" : "NO CYCLE"})`;
        } else if (c.column_default !== null) {
            definition += ` DEFAULT ${c.column_default}`;
        }
        if (c.is_nullable === "NO") definition += " NOT NULL";
        return definition;
    });
    sql.push(`CREATE TABLE ${qualified("public", table.relname)} (\n${definitions.join(",\n")}\n);`);
    sql.push(`ALTER TABLE ${qualified("public", table.relname)} OWNER TO ${quote(table.owner)};`);
}
assert.equal(usedSequences.size, snapshot.sequences.length, "Unmapped sequences");
if (roundedSequenceBounds.length) {
    sql.unshift("-- CAPTURE PRECISION GAP: dashboard rounded " + roundedSequenceBounds.length +
        " sequence maxima outside bigint range. Local draft uses default maxima only.",
        "-- Obtain exact text-valued sequence metadata before approving a baseline.");
}

sql.push("\n-- Constraints: all tables exist before foreign keys are created");
const constraintOrder = { p: 0, u: 1, c: 2, x: 3, f: 4 };
for (const constraint of [...snapshot.constraints].sort((a, b) =>
    constraintOrder[a.contype] - constraintOrder[b.contype])) {
    assert(constraint.contype in constraintOrder, "Unsupported constraint type");
    assert(constraint.convalidated, "Unvalidated constraint needs separate handling");
    sql.push(`ALTER TABLE ${qualified("public", constraint.relation_name)} ADD CONSTRAINT ` +
        `${quote(constraint.conname)} ${constraint.definition};`);
}

const backedIndexes = new Set(snapshot.constraints
    .filter((c) => ["p", "u", "x"].includes(c.contype)).map((c) => c.conname));
assert([...backedIndexes].every((name) => snapshot.indexes.some((i) => i.indexname === name)),
    "Constraint/index mapping needs further capture");
sql.push("\n-- Standalone indexes; constraint-backed indexes were created above");
for (const index of snapshot.indexes.filter((i) => !backedIndexes.has(i.indexname))) {
    sql.push(index.indexdef + ";");
}

sql.push("\n-- Captured function definitions are preserved verbatim");
// Resolve known function-to-function dependencies before SQL-language creation.
const ordered = [], pending = [...snapshot.functions];
while (pending.length) {
    const index = pending.findIndex((f) => {
        const body = f.definition.slice(f.definition.indexOf("AS $"));
        return !pending.some((other) => other !== f &&
            new RegExp("\\b" + other.proname + "\\s*\\(", "i").test(body));
    });
    assert(index >= 0, "Function dependency cycle requires a schema dump");
    ordered.push(pending.splice(index, 1)[0]);
}
for (const fn of ordered) {
    sql.push(fn.definition.trim().replace(/;$/, "") + ";");
    sql.push(`ALTER FUNCTION ${qualified(fn.schema_name, fn.proname)}(${fn.identity_arguments}) OWNER TO ${quote(fn.owner)};`);
}

sql.push("\n-- Application triggers only; managed Storage triggers are excluded");
for (const trigger of snapshot.triggers.filter((t) => t.schema_name === "public")) {
    sql.push(trigger.definition + ";");
    const mode = { O: "ENABLE", D: "DISABLE", R: "ENABLE REPLICA", A: "ENABLE ALWAYS" }[trigger.tgenabled];
    assert(mode, "Unknown trigger mode");
    sql.push(`ALTER TABLE ${qualified(trigger.schema_name, trigger.relation_name)} ${mode} TRIGGER ${quote(trigger.tgname)};`);
}

sql.push("\n-- Preserve RLS flags and public/Storage policy definitions");
for (const table of tables) {
    sql.push(`ALTER TABLE ${qualified("public", table.relname)} ${table.rls_enabled ? "ENABLE" : "DISABLE"} ROW LEVEL SECURITY;`);
    sql.push(`ALTER TABLE ${qualified("public", table.relname)} ${table.rls_forced ? "FORCE" : "NO FORCE"} ROW LEVEL SECURITY;`);
}
for (const policy of snapshot.policies) {
    assert(["public", "storage"].includes(policy.schemaname),
        "Unexpected Auth policy needs separate review");
    const roles = policy.roles.map((role) => role === "public" ? "PUBLIC" : quote(role)).join(", ");
    let definition = `CREATE POLICY ${quote(policy.policyname)} ON ${qualified(policy.schemaname, policy.tablename)} ` +
        `AS ${policy.permissive} FOR ${policy.cmd} TO ${roles}`;
    if (policy.qual !== null) definition += ` USING (${policy.qual})`;
    if (policy.with_check !== null) definition += ` WITH CHECK (${policy.with_check})`;
    sql.push(definition + ";");
}

sql.push("\n-- Reproduce captured ACLs for application objects and known API roles");
function writeAcl(kind, target, acl) {
    assert(Array.isArray(acl), "Null ACL needs explicit default-privilege handling");
    const map = kind === "FUNCTION" ? { X: "EXECUTE" } : kind === "SEQUENCE" ?
        { r: "SELECT", w: "UPDATE", U: "USAGE" } :
        { a: "INSERT", r: "SELECT", w: "UPDATE", d: "DELETE", D: "TRUNCATE", x: "REFERENCES", t: "TRIGGER", m: "MAINTAIN" };
    const entries = acl.map((entry) => {
        const match = entry.match(/^([A-Za-z_][A-Za-z0-9_]*|)=([A-Za-z*]*)\/([A-Za-z_][A-Za-z0-9_]*)$/);
        assert(match, "Complex ACL needs a schema dump");
        const [, role, privileges, grantor] = match;
        assert.equal(grantor, "postgres", "Non-owner grantor requires separate handling");
        return { role: role || "PUBLIC", privileges };
    });
    const roles = new Set(["PUBLIC", "anon", "authenticated", "service_role", ...entries.map((entry) => entry.role)]);
    const roleSql = (role) => role === "PUBLIC" ? role : quote(role);
    for (const role of roles) sql.push(`REVOKE ALL PRIVILEGES ON ${kind} ${target} FROM ${roleSql(role)};`);
    for (const entry of entries) {
        for (let i = 0; i < entry.privileges.length; i++) {
            const privilege = map[entry.privileges[i]];
            assert(privilege, "Unknown ACL privilege");
            const option = entry.privileges[i + 1] === "*";
            if (option) i++;
            sql.push(`GRANT ${privilege} ON ${kind} ${target} TO ${roleSql(entry.role)}${option ? " WITH GRANT OPTION" : ""};`);
        }
    }
}
for (const relation of snapshot.relations) {
    writeAcl(relation.relkind === "S" ? "SEQUENCE" : "TABLE",
        qualified("public", relation.relname), relation.relacl);
}
for (const fn of snapshot.functions) {
    writeAcl("FUNCTION", `${qualified(fn.schema_name, fn.proname)}(${fn.identity_arguments})`, fn.proacl);
}
sql.push("COMMIT;\n");

mkdirSync(resolve(root, "drafts"), { recursive: true });
writeFileSync(resolve(root, "drafts/baseline_candidate.sql"), sql.join("\n\n"));
console.log(`Prepared local-only draft: ${tables.length} tables, ${snapshot.functions.length} functions, ` +
    `${snapshot.constraints.length} constraints, ${snapshot.policies.length} policies. No SQL executed.`);
