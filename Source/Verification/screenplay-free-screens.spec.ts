// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import type { Fence } from './play/Fence.ts';
import { parseFences } from './play/fences.ts';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const skills = join(repositoryRoot, '.cratis/ai/skills');
const read = (path: string) => readFileSync(join(skills, path), 'utf8');

const freeScreens = 'cratis-screenplay-ui-composition/references/free-screens.md';
const sceneDesign = 'cratis-screenplay-ui-composition/references/scene-design.md';
const designSystem = 'cratis-screenplay-ui-composition/references/design-system-and-themes.md';
const screensBeforeSlices = 'cratis-screenplay-slice-design/references/screens-before-slices.md';
const proposals = 'cratis-screenplay-model-authoring/references/free-screens-proposals.md';
const contractPath = 'cratis-screenplay-toolchain/references/screenplay-contract.json';

const freeScreenDiagnostics = Array.from({ length: 16 }, (_, index) => `PLAY${1149 + index}`);

const fencesOf = (path: string): Fence[] => parseFences(path, read(path)).fences;
const indentation = (line: string) => line.length - line.trimStart().length;

interface Need { name: string; list: boolean }
interface Provision { need: string; query: string }
interface Adoption { screen: string; provisions: Provision[] }

/** What a fence declares about free screens, read the way a reviewer reads it. */
function inspect(fence: Fence) {
    const lines = fence.source.split('\n');
    const shapes: string[] = [];
    const queries = new Set<string>();
    const screens = new Map<string, Need[]>();
    const adoptions: Adoption[] = [];
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const text = line.trim();
        const depth = indentation(line);
        const body = () => {
            const end = lines.findIndex((candidate, candidateIndex) => candidateIndex > index && candidate.trim() !== '' && indentation(candidate) <= depth);
            return lines.slice(index + 1, end < 0 ? lines.length : end);
        };
        // Only a top-level shape declares a contract; an indented one names it as a sample data pack's rows.
        const shape = /^shape (\w+)$/.exec(line);
        if (shape) shapes.push(shape[1]);
        const query = /^query (\w+) =>/.exec(text);
        if (query) queries.add(query[1]);
        const screen = /^screen (\w+)$/.exec(text);
        if (screen) {
            const needs: Need[] = [];
            for (const candidate of body()) {
                const need = /^data (\w+)(\[\])?(?: as (\w+))?$/.exec(candidate.trim());
                if (need) needs.push({ name: need[3] ?? need[1], list: need[2] !== undefined });
            }
            screens.set(screen[1], needs);
        }
        const adoption = /^uses screen (\w+)$/.exec(text);
        if (adoption) {
            const provisions: Provision[] = [];
            for (const candidate of body()) {
                const provision = /^data (\w+) via query (\w+)(?: by \w+)?$/.exec(candidate.trim());
                if (provision) provisions.push({ need: provision[1], query: provision[2] });
            }
            adoptions.push({ screen: adoption[1], provisions });
        }
    }
    return { shapes, queries, screens, adoptions };
}

test('every free-screen example is a coherent document: adopted screens exist, provisions meet needs, queries are declared', () => {
    const fences = fencesOf(freeScreens);
    assert.ok(fences.length >= 4, 'the free screens reference lost its examples');
    let shapes = 0;
    let adoptions = 0;
    let provisions = 0;
    let aliases = 0;
    for (const fence of fences) {
        const { shapes: declaredShapes, queries, screens, adoptions: adopted } = inspect(fence);
        shapes += declaredShapes.length;
        aliases += [...screens.values()].flat().filter(need => !declaredShapes.includes(need.name)).length;
        for (const adoption of adopted) {
            adoptions++;
            const needs = screens.get(adoption.screen);
            assert.ok(needs, `${fence.file}:${fence.line} adopts ${adoption.screen}, which the example does not declare`);
            for (const provision of adoption.provisions) {
                provisions++;
                assert.ok(needs.some(need => need.name === provision.need), `${fence.file}:${fence.line} provides ${provision.need}, which ${adoption.screen} does not need`);
                assert.ok(queries.has(provision.query), `${fence.file}:${fence.line} provides ${provision.need} from ${provision.query}, which no slice declares`);
            }
            for (const need of needs) {
                assert.ok(adoption.provisions.some(provision => provision.need === need.name), `${fence.file}:${fence.line} adopts ${adoption.screen} without providing ${need.name}`);
            }
        }
    }
    // A scan that finds nothing proves nothing.
    assert.ok(shapes > 0 && adoptions > 0 && provisions > 0 && aliases > 0, 'the examples no longer show shapes, adoptions, provisions and aliases');
});

