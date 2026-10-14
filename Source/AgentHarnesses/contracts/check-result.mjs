// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync, writeFileSync } from 'node:fs';

const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isGuid = value => typeof value === 'string' && value.length === 36 && guid.test(value);
const keys = ['job', 'session', 'application', 'feature'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const studioCorrelation = value => object(value) && keys.every(key => isGuid(value[key]));
const reject = clause => { throw new RangeError(clause); };

function text(value, clause, limit = Infinity) {
    if (typeof value !== 'string') reject(`${clause}: expected a non-null string`);
    // Studio's string.Length counts UTF-16 units, not Unicode code points.
    if (value.length > limit) reject(`${clause}: exceeds ${limit} UTF-16 characters`);
}

function list(value, clause, cap) {
    if (!Array.isArray(value)) reject(`${clause}: expected an array`);
    if (value.length > cap) reject(`${clause}: exceeds ${cap} items`);
    value.forEach(item => text(item, `${clause} item`, 8192));
}

function truncate(value) {
    if (value.length <= 8192) return value;
    let end = 8191;
    if (/[\uD800-\uDBFF]/.test(value[end - 1])) end--;
    return value.slice(0, end) + '…';
}

function normalize(result) {
    if (!object(result?.structured)) return;
    const structured = result.structured;
    if (typeof structured.summary === 'string') structured.summary = truncate(structured.summary);
    for (const key of ['gaps', 'selfChecks']) {
        if (!Array.isArray(structured[key])) continue;
        structured[key] = structured[key].filter(item => item !== null).slice(0, 1000)
            .map(item => truncate(typeof item === 'string' ? item : JSON.stringify(item)));
    }
}

// Keep the original usage token: JSON.stringify would hide over-limit whitespace or escapes.
// JSON.parse has already checked the syntax; token depth isolates top-level member values.
function rawMember(json, name) {
    const tokens = json.matchAll(/"(?:[^"\\]|\\.)*"|[{}\[\],:]|[^\s{}\[\],:]+/g);
    let depth = 0, key, start, raw = '';
    for (const token of tokens) {
        const value = token[0];
        if (depth === 1 && (value === ',' || value === '}')) {
            if (key === name && start !== undefined) raw = json.slice(start, token.index).trim();
            start = undefined;
        }
        if (depth === 1 && start === undefined && value.startsWith('"')) key = JSON.parse(value);
        if (depth === 1 && value === ':') start = token.index + 1;
        if (value === '{' || value === '[') depth++;
        if (value === '}' || value === ']') depth--;
    }
    return raw;
}

// A conservative byte bound for Studio's Web-default serializer: non-ASCII and HTML-sensitive
// string characters are escaped there even when the worker sends them as literal UTF-8.
function metadataBytes(result, json) {
    const metadata = JSON.stringify({ diff: '', sha256: result.sha256, structured: result.structured });
    // Retain numeric spellings and internal whitespace in JsonElement values as a safe upper
    // bound too: parsing through JavaScript numbers could shorten a very large JSON number.
    const wire = metadata.slice(0, -1) + ',"usage":' + rawMember(json, 'usage') +
        ',"correlation":' + rawMember(json, 'correlation') + '}';
    const encoded = wire.replace(/"(?:[^"\\]|\\.)*"/g, token => {
        const content = JSON.stringify(JSON.parse(token)).slice(1, -1);
        return '"' + content.replace(/[\u007f-\uffff<>&'+`]|\\"/g, value => {
            const code = value === '\\"' ? 34 : value.charCodeAt(0);
            return '\\u' + code.toString(16).padStart(4, '0');
        }) + '"';
    });
    return Buffer.byteLength(encoded, 'utf8');
}

function check(result, json, expected) {
    if (!object(result)) reject('result: expected an object');
    text(result.diff, 'diff');
    text(result.sha256, 'sha256');
    if (!object(result.structured)) reject('structured: expected an object');
    const structured = result.structured;
    if (!['Completed', 'NoChanges', 'Refused', 'Cancelled'].includes(structured.outcome)) reject('structured.outcome: unsupported outcome');
    text(structured.summary, 'structured.summary', 8192);
    list(structured.touchedFiles, 'structured.touchedFiles', 10000);
    list(structured.gaps, 'structured.gaps', 1000);
    list(structured.selfChecks, 'structured.selfChecks', 1000);
    if (!object(result.usage)) reject('usage: expected an object');
    if (rawMember(json, 'usage').length > 8192) reject('usage: raw JSON exceeds 8192 characters');
    if (!object(result.correlation)) reject('correlation: expected an object');
    // Without an expected launch, standalone checks require Studio's four GUIDs. Legacy callers
    // may supply opaque correlation; only that explicit launch context relaxes the GUID clause.
    if (expected === undefined || studioCorrelation(expected)) {
        for (const key of keys) {
            if (!isGuid(result.correlation[key])) reject(`correlation.${key}: expected a GUID string`);
            if (expected && result.correlation[key].toLowerCase() !== expected[key].toLowerCase()) reject(`correlation.${key}: differs from launch`);
        }
    }
    if (metadataBytes(result, json) > 65536) reject('metadata without diff: exceeds 65536 UTF-8 bytes (Web escaping bound)');
}

let file, correlationFile, shouldNormalize = false;
try {
    const args = process.argv.slice(2);
    while (args.length) {
        const arg = args.shift();
        if (arg === '--normalize') shouldNormalize = true;
        else if (arg === '--correlation' && args.length) correlationFile = args.shift();
        else if (!arg.startsWith('-') && !file) file = arg;
        else throw new Error('Usage: node check-result.mjs [--normalize] [--correlation launch.json] result.json');
    }
    if (!file) throw new Error('A result file is required');
    const bytes = readFileSync(file);
    let json;
    try { json = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { reject('result: invalid UTF-8'); }
    let result;
    try { result = JSON.parse(json); } catch { reject('result: malformed JSON'); }
    let expected;
    if (correlationFile) {
        try { expected = JSON.parse(readFileSync(correlationFile, 'utf8')); }
        catch (error) { if (error instanceof SyntaxError) expected = {}; else throw error; }
    }
    if (shouldNormalize) {
        normalize(result);
        json = JSON.stringify(result);
    }
    check(result, json, expected);
    if (shouldNormalize) writeFileSync(file, json + '\n');
    console.log('Checked 1 result');
} catch (error) {
    console.error(error.message);
    process.exitCode = error instanceof RangeError ? 1 : 2;
}
