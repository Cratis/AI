// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    lineCount, markdownHeadings, maximumSkillBodyCharacters, maximumSkillBodyLines,
    referenceContentsProblems, skillAssertionFileProblem, skillBody, skillContainsAssertionProblems,
    skillReferenceProblems, skillStructureProblems, withReferenceContents,
} from './skill-structure.ts';

function skill(fields: Record<string, unknown> = {}, body = '# Skill\n'): string {
    return `---\n${Object.entries({ name: 'cratis-example', description: 'Use for an example.', ...fields }).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n${body}`;
}

function longReference(headings = '## First\n\nFirst prose.\n\n## Second\n\nSecond prose.\n', prefix = '# Reference\n\n'): string {
    return prefix + headings + 'More prose.\n'.repeat(105);
}

test('valid frontmatter values include name and string length boundaries', () => {
    assert.deepEqual(skillStructureProblems('SKILL.md', skill()), []);
    for (const name of ['a', '0', 'a-b-1', 'a'.repeat(64)]) assert.deepEqual(skillStructureProblems('SKILL.md', skill({ name })), []);
    for (const description of ['a', 'a'.repeat(1024)]) assert.deepEqual(skillStructureProblems('SKILL.md', skill({ description })), []);
    for (const compatibility of ['a', 'a'.repeat(500)]) assert.deepEqual(skillStructureProblems('SKILL.md', skill({ compatibility })), []);
});

test('invalid name characters, separators, reserved words and lengths are rejected', () => {
    for (const name of ['', '-a', 'a-', 'a--b', 'A', 'a_b', 'a b', 'claude-x', 'x-anthropic', 'a'.repeat(65), 1]) {
        assert.match(skillStructureProblems('path/SKILL.md', skill({ name }))[0], /path\/SKILL.md name must/);
    }
});

test('description must be a nonempty string no longer than 1024 characters', () => {
    for (const description of ['', 'a'.repeat(1025), 1, null]) assert.match(skillStructureProblems('SKILL.md', skill({ description }))[0], /description must be a string/);
});

test('description rejects tags and generic types but permits arrows and unclosed comparisons', () => {
    for (const description of ['ConceptAs<T>', '<tag>hello</tag>', '<!-- comment -->', '<>']) assert.match(skillStructureProblems('SKILL.md', skill({ description }))[0], /XML\/HTML/);
    for (const description of ['a -> b', 'x < y']) assert.deepEqual(skillStructureProblems('SKILL.md', skill({ description })), []);
});

test('optional compatibility must be a nonempty string no longer than 500 characters', () => {
    for (const compatibility of ['', 'a'.repeat(501), false, null]) assert.match(skillStructureProblems('SKILL.md', skill({ compatibility }))[0], /compatibility must/);
});

test('body line budget excludes frontmatter and does not count an artificial trailing line', () => {
    const body = 'text\n'.repeat(maximumSkillBodyLines);
    assert.equal(skillBody(skill({}, body)), body);
    assert.equal(lineCount(body), maximumSkillBodyLines);
    assert.deepEqual(skillStructureProblems('SKILL.md', skill({}, body)), []);
    assert.match(skillStructureProblems('SKILL.md', skill({}, body + 'text\n'))[0], /body exceeds 500 lines/);
    assert.equal(lineCount(''), 0);
    assert.equal(lineCount('text'), 1);
});

