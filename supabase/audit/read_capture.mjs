import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Read one exported CSV result without exposing raw contents or rounding bigint. */
export function readCapture(path) {
    const csv = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let i = 0; i < csv.length; i++) {
        const char = csv[i];
        if (char === '"') {
            if (quoted && csv[i + 1] === '"') { field += '"'; i++; }
            else quoted = !quoted;
        } else if (!quoted && char === ",") {
            row.push(field); field = "";
        } else if (!quoted && char === "\n") {
            row.push(field); rows.push(row); row = []; field = "";
        } else if (quoted || char !== "\r") field += char;
    }
    assert(!quoted, "CSV quoting is incomplete");
    if (field || row.length) { row.push(field); rows.push(row); }
    assert.equal(rows.length, 2, "Expected one header and one complete capture row");
    const index = rows[0].indexOf("schema_snapshot");
    assert(index >= 0, "Capture column schema_snapshot is missing");
    const snapshot = rows[1][index];
    // Text-valued fields in corrected captures are already lossless. This also
    // protects raw integer-valued fields if a native exporter preserves them.
    return JSON.parse(snapshot.replace(
        /("(?:start_value|min_value|max_value|increment_by|cache_size)"\s*:\s*)(-?\d+)/g,
        '$1"$2"'
    ));
}
