// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import test from 'node:test';
import { bundlePins, bundleTable, pinRestatements, scaffoldPins, scaffoldTable, type PinException } from './pin-restatements.ts';

const root = resolve(import.meta.dirname, '../..');

const scaffold = `## Scaffold pins

| Item | Value |
| --- | --- |
| Arc packages (\`Cratis\`) | \`22.68.0\` (below Arc 22.70) |
| Chronicle client | \`Cratis.Chronicle\` \`19.45.0\`, matched to the \`19.45.0-development\` image |
| Frontend | Vite 8.3.0; \`@cratis/arc\`, \`arc.react\` 22.58.2; \`@cratis/components\` 4.26.2; \`@cratis/scene\` 4.21.0; \`@cratis/fundamentals\` 7.22.8 |
`;
const bundle = `| Source | Pin | Evidence |
| --- | --- | --- |
| cratis CLI | **3.53.1** | tag |
| Cratis.Arc.Screenplay bundled by CLI | **22.54.0** | file |
`;
const pins = [...scaffoldPins(scaffold), ...bundlePins(bundle)];

test('pins are parsed from the tables, not hardcoded', () => {
    assert.deepEqual(pins.map(pin => `${pin.label}=${pin.value}`), [
        'Arc=22.68.0', 'Chronicle=19.45.0', '@cratis/arc=22.58.2', '@cratis/components=4.26.2', '@cratis/scene=4.21.0', 'Cratis.Arc.Screenplay=22.54.0']);
    assert.equal(scaffoldPins(scaffold.replaceAll('22.68.0', '22.99.0'))[0].value, '22.99.0');
});

test('a planted restatement outside the central tables is found', () => {
    const report = pinRestatements([{ path: 'skills/a/SKILL.md', content: 'ok\nThe scaffold pins Arc 22.68.0 today.' }], pins, []);
    assert.equal(report.problems.length, 1);
    assert.match(report.problems[0], /skills\/a\/SKILL\.md:2 restates the current Arc pin 22\.68\.0/);
});

test('the central tables themselves and bare CLI or Stage versions are not flagged', () => {
    const report = pinRestatements([
        { path: scaffoldTable, content: 'Arc 22.68.0' },
        { path: bundleTable, content: 'Arc.Screenplay 22.54.0' },
        { path: 'skills/a/SKILL.md', content: 'Refused at Stage 4.73.1 and probed with CLI 3.53.1; a 122.68.0 or 22.68.01 is another number.' },
    ], pins, []);
    assert.deepEqual(report.problems, []);
});

test('an allowlisted occurrence passes and is counted', () => {
    const exceptions: PinException[] = [{ file: 'skills/a/SKILL.md', text: 'verified at Arc v22.68.0', reason: 'verification tag' }];
    const report = pinRestatements([{ path: 'skills/a/SKILL.md', content: 'Behavior verified at Arc v22.68.0.' }], pins, exceptions);
    assert.deepEqual(report.problems, []);
    assert.equal(report.allowed, 1);
});

test('an allowlist entry covers only its own occurrence, not the rest of the line', () => {
    const exceptions: PinException[] = [{ file: 'skills/a/SKILL.md', text: 'verified at Arc v22.68.0', reason: 'verification tag' }];
    const report = pinRestatements([{ path: 'skills/a/SKILL.md', content: 'Behavior verified at Arc v22.68.0; the scaffold pins Arc 22.68.0.' }], pins, exceptions);
    assert.equal(report.problems.length, 1);
    assert.match(report.problems[0], /restates the current Arc pin 22\.68\.0/);
});

test('a stale allowlist entry fails', () => {
    const exceptions: PinException[] = [{ file: 'skills/a/SKILL.md', text: 'verified at Arc v22.68.0', reason: 'verification tag' }];
    const report = pinRestatements([{ path: 'skills/a/SKILL.md', content: 'Nothing to see.' }], pins, exceptions);
    assert.equal(report.problems.length, 1);
    assert.match(report.problems[0], /matches nothing any more/);
});

test('an allowlist entry without a reason fails', () => {
    const report = pinRestatements([{ path: 'a.md', content: 'Arc v22.68.0' }], pins, [{ file: 'a.md', text: 'Arc v22.68.0', reason: ' ' }]);
    assert.match(report.problems.join('\n'), /has no reason/);
});

test('the check is not vacuous', () => {
    assert.match(pinRestatements([{ path: 'a.md', content: 'x' }], [], []).problems.join('\n'), /No dependency pins/);
    assert.match(pinRestatements([], pins, []).problems.join('\n'), /No skill files/);
});

test('the real corpus restates no current pin outside the central tables', () => {
    const walk = (directory: string): string[] => readdirSync(directory).flatMap(name => {
        const path = join(directory, name);
        if (name === 'node_modules') return [];
        return statSync(path).isDirectory() ? walk(path) : /\.(md|json)$/.test(name) ? [path] : [];
    });
    const files = [join(root, '.cratis/ai/skills'), join(root, 'Evaluations/skills')].flatMap(walk).map(path => ({ path: relative(root, path), content: readFileSync(path, 'utf8') }));
    const exceptions = JSON.parse(readFileSync(join(import.meta.dirname, 'pin-restatement-exceptions.json'), 'utf8')) as PinException[];
    const parsed = [...scaffoldPins(readFileSync(join(root, scaffoldTable), 'utf8')), ...bundlePins(readFileSync(join(root, bundleTable), 'utf8'))];
    assert.equal(parsed.length, 6);
    assert.deepEqual(pinRestatements(files, parsed, exceptions).problems, []);
});
