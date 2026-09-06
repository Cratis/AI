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
    "d86b3c4e39c5e9e8f92b15a83dc502dfe8b9331128d9df3d5bb663206a62ad62";
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
