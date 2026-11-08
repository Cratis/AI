// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { contentRoot, filesUnder, readContent } from './content.ts';
import { stackTerms } from './stack-terms.ts';
import { pinnedScreenplayVersion, repositoryRoot } from './version.ts';

const exampleDirectory = join(contentRoot, 'skills/screenplay-language/references');
const markdown = filesUnder(contentRoot).filter(file => file.endsWith('.md'));

function fences(source: string, language: string): string[] {
    const pattern = new RegExp(`^( *)\`\`\`${language}\\n([\\s\\S]*?)^\\1\`\`\`$`, 'gm');
    return [...source.matchAll(pattern)].map(match => match[2].split('\n').map(line => line.slice(match[1].length)).join('\n').trimEnd());
}

function dedent(lines: string[]): string {
    const indent = Math.min(...lines.filter(line => line.trim()).map(line => line.length - line.trimStart().length));
    return lines.map(line => line.slice(indent)).join('\n').trimEnd();
}

/** True when the excerpt equals a run of lines in the source, after removing their shared indentation. */
export function isExcerptOf(excerpt: string, source: string): boolean {
    const wanted = excerpt.split('\n');
    const lines = source.split('\n');
    for (let start = 0; start + wanted.length <= lines.length; start++) {
        if (dedent(lines.slice(start, start + wanted.length)) === excerpt) return true;
    }
    return false;
}

test('an excerpt matches indented source lines and nothing else', () => {
    const source = 'module A\n  slice StateChange B\n    command B\n      name String\n';
    assert.ok(isExcerptOf('command B\n  name String', source));
    assert.ok(!isExcerptOf('command B\n  name Int', source));
    assert.ok(!isExcerptOf('command B\nname String', source));
});

test('the guidance names no stack', () => {
    const findings = markdown.flatMap(file => {
        const text = readFileSync(join(contentRoot, file), 'utf8');
        return stackTerms.filter(term => term.test(text)).map(term => `${file}: ${term}`);
    });
    assert.deepEqual(findings, []);
});

test('every Screenplay excerpt is taken from the compiled example model', () => {
    const example = readFileSync(join(exampleDirectory, 'example.play'), 'utf8');
    const excerpts = markdown.flatMap(file => fences(readFileSync(join(contentRoot, file), 'utf8'), 'screenplay').map(excerpt => ({ file, excerpt })));
    assert.ok(excerpts.length > 5, 'expected the guidance to show Screenplay excerpts');
    assert.deepEqual(excerpts.filter(({ excerpt }) => !isExcerptOf(excerpt, example)).map(({ file, excerpt }) => `${file}: ${excerpt.split('\n')[0]}`), []);
});

test('every relative link resolves to a file in the content', () => {
    const broken = markdown.flatMap(file => [...readFileSync(join(contentRoot, file), 'utf8').matchAll(/\]\(([^)#\s]+)(#[^)]*)?\)/g)]
        .map(match => match[1])
        .filter(target => !/^[a-z]+:/.test(target))
        .filter(target => !existsSync(resolve(dirname(join(contentRoot, file)), target)))
        .map(target => `${file} -> ${target}`));
    assert.deepEqual(broken, []);
});

test('the skills are named after their folders and say when to use them', () => {
    const skills = readContent().skills;
    assert.deepEqual(skills.map(skill => skill.name), ['screenplay-language', 'screenplay-slice-building']);
    for (const skill of skills) assert.match(skill.description, /^Use when .+ Not for .+\.$/);
});

test('the example model compiles and its specifications pass with the pinned Screenplay tool', context => {
    const version = pinnedScreenplayVersion();
    const tool = process.env.CRATIS_SCREENPLAY_TOOL ? resolve(repositoryRoot, process.env.CRATIS_SCREENPLAY_TOOL) : join(repositoryRoot, '.cache/screenplay-tool', version, 'screenplay');
    if (!existsSync(tool)) {
        assert.notEqual(process.env.CRATIS_REQUIRE_SCREENPLAY, '1', `Screenplay ${version} is required but missing at ${tool}; run yarn workspace @cratis/ai-verification run tool:screenplay`);
        context.skip(`Screenplay ${version} is not installed at ${tool}`);
        return;
    }
    const compile = spawnSync(tool, [exampleDirectory, '--warnaserror'], { encoding: 'utf8', timeout: 120_000 });
    assert.equal(compile.status, 0, `${compile.stdout}${compile.stderr}`);
    const run = spawnSync(tool, ['test', exampleDirectory], { encoding: 'utf8', timeout: 120_000 });
    assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
    assert.match(run.stdout, /passed: (\d+) discovered, \1 selected, \1 executed; \1 passed, 0 failed, 0 unsupported/);
});
