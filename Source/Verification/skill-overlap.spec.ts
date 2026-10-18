// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import test from 'node:test';
import { skillAuthoringProblems, skillOverlapFindings, skillOverlapThreshold, skillTriggerTokens } from './skill-authoring.ts';

const entry = (name: string, description: string) => ({ file: `${name}/SKILL.md`, content: `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n---\n` });

test('overlapping positive triggers warn with both locations, even under strict authoring mode', () => {
    const findings = skillOverlapFindings([
        entry('alpha', 'First purpose. Use when inspecting event streams. Not for queries.'),
        entry('beta', 'Different introduction. Use when inspecting event streams. Do not use for commands.'),
    ]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].rule, 'description-overlap');
    assert.equal(findings[0].file, 'alpha/SKILL.md');
    assert.equal(findings[0].line, 3);
    assert.match(findings[0].matchedText, /beta\/SKILL.md:3 trigger Jaccard=1.000/);
    assert.deepEqual(skillAuthoringProblems(findings, 'fail'), []);
    assert.deepEqual(skillAuthoringProblems(findings, 'warn'), []);
});

test('distinct triggers do not warn; shared introductions and negative pointers do not count', () => {
    assert.deepEqual(skillOverlapFindings([
        entry('alpha', 'Inspect streams. Use when compiling CSharp proxies. Not for inspecting event streams.'),
        entry('beta', 'Inspect streams. Use when inspecting event streams. Not for compiling CSharp proxies.'),
    ]), []);
    assert.deepEqual(skillOverlapFindings([entry('alpha', 'No trigger.'), entry('beta', 'No trigger.')]), []);
    assert.deepEqual(skillOverlapFindings([entry('alpha', 'Use when the skill is in use.'), entry('beta', 'Use when the skill is in use.')]), []);
});

test('Jaccard threshold includes exactly two shared tokens out of five, without rounding', () => {
    assert.equal(skillOverlapThreshold, 0.4);
    const left = entry('alpha', 'Use when alpha beta gamma.');
    assert.equal(skillOverlapFindings([left, entry('beta', 'Use when alpha beta delta epsilon.')]).length, 1); // 2/5
    assert.equal(skillOverlapFindings([left, entry('beta', 'Use when alpha beta delta epsilon zeta.')]).length, 0); // 2/6
    assert.equal(skillOverlapFindings([left, entry('beta', 'Use when alpha beta gamma delta epsilon.')]).length, 1); // 3/5
});

test('tokens ignore case, punctuation, repetition and routing boilerplate', () => {
    assert.deepEqual([...skillTriggerTokens('Use when Event-streams, EVENT streams and commands. Do not use for queries.')].sort(), ['commands', 'event', 'streams']);
    for (const clause of ['Use for', 'Load when', 'Read before', 'Use this skill when']) {
        assert.deepEqual([...skillTriggerTokens(`${clause} event streams. Not for commands.`)], ['event', 'streams']);
    }
});

test('pairs are unique, sorted independently of discovery order, and folded YAML keeps line numbers', () => {
    const entries = ['charlie', 'alpha', 'beta'].map(name => entry(name, 'Use when inspecting event streams.'));
    assert.deepEqual(skillOverlapFindings(entries), skillOverlapFindings([...entries].reverse()));
    assert.equal(skillOverlapFindings(entries).length, 3);
    const folded = { file: 'folded/SKILL.md', content: '---\nname: folded\ndescription: >-\n  Use when inspecting\n  event streams.\n---\n' };
    assert.equal(skillOverlapFindings([entries[0], folded]).length, 1);
    assert.deepEqual(skillOverlapFindings([entries[0], { file: 'bad/SKILL.md', content: '---\ndescription: [invalid\n---' }]), []);
    assert.deepEqual(skillOverlapFindings([entries[0], { ...entries[1], file: 'reference.md' }]), []);
});
