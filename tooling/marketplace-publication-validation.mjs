// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { join } from "node:path";
import {
    defaultRepositoryRoot,
    readCatalog,
    validateAgainstSchema,
    validateSchemaVocabulary,
} from "./catalog-validation.mjs";
import { s10ReleasePaths } from "./generate-release-readiness.mjs";

export function validateMarketplacePublications(
    root = defaultRepositoryRoot,
) {
    const publications = readCatalog(join(root, s10ReleasePaths.marketplaces));
    const schema = readCatalog(join(root, s10ReleasePaths.marketplacesSchema));
    const support = readCatalog(join(root, s10ReleasePaths.support));
    const errors = [
        ...validateSchemaVocabulary(schema),
        ...validateAgainstSchema(publications, schema, schema),
    ];
    if (publications.publications.length > 0)
        errors.push("marketplace publication collection must remain empty while S10 is blocked");
    if (
        support.bindings.some(
            (binding) => binding.marketplaceAvailabilityClaim === true,
        )
    )
        errors.push("marketplace availability cannot exist without a live publication record");
    return errors;
}
