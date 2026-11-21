// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const corpus = resolve(import.meta.dirname, '../../.cratis/ai');
const read = (path: string) => readFileSync(resolve(corpus, path), 'utf8');

// Cratis.Specifications declares ShouldContain<T>(IEnumerable<T>, Func<T, bool>); there is no Predicate<T> overload.
for (const path of [
    'rules/specs.csharp.md',
    'harnesses/copilot/instructions/specs.csharp.instructions.md',
    'skills/cratis-specifications-csharp/references/csharp-patterns.md',
]) {
    test(`${path} advertises the Func<T, bool> collection ShouldContain overload`, () => {
        const content = read(path);
        assert.match(content, /ShouldContain\(Func<T, bool>\)/);
        assert.doesNotMatch(content, /ShouldContain\(Predicate<T>\)/);
    });
}

test('the Specifications C# patterns pass a typed Predicate only through a lambda adapter', () => {
    const content = read('skills/cratis-specifications-csharp/references/csharp-patterns.md');
    const typedFunc = /Func<[^\n]*?, bool> (\w+) = [^\n]*\n[^\n]*\.ShouldContain\((\w+)\);/.exec(content);
    assert.ok(typedFunc && typedFunc[1] === typedFunc[2], 'a typed Func<T, bool> example passes the delegate directly');
    assert.match(content, /\.ShouldContain\((\w+) => \1\.[^\n]*\);/, 'an inline lambda example');
    const predicates = [...content.matchAll(/Predicate<[^\n]*?> (\w+) = /g)].map(match => match[1]);
    assert.ok(predicates.length > 0, 'a typed Predicate<T> example');
    for (const name of predicates) {
        assert.doesNotMatch(content, new RegExp(`\\.ShouldContain\\(${name}\\)`), `${name} is passed directly`);
        assert.match(content, new RegExp(`\\.ShouldContain\\((\\w+) => ${name}\\(\\1\\)\\)`), `${name} is adapted`);
    }
});

// Arc's generated plain query returns [result, perform, setSorting, setPage, setPageSize];
// an observable query has no perform: [result, setSorting, setPage, setPageSize].
for (const path of [
    'rules/typescript.md',
    'harnesses/copilot/instructions/typescript.instructions.md',
    'skills/cratis-arc-query-paging/SKILL.md',
]) {
    test(`${path} binds the paging setter at the right tuple slot`, () => {
        const content = read(path);
        const isObservable = (index: number) => /observable/i.test(content.slice(0, index).split('\n').at(-2) ?? '');
        const destructurings = [...content.matchAll(/const \[([^\]]*)\]\s*=\s*\S+?\.useWithPaging\(/g)];
        assert.ok(destructurings.some(match => isObservable(match.index)), 'an observable example');
        assert.ok(destructurings.some(match => !isObservable(match.index)), 'a plain example');
        for (const match of destructurings) {
            const slots = match[1].split(',').map(slot => slot.trim());
            const expected = isObservable(match.index) ? 2 : 3;
            const pageSetter = slots.findIndex(slot => /page(?!size)/i.test(slot) && /^set/i.test(slot));
            assert.equal(pageSetter, expected, `${match[0]} binds the page setter at slot ${pageSetter}`);
        }
    });
}

// A live Arc slice page is stateful but never storied; reusable components still are.
for (const path of ['rules/frontend-quality.md', 'harnesses/copilot/instructions/frontend-quality.instructions.md']) {
    test(`${path} applies the live-page Storybook exclusion in its checklist`, () => {
        const item = read(path).split('\n').find(line => line.includes('Storybook stories'));
        assert.ok(item, 'the Storybook checklist item');
        assert.match(item, /reusable/);
        assert.match(item, /except live slice pages wired directly to Arc hooks/);
        assert.match(item, /\]\(\.\/storybook(?:\.instructions)?\.md\)/);
        assert.match(item, /behavior specs and the running app/);
    });
}

