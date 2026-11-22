// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const skills = '.cratis/ai/skills';
const toolchain = `${skills}/cratis-screenplay-toolchain`;
const read = (path: string) => readFileSync(resolve(root, path), 'utf8').replace(/\s+/g, ' ');
const exposure = () => read(`${toolchain}/references/agent-exposure.md`);
const manifest = () => read(`${toolchain}/references/capability-manifest.md`);
const review = () => read(`${skills}/cratis-screenplay-model-review/references/baseline-comparison.md`);

for (const name of ['toolchain', 'command-surface', 'read-surface', 'model-review']) {
    test(`${name} routes agent exposure to the toolchain owner`, () => {
        assert.match(read(`${skills}/cratis-screenplay-${name}/SKILL.md`), /references\/agent-exposure\.md/);
    });

    test(`${name} evaluates explicit exposure rather than inferring agent access`, () => {
        const inputs = read(`Evaluations/skills/cratis-screenplay-${name}/evals.json`);
        assert.match(inputs, /agents/);
        assert.match(inputs, /authorization/);
        assert.match(read(`Evaluations/skills/cratis-screenplay-${name}/trigger.json`), /agent/i);
    });
}

test('agent exposure has a product prerequisite separate from ESM and manifest versions', () => {
    assert.match(exposure(), /Requires Screenplay 6\.15\.0/);
    assert.match(exposure(), /screenplay --version/);
    assert.match(exposure(), /ESM v48/);
    assert.match(exposure(), /older.*upgrade or stop/i);
    assert.match(manifest(), /screenplay-capability-manifest\/1/);
});

test('the allowlist is root-level, explicit and independent of operation authorization', () => {
    const content = exposure();
    assert.match(content, /default.deny/i);
    assert.match(content, /tokens personal/);
    assert.match(content, /scope read/);
    assert.match(content, /scope write/);
    assert.match(content, /description "List invoices"/);
    assert.match(content, /read.*or.*write.*query/i);
    assert.match(content, /commands.*write/i);
    assert.match(content, /module.*feature.*authorization/i);
    assert.match(content, /absent.*NoAgentsBlock/);
    assert.match(content, /empty.*PLAY0977/);
});

test('refusal guidance distinguishes approval syntax, warnings and reserved diagnostics', () => {
    const content = exposure();
    assert.match(content, /`approval required`.*PLAY0974/);
    assert.match(content, /`approve`.*PLAY0964/);
    assert.match(content, /PLAY0978.*PLAY0979.*reserved/i);
    assert.match(content, /PLAY0980.*warning/i);
    assert.match(content, /PLAY0981.*error/i);
    assert.match(content, /PLAY0982.*error/i);
    assert.match(content, /warnings.as.errors.*manifest emission/i);
});

test('manifest export teaches whole-model refusal and stale-target handling', () => {
    const content = manifest();
    assert.match(content, /screenplay export <model-folder> --format capability-manifest --output capabilities\.json/);
    for (const refusal of ['CompilationErrors', 'NoAgentsBlock', 'DescriptionTooLong']) assert.ok(content.includes(refusal));
    assert.match(content, /1024 Unicode code points/);
    assert.match(content, /never truncate/i);
    assert.match(content, /exit 1/);
    assert.match(content, /exit 2/);
    assert.match(content, /Never use a stale target after any failure/);
    assert.match(content, /capability-manifest-v1\.schema\.json/);
    assert.match(content, /capability-manifest-v1\.example\.play/);
    assert.match(content, /capability-manifest-v1\.example\.json/);
});

test('MCP manifest reads use native discovery, pinned revisions and byte pages', () => {
    const content = manifest();
    assert.match(content, /native.*name.*connected.*tool listing/i);
    assert.match(content, /`screenplay`.*`read-workspace`/);
    for (const field of ['expectedRevision', 'expectedModelRevision', 'bytesBase64', 'nextOffset', 'available', 'executable-diagnostics', 'StaleRevision']) assert.ok(content.includes(field), field);
    assert.match(content, /decode.*concatenate.*order/i);
    assert.match(content, /48 KiB.*192 KiB/);
    assert.match(content, /not a CLI.*exit code/);
});

test('consumers must validate nested identity, duplicate keys and authorization fail closed', () => {
    const content = manifest();
    assert.match(content, /Sales\.Invoices\.History\.Listing\.All/);
    assert.match(content, /"features": \["Invoices", "History"\]/);
    assert.match(content, /outermost.*innermost/);
    assert.match(content, /duplicate.*different metadata/);
    assert.match(content, /zero.*multiple.*kind mismatch/);
    assert.match(content, /unknown contract.*unknown properties/);
    assert.match(content, /never.*expose.all/i);
    assert.match(content, /untrusted text/);
    assert.match(content, /not prompt.injection protection/);
    assert.match(content, /approvalRequired.*false.*authorization/);
    assert.match(content, /capability-is-not-authority\.md/);
    assert.match(content, /not.*Arc configuration.*runtime/i);
});

test('manual exposure review cannot turn incomplete comparison into a safety verdict', () => {
    const content = review();
    assert.match(content, /manual/i);
    assert.match(content, /identity.*kind/);
    assert.match(content, /write.*read/);
    assert.match(content, /signature.*contract.*inherited.authorization/i);
    assert.match(content, /complete before.*after models/);
    assert.match(content, /unchanged manifest.*cannot prove/i);
    assert.match(content, /compilation.*unresolved/i);
    assert.match(content, /not.*safe.*unchanged/i);
    assert.match(content, /automatic exposure comparison.*not.*shipped/i);
    assert.match(content, /semantic-diff.*not.*agent.exposure verdict/i);
});
