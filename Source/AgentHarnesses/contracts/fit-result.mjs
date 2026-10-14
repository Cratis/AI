// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { writeFileSync } from 'node:fs';
import { ContractError, reject, readJson, members, rawMember, replaceMembers,
    metadataBytes, webJsonBytes, webStringBytes } from './result-json.mjs';

function listBudget(items, key) {
    const prefix = [0];
    for (const item of items) prefix.push(prefix.at(-1) + webStringBytes(item));
    let retained = items.length;
    const marker = () => `[${items.length - retained} trailing ${key} items dropped to fit metadata]`;
    return {
        lastBytes: () => retained ? webStringBytes(items[retained - 1]) : -1,
        drop: () => { retained--; },
        remaining: () => retained,
        bytes: () => prefix[retained] + (retained === items.length ? Math.max(0, retained - 1) : retained + webStringBytes(marker())),
        value: () => retained === items.length ? items : [...items.slice(0, retained), marker()]
    };
}

function prefix(value, units) {
    let end = units;
    const code = value.charCodeAt(end - 1);
    if (code >= 0xd800 && code <= 0xdbff) end--;
    return value.slice(0, end) + '…';
}

try {
    if (process.argv.length !== 3) throw new Error('Usage: node fit-result.mjs result.json');
    const file = process.argv[2];
    const { json, value } = readJson(file);
    if (value.structured.touchedFiles.length > 10000) reject('structured.touchedFiles: exceeds 10000 items');
    const root = members(json);
    if (metadataBytes(json, root) <= 65536) process.exit(0);
    const structured = rawMember(json, root, 'structured');
    const spans = members(structured);
    const empty = replaceMembers(structured, spans, { summary: '""', gaps: '[]', selfChecks: '[]' });
    const ownedBytes = metadataBytes(json, root) - webJsonBytes(structured) + webJsonBytes(empty);
    if (ownedBytes > 65536) reject('metadata without diff: harness-owned fields and touchedFiles exceed 65536 UTF-8 bytes');
    const gaps = listBudget(value.structured.gaps, 'gaps');
    const checks = listBudget(value.structured.selfChecks, 'selfChecks');
    let summary = value.structured.summary;
    const bytes = () => ownedBytes + webStringBytes(summary) - 2 + gaps.bytes() + checks.bytes();
    while (bytes() > 65536 && (gaps.remaining() || checks.remaining())) {
        (gaps.lastBytes() >= checks.lastBytes() ? gaps : checks).drop();
    }
    if (bytes() > 65536) {
        let low = 0, high = summary.length;
        const original = summary;
        summary = '';
        if (bytes() > 65536) reject('metadata without diff: harness-owned fields, touchedFiles and required drop markers exceed 65536 UTF-8 bytes');
        while (low < high) {
            const mid = Math.ceil((low + high) / 2);
            summary = prefix(original, mid);
            if (bytes() <= 65536) low = mid; else high = mid - 1;
        }
        summary = low ? prefix(original, low) : '';
    }
    const fitted = replaceMembers(structured, spans, {
        summary: JSON.stringify(summary), gaps: JSON.stringify(gaps.value()), selfChecks: JSON.stringify(checks.value())
    });
    const result = replaceMembers(json, root, { structured: fitted });
    if (metadataBytes(result) > 65536) throw new Error('Metadata fitting calculation did not match the emitted result');
    // Only the three advisory fields are changed; every other byte, including opaque JSON
    // numeric literals, member order, usage and the original diff escapes, is untouched.
    writeFileSync(file, result);
} catch (error) {
    console.error(error.message);
    process.exitCode = error instanceof ContractError ? 1 : 2;
}
