// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { basename } from "node:path";
import { test } from "node:test";
import {
    governedOnlySpecBasenames,
    specsForMode,
} from "../run-spec-suite.mjs";

test("basic specs exclude only the explicit governed assurance suite", () => {
    const basic = specsForMode("basic").map((path) => basename(path));
    const governed = specsForMode("governed").map((path) => basename(path));
    assert(governed.length > basic.length);
    assert.equal(governed.length - basic.length, governedOnlySpecBasenames.length);
    for (const path of governedOnlySpecBasenames) {
        assert(governed.includes(path), path);
        assert(!basic.includes(path), path);
    }
    for (const required of [
        "assurance-lanes.spec.mjs",
        "candidate-contract-schemas.spec.mjs",
        "candidate-review-batch.spec.mjs",
        "passive-candidate-assets.spec.mjs",
        "portable-compliance-validation.spec.mjs",
        "workflow-safety.spec.mjs",
    ])
        assert(basic.includes(required), required);
});

test("unknown specification modes fail closed", () => {
    assert.throws(() => specsForMode("preview"), /Unknown specification mode/);
});
