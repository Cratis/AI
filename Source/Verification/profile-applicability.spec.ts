// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { rulesForPath, universalRules } from '../../.cratis/ai/harnesses/pi/extensions/shared/rules.ts';
import { selectedSkillNames } from '../../.cratis/ai/harnesses/pi/extensions/shared/skillSelection.ts';
import { packageProblems, retiredSkills, sharedSkills } from './corpus-shape.ts';
import { directWorkerProblems, shimBudgetProblems, workerRuleProblems } from './direct-worker.ts';
import { installedLinkProblems } from './installed-links.ts';
import { nativeRouteProblems } from './native-routes.ts';
import { type Profile, type Selection, skillClosure } from './profile-closure.ts';
import { skillBody } from './skill-structure.ts';

const root = resolve(import.meta.dirname, '../..');
const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const sorted = (items: Iterable<string>) => [...items].sort();
const digest = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
interface CatalogProfile extends Profile { description?: string; featured?: boolean }
const catalog = readJson<Record<'publicProfiles' | 'engineeringProfiles', CatalogProfile[]>>(join(root, '.cratis/ai/profile-catalog.json'));
const profiles = [...catalog.publicProfiles, ...catalog.engineeringProfiles];
const manifest = readJson<{ profiles: string[]; languages: string[] }>(join(root, '.cratis/ai/manifest.json'));
// 88b9b9af1 + the walkthrough.
const graph = (['publicProfiles', 'engineeringProfiles'] as const).flatMap(section => catalog[section].map(p =>
    [section, p.id, sorted(p.composes ?? []), sorted(p.languages ?? [])] as const)).sort((a, b) => a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
const ids = graph.map(row => row[1]);
// Approved direct target hashes in profile-ID order.
const targets = `
908d1976a7 1c3c7eb826 996c0dc754 367c34a4b6 cebf4a7593 5651dff530 f339643561 f339643561
f339643561 a716d1b5a4 f339643561 8f6f16be90 8504cc7fa3 88970eef00 dbf8545981 1db6707330
8f6f16be90 0aa9e41e1b - - - 281c886cc8 6e66dd670c -
3ca074c722 36aa92822d ce00067af7 3ca074c722 - ce00067af7 1bc7624553 ce00067af7
- 1770c151be - - - - ff6866b8a7 -
- efa0b818ea 7add883f54 4996440368 226f14578d 030aaaac72 31ff53d01f d0cd44ed70
- 62b90a5763 4ebb42c901 - b68d53f554 db69f1593e 9dd86f9426 f5104113db
d1d52a9549 ad1566413e 4eb24ff137 - - - - 172829aaee
908d1976a7 - - - - - 9179c19ac8 f013db4081
6df07480cb 73ae16e0e5 73ae16e0e5 73ae16e0e5 73ae16e0e5 73ae16e0e5 73ae16e0e5 a3e6036337
7cdba1bf33 26e63b3b48 a1e001f8a6 73ae16e0e5 01802ed9b3 133627f836 73ae16e0e5 c22d70c043
172829aaee 09365dfbaf d9406ea53f 164273a28c
`.trim().split(/\s+/);


test('catalog and offered targets match the approved plan', () => {
    assert.equal(digest(graph), '49016163ecc23325b0e11062c2279c4501b1129dd6d58e40ef33e1ae02b9e1d6');
    assert.deepEqual(sorted(manifest.profiles), ids);
    assert.equal(digest(sorted(manifest.languages)), '8b7c9f51bc65717ce60954b08ec7bf1314304b48bffa80d61fcde905fbb4b0de');
    assert.deepEqual(ids.filter((id, i) => {
        const direct = byId.get(id)?.availableTargets;
        return (direct?.length ? digest(sorted(direct)).slice(0, 10) : '-') !== targets[i];
    }), []);
    assert.deepEqual(profiles.filter(p => p.featured || (p.id !== 'cratis/v2/application' && p.description !== undefined)).map(p => p.id), []);
});

const languages = ['csharp', 'typescript', 'kotlin', 'java', 'go', 'elixir', 'python'];
const app = 'cratis/application';
const eng = 'cratis/engineering';
const governedReleases = 'cratis/methodology/governed-releases';
const release = ['governed-release-methodology', 'platform-prepare-release-pr'];
const core = ['arc-declare-command', 'chronicle-record-event', 'specifications-exercise-backend'];
const entry = ['platform-start-application', 'platform-deliver-slice'];
const byId = new Map(profiles.map(p => [p.id, p]));

// v1 keeps explicit profile targets even when their language does not match. The opt-in v2 walkthrough
// likewise keeps its mixed-stack payload. These skills are not Go recipes and must not leak into other Go roots.
const goSpecialists = new Map([
    ['arc-expose-mcp-operation', ['cratis/application/arc-chronicle', 'cratis/application/arc-only', 'cratis/v2/application']],
    ['arc-migrate-relational-schema', ['cratis/arc/ef-core', 'cratis/v2/application']],
    ['arc-react-bind-slice', ['cratis/arc/react', 'cratis/v2/application']],
]);

function goSpecialistProblems(profiles: string[], has: (name: string) => boolean): string[] {
    return [...goSpecialists].flatMap(([skill, roots]) => {
        if (roots.some(root => profiles.includes(root))) return has(skill) ? [] : [`missing ${skill}`];
        return has(skill) ? [`unexpected ${skill}`] : [];
    });
}

function purpose({ profiles, languages }: Selection, installed: string[]): string[] {
    const [profile] = profiles;
    const expected = profile === app || profile === 'cratis' || profile === 'cratis/full' ? [...core, ...entry]
        : profile === eng ? ['commits-and-pull-requests', 'platform-prepare-release-pr']
        : profile === `${app}/csharp` ? core : /^cratis\/arc(?:\/(?:csharp|go))?$/.test(profile) ? core.slice(0, 1)
        : profile === 'cratis/chronicle' ? core.slice(1, 2) : [];
    const has = (name: string) => installed.includes(`cratis-${name}`);
    return [
        ...expected.filter(name => !has(name)).map(name => `missing ${name}`),
        ...(profile === eng ? [...core, ...entry].filter(has).map(name => `unexpected ${name}`) : []),
        ...(languages.join() === 'go' ? goSpecialistProblems(profiles, has) : []),
    ];
}

const scratch = (label: string) => {
    const base = join(root, '.ai-work');
    mkdirSync(base, { recursive: true });
    return mkdtempSync(join(base, `${label}-`));
};

test('explicit roots resolve per language', () => {
    const cwd = scratch('closures');
    try {
        mkdirSync(join(cwd, '.cratis'));
        const failures = profiles.flatMap(({ id }) => languages.flatMap(language => {
            const selection = { profiles: [id], languages: [language] };
            writeFileSync(join(cwd, '.cratis/ai.json'), JSON.stringify(selection));
            const expected = skillClosure(byId, selection, 'pi');
            const problems = purpose(selection, expected);
            if (selectedSkillNames(cwd)?.join() !== expected.join()) problems.push('closure mismatch');
            return problems.map(problem => `${id}/${language}: ${problem}`);
        }));
        assert.deepEqual(failures, []);
    } finally { rmSync(cwd, { recursive: true, force: true }); }
});

const matrix: Selection[] = [
    ...[app, eng].flatMap(profile => languages.map(language => ({ profiles: [profile], languages: [language] }))),
    { profiles: [governedReleases], languages: ['go'] },
    ...`arc/server-typescript,arc/react typescript
application java,kotlin
application/kotlin,arc/react kotlin,react
arc go
chronicle go
full go
/ go
/ python
application/csharp csharp
arc/csharp csharp
arc/go go
chronicle/client-python python`.split('\n').map(line => {
        const [profiles, languages] = line.split(' ');
        return { profiles: profiles.split(',').map(id => id === '/' ? 'cratis' : `cratis/${id}`), languages: languages.split(',') };
    }),
];

test('Direct can render each worker rule list without skill access', () => {
    assert.deepEqual(directWorkerProblems(root), []);
});

test('Direct requires substantive text even for a rule shared by two workers', () => {
    assert.deepEqual(workerRuleProblems(() => '# Rule\n\nVerify the outcome.'), []);
    const missing = workerRuleProblems(name => name === 'verification-discipline.md' ? '# Heading\n<!-- placeholder -->' : 'Verify the outcome.');
    assert.equal(missing.length, 2);
});

const probes = [
    'Source/Features/Books/Checkout/CheckoutBook.cs', 'Source/Features/Books/Checkout/OnBookCheckedOut.cs',
    'Source/Features/Books/for_CheckoutBook/when_handling/and_available.cs',
    'Source/Features/Books/Checkout/CheckoutBook.tsx', 'Source/Features/Books/for_CheckoutBook/when_rendering/and_available.tsx',
];

test('effective Direct shim text is scoped and at most 3,000 bytes per touched path', () => {
    assert.deepEqual(shimBudgetProblems(root, probes), []);
});

test('the effective shim cap counts UTF-8 bytes and only matching rules', () => {
    const cwd = scratch('shim');
    try {
        const rules = join(cwd, '.cratis/ai/rules');
        mkdirSync(rules, { recursive: true });
        for (const bytes of [3000, 3002]) {
            writeFileSync(join(rules, 'reactors.md'), `---
paths: "**/*.cs"
---
${'é'.repeat(bytes / 2)}`);
            assert.equal(shimBudgetProblems(cwd, [probes[0], probes[3]]).length, bytes > 3000 ? 1 : 0);
        }
    } finally { rmSync(cwd, { recursive: true, force: true }); }
});

const cli = process.env.CRATIS_OFFLINE_CLI;
const evidence = process.env.CRATIS_OFFLINE_INSTALL_DIR;
const offline = { skip: !cli || !evidence ? 'No offline CLI or install directory configured.' : false };
const invoke = (args: string[], cwd = root) => execFileSync('dotnet', [cli!, 'ai', ...args, '--source', root], { cwd, encoding: 'utf8' });

test('CLI listings expose all choices', offline, () => {
    const listings = [['plain'], ['plain', '--all'], ['json']].map(args => {
        const output = invoke(['profiles', 'list', '--output', ...args]);
        const pattern = args.includes('json') ? /"(cratis(?:\/[\w/-]+)?)"/g : /^(cratis(?:\/[\w/-]+)?)(?=\s|$)/gm;
        return sorted(new Set([...output.matchAll(pattern)].map(m => m[1])));
    });
    assert.deepEqual(listings, [ids, ids, ids]);
});

for (const selection of matrix) {
    const { profiles, languages } = selection;
    const label = [...profiles, ...languages].join('+').replaceAll('/', '-');
    test(`offline install: ${label}`, offline, () => {
        const cwd = mkdtempSync(join(evidence!, `${label}-`));
        const output = invoke(['install', '--yes', '--output', 'json', '--profiles', profiles.join(), '--languages', languages.join(), '--harnesses', 'pi'], cwd);
        writeFileSync(join(cwd, 'install-output.json'), output);
        const base = join(cwd, '.cratis/ai');
        const files = new Map(readdirSync(join(base, 'skills'), { recursive: true, withFileTypes: true }).filter(e => e.isFile()).map(e => {
            const file = join(e.parentPath, e.name);
            return [file.slice(base.length + 1).replaceAll('\\', '/'), e.name.endsWith('.md') ? readFileSync(file, 'utf8') : ''] as const;
        }));
        const installed = readJson<{ Files: Array<{ Destination: string }> }>(join(cwd, '.cratis/ai.manifest.json'));
        assert.deepEqual(sorted(installed.Files.map(f => f.Destination).filter(path => path.startsWith('skills/'))), sorted(files.keys()));
        const names = sorted([...files.keys()].filter(path => /^skills\/[^/]+\/SKILL\.md$/.test(path)).map(path => path.split('/')[1]));
        assert.deepEqual(names, skillClosure(byId, selection, 'cli'));
        assert.deepEqual(purpose(selection, names), []);
        if (profiles[0] === 'cratis' || profiles[0] === governedReleases) {
            // v1 excludes this composed, empty-language profile under a language filter but honors an explicit root.
            for (const name of release) assert.equal(names.includes(`cratis-${name}`), profiles[0] === governedReleases);
        }
        const problems = [...installedLinkProblems(files), ...packageProblems(files, retiredSkills)];
        for (const skill of sharedSkills.filter(name => names.includes(name))) {
            const prefix = `skills/${skill}/`;
            const assets = [...files.keys()].filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length));
            problems.push(...nativeRouteProblems(skill, skillBody(files.get(`${prefix}SKILL.md`)!), assets));
        }
        assert.ok(universalRules(cwd).some(rule => rule.name === 'general.md'));
        for (const language of languages) {
            const ext = ({ csharp: 'cs', typescript: 'ts', kotlin: 'kt', java: 'java', go: 'go', elixir: 'ex', python: 'py' } as Record<string, string>)[language];
            if (!ext) continue;
            const rules = rulesForPath(cwd, `Source/Features/Demo/Example.${ext}`).map(rule => rule.name);
            if (profiles[0].startsWith(app) || profiles[0] === eng) assert.equal(rules.includes('framework.md'), profiles[0] === eng && language !== 'python');
            if (language !== 'csharp') assert.ok(!rules.includes('efcore.md'));
        }
        assert.deepEqual(problems, []);
    });
}
