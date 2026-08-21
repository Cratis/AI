// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { test } from "node:test";
import { compareOrdinal, sortedOrdinal } from "../catalog-ordering.mjs";

test("catalog ordering is ordinal and independent of process locale", () => {
    const values = ["z", "Z", "é", "e", "_", "a-10", "a-2"];
    assert.deepEqual(sortedOrdinal(values), [
        "Z",
        "_",
        "a-10",
        "a-2",
        "e",
        "z",
        "é",
    ]);
    assert.equal(compareOrdinal("same", "same"), 0);
    assert.equal(compareOrdinal("A", "a"), -1);
    assert.equal(compareOrdinal("é", "z"), 1);
});
