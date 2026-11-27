// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Idiom, Suite, SuiteTask } from './Suite.ts';
import { inside } from './suite-files.ts';

function requireValue(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function validateIdiom(check: Idiom): void {
    inside('/suite', check.file);
    requireValue(check.id, 'Idiom requires an ID');
    requireValue(['present', 'absent'].includes(check.kind), `Invalid idiom kind: ${check.id}`);
    requireValue(check.pattern, `Missing idiom pattern: ${check.id}`);
    requireValue(typeof check.positive === 'string', `Missing positive witness: ${check.id}`);
    requireValue(typeof check.negative === 'string', `Missing negative mutant: ${check.id}`);
    new RegExp(check.pattern, 'm');
}

function validateTask(task: SuiteTask, suite: Suite, ids: Set<string>): void {
    requireValue(/^[a-z0-9-]+$/.test(task.id), `Invalid task ID: ${task.id}`);
    requireValue(!ids.has(task.id), `Duplicate task: ${task.id}`);
    ids.add(task.id);
    requireValue(Object.hasOwn(suite.fixtures, task.fixture), `Unknown fixture: ${task.fixture}`);
    if (task.overlay) inside('/suite', task.overlay);
    requireValue(task.area, `Missing area: ${task.id}`);
    requireValue(task.prompt, `Missing prompt: ${task.id}`);
    requireValue(Number.isInteger(task.timeoutSeconds), `Invalid timeout: ${task.id}`);
    requireValue(task.timeoutSeconds > 0, `Invalid timeout: ${task.id}`);
    requireValue(task.timeoutSeconds <= 3600, `Invalid timeout: ${task.id}`);
    validateTaskScorers(task);
}

function validateTaskScorers(task: SuiteTask): void {
    requireValue(task.idioms?.length, `Missing idioms: ${task.id}`);
    requireValue(task.requiredSpecs?.length, `Missing specs: ${task.id}`);
    for (const arm of ['v1', 'v2'] as const) {
        requireValue(Array.isArray(task.expectedSkills?.[arm]), `Missing ${arm} expected skills: ${task.id}`);
        requireValue(task.expectedSkills[arm].every(skill => typeof skill === 'string'), `Invalid ${arm} expected skills: ${task.id}`);
    }
    task.requiredSpecs.forEach(path => inside('/suite', path));
    task.idioms.forEach(validateIdiom);
}

/** Validate trusted benchmark definitions before any process starts. */
export function validateSuite(value: unknown): Suite {
    requireValue(value, 'Invalid suite');
    requireValue(typeof value === 'object', 'Invalid suite');
    const suite = value as Suite;
    requireValue(suite.schemaVersion === 1, 'Invalid suite version');
    requireValue(Array.isArray(suite.tasks), 'Invalid task list');
    requireValue(suite.tasks.length, 'Empty task list');
    requireValue(suite.fixtures, 'Missing fixtures');
    for (const [id, fixture] of Object.entries(suite.fixtures)) {
        inside('/suite', fixture.path);
        requireValue(id, 'Missing fixture ID');
        requireValue(fixture.build, `Missing build command: ${id}`);
        requireValue(fixture.specs, `Missing specs command: ${id}`);
    }
    const ids = new Set<string>();
    suite.tasks.forEach(task => validateTask(task, suite, ids));
    return suite;
}
