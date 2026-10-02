import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const exports = {};
vm.runInNewContext(ts.transpileModule(
    readFileSync(new URL("../lib/media-upload.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText, { exports, Error });
const bucket = JSON.parse(readFileSync(new URL("../supabase/baseline_manifest.json", import.meta.url), "utf8")).storage_bucket_configuration[0];

test("input and cropped upload boundaries match the captured 5 MiB bucket limit", () => {
    // The public manifest stores the captured bucket configuration.
    const limit = bucket.file_size_limit;
    assert.equal(exports.MAX_IMAGE_BYTES, limit);
    for (const validate of [exports.imageFileError, exports.croppedImageError]) {
        assert.equal(validate({ type: "image/webp", size: limit }), "");
        assert.match(validate({ type: "image/webp", size: limit + 1 }), /5 MB/);
        assert.match(validate({ type: "image/webp", size: 0 }), /empty/);
    }
});

test("supported crop formats get matching extensions; unsupported content is rejected", () => {
    assert.deepEqual([...exports.UPLOAD_IMAGE_TYPES], bucket.allowed_mime_types);
    for (const [type, extension] of [["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]) {
        assert.equal(exports.croppedImageError({ type, size: 100 }), "");
        assert.equal(exports.imageExtension(type), extension);
    }
    assert.match(exports.imageFileError({ type: "application/pdf", size: 100 }), /image file/);
    assert.match(exports.croppedImageError({ type: "image/gif", size: 100 }), /supported format/);
    assert.throws(() => exports.imageExtension("image/gif"), /Unsupported/);
});

function uploader(blob) {
    const state = ["blob:test", null, { x: 0, y: 0 }, 1,
        { x: 0, y: 0, width: 20, height: 20 }, false, ""];
    let index = 0;
    const calls = { uploads: [], uploaded: [], revoked: [] };
    const componentExports = {};
    const element = (type, props) => ({ type, props });
    const imports = {
        "react": { useRef: () => ({ current: null }), useState: () => {
            const position = index++;
            return [state[position], value => { state[position] = value; }];
        } },
        "react/jsx-runtime": { jsx: element, jsxs: element },
        "react-easy-crop": { default: () => null },
        "@/lib/media-upload": exports,
        "@/lib/supabase": { supabase: { storage: { from: () => ({
            upload: async (...args) => { calls.uploads.push(args); return { error: null }; },
            getPublicUrl: () => ({ data: { publicUrl: "https://local.example/image.png" } }),
        }) } } },
    };
    vm.runInNewContext(ts.transpileModule(
        readFileSync(new URL("../components/image-upload.tsx", import.meta.url), "utf8"),
        { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } },
    ).outputText, {
        exports: componentExports, require: name => imports[name], Error, Promise,
        Image: class { set src(value) { this.onload(); } },
        document: { createElement: () => ({ getContext: () => ({ drawImage() {} }), toBlob: callback => callback(blob) }) },
        crypto: { randomUUID: () => "fake-id" },
        URL: { revokeObjectURL: url => calls.revoked.push(url) },
        console: { error() {} },
    });
    const tree = componentExports.default({ userId: "fake-user", folder: "avatar", onUploaded: url => calls.uploaded.push(url) });
    function findSave(node) {
        if (!node || typeof node !== "object") return null;
        if (node.type === "button" && node.props.children === "Save Photo") return node;
        for (const child of [node.props?.children].flat(Infinity)) {
            const found = findSave(child);
            if (found) return found;
        }
        return null;
    }
    return { state, calls, save: findSave(tree).props.onClick };
}

test("an oversized cropped image never reaches Storage and leaves Save available for retry", async () => {
    const { save, calls, state } = uploader({ type: "image/webp", size: 5242881 });
    await save();
    assert.equal(calls.uploads.length, 0);
    assert.equal(calls.uploaded.length, 0);
    assert.equal(state[5], false);
    assert.match(state[6], /5 MB/);
});

test("canvas PNG fallback is uploaded with a matching filename and content type", async () => {
    const { save, calls, state } = uploader({ type: "image/png", size: 100 });
    await save();
    assert.equal(calls.uploads.length, 1);
    assert.equal(calls.uploads[0][0], "fake-user/avatar/fake-id.png");
    assert.equal(calls.uploads[0][2].contentType, "image/png");
    assert.equal(calls.uploaded.length, 1);
    assert.equal(state[5], false);
    assert.equal(state[0], null);
});
