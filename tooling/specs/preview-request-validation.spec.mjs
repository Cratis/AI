// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { validateAgainstSchema } from "../catalog-validation.mjs";
import { validatePreviewRequests } from "../preview-request-validation.mjs";

function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}

test("preview request catalog is empty closed and valid before owner setup", () => {
    assert.deepEqual(validatePreviewRequests(), []);
    assert.deepEqual(
        validatePreviewRequests(undefined, { baseRevision: "HEAD" }),
        [],
    );
    assert(
        validatePreviewRequests(undefined, { requireRequest: true }).some(
            (error) => error.includes("At least one passive preview request"),
        ),
    );
    const requests = readJson("distribution/preview-requests.json");
    assert.deepEqual(requests.requests, []);
});

test("preview request schema rejects support claims unknown fields and multiple releases", () => {
    const schema = readJson("distribution/preview-requests.schema.json");
    const request = {
        id: "public-fundamentals-0-1-0-preview-1",
        state: "preview-on-merge",
        profileId: "public-fundamentals",
        packageName: "@cratis/ai-fundamentals",
        version: "0.1.0-preview.1",
        sourceRevision: "a".repeat(40),
        sourceContentDigest: "b".repeat(64),
        assuranceMode: "basic",
        supportClaim: true,
        releaseNotes: "Preview",
        unknownAuthority: true,
    };
    const errors = validateAgainstSchema(
        {
            schemaVersion: 1,
            defaultPolicy: "deny",
            requests: [request, structuredClone(request)],
        },
        schema,
        schema,
    );
    assert(
        errors.some((error) => error.includes("duplicate items")),
    );
    assert(
        errors.some((error) =>
            error.includes("supportClaim: expected constant false"),
        ),
    );
    assert(
        errors.some((error) =>
            error.includes("unknown property unknownAuthority"),
        ),
    );
});

test("preview request validation is bound to basic readiness and immutable source ancestry", () => {
    const source = readFileSync(
        "tooling/preview-request-validation.mjs",
        "utf8",
    );
    for (const required of [
        "buildPreviewReadiness",
        "READY_FOR_PREVIEW_REQUEST",
        "loadPreviewAuthority",
        "sourceContentDigest",
        "merge-base",
        "--is-ancestor",
        "cat-file",
        "Preview requests must append exactly one record",
    ])
        assert(source.includes(required), required);
    for (const forbidden of ["npm publish", "id-token", "gh release"])
        assert.equal(source.includes(forbidden), false, forbidden);
});
