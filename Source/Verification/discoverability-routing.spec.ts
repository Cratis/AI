// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const corpus = join(repositoryRoot, '.cratis/ai');
const skill = 'cratis-discoverability';

test('the discoverability skill is reachable from the documentation and content profiles', () => {
    const catalog = JSON.parse(readFileSync(join(corpus, 'profile-catalog.json'), 'utf8')) as {
        publicProfiles: Array<{ id: string; availableTargets?: string[] }>;
    };
    for (const id of ['cratis/documentation', 'cratis/content']) {
        const profile = catalog.publicProfiles.find(candidate => candidate.id === id);
        assert.ok(profile?.availableTargets?.includes(skill), `${id} does not expose ${skill}`);
    }
    assert.ok(existsSync(join(corpus, 'skills', skill, 'SKILL.md')));
});

test('the discoverability rule and prompt route to the installed skill', () => {
    for (const entryPoint of ['rules/discoverability.md', 'prompts/pre-publish-check.prompt.md']) {
        assert.match(readFileSync(join(corpus, entryPoint), 'utf8'), /cratis-discoverability/, entryPoint);
    }
    const rule = readFileSync(join(corpus, 'rules/discoverability.md'), 'utf8');
    assert.ok(rule.trimEnd().split('\n').length <= 40, 'the rule stays within 40 lines');
});

function reminder(path: string, content: string): string {
    const scratch = join(repositoryRoot, '.ai-work/hook-fixtures');
    mkdirSync(scratch, { recursive: true });
    const root = mkdtempSync(join(scratch, 'discoverability-'));
    try {
        const file = join(root, path);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, content);
        const result = spawnSync('bash', [join(corpus, 'hooks/scripts/cratis-pattern-scan.sh')], {
            input: JSON.stringify({ session_id: 'fixture', cwd: root, tool_name: 'Edit', tool_input: { file_path: file } }),
            encoding: 'utf8',
            env: { ...process.env, CLAUDE_PROJECT_DIR: root, TMPDIR: root, CRATIS_HOOKS_PATTERNS: join(corpus, 'hooks/scripts/cratis-patterns.json'), CRATIS_HOOKS_SKIP_SCAN: '' },
        });
        assert.equal(result.status, 0, result.stderr);
        return result.stdout;
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test('discoverability pattern hints are advisory and fire on apex links, empty alt text and GitHub-only project URLs', () => {
    const apex = JSON.parse(reminder('blog/post.md', 'See [the docs](https://cratis.io/chronicle/).\n')).hookSpecificOutput.additionalContext as string;
    assert.match(apex, /https:\/\/www\.cratis\.io/);
    const alt = JSON.parse(reminder('docs/page.md', '![](diagram.png)\n')).hookSpecificOutput.additionalContext as string;
    assert.match(alt, /empty alt text/);
    const url = JSON.parse(reminder('Source/Directory.Build.props', '<PackageProjectUrl>https://github.com/Cratis/Arc</PackageProjectUrl>\n')).hookSpecificOutput.additionalContext as string;
    assert.match(url, /PackageProjectUrl/);
});

test('canonical host links and described images receive no discoverability hint', () => {
    assert.equal(reminder('blog/post.md', 'See [the docs](https://www.cratis.io/chronicle/) and ![A diagram of the flow](flow.png).\n'), '');
});