test('the Storybook rule keeps reusable components storied and live slice pages unstoried', () => {
    const content = read('rules/storybook.md');
    assert.match(content, /Write stories for \*\*reusable components\*\*/);
    assert.match(content, /Do \*\*not\*\* story live slice pages wired directly to Arc query\/command hooks/);
});

// The scenario rule and decision reference forbid a race scenario; authors and reviewers must agree.
const scenarioEntryPoints = [
    'agents/spec-writer.md',
    'harnesses/opencode/agents/spec-writer.md',
    'harnesses/pi/agents/spec-writer.md',
    'skills/cratis-code-review/SKILL.md',
];

for (const path of scenarioEntryPoints) {
    test(`${path} adds no scenario beyond the decision table and proves races from supplied state`, () => {
        const content = read(path).replace(/\s+/g, ' ');
        assert.match(content, /specs\.scenarios\.csharp\.md/);
        assert.match(content, /reactor dispatch and routing\)/);
        assert.doesNotMatch(content, /reactor dispatch and routing\) plus/);
        assert.doesNotMatch(content, /race[- ]policy/i);
        assert.match(content, /concurrent writers[^.]*supplied read-model state/);
        assert.match(content, /(?:never with|not) a race scenario/);
    });
}

test('the scenario reference still forbids a race scenario', () => {
    const content = read('skills/cratis-application-slice-specifications/references/query-and-decision-scenarios.md');
    assert.match(content, /Do not add a scenario to prove a race/);
    assert.match(read('rules/specs.scenarios.csharp.md'), /add a scenario for each behavior listed, and none beyond it/);
});

const identityReference = 'skills/cratis-arc-authentication-authorization-and-identity/references/command-identity.md';
for (const path of [
    'skills/cratis-arc-authentication-authorization-and-identity/SKILL.md',
    'skills/cratis-arc-command/references/decisions-and-routing.md',
    'skills/cratis-arc-command-operation/SKILL.md',
    'skills/cratis-chronicle-client-dotnet/SKILL.md',
    'skills/cratis-chronicle-compliance/SKILL.md',
]) {
    test(`${path} routes command identity and audit questions to the shared reference`, () => {
        const link = /\]\(([^)]+command-identity\.md)\)/.exec(read(path));
        assert.ok(link, 'a direct identity-reference link');
        assert.equal(resolve(corpus, path, '..', link[1]), resolve(corpus, identityReference));
    });
}

test('command identity separates the actor, a lookup key, authorization and Chronicle attribution', () => {
    const content = read(identityReference);
    for (const api of [
        'ICurrentPrincipalAccessor.Current', 'IAsyncParameterDependencyResolver', 'ParameterDependencyResolution.NotResolved',
        'ParameterDependencyResolution.Resolved', 'ICanResolveParameterDependency', 'AuthorizationResult.Failure',
        'LookUpBy<CallerSubject>', 'CallerClaim', 'IReadModelKeyProvider', 'ReadModelKeyLookup', 'CommandCaller.Single',
        'IIdentityProvider.GetCurrent()', 'EventContext.CausedBy', 'Identity.OnBehalfOf',
    ]) {
        assert.ok(content.includes(api), `${api} is explained`);
    }
    assert.match(content, /Chronicle first[^.]*application resolvers/);
    assert.match(content, /IsAuthenticated: true/);
    assert.match(content, /(?:no|never a) privileged fallback/i);
    assert.match(content, /(?:neither|not)[^.]*permission/i);
    assert.match(content, /per-stream/);
    assert.match(content, /not[^.]*event payloads/i);
    assert.doesNotMatch(content, /AssemblyQualifiedName|Type\.GetType|\.GetAwaiter\(\)\.GetResult\(\)/);
});

test('read-model injection includes caller keys without an unconditional command-key claim', () => {
    const content = read('skills/cratis-arc-command/references/read-model-injection.md');
    assert.match(content, /LookUpBy<CallerSubject>/);
    assert.match(content, /IReadModelKeyProvider/);
    assert.match(content, /command-identity\.md/);
    assert.doesNotMatch(content, /in all three, under `Off`/i);
    assert.doesNotMatch(content, /resolves it[^.]*by the command's resolved key/i);
});
