// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { rulesForPath, universalRules } from '../../.cratis/ai/harnesses/pi/extensions/shared/rules.ts';
import { frontmatter } from '../../.cratis/ai/harnesses/pi/extensions/shared/frontmatter.ts';
import { lineCount, skillStructureProblems } from './skill-structure.ts';
import { evaluationProblems } from './skill-evaluations.ts';
import { skillHygieneFindings } from './skill-hygiene.ts';

const corpus = resolve(import.meta.dirname, '../../.cratis/ai');
const scoped = ['code-quality.md', 'glossary.md', 'framework.md'];
const skills = ['cratis-commits-and-pull-requests', 'cratis-rtk'];

function workspace(managed: boolean): string {
    const project = mkdtempSync(join(tmpdir(), 'rule-scoping-'));
    mkdirSync(join(project, '.cratis/ai'), { recursive: true });
    if (managed) cpSync(join(corpus, 'rules'), join(project, '.cratis/ai/rules'), { recursive: true });
    writeFileSync(join(project, '.cratis/ai.json'), JSON.stringify({ profiles: ['cratis/engineering/csharp', 'cratis/documentation'], languages: ['csharp'] }));
    return project;
}

test('file concerns are scoped in both harness fields and still reach matching Pi paths', () => {
    for (const managed of [false, true]) {
        const project = workspace(managed);
        try {
            const universal = universalRules(project).map(rule => rule.name);
            for (const name of scoped) {
                const fields = frontmatter(readFileSync(join(corpus, 'rules', name), 'utf8'));
                assert.ok(fields.get('paths')?.length, `${name} has Claude paths`);
                assert.ok(!fields.get('applyTo')?.includes('**/*'), `${name} has narrow Copilot scope`);
                assert.ok(!universal.includes(name), `${name} is not Pi universal`);
            }
            for (const name of ['code-quality.md', 'glossary.md', 'framework.md']) {
                assert.ok(rulesForPath(project, 'Source/Thing.cs').some(rule => rule.name === name), `${name} reaches C#`);
            }
            assert.ok(universal.includes('local-work-artifacts.md'), 'work-artifact safety is delivered before a file is touched');
            assert.ok(rulesForPath(project, 'Documentation/guide.mdx').some(rule => rule.name === 'glossary.md'));
        } finally {
            rmSync(project, { recursive: true, force: true });
        }
    }
});

test('work-artifact safety reaches CSharp-only sessions without documentation before path access', () => {
    for (const managed of [false, true]) {
        const project = workspace(managed);
        try {
            writeFileSync(join(project, '.cratis/ai.json'), JSON.stringify({ profiles: ['cratis/engineering/csharp'], languages: ['csharp'] }));
            const rule = universalRules(project).find(candidate => candidate.name === 'local-work-artifacts.md');
            assert.ok(rule, `work-artifact safety missing in ${managed ? 'managed' : 'packaged'} CSharp-only session`);
            assert.ok(rule.content.includes('Check the preconditions before acting on a prompt'));
            assert.ok(rule.content.includes('cratis-cleanup-worktrees.sh'));
            assert.ok(rule.content.includes('pushed is not merged'));
        } finally {
            rmSync(project, { recursive: true, force: true });
        }
    }
});

test('local work-artifact safety remains exactly HEAD, including its always-on scope', () => {
    const content = readFileSync(join(corpus, 'rules/local-work-artifacts.md'), 'utf8');
    const original = execFileSync('git', ['show', 'HEAD:.cratis/ai/rules/local-work-artifacts.md'], { cwd: resolve(corpus, '../..'), encoding: 'utf8' });
    assert.equal(content, original, 'restore scope without changing or moving any safety text');
    const fields = frontmatter(content);
    assert.deepEqual(fields.get('applyTo'), ['**/*']);
    assert.ok(!fields.has('paths'));
});

test('source concerns cover all supported source languages and framework manifests', () => {
    const fields = (name: string) => frontmatter(readFileSync(join(corpus, 'rules', name), 'utf8'));
    for (const extension of ['cs', 'ts', 'tsx', 'go', 'kt', 'kts', 'java', 'ex', 'exs']) {
        for (const name of ['code-quality.md', 'glossary.md', 'framework.md']) {
            assert.ok(fields(name).get('paths')?.includes(`**/*.${extension}`), `${name} covers ${extension}`);
        }
    }
    for (const manifest of ['**/*.csproj', '**/package.json', '**/go.mod']) assert.ok(fields('framework.md').get('paths')?.includes(manifest));
    assert.ok(fields('framework.md').get('profile')?.includes('framework'));
    assert.ok(fields('glossary.md').get('paths')?.includes('**/*.play'));
});

