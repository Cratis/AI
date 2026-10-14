#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
# The published sample and planted violations exercise every transport clause, without a service.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/scratch.sh
source "$HERE/lib/scratch.sh"
scratch_create result-contract
node --input-type=module - "$HERE/../contracts" "$SCRATCH_ROOT" <<'NODE'
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const [contracts, root] = process.argv.slice(2);
const schema = JSON.parse(readFileSync(`${contracts}/agent-worker-result.schema.json`, 'utf8'));
assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
const sample = JSON.parse(readFileSync(`${contracts}/agent-worker-result.sample.json`, 'utf8'));
const checker = `${contracts}/check-result.mjs`;
const file = `${root}/result.json`;
let cases = 0;
function run(json, status, clause = '', args = []) {
    writeFileSync(file, json);
    const result = spawnSync(process.execPath, [checker, ...args, file], { encoding: 'utf8' });
    assert.equal(result.status, status, result.stderr);
    assert.ok(result.stderr.includes(clause), result.stderr);
    cases++;
}
function invalid(change, clause) {
    const result = structuredClone(sample);
    change(result);
    run(JSON.stringify(result), 1, clause);
}
run(JSON.stringify(sample), 0);
run('not json', 1, 'malformed JSON');
run('[]', 1, 'result:');
run(Buffer.from([0xff]), 1, 'invalid UTF-8');
run(JSON.stringify({ ...sample, diff: 'x'.repeat(9.5 * 1024 * 1024) }), 0);
invalid(result => { result.structured.Summary = 42; }, 'structured.Summary: case-variant alias');
invalid(result => { result.Structured = {}; }, 'result.Structured: case-variant alias');
for (const key of ['diff', 'sha256', 'structured', 'usage', 'correlation']) {
    invalid(result => { delete result[key]; }, key);
    invalid(result => { result[key] = null; }, key);
    invalid(result => { result[key] = 42; }, key);
}
for (const key of ['outcome', 'summary', 'touchedFiles', 'gaps', 'selfChecks']) {
    invalid(result => { delete result.structured[key]; }, `structured.${key}`);
    invalid(result => { result.structured[key] = null; }, `structured.${key}`);
}
invalid(result => { result.structured.outcome = 'Failed'; }, 'structured.outcome');
for (const outcome of ['Completed', 'NoChanges', 'Refused', 'Cancelled']) {
    run(JSON.stringify({ ...sample, structured: { ...sample.structured, outcome } }), 0);
}
invalid(result => { result.structured.summary = 42; }, 'structured.summary');
invalid(result => { result.structured.summary = 'x'.repeat(8193); }, 'structured.summary');
invalid(result => { result.structured.summary = '😀'.repeat(4097); }, 'structured.summary');
for (const [key, cap] of [['touchedFiles', 10000], ['gaps', 1000], ['selfChecks', 1000]]) {
    invalid(result => { result.structured[key] = {}; }, `structured.${key}`);
    invalid(result => { result.structured[key] = Array(cap + 1).fill(''); }, `structured.${key}`);
    for (const value of [null, 42, {}, 'x'.repeat(8193)]) {
        invalid(result => { result.structured[key] = [value]; }, `structured.${key} item`);
    }
    run(JSON.stringify({ ...sample, structured: { ...sample.structured, [key]: Array(cap).fill('') } }), 0);
}
invalid(result => { result.usage = []; }, 'usage:');
invalid(result => { result.usage = { long: 'x'.repeat(8192) }; }, 'usage: raw JSON');
run(JSON.stringify({ ...sample, usage: {} }).replace('"usage":{}', '"usage":{' + ' '.repeat(8192) + '}'), 1, 'usage: raw JSON');
run(JSON.stringify({ ...sample, usage: { escaped: 'x'.repeat(1400) } }).replace(/x/g, '\\u0078'), 1, 'usage: raw JSON');
run(JSON.stringify(sample).replace('"usage":{', '"usage":{},"usage":{' + ' '.repeat(8192)), 1, 'result.usage: duplicate property');
run(JSON.stringify(sample).replace('"correlation":{', '"correlation":{"extra":' + '1'.repeat(65536) + ','), 1, 'metadata without diff');
invalid(result => { result.structured.gaps = Array(1000).fill('x'.repeat(100)); }, 'metadata without diff');
// UTF-8 alone fits, but Web-default escaping would exceed Studio's metadata budget.
invalid(result => { result.structured.summary = 'é'.repeat(8192); result.structured.gaps = ['é'.repeat(8192)]; }, 'metadata without diff');
for (const key of ['job', 'session', 'application', 'feature']) {
    for (const value of [undefined, null, 42, 'not-a-guid', sample.correlation[key] + '\n']) {
        invalid(result => { result.correlation[key] = value; }, `correlation.${key}`);
    }
}
const launch = `${root}/launch.json`;
writeFileSync(launch, JSON.stringify(sample.correlation));
run(JSON.stringify(sample), 0, '', ['--correlation', launch]);
for (const key of ['job', 'session', 'application', 'feature']) {
    const result = structuredClone(sample);
    result.correlation[key] = '00000000-0000-0000-0000-000000000000';
    run(JSON.stringify(result), 1, `correlation.${key}: differs from launch`, ['--correlation', launch]);
}
writeFileSync(launch, '{}');
run(JSON.stringify({ ...sample, correlation: {} }), 0, '', ['--correlation', launch]);
run(JSON.stringify({ ...sample, correlation: {} }), 1, 'correlation.job');
// File/usage failures are distinguishable from invalid payloads.
const missing = spawnSync(process.execPath, [checker, `${root}/missing.json`], { encoding: 'utf8' });
assert.equal(missing.status, 2);
const usage = spawnSync(process.execPath, [checker, '--unknown'], { encoding: 'utf8' });
assert.equal(usage.status, 2);
const crashFile = `${root}/crash.mjs`;
writeFileSync(crashFile, 'JSON.parse = () => { throw new RangeError("planted internal crash"); };');
const crash = spawnSync(process.execPath, ['--import', crashFile, checker, file], { encoding: 'utf8' });
assert.equal(crash.status, 2, crash.stderr);
assert.ok(crash.stderr.includes('planted internal crash'));
// Budget fitting must splice only advisory fields, preserving even numbers JS cannot represent.
const { members, rawMember, metadataBytes } = await import(`${contracts}/result-json.mjs`);
const opaque = '{"large":9007199254740993,"decimal":1.50,"exponent":1e3,"9":"nine","2":"two"}';
const verbose = { ...sample, structured: { ...sample.structured, selfChecks: Array(100).fill('x'.repeat(1000)) } };
const original = JSON.stringify(verbose).replace('"usage":' + JSON.stringify(sample.usage), '"usage":' + opaque)
    .replace('"correlation":' + JSON.stringify(sample.correlation), '"correlation":' + opaque);
writeFileSync(file, original);
const fitted = spawnSync(process.execPath, [`${contracts}/fit-result.mjs`, file], { encoding: 'utf8' });
assert.equal(fitted.status, 0, fitted.stderr);
const fittedJson = readFileSync(file, 'utf8');
for (const key of ['diff', 'sha256', 'usage', 'correlation']) {
    assert.equal(rawMember(fittedJson, members(fittedJson), key), rawMember(original, members(original), key));
}
assert.ok(metadataBytes(fittedJson) <= 65536);
const checks = JSON.parse(fittedJson).structured.selfChecks;
assert.ok(checks.length < 100);
assert.equal(checks.at(-1), `[${101 - checks.length} trailing selfChecks items dropped to fit metadata]`);
run(fittedJson, 0, '', ['--correlation', launch]);
assert.equal(readFileSync(file, 'utf8'), fittedJson, 'checker must not rewrite the payload');
console.log(`Passed ${cases + 4} result-contract cases`);
NODE
