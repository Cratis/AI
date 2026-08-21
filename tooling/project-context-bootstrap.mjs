// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const canonicalProjectContextPath = ".cratis/PROJECT.md";
export const legacyProjectContextPath = ".agents/PROJECT.md";

export function resolveProjectContext(repositoryRoot) {
    const canonical = join(repositoryRoot, canonicalProjectContextPath);
    const legacy = join(repositoryRoot, legacyProjectContextPath);
    if (existsSync(canonical)) {
        return {
            state: "canonical",
            relativePath: canonicalProjectContextPath,
            content: readFileSync(canonical, "utf8"),
            legacyAlsoExists: existsSync(legacy),
        };
    }
    if (existsSync(legacy)) {
        return {
            state: "legacy-fallback",
            relativePath: legacyProjectContextPath,
            content: readFileSync(legacy, "utf8"),
            legacyAlsoExists: true,
        };
    }
    return {
        state: "no-context",
        relativePath: undefined,
        content: undefined,
        legacyAlsoExists: false,
    };
}

export function bootstrapContents(projectContextPath) {
    if (
        ![canonicalProjectContextPath, legacyProjectContextPath].includes(
            projectContextPath,
        )
    ) {
        throw new Error(
            `Unsupported project-context path: ${projectContextPath}`,
        );
    }
    return {
        "AGENTS.md": [
            `Read and follow \`${projectContextPath}\` for project-owned context.`,
            "Do not merge it with another project-context file.",
            "",
        ].join("\n"),
        "CLAUDE.md": `@${projectContextPath}\n`,
        "GEMINI.md": `@${projectContextPath}\n`,
    };
}

export function planProjectBootstraps(repositoryRoot) {
    const context = resolveProjectContext(repositoryRoot);
    if (context.state === "no-context") {
        return { context, create: [], existing: [] };
    }
    const templates = bootstrapContents(context.relativePath);
    const create = [];
    const existing = [];
    for (const [path, content] of Object.entries(templates)) {
        const absolutePath = join(repositoryRoot, path);
        if (existsSync(absolutePath)) {
            existing.push({
                path,
                content: readFileSync(absolutePath, "utf8"),
            });
        } else {
            create.push({ path, content });
        }
    }
    return { context, create, existing };
}