test('general routes to scoped concerns and operational skills; all profiles can discover both new skills', () => {
    const general = readFileSync(join(corpus, 'rules/general.md'), 'utf8');
    assert.ok(lineCount(general) <= 200, `general.md: ${lineCount(general)} lines`);
    assert.ok(Buffer.byteLength(general) < 24_000, 'general.md stays below 24k bytes');
    for (const name of [...scoped, 'local-work-artifacts.md', 'git-commits.md', 'pull-requests.md', 'rtk.md', 'issue-assignment.md']) assert.ok(general.includes(`\`${name}\``), name);
    for (const skill of [...skills, 'cratis-engineering-issue-hygiene']) {
        assert.ok(general.includes(skill), skill);
        assert.ok(existsSync(join(corpus, 'skills', skill, 'SKILL.md')), skill);
    }
    const catalog = JSON.parse(readFileSync(join(corpus, 'profile-catalog.json'), 'utf8')) as {
        publicProfiles: Profile[]; engineeringProfiles: Profile[];
    };
    interface Profile { id: string; composes?: string[]; availableTargets?: string[] }
    const profiles = [...catalog.publicProfiles, ...catalog.engineeringProfiles];
    const byId = new Map(profiles.map(profile => [profile.id, profile]));
    const targets = (id: string, seen = new Set<string>()): Set<string> => {
        assert.ok(byId.has(id), `known profile ${id}`);
        if (seen.has(id)) return new Set();
        seen.add(id);
        const profile = byId.get(id)!;
        return new Set([...(profile.availableTargets ?? []), ...(profile.composes ?? []).flatMap(child => [...targets(child, seen)])]);
    };
    for (const profile of profiles) for (const skill of skills) assert.ok(targets(profile.id).has(skill), `${profile.id} discovers ${skill}`);
});