test('free-screen examples never use the rejected forms', () => {
    for (const fence of fencesOf(freeScreens)) {
        let storyline = false;
        for (const line of fence.source.split('\n')) {
            if (indentation(line) === 0 && line.trim() !== '') storyline = line.startsWith('storyline ');
            // A storyline step may carry a quoted note; a declaration never carries a quoted name.
            if (!storyline) assert.doesNotMatch(line, /^\s*screen \w+ "/, `${fence.file}:${fence.line} a screen title is the title directive, not a quoted name`);
        }
    }
});

test('the free-screen examples are compiled against the pinned contract', () => {
    const contract = JSON.parse(read(contractPath)) as { diagnostics: Array<{ code: string }> };
    for (const code of freeScreenDiagnostics) assert.ok(contract.diagnostics.some(diagnostic => diagnostic.code === code), `the pinned contract must carry ${code}`);
    for (const fence of fencesOf(freeScreens)) assert.equal(fence.excerpt, false, `${fence.file}:${fence.line} free-screen examples compile against the pin: drop the excerpt marker (a design-only screen needs expect PLAY1164)`);
});

test('the guidance states the severities and the gate the compiler actually has', () => {
    const syntax = read(freeScreens);
    assert.match(syntax, /There is no separate release flag/);
    assert.match(syntax, /--warnaserror/);
    assert.doesNotMatch(syntax, /--release/, 'the compiler has no --release flag');
    assert.match(syntax, /Warning `PLAY1155`/);
    assert.match(syntax, /Information `PLAY1164`; never fails any gate/);
    assert.match(syntax, /design-only/);
    assert.match(syntax, /no key, identifier, subject or generated modifier/);
    for (const code of freeScreenDiagnostics) {
        assert.ok(syntax.includes(`\`${code}\``), `the free screens reference does not explain ${code}`);
        assert.ok(read('cratis-screenplay-toolchain/references/diagnostics.md').includes(`\`${code}\``), `the toolchain diagnostics index does not list ${code}`);
    }
});

test('every free-screen reference is reachable from the skill that owns it', () => {
    assert.match(read('cratis-screenplay-ui-composition/SKILL.md'), /references\/free-screens\.md/);
    assert.match(read('cratis-screenplay-ui-composition/SKILL.md'), /references\/scene-design\.md/);
    assert.match(read('cratis-screenplay-slice-design/SKILL.md'), /references\/screens-before-slices\.md/);
    assert.match(read('cratis-screenplay-model-authoring/SKILL.md'), /references\/free-screens-proposals\.md/);
    assert.match(read(freeScreens), /screens-before-slices\.md/);
    assert.match(read(freeScreens), /free-screens-proposals\.md/);
    assert.match(read(screensBeforeSlices), /free-screens\.md/);
    assert.match(read(proposals), /free-screens\.md/);
});

test('typed proposals name every free-screen syntax node and keep the accepted and refused outcomes apart', () => {
    const content = read(proposals);
    for (const node of ['ShapeSyntax', 'ScreenSyntax', 'ScreenNeedSyntax', 'UsesScreenSyntax', 'ScreenProvisionSyntax', 'ScreenProvisionMappingSyntax']) {
        assert.ok(content.includes(`\`${node}\``), `the proposals reference does not name ${node}`);
    }
    assert.match(content, /accepted with warning\*\* `PLAY1155`/);
    assert.match(content, /`PLAY1156` to `PLAY1163` and \*\*cannot be applied\*\*/);
});

test('the design system guidance makes components the rendering contract and keeps maps to out of the model', () => {
    const content = read(designSystem);
    assert.match(content, /## Components are the rendering contract/);
    assert.match(content, /A renderer never reads a token by name\./);
    assert.match(content, /the Screenplay `design system` has no `maps to`/);
    for (const required of ['--ds-<component>-<variant>-<part>', 'variantProperty', 'variantValues', 'componentUnbound', 'partUnsupported', 'variantUnsupported', 'stateUnsupported']) {
        assert.ok(content.includes(required), `the design system guidance is missing ${required}`);
    }
    for (const fence of fencesOf(designSystem)) {
        assert.doesNotMatch(fence.source, /\bmaps to\b/, `${fence.file}:${fence.line} a design system has no maps to line`);
    }
});

test('Scene Design guidance runs a tool loop, refuses free styling and sends missing design-system needs to the draft', () => {
    const content = read(sceneDesign);
    for (const required of ['Repair inside the loop.', 'freeStylingNotAllowed', 'offSystemValue', 'variantNotInDesignSystem', 'The canvas edits **screens only**.', 'design-system **draft**', 'A new screen is a free screen.']) {
        assert.ok(content.includes(required), `the Scene Design guidance is missing ${required}`);
    }
    for (const operation of ['addScreen', 'removeScreen', 'moveScreen', 'insert', 'set', 'remove', 'move', 'link', 'profile', 'variations', 'tweaks', 'refuse']) {
        assert.ok(content.includes(`\`${operation}\``), `the Scene Design guidance does not list the ${operation} operation`);
    }
    // Every refusal the agent is told about is a camelCase code, and the worked refusal is valid JSON.
    const json = /```json\n([\s\S]*?)```/.exec(content);
    assert.ok(json, 'the Scene Design guidance lost its refusal example');
    const refusal = JSON.parse(json[1]) as { applied: boolean; code: string; alternatives: Array<{ label: string }> };
    assert.equal(refusal.applied, false);
    assert.match(refusal.code, /^[a-z][A-Za-z]+$/);
    assert.ok(refusal.alternatives.length >= 2, 'a refusal carries an alternative and a design-system proposal');
});
