// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { ContractError, reject, readJson, members, rawMember, metadataBytes } from './result-json.mjs';

const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isGuid = value => typeof value === 'string' && value.length === 36 && guid.test(value);
const keys = ['job', 'session', 'application', 'feature'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const studioCorrelation = value => object(value) && keys.every(key => isGuid(value[key]));

function text(value, clause, limit = Infinity) {
    if (typeof value !== 'string') reject(`${clause}: expected a non-null string`);
    if (value.length > limit) reject(`${clause}: exceeds ${limit} UTF-16 characters`);
}

function list(value, clause, cap) {
    if (!Array.isArray(value)) reject(`${clause}: expected an array`);
    if (value.length > cap) reject(`${clause}: exceeds ${cap} items`);
    value.forEach(item => text(item, `${clause} item`, 8192));
}

function canonical(spans, known, scope) {
    const seen = new Set();
    for (const { key } of spans) {
        const expected = known.find(name => name.toLowerCase() === key.toLowerCase());
        if (!expected) continue;
        if (key !== expected) reject(`${scope}.${key}: case-variant alias of ${expected}`);
        if (seen.has(key)) reject(`${scope}.${key}: duplicate property`);
        seen.add(key);
    }
}

function check(result, json, expected) {
    if (!object(result)) reject('result: expected an object');
    const spans = members(json);
    canonical(spans, ['diff', 'sha256', 'structured', 'usage', 'correlation'], 'result');
    text(result.diff, 'diff');
    text(result.sha256, 'sha256');
    if (!object(result.structured)) reject('structured: expected an object');
    const structured = result.structured;
    canonical(members(rawMember(json, spans, 'structured')), ['outcome', 'summary', 'touchedFiles', 'gaps', 'selfChecks'], 'structured');
    if (!['Completed', 'NoChanges', 'Refused', 'Cancelled'].includes(structured.outcome)) reject('structured.outcome: unsupported outcome');
    text(structured.summary, 'structured.summary', 8192);
    list(structured.touchedFiles, 'structured.touchedFiles', 10000);
    list(structured.gaps, 'structured.gaps', 1000);
    list(structured.selfChecks, 'structured.selfChecks', 1000);
    if (!object(result.usage)) reject('usage: expected an object');
    if (rawMember(json, spans, 'usage').length > 8192) reject('usage: raw JSON exceeds 8192 characters');
    if (!object(result.correlation)) reject('correlation: expected an object');
    // Opaque correlation is permitted only with an explicit non-Studio launch context.
    if (expected === undefined || studioCorrelation(expected)) {
        for (const key of keys) {
            if (!isGuid(result.correlation[key])) reject(`correlation.${key}: expected a GUID string`);
            if (expected && result.correlation[key].toLowerCase() !== expected[key].toLowerCase()) reject(`correlation.${key}: differs from launch`);
        }
    }
    if (metadataBytes(json, spans) > 65536) reject('metadata without diff: exceeds 65536 UTF-8 bytes (Web escaping bound)');
}

try {
    let file, correlationFile;
    const args = process.argv.slice(2);
    while (args.length) {
        const arg = args.shift();
        if (arg === '--correlation' && args.length) correlationFile = args.shift();
        else if (!arg.startsWith('-') && !file) file = arg;
        else throw new Error('Usage: node check-result.mjs [--correlation launch.json] result.json');
    }
    if (!file) throw new Error('A result file is required');
    const { json, value } = readJson(file);
    let expected;
    if (correlationFile) {
        try { expected = JSON.parse(readFileSync(correlationFile, 'utf8')); }
        catch (error) { if (error instanceof SyntaxError) expected = {}; else throw error; }
    }
    check(value, json, expected);
    console.log('Checked 1 result');
} catch (error) {
    console.error(error.message);
    process.exitCode = error instanceof ContractError ? 1 : 2;
}
