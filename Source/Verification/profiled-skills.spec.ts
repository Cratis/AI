// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { unprofiledSkills } from './profiled-skills.ts';

test('the profile reachability check catches a planted unregistered skill', () => {
    assert.deepEqual(unprofiledSkills(['docs', 'unregistered'], [{ availableTargets: ['docs'] }]), ['unregistered']);
});

test('the profile reachability check accepts skills available from different profiles', () => {
    assert.deepEqual(unprofiledSkills(['docs', 'release'], [
        { availableTargets: ['docs'] },
        { availableTargets: ['release'] },
    ]), []);
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
    assert.ok(targets('cratis/engineering/core').includes('cratis-release-notes'));
    assert.ok(targets('cratis/engineering/core').includes('cratis-technical-examples'));
});
