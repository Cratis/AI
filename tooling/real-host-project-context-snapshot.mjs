// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import {
    lstatSync,
    readFileSync,
    readdirSync,
    readlinkSync,
    realpathSync,
} from "node:fs";
import { join, relative, sep } from "node:path";
import { compareOrdinal } from "./catalog-ordering.mjs";

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

export function snapshotProjectContext(root) {
    const rootReal = realpathSync(root);
    const rootStat = lstatSync(rootReal);
    const entries = [
        {
            path: ".",
            kind: "directory",
            mode: rootStat.mode & 0o7777,
        },
    ];
    const visit = (current) => {
        for (const name of readdirSync(current).sort(compareOrdinal)) {
            if (current === rootReal && name === ".git") continue;
            const absolute = join(current, name);
            const path = relative(rootReal, absolute).split(sep).join("/");
            const stat = lstatSync(absolute);
            const mode = stat.mode & 0o7777;
            if (stat.isSymbolicLink())
                entries.push({
                    path,
                    kind: "symlink",
                    mode,
                    target: readlinkSync(absolute),
                });
            else if (stat.isDirectory()) {
                entries.push({ path, kind: "directory", mode });
                visit(absolute);
            } else if (stat.isFile()) {
                const content = readFileSync(absolute);
                entries.push({
                    path,
                    kind: "file",
                    mode,
                    size: content.length,
                    sha256: sha256(content),
                });
            } else
                entries.push({ path, kind: "special", mode });
        }
    };
    visit(rootReal);
    const canonical = `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
    return Object.freeze({
        schemaVersion: "1.0.0",
        entries: Object.freeze(entries.map((entry) => Object.freeze(entry))),
        entryCount: entries.length,
        digest: sha256(canonical),
    });
}
