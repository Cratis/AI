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
// Approved profile composition and language applicability.
const graph = (['publicProfiles', 'engineeringProfiles'] as const).flatMap(section => catalog[section].map(p =>
    [section, p.id, sorted(p.composes ?? []), sorted(p.languages ?? [])] as const)).sort((a, b) => a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
const ids = graph.map(row => row[1]);
// Approved direct target hashes in profile-ID order.
const targets = `
efd6e8b20d caf43b025b 3c4996515f 6938a683aa cebf4a7593 09f51c2aec edf833f608 9a01d2647c
9a01d2647c 87a4d4e7ab 79fc527a6f 43d2db935f 61ccb20157 301bea73c6 5bac36aa65 518a840887
742cf55e6f 43d2db935f 5f82dc618c 5b2e1b69e3 5b2e1b69e3 015420d5d2 832ba866ca 5b2e1b69e3
3ca074c722 ba6e0a1c00 840e0037c9 2eb64bd7ef 5b2e1b69e3 62c78c80fb b1ab20392b 94c314d2f8
759d051ebf ae41268393 - 5b2e1b69e3 5b2e1b69e3 5b2e1b69e3 f350625213 8ebd2d4c89
5b2e1b69e3 efa0b818ea 634d235944 27afc1e67d fbe77a29a5 28ff2d6afe 72a302477f c2c5bed659
- 5fdd0c177f c104619d9c 5b2e1b69e3 9ef74c5749 fbea753318 eb1cd9be95 dc8fbd0866
aaee798853 3ed21a8b13 29fc5dbb66 - - - - 5184982126
efd6e8b20d - - - - - 9e49550745 cdec94282c
e80c8ab9fd 01802ed9b3 01802ed9b3 01802ed9b3 01802ed9b3 01802ed9b3 01802ed9b3 d251031288
46c86ba34b 26e63b3b48 a1e001f8a6 01802ed9b3 01802ed9b3 37d9fcdb78 01802ed9b3 7ca7b4ae3e
172829aaee 7883182b2c b700fb255c bf6952cb17
`.trim().split(/\s+/);


test('catalog and offered targets match the approved plan', () => {
    assert.equal(digest(graph), 'a042bd81ba97534a79952615c1aa5ce6264d2f08608bafc235aa11e0d6c742ff');
    assert.deepEqual(sorted(manifest.profiles), ids);
    assert.equal(digest(sorted(manifest.languages)), '8b7c9f51bc65717ce60954b08ec7bf1314304b48bffa80d61fcde905fbb4b0de');
    assert.deepEqual(ids.filter((id, i) => {
        const direct = byId.get(id)?.availableTargets;
        return (direct?.length ? digest(sorted(direct)).slice(0, 10) : '-') !== targets[i];
    }), []);
    assert.deepEqual(profiles.filter(p => p.featured || (p.id !== 'cratis/v2/application' && p.description !== undefined)).map(p => p.id), []);
});

const languages = ['csharp', 'typescript', 'kotlin', 'java', 'go', 'elixir', 'python', 'react', 'language-agnostic'];
const app = 'cratis/application';
const eng = 'cratis/engineering';
const governedReleases = 'cratis/methodology/governed-releases';
const release = ['governed-release-methodology', 'platform-prepare-release-pr'];
const core = ['arc-declare-command', 'chronicle-record-event', 'specifications-exercise-backend'];
const reviewers = ['code-reviewer', 'performance-reviewer', 'security-reviewer'];
const reviewSkills = ['code-review', 'performance-review', 'security-review'];
const arcCore = ['arc-declare-command', 'arc-declare-operation', 'arc-expose-mcp-operation', 'arc-generate-proxies'];
const scenario = 'specifications-exercise-backend';
const startup = 'platform-start-application';
const startupRoots = new Set([app, 'cratis', 'cratis/full']);
const startupLanguages = new Set(['csharp', 'java', 'kotlin', 'react', 'typescript']);
const restoredCapabilities: { profile: string; language: string; skills: string[]; references?: string[] }[] = [
    ...['java', 'kotlin'].map(language => ({ profile: `${app}/${language}`, language, skills: [startup, 'observability', 'platform-deliver-slice'] })),
    ...['typescript', 'react'].map(language => ({ profile: `${app}/react`, language, skills: ['observability', 'application-growth'] })),
    ...['csharp', 'typescript', 'react', 'java', 'kotlin', 'elixir'].map(language => ({ profile: 'cratis/full', language, skills: ['observability'] })),
    { profile: app, language: '', skills: ['observability', 'application-growth'] },
    { profile: app, language: 'typescript', skills: ['arc-declare-operation', 'observability'], references: ['arc-declare-operation/typescript.md'] },
    { profile: eng, language: 'csharp', skills: reviewSkills },
    { profile: `${app}/csharp`, language: 'csharp', skills: ['application-growth', 'observability', 'platform-deliver-slice'] },
    { profile: `${app}/elixir`, language: 'elixir', skills: ['observability', 'platform-deliver-slice'] },
    { profile: `${app}/typescript`, language: 'typescript', skills: ['arc-declare-operation', 'observability', 'platform-deliver-slice'] },
    { profile: 'cratis/arc', language: 'typescript', skills: ['arc-declare-operation'], references: ['arc-declare-operation/typescript.md'] },
    ...['core', 'ef-core', 'identity'].map(name => ({ profile: `cratis/arc/${name}`, language: 'csharp', skills: arcCore })),
    { profile: 'cratis/arc/identity', language: 'csharp', skills: ['arc-authorize-request', 'arc-isolate-tenant'] },
    { profile: 'cratis/arc/server-typescript', language: 'typescript', skills: ['observability'] },
    ...['react', 'typescript'].map(language => ({
        profile: 'cratis/arc/react', language,
        skills: ['components-display-list', 'components-submit-form', 'specifications-observe-ui', 'specifications-test-application-ui'],
    })),
    ...['application/arc-only', 'application/arc-chronicle'].map(name => ({
        profile: `cratis/${name}`, language: 'csharp', skills: arcCore,
        references: ['arc-declare-command/csharp.md', 'arc-generate-proxies/csharp.md'],
    })),
    ...['specifications/dotnet', 'application/chronicle-dotnet', 'application/react', 'arc/csharp', 'chronicle/csharp'].map(name => ({
        profile: `cratis/${name}`, language: 'csharp', skills: [scenario], references: [`${scenario}/csharp.md`],
    })),
    ...['elixir', 'typescript'].map(language => ({
        profile: `cratis/chronicle/client-${language}`, language, skills: [scenario], references: [`${scenario}/${language}.md`],
    })),
    { profile: 'cratis/chronicle/client-elixir', language: 'elixir', skills: ['chronicle-inspect-observer'], references: ['chronicle-inspect-observer/elixir.md'] },
    {
        profile: 'cratis/chronicle/core', language: 'go',
        skills: ['event-model-diagram', 'multi-service-local-orchestration', 'modeling-design-event-model', 'modeling-discover-timeline',
            'modeling-review-event-model', 'modeling-trace-existing-behavior'],
    },
    ...['csharp', 'language-agnostic'].map(language => ({ profile: 'cratis/chronicle/compliance', language, skills: ['chronicle-protect-personal-data'] })),
    { profile: 'cratis/chronicle/multi-tenancy', language: 'csharp', skills: ['chronicle-connect-application'] },
    { profile: `${eng}/csharp`, language: 'csharp', skills: ['fundamentals-name-value', 'fundamentals-type-discovery', 'observability'] },
    { profile: `${eng}/typescript`, language: 'typescript', skills: ['fundamentals-name-value'] },
    ...['msbuild', 'performance'].map(name => ({ profile: `${eng}/dotnet/${name}`, language: 'csharp', skills: ['platform-prepare-release-pr'] })),
    { profile: 'cratis/screenplay', language: '', skills: ['screenplay-author-extension'] },
    { profile: 'cratis/stage', language: '', skills: ['onboarding-runtime'] },
];
const byId = new Map(profiles.map(p => [p.id, p]));

// v1 keeps explicit profile targets even when their language does not match. The opt-in v2 walkthrough
// likewise keeps its mixed-stack payload. These skills are not Go recipes and must not leak into other Go roots.
const goSpecialists = new Map([
    ['arc-expose-mcp-operation', ['cratis/application/arc-chronicle', 'cratis/application/arc-only', 'cratis/arc/core', 'cratis/v2/application']],
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
    const expected = startupRoots.has(profile) ? [...core, 'platform-deliver-slice']
        : profile === eng ? ['commits-and-pull-requests', 'platform-prepare-release-pr']
        : profile === `${app}/csharp` ? [...core, startup] : /^cratis\/arc(?:\/(?:csharp|go))?$/.test(profile) ? core.slice(0, 1)
        : profile === 'cratis/chronicle' ? core.slice(1, 2) : [];
    const has = (name: string) => installed.includes(`cratis-${name}`);
    const restored = restoredCapabilities.filter(({ profile, language }) => profiles.includes(profile) && languages.join() === language);
    const supportsStartup = !languages.length || languages.some(language => startupLanguages.has(language));
    return [
        ...[...expected, ...reviewSkills, ...restored.flatMap(({ skills }) => skills)].filter(name => !has(name)).map(name => `missing ${name}`),
        ...(profile === eng ? [...core, 'platform-deliver-slice', startup].filter(has).map(name => `unexpected ${name}`) : []),
        ...(startupRoots.has(profile) && has(startup) !== supportsStartup ? [`${supportsStartup ? 'missing' : 'unexpected'} ${startup}`] : []),
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
        const failures = profiles.flatMap(({ id }) => ['', ...languages].flatMap(language => {
            const selection = { profiles: [id], languages: language ? [language] : [] };
            writeFileSync(join(cwd, '.cratis/ai.json'), JSON.stringify(selection));
            const expected = skillClosure(byId, selection, 'pi');
            const problems = purpose(selection, expected);
            if (selectedSkillNames(cwd)?.join() !== expected.join()) problems.push('closure mismatch');
            if ((id === app || id === eng) && !rulesForPath(cwd, '.cratis/ai.json').some(rule => rule.name === 'profiles.md')) {
                problems.push('missing profile selection rule');
            }
            return problems.map(problem => `${id}/${language}: ${problem}`);
        }));
        assert.deepEqual(failures, []);
    } finally { rmSync(cwd, { recursive: true, force: true }); }
});

const matrix: Selection[] = [
    ...[app, eng].flatMap(profile => languages.map(language => ({ profiles: [profile], languages: [language] }))),
    ...restoredCapabilities.filter(({ profile, language }, i) =>
        restoredCapabilities.findIndex(entry => entry.profile === profile && entry.language === language) === i)
        .map(({ profile, language }) => ({ profiles: [profile], languages: language ? [language] : [] })),
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
        writeFileSync(join(rules, 'reactors.md'), '---\npaths: "**/*"\n---\nShort.');
        assert.deepEqual(shimBudgetProblems(cwd, []), ["Direct shim 'reactors.md' must be path scoped."]);
        writeFileSync(join(rules, 'reactors.md'), '---\npaths: "**/*.cs"\n---\nShort.');
        writeFileSync(join(rules, 'verification-discipline.md'), '---\npaths: "**/*"\n---\nShort.');
        assert.deepEqual(shimBudgetProblems(cwd, []), []);
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

const labeledMatrix = new Map(matrix.map(selection =>
    [[...selection.profiles, ...selection.languages].join('+').replaceAll('/', '-'), selection] as const));
for (const [label, selection] of labeledMatrix) {
    const { profiles, languages } = selection;
    test(`offline install: ${label}`, offline, () => {
        const cwd = mkdtempSync(join(evidence!, `${label}-`));
        const languageOptions = languages.length ? ['--languages', languages.join()] : [];
        const output = invoke(['install', '--yes', '--output', 'json', '--profiles', profiles.join(), ...languageOptions, '--harnesses', 'pi'], cwd);
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
        const references = restoredCapabilities.filter(({ profile, language }) => profiles.includes(profile) && languages.join() === language)
            .flatMap(({ references }) => references ?? []);
        for (const reference of references) {
            const [skill, file] = reference.split('/');
            assert.ok(files.has(`skills/cratis-${skill}/references/${file}`), `missing ${reference}`);
        }
        const installedPaths = new Set(installed.Files.map(file => file.Destination));
        assert.deepEqual(reviewers.filter(agent => !installedPaths.has(`agents/${agent}.md`)), []);
        if (restoredCapabilities.some(entry => profiles.includes(entry.profile) && languages.join() === entry.language && entry.skills.includes('platform-deliver-slice'))) {
            assert.ok(installedPaths.has('agents/slice-implementer.md'));
        }
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
