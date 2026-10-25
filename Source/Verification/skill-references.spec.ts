// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { danglingSkillReferences, skillReferences } from './skill-references.ts';

const corpus = resolve(import.meta.dirname, '../../.cratis/ai');

test('a name followed by the word skill is a reference', () => {
    assert.deepEqual(skillReferences('Invoke the **write-specs** skill and follow the rules.'), ['write-specs']);
    assert.deepEqual(skillReferences('the `cratis-arc-command` skill\'s reference'), ['cratis-arc-command']);
});

test('several names in front of one skill are all references', () => {
    assert.deepEqual(
        skillReferences('the **cratis-a** and **cratis-b** skills, or **cratis-c** / **cratis-d** skill'),
        ['cratis-a', 'cratis-b', 'cratis-c', 'cratis-d']);
});

test('every name on a skills list line is a reference', () => {
    assert.deepEqual(skillReferences('- skills: **cratis-a**, **cratis-b**.'), ['cratis-a', 'cratis-b']);
    assert.deepEqual(skillReferences('- skill: **cratis-a** — the workflow.'), ['cratis-a']);
});

test('a path into the skill directory is a reference', () => {
    assert.deepEqual(skillReferences('- `.cratis/ai/skills/cratis-chronicle-event-modeling/SKILL.md` — vocabulary'), ['cratis-chronicle-event-modeling']);
});

test('a bold word that is not used as a skill is not a reference', () => {
    assert.deepEqual(skillReferences('See the **add-reactor** prompt, the `read-model-injection` reference and **git-commits**.'), []);
    assert.deepEqual(skillReferences('The skills live in `.cratis/ai/skills/`.'), []);
});

test('the check names a planted reference to a skill that does not exist', () => {
    const problems = danglingSkillReferences([
        { path: 'rules/planted.md', content: 'Invoke the **write-specs** skill and the **cratis-real** skill.' },
    ], ['cratis-real']);
    assert.deepEqual(problems, ["rules/planted.md names skill 'write-specs', which has no directory in .cratis/ai/skills."]);
});

test('every skill named in a rule, prompt or agent resolves to a skill directory', () => {
    const skillNames = readdirSync(join(corpus, 'skills'), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);
    const entries = ['rules', 'prompts', 'agents'].flatMap(directory => readdirSync(join(corpus, directory))
        .filter(name => name.endsWith('.md'))
        .map(name => ({ path: `${directory}/${name}`, content: readFileSync(join(corpus, directory, name), 'utf8') })));
    assert.deepEqual(danglingSkillReferences(entries, skillNames), []);
});