test('body character budget is explicitly approximate and includes all body characters', () => {
    assert.deepEqual(skillStructureProblems('SKILL.md', skill({}, 'a'.repeat(maximumSkillBodyCharacters))), []);
    assert.match(skillStructureProblems('SKILL.md', skill({}, 'a'.repeat(maximumSkillBodyCharacters + 1)))[0], /~5000-token budget \(20000 chars/);
});

test('CRLF frontmatter and multiline YAML descriptions are read correctly', () => {
    const content = '---\r\nname: example\r\ndescription: >-\r\n  Use for\r\n  an example.\r\n---\r\n# Example\r\n';
    assert.equal(skillBody(content), '# Example\r\n');
    assert.deepEqual(skillStructureProblems('SKILL.md', content), []);
    assert.equal(skillBody('# No frontmatter\n'), '# No frontmatter\n');
});

test('direct references accept both links and code spans, but not references only in frontmatter', () => {
    assert.deepEqual(skillReferenceProblems('SKILL.md', '[Read](references/a.md) and `references/b.md`', ['references/a.md', 'references/b.md']), []);
    const problems = skillReferenceProblems('path/SKILL.md', skillBody(skill({ description: 'Read references/a.md' })), ['references/a.md', 'nested/b.md']);
    assert.equal(problems.length, 2);
    assert.match(problems[0], /path\/SKILL.md.*references\/a.md.*only reachable through another file, or not at all/);
});

test('headings in backtick and tilde fences with info strings are ignored', () => {
    const content = '# Title\n```play\n## Hidden\n```\n~~~markdown\n## Also hidden\n~~~\n````markdown\n```\n## Still hidden\n````\n## Real ###\n### Child\n';
    assert.deepEqual(markdownHeadings(content).map(heading => [heading.level, heading.text]), [[1, 'Title'], [2, 'Real'], [3, 'Child']]);
    const generated = withReferenceContents(longReference(content, ''));
    assert.ok(!generated.slice(0, generated.indexOf('```play')).includes('Hidden'));
    assert.deepEqual(referenceContentsProblems('reference.md', generated), []);
});

test('references of at most 100 lines need no Contents list', () => {
    const short = 'text\n'.repeat(100);
    assert.deepEqual(referenceContentsProblems('reference.md', short), []);
    assert.equal(withReferenceContents(short), short);
    assert.match(referenceContentsProblems('reference.md', short + 'text\n')[0], /no H2\/H3 headings/);
});

test('generator inserts after title and blank line, lists H2s only, and is idempotent', () => {
    const original = longReference('## First\n### Child\n## Second\n');
    const generated = withReferenceContents(original);
    const block = '## Contents\n\n- First\n- Second\n\n';
    assert.equal(generated, original.slice(0, '# Reference\n\n'.length) + block + original.slice('# Reference\n\n'.length));
    assert.deepEqual(referenceContentsProblems('reference.md', generated), []);
    assert.equal(withReferenceContents(generated), generated);
});

test('generator preserves introductory prose and repairs a misplaced Contents list', () => {
    const original = longReference(undefined, '# Reference\n\nIntroductory prose.\n\n');
    const generated = withReferenceContents(original);
    assert.deepEqual(referenceContentsProblems('reference.md', generated), []);
    assert.equal(generated.replace('## Contents\n\n- First\n- Second\n\n', ''), original);
    const misplaced = original.replace('## First', '## Contents\n\n- Wrong\n\n## First');
    assert.equal(withReferenceContents(misplaced), generated);
    assert.equal(withReferenceContents(withReferenceContents(misplaced)), generated);
});

test('generator uses line 1 without an H1 and preserves CRLF and a missing trailing newline', () => {
    const original = longReference(undefined, '').replaceAll('\n', '\r\n').replace(/\r\n$/, '');
    const generated = withReferenceContents(original);
    assert.equal(generated, '## Contents\r\n\r\n- First\r\n- Second\r\n\r\n' + original);
    assert.deepEqual(referenceContentsProblems('reference.md', generated), []);
    assert.equal(withReferenceContents(generated), generated);
});

test('H3 fallback handles zero H2s and nests H3s under a sole H2', () => {
    const onlyThirdLevel = withReferenceContents(longReference('### First\n### Second\n'));
    assert.ok(onlyThirdLevel.includes('## Contents\n\n- First\n- Second\n\n'));
    assert.deepEqual(referenceContentsProblems('reference.md', onlyThirdLevel), []);
    const nested = withReferenceContents(longReference('## Parent\n### First\n### Second\n'));
    assert.ok(nested.includes('## Contents\n\n- Parent\n  - First\n  - Second\n\n'));
    assert.deepEqual(referenceContentsProblems('reference.md', nested), []);
    assert.match(referenceContentsProblems('reference.md', nested.replace('  - First', '  - Wrong'))[0], /exactly match/);
});

test('long references without H2 or H3 headings require human resolution', () => {
    const original = longReference('```markdown\n## Fenced only\n```\n');
    assert.match(referenceContentsProblems('reference.md', original)[0], /reference.md.*human must add headings/);
    assert.equal(withReferenceContents(original), original);
});

test('Contents checker detects missing, misplaced, duplicate, reordered and non-bullet entries', () => {
    const generated = withReferenceContents(longReference());
    assert.equal(referenceContentsProblems('reference.md', longReference()).length, 1);
    for (const content of [
        generated.replace('## Contents', 'Prose.\n\n## Contents'),
        generated + '## Contents\n\n- First\n- Second\n',
        generated.replace('- First\n- Second', '- Second\n- First'),
        generated.replace('- First', 'First'),
        generated.replace('- First', '- First changed'),
    ]) assert.equal(referenceContentsProblems('reference.md', content).length, 1);
});

test('generator replaces only an incorrect existing Contents section', () => {
    const generated = withReferenceContents(longReference());
    const incorrect = generated.replace('- First\n- Second', '- Wrong');
    assert.match(referenceContentsProblems('reference.md', incorrect)[0], /exactly match/);
    assert.equal(withReferenceContents(incorrect), generated);
    assert.equal(withReferenceContents(withReferenceContents(incorrect)), generated);
    const duplicate = generated.replace('## First', '## Contents\n\n- Wrong\n\n## First');
    assert.equal(withReferenceContents(duplicate), generated);
});

test('checker accepts optional nested H3 entries when the H2 entries match', () => {
    const generated = withReferenceContents(longReference('## First\n### Child\n## Second\n'));
    const nested = generated.replace('- First\n- Second', '- First\n  - Child\n- Second');
    assert.deepEqual(referenceContentsProblems('reference.md', nested), []);
    assert.equal(withReferenceContents(nested), nested);
});

test('assertion file paths reject POSIX and Windows directory escapes', () => {
    for (const file of ['../secret.md', 'references/../../secret.md', '/secret.md', 'C:\\secret.md', '..\\secret.md', '\\server\\secret.md', '', null]) {
        assert.ok(skillAssertionFileProblem(file), String(file));
    }
    for (const file of ['references/example.md', './references/example.md', 'references/a..b.md']) assert.equal(skillAssertionFileProblem(file), undefined);
});

test('skill-contains retains SKILL.md semantics and supports reference content with explicit missing/unsafe failures', () => {
    assert.deepEqual(skillContainsAssertionProblems('verification.json', { kind: 'skill-contains', value: 'example' }, 'An example'), []);
    assert.equal(skillContainsAssertionProblems('verification.json', { kind: 'other', value: 'example' }, 'An example').length, 1);
    const assertion = { kind: 'skill-contains', value: 'reference only', file: 'references/example.md' };
    assert.deepEqual(skillContainsAssertionProblems('verification.json', assertion, 'reference only'), []);
    assert.equal(skillContainsAssertionProblems('verification.json', assertion, 'SKILL.md only').length, 1);
    assert.match(skillContainsAssertionProblems('verification.json', assertion, undefined)[0], /file does not exist/);
    assert.match(skillContainsAssertionProblems('verification.json', { ...assertion, file: '../secret.md' }, 'reference only')[0], /must not escape/);
});
