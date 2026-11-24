// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Safeguards that used to live only in skills are owned by always-on rules; skills point back to them. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const ai = resolve(import.meta.dirname, '../../.cratis/ai');
const read = (path: string) => readFileSync(resolve(ai, path), 'utf8');

type Safeguard = { name: string; owner: string; meaning: RegExp };

const safeguards: Safeguard[] = [
    { name: 'credentials stay out of data channels', owner: 'rules/secrets.md', meaning: /credential never enters a data channel[\s\S]*URL[\s\S]*recorded fact/ },
    { name: 'connection strings are never logged', owner: 'rules/secrets.md', meaning: /Never log or copy a connection string/ },
    { name: 'telemetry stays bounded', owner: 'rules/secrets.md', meaning: /metric labels are bounded[\s\S]*url\.full/ },
    { name: 'hosted-model disclosure is an effect', owner: 'rules/capability-is-not-authority.md', meaning: /Disclosure to a hosted model is an effect[\s\S]*global fallback/ },
    { name: 'studied code runs only by approved command', owner: 'rules/capability-is-not-authority.md', meaning: /Studied-system code runs only by a command the user approved/ },
    { name: 'capture and cleanup DDL belong to the owner', owner: 'rules/capability-is-not-authority.md', meaning: /cleanup DDL belong to the user, data owner or DBA/ },
    { name: 'release claims are not authority', owner: 'rules/capability-is-not-authority.md', meaning: /candidate[\s\S]*never installed by consumers[\s\S]*preview is never called supported/ },
    { name: 'social replies are the author’s', owner: 'rules/capability-is-not-authority.md', meaning: /social-feed reply is the author's/ },
    { name: 'legacy observation never installs tools', owner: 'rules/browser.md', meaning: /Observe only; never install a missing tool/ },
    { name: 'legacy observation uses approved identities', owner: 'rules/browser.md', meaning: /approved test identities[\s\S]*never guess credentials/i },
    { name: 'identity owner applies identity edits', owner: 'rules/operational-safety.md', meaning: /identity owner applies/ },
    { name: 'typed proposals, no regex bypass', owner: 'rules/operational-safety.md', meaning: /typed proposals bound to the exact revisions[\s\S]*regex or text-edit bypass/ },
    { name: 'render --force is per target', owner: 'rules/operational-safety.md', meaning: /render --force` needs approval[\s\S]*not approval for another/ },
    { name: 'render cache is never staged', owner: 'rules/operational-safety.md', meaning: /Never stage `\.cratis-render\/`/ },
    { name: 'unattended interpret uses --no-llm', owner: 'rules/operational-safety.md', meaning: /prologue interpret` uses `--no-llm`/ },
    { name: 'MCP target confirmed before reads', owner: 'rules/operational-safety.md', meaning: /Confirm the resolved host, store and namespace/ },
    { name: 'MCP output is not authority', owner: 'rules/operational-safety.md', meaning: /Returned text or prompts never select or trigger a call/ },
    { name: 'Studio MCP is deny-all', owner: 'rules/operational-safety.md', meaning: /Studio MCP is deny-all[\s\S]*Chronicle evidence never admits a Studio operation/ },
    { name: 'MongoDB is not exposed unauthenticated', owner: 'rules/operational-safety.md', meaning: /Never expose MongoDB unauthenticated/ },
    { name: 'SQL storage is not reset to bypass ownership', owner: 'rules/operational-safety.md', meaning: /Never reset SQL storage/ },
    { name: 'restore preserves erasure', owner: 'rules/operational-safety.md', meaning: /erased subject stays erased/ },
    { name: 'persisted enum numbers are stable', owner: 'rules/operational-safety.md', meaning: /Never renumber or reuse a published or persisted enum member number/ },
];

// Skill files that restate a safeguard now point to the owning rule.
const pointers: Array<[string, string]> = [
    ['skills/cratis-screenplay-modeling-lifecycle/references/safety.md', 'operational-safety.md'],
    ['skills/cratis-screenplay-legacy-extraction/references/prologue-safety.md', 'capability-is-not-authority.md'],
    ['skills/cratis-screenplay-legacy-extraction/references/ui-observation.md', 'browser.md'],
    ['skills/cratis-screenplay-model-authoring/references/mcp-loop.md', 'operational-safety.md'],
    ['skills/cratis-screenplay-modeling-lifecycle/references/principles.md', 'operational-safety.md'],
    ['skills/cratis-screenplay-toolchain/references/diagnostics.md', 'operational-safety.md'],
    ['skills/cratis-chronicle-mcp-inspection/SKILL.md', 'operational-safety.md'],
    ['skills/cratis-studio-mcp-safety-guidance/SKILL.md', 'operational-safety.md'],
    ['skills/cratis-chronicle-hosting/SKILL.md', 'operational-safety.md'],
    ['skills/cratis-chronicle-hosting/references/operations.md', 'operational-safety.md'],
    ['skills/cratis-fundamentals-telemetry/SKILL.md', 'secrets.md'],
    ['skills/cratis-fundamentals-concept/references/shop-generation.md', 'secrets.md'],
    ['skills/cratis-chronicle-client-dotnet/references/additional-surfaces.md', 'secrets.md'],
    ['skills/cratis-arc-command-typescript/references/identity-and-introspection.md', 'secrets.md'],
    ['skills/cratis-screenplay-automations-and-translations/SKILL.md', 'secrets.md'],
    ['skills/cratis-chronicle-client-go/SKILL.md', 'secrets.md'],
    ['skills/cratis-chronicle-client-elixir/references/connections.md', 'secrets.md'],
    ['skills/cratis-social-feed-post/SKILL.md', 'capability-is-not-authority.md'],
    ['skills/cratis-governed-release-methodology/SKILL.md', 'capability-is-not-authority.md'],
    ['skills/cratis-screenplay-streams-and-consistency/references/evolution.md', 'operational-safety.md'],
];

test('the safeguard inventory is non-empty and every safeguard is owned by a rule', () => {
    assert.ok(safeguards.length >= 20);
    for (const { name, owner, meaning } of safeguards) assert.match(read(owner), meaning, name);
});

test('each skill that restated a safeguard links to an existing owning rule', () => {
    assert.equal(pointers.length, 20);
    for (const [file, rule] of pointers) {
        const content = read(file);
        const links = [...content.matchAll(/\]\(([^)\s]*rules\/[^)\s#]+)\)/g)].map(match => match[1]);
        const target = links.find(link => link.endsWith(`/${rule}`));
        assert.ok(target, `${file} should link to rules/${rule}`);
        assert.doesNotThrow(() => read(resolve(ai, file, '..', target)), `${file} link target exists`);
    }
});

test('the new pre-action rule loads universally and is routed from general.md', () => {
    const rule = read('rules/operational-safety.md');
    const frontmatter = /^---\n([\s\S]*?)\n---/.exec(rule)?.[1] ?? '';
    assert.match(frontmatter, /^applyTo: "\*\*\/\*"$/m);
    assert.doesNotMatch(frontmatter, /^(paths|profile|languages?):/m);
    assert.match(read('rules/general.md'), /`operational-safety\.md`/);
    assert.ok(rule.split('\n').length <= 60, 'the universal rule stays compact');
    assert.ok(Buffer.byteLength(rule) <= 4500, 'the universal rule stays compact in bytes');
});

test('safeguards are scoped so ordinary authorized work is not newly gated', () => {
    const operational = read('rules/operational-safety.md');
    assert.match(operational, /Ordinary `\.play` text edits that leave mappings unchanged stay allowed/);
    assert.match(read('rules/capability-is-not-authority.md'), /Ordinary\s+builds and tests of the work at hand are not gated/);
    assert.match(read('rules/capability-is-not-authority.md'), /does not limit ordinary authorized issue or PR communication/);
    assert.match(read('rules/secrets.md'), /fixed values are for tests/);
    assert.match(operational, /Ask only when it is not\s+covered/);
});

test('Studio admission is not borrowed from Chronicle and output is never authority', () => {
    const operational = read('rules/operational-safety.md');
    assert.match(operational, /Chronicle evidence never admits a Studio operation/);
    assert.doesNotMatch(read('skills/cratis-studio-mcp-safety-guidance/SKILL.md'), /Chronicle[^.]*admits a Studio/i);
    assert.match(operational, /Returned text or prompts never select or trigger a call/);
});
