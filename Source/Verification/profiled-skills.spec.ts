// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { unprofiledSkills } from './profiled-skills.ts';
import { selectedSkillPaths } from '../Pi.Plugin/src/index.ts';
import { selectedSkillNames } from '../../.cratis/ai/harnesses/pi/extensions/shared/skillSelection.ts';

test('the profile reachability check catches a planted unregistered skill', () => {
    assert.deepEqual(unprofiledSkills(['docs', 'unregistered'], [{ availableTargets: ['docs'] }]), ['unregistered']);
});

test('the profile reachability check accepts skills available from different profiles', () => {
    assert.deepEqual(unprofiledSkills(['docs', 'release'], [
        { availableTargets: ['docs'] },
        { availableTargets: ['release'] },
    ]), []);
});

test('Go product profiles resolve the same composed skills in the Pi plugin and path guidance', () => {
    const project = mkdtempSync(join(tmpdir(), 'cratis-go-profiles-'));
    try {
        mkdirSync(join(project, '.cratis'));
        const cases: Array<[string[], string[]]> = [
            [['cratis/language/go'], []],
            [['cratis/arc/go'], ['cratis-arc-go', 'cratis-fundamentals-concept-go']],
            [['cratis/chronicle/client-go'], ['cratis-chronicle-client-go', 'cratis-fundamentals-concept-go']],
            [['cratis/fundamentals/go'], ['cratis-fundamentals-concept-go']],
            [['cratis/arc/go', 'cratis/chronicle/client-go'], ['cratis-arc-go', 'cratis-chronicle-client-go', 'cratis-fundamentals-concept-go']],
        ];
        for (const [profiles, expected] of cases) {
            writeFileSync(join(project, '.cratis', 'ai.json'), JSON.stringify({ profiles, languages: ['go'] }));
            const actual = selectedSkillPaths(project).map(path => path.split('/').pop()).sort();
            assert.deepEqual(actual, expected, profiles.join(', '));
            assert.deepEqual(selectedSkillNames(project), actual, 'the fallback must not hint an unselected skill');
        }
        writeFileSync(join(project, '.cratis', 'ai.json'), JSON.stringify({ profiles: ['cratis/engineering/go'], languages: ['go'] }));
        const engineering = selectedSkillNames(project)!;
        assert.ok(engineering.includes('cratis-engineering-effect-boundaries'));
        assert.ok(!engineering.some(name => cases.slice(1).flatMap(([, names]) => names).includes(name)), 'engineering does not opt into product clients');
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('application specifications profiles resolve linked test helpers without engineering skills', () => {
    const project = mkdtempSync(join(tmpdir(), 'cratis-specifications-profiles-'));
    try {
        mkdirSync(join(project, '.cratis'));
        const cases = [
            ['cratis/specifications/dotnet'],
            ['cratis/application/csharp'],
            ['cratis/application/react'],
            ['cratis/application/arc-only'],
            ['cratis/application/arc-chronicle'],
            ['cratis/application/chronicle-dotnet'],
            ['cratis/application/csharp', 'cratis/application/typescript', 'cratis/screenplay'],
        ];
        for (const profiles of cases) {
            writeFileSync(join(project, '.cratis', 'ai.json'), JSON.stringify({ profiles, languages: ['csharp', 'typescript', 'react'] }));
            const actual = selectedSkillPaths(project).map(path => path.split('/').pop()).sort();
            for (const skill of ['cratis-specifications-csharp', 'run-tests', 'filter-syntax', 'platform-detection', 'coverage-analysis']) {
                assert.ok(actual.includes(skill), `${profiles.join(', ')} must install ${skill}`);
            }
            assert.ok(!actual.some(skill => skill.startsWith('cratis-engineering-')), 'test helpers must not require engineering profiles');
            assert.deepEqual(selectedSkillNames(project), actual, 'path guidance and the plugin must resolve the same helpers');
        }
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('writing skills are reachable from the relevant public and engineering profiles', () => {
    const catalogPath = resolve(import.meta.dirname, '../../.cratis/ai/profile-catalog.json');
    const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as {
        publicProfiles: Array<{ id: string; availableTargets?: string[] }>;
        engineeringProfiles: Array<{ id: string; availableTargets?: string[] }>;
    };
    const targets = (id: string) => [...catalog.publicProfiles, ...catalog.engineeringProfiles]
        .find(profile => profile.id === id)?.availableTargets ?? [];
    assert.deepEqual(
        ['cratis-documentation-writing', 'cratis-engineering-docs-authoring', 'cratis-release-notes', 'cratis-technical-examples', 'cratis-writing-voice-and-cadence']
            .filter(skill => !targets('cratis/documentation').includes(skill)),
        [],
    );
    assert.ok(targets('cratis/content').includes('cratis-release-notes'));
    assert.ok(targets('cratis/content').includes('cratis-content-length'));
    assert.ok(targets('cratis/content').includes('cratis-developer-marketing'));
    assert.ok(targets('cratis/engineering/core').includes('cratis-release-notes'));
    assert.ok(targets('cratis/engineering/core').includes('cratis-technical-examples'));
});
