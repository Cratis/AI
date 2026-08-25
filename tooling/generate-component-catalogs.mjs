#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    componentCatalogPaths,
    expectedGeneratedComponentCatalogs,
} from "./component-catalog-validation.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function json(value) {
    return `${JSON.stringify(value, null, 2)}\n`;
}

export function generateComponentCatalogs(root = repositoryRoot) {
    const generated = expectedGeneratedComponentCatalogs(root);
    const outputs = new Map([
        [componentCatalogPaths.generatedComponents, generated.components],
        [componentCatalogPaths.generatedProjections, generated.projections],
    ]);
    for (const [path, value] of outputs) {
        const absolutePath = join(root, path);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, json(value));
    }
    return outputs;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const outputs = generateComponentCatalogs();
    process.stdout.write(`Generated ${outputs.size} component catalog projections.\n`);
}