test('moved operational detail and incoming links retain valid relative targets and anchors', () => {
    const files = [
        'skills/cratis-commits-and-pull-requests/SKILL.md',
        'skills/cratis-commits-and-pull-requests/references/commits.md',
        'skills/cratis-commits-and-pull-requests/references/pr-description.md',
        'skills/cratis-commits-and-pull-requests/references/pr-labels-and-release.md',
        'skills/cratis-rtk/SKILL.md',
        'skills/cratis-engineering-issue-hygiene/SKILL.md',
        'skills/cratis-engineering-ci-gates/SKILL.md',
        'prompts/ship-changes.prompt.md',
    ];
    let checked = 0;
    for (const file of files) {
        const content = readFileSync(join(corpus, file), 'utf8').replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
        for (const match of content.matchAll(/\]\(([^)]+\.md)(?:#([^)]*))?\)/g)) {
            if (/^[a-z]+:/.test(match[1])) continue;
            const target = resolve(dirname(join(corpus, file)), match[1]);
            assert.ok(existsSync(target), `${file} -> ${match[1]}`);
            if (match[2]) {
                const headings = [...readFileSync(target, 'utf8').matchAll(/^#+ (.+)$/gm)].map(heading => heading[1].toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/ /g, '-'));
                assert.ok(headings.includes(match[2]), `${file} -> ${match[1]}#${match[2]}`);
            }
            checked++;
        }
    }
    assert.ok(checked >= 10, 'checks real moved references, not an empty link set');
});

test('every pathless history and release contract stays literal in an always-on stub', () => {
    const mandatory = 'Before writing any commit message, committing, pushing, or creating/editing a PR, read the `cratis-commits-and-pull-requests` skill.';
    const contracts: Record<string, string[]> = {
        'git-commits.md': [
            mandatory,
            'Committed history is append-only.',
            'unless the human explicitly asks for that specific command on that specific branch in that specific message',
            '`git rebase` (any form, incl. `-i`, `--onto`, `--autosquash`)',
            '`git commit --amend`', '`git reset --hard`, `git reset` onto an earlier commit',
            '`git push --force`, `git push --force-with-lease`, `git push -f`',
            '`git branch -D` / `git branch -d` on a branch holding unmerged commits',
            "`git checkout`/`git switch` away while another agent's commits sit only on this branch",
            '`git filter-branch`, `git filter-repo`, history-rewriting scripts',
            '`git gc --prune=now`, `git reflog expire`',
            '`git merge --squash`, `gh pr merge --squash`, `--rebase`',
            'Always merge with a true merge commit', 'Never `--squash`, never `--rebase`',
            'If a repository\'s settings only allow squash or rebase merges', 'Stop and ask.',
            'Add a new commit that corrects it.', '`git revert <sha>`',
            'Leave them; the project does not require a linear history.',
            '`gh pr merge --merge` (a real merge commit)', '`git merge`, never `git rebase`',
            '`git cherry-pick`', 'Use `git worktree add`', 'Never two sessions committing in one working tree.',
        ],
        'pull-requests.md': [
            mandatory,
            'The PR description is published verbatim as the GitHub release.',
            '`(#n)` at the end of the bullet that delivers it', 'only** for an issue this PR fully delivers',
            '`(part of #n)`', 'No issue means no reference; never use a placeholder or guess a number.',
            'Never use a linking or closing keyword before a number, anywhere',
            'One `(#n)` per issue', 'Comment on or close an issue only when the user\'s request includes that effect.',
            'Exactly one** of `major`/`minor`/`patch`/`no-release`', 'set in the creating command',
            'Never add a second', 'Dependabot PRs carry only `no-release`.',
            'Confirm the repository workflow before choosing',
            'A direct request to ship with a named label authorizes applying it and the standard workflow',
            'without a ship request a proposed label describes impact but grants no authority',
            "A major release needs a human's explicit go-ahead, and a human merges it.",
            'An agent never merges a `major` PR, even after confirmation', 'the checkpoint is per release',
            'If nothing in the PR can change what a consumer compiles against, runs or observes, use `no-release`',
            'Reviewer-facing information goes in a PR comment', 'even when the PR is labelled `no-release`',
            'cratis ai update',
            'node .cratis/ai/hooks/scripts/cratis-check-pr.mjs --body-file <file> --label <intent>',
            'If it fails, fix the description, not the code.',
            'Run the affected-project gates before marking work ready',
            "the repository's required CI checks after an authorized push",
            'none is a blanket exemption from red CI.',
        ],
    };
    for (const [name, sentences] of Object.entries(contracts)) {
        const content = readFileSync(join(corpus, 'rules', name), 'utf8');
        const fields = frontmatter(content);
        assert.deepEqual(fields.get('applyTo'), ['**/*']);
        assert.ok(!fields.has('paths'));
        for (const sentence of sentences) assert.ok(content.includes(sentence), `${name}: ${sentence}`);
    }
});

test('new and changed operational skill Markdown passes the actual hygiene checker', () => {
    const files = [
        'skills/cratis-commits-and-pull-requests/SKILL.md',
        'skills/cratis-commits-and-pull-requests/references/commits.md',
        'skills/cratis-commits-and-pull-requests/references/pr-description.md',
        'skills/cratis-commits-and-pull-requests/references/pr-labels-and-release.md',
        'skills/cratis-rtk/SKILL.md',
        'skills/cratis-engineering-issue-hygiene/SKILL.md',
        'skills/cratis-engineering-ci-gates/SKILL.md',
    ];
    const findings = files.flatMap(file => skillHygieneFindings(join(corpus, file), readFileSync(join(corpus, file), 'utf8')));
    console.log(`Operational skill hygiene: ${files.length} Markdown files, ${findings.length} findings.`);
    assert.deepEqual(findings, []);
});

test('new skill fixtures have valid structure, balanced routing inputs and matching literal assertions', () => {
    for (const skill of skills) {
        const entry = readFileSync(join(corpus, 'skills', skill, 'SKILL.md'), 'utf8');
        assert.deepEqual(skillStructureProblems(skill, entry), []);
        assert.ok(existsSync(join(corpus, 'skills', skill, 'LICENSE')));
        for (const kind of ['trigger', 'evals'] as const) {
            const path = resolve(corpus, '../../Evaluations/skills', skill, `${kind}.json`);
            assert.deepEqual(evaluationProblems(path, skill, kind, JSON.parse(readFileSync(path, 'utf8')), skills), []);
        }
    }
    for (const skill of [...skills, 'cratis-engineering-issue-hygiene']) {
        const entry = readFileSync(join(corpus, 'skills', skill, 'SKILL.md'), 'utf8');
        assert.deepEqual(skillStructureProblems(skill, entry), []);
        const verification = JSON.parse(readFileSync(join(corpus, 'skills', skill, 'verification.json'), 'utf8'));
        assert.equal(verification.skill, skill);
        assert.ok(verification.assertions.length > 0);
        for (const assertion of verification.assertions) {
            assert.equal(assertion.kind, 'skill-contains');
            assert.ok(entry.includes(assertion.value), `${skill}: ${assertion.value}`);
        }
    }
});
