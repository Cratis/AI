// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';

export class ContractError extends Error {}
export const reject = clause => { throw new ContractError(clause); };
const space = code => code === 32 || code === 9 || code === 10 || code === 13;

export function readJson(file) {
    const bytes = readFileSync(file);
    let json;
    try { json = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch (error) { if (error instanceof TypeError) reject('result: invalid UTF-8'); else throw error; }
    let value;
    try { value = JSON.parse(json); }
    catch (error) { if (error instanceof SyntaxError) reject('result: malformed JSON'); else throw error; }
    return { json, value };
}

function stringEnd(json, start) {
    for (let i = start + 1; i < json.length; i++) {
        const code = json.charCodeAt(i);
        if (code === 92) i++;
        else if (code === 34) return i + 1;
    }
    throw new Error('Unterminated string in parsed JSON');
}

function valueEnd(json, start) {
    const first = json.charCodeAt(start);
    if (first === 34) return stringEnd(json, start);
    if (first !== 123 && first !== 91) {
        let end = start;
        while (end < json.length && !space(json.charCodeAt(end)) && ![44, 125, 93].includes(json.charCodeAt(end))) end++;
        return end;
    }
    let depth = 0;
    for (let i = start; i < json.length; i++) {
        const code = json.charCodeAt(i);
        if (code === 34) i = stringEnd(json, i) - 1;
        else if (code === 123 || code === 91) depth++;
        else if ((code === 125 || code === 93) && --depth === 0) return i + 1;
    }
    throw new Error('Unterminated object in parsed JSON');
}

// Linear, non-recursive scanning of already parsed JSON; no regex ever visits a large diff.
export function members(json) {
    const spans = [];
    let i = 0;
    while (space(json.charCodeAt(i))) i++;
    if (json.charCodeAt(i++) !== 123) return spans;
    while (i < json.length) {
        while (space(json.charCodeAt(i)) || json.charCodeAt(i) === 44) i++;
        if (json.charCodeAt(i) === 125) break;
        const end = stringEnd(json, i);
        const key = JSON.parse(json.slice(i, end));
        i = end;
        while (space(json.charCodeAt(i))) i++;
        if (json.charCodeAt(i++) !== 58) throw new Error('Missing colon in parsed JSON');
        while (space(json.charCodeAt(i))) i++;
        const start = i;
        i = valueEnd(json, start);
        spans.push({ key, start, end: i });
    }
    return spans;
}

export function rawMember(json, spans, key) {
    const span = spans.findLast(member => member.key === key);
    return span ? json.slice(span.start, span.end) : '';
}

export function replaceMembers(json, spans, values) {
    let end = 0, output = '';
    for (const span of spans) {
        if (!Object.hasOwn(values, span.key)) continue;
        output += json.slice(end, span.start) + values[span.key];
        end = span.end;
    }
    return output + json.slice(end);
}

export function webStringBytes(value) {
    let bytes = 2;
    for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        if ([8, 9, 10, 12, 13, 92].includes(code)) bytes += 2;
        else if (code < 32 || code >= 127 || [34, 38, 39, 43, 60, 62, 96].includes(code)) bytes += 6;
        else bytes++;
    }
    return bytes;
}

// Conservative Web-default serialization bound, retaining numeric spellings and whitespace.
export function webJsonBytes(json) {
    let bytes = 0;
    for (let i = 0; i < json.length; i++) {
        if (json.charCodeAt(i) === 34) {
            const end = stringEnd(json, i);
            bytes += webStringBytes(JSON.parse(json.slice(i, end)));
            i = end - 1;
        } else bytes++;
    }
    return bytes;
}

export function metadataBytes(json, spans = members(json)) {
    const fields = ['diff', 'sha256', 'structured', 'usage', 'correlation'];
    return 2 + fields.length - 1 + fields.reduce((bytes, key) =>
        bytes + webStringBytes(key) + 1 + webJsonBytes(key === 'diff' ? '""' : rawMember(json, spans, key)), 0);
}
