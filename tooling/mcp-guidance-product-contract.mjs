// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import { compareOrdinal } from "./catalog-ordering.mjs";
import {
    anchorMismatch,
    validateAgainstSchema,
    validateSchemaVocabulary,
} from "./catalog-validation.mjs";

const expectedProductAnchor =
    "24f545c106a70371ba6202baaa1c76357f3bbc19ad05e33bff4c3050b350d339";
const expectedProductIds = Object.freeze(["chronicle-mcp", "studio"]);

function semanticAnchor(records) {
    return createHash("sha256")
        .update(
            `${[...records]
                .sort((left, right) => compareOrdinal(left.id, right.id))
                .map((record) => JSON.stringify(record))
                .join("\n")}\n`,
        )
        .digest("hex");
}

export function validateMcpGuidanceProductContract(products, schema) {
    const errors = [
        ...validateSchemaVocabulary(schema),
        ...validateAgainstSchema(products, schema, schema),
    ];
    const productAnchor = semanticAnchor(products.products);
    if (productAnchor !== expectedProductAnchor)
        errors.push(
            anchorMismatch(
                "MCP guidance product contract",
                expectedProductAnchor,
                productAnchor,
                "expectedProductAnchor in tooling/mcp-guidance-product-contract.mjs",
            ),
        );
    const productIds = products.products
        .map((product) => product.id)
        .sort(compareOrdinal);
    if (JSON.stringify(productIds) !== JSON.stringify(expectedProductIds))
        errors.push("MCP guidance products must remain Chronicle and Studio");
    return errors;
}
