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

// Ordinary decisions use supplied state; an explicit application policy may need focused boundary proof.
const scenarioEntryPoints = [
    'agents/spec-writer.md',
    'harnesses/opencode/agents/spec-writer.md',
    'harnesses/pi/agents/spec-writer.md',
    'skills/cratis-code-review/SKILL.md',
];

for (const path of scenarioEntryPoints) {
    test(`${path} keeps the decision table and the focused explicit-policy boundary`, () => {
        const content = read(path).replace(/\s+/g, ' ');
        assert.match(content, /specs\.scenarios\.csharp\.md/);
        assert.match(content, /supplied.*state/);
        assert.match(content, /platform.*matrix/);
        assert.match(content, /explicit.*guard.*policy/);
        assert.match(content, /focused.*regression/);
        assert.match(content, /query-and-decision-scenarios\.md/);
    });
}

for (const path of [
    ...scenarioEntryPoints,
    'rules/specs.scenarios.csharp.md',
    'harnesses/copilot/instructions/specs.scenarios.csharp.instructions.md',
    'skills/cratis-specifications-csharp/SKILL.md',
    'skills/cratis-application-slice-specifications/SKILL.md',
    'skills/cratis-arc-command-validation/SKILL.md',
    'skills/cratis-chronicle-decision-reads/SKILL.md',
    'skills/cratis-arc-command/references/decisions-and-routing.md',
    'skills/cratis-chronicle-decision-reads/references/choosing-how-a-rule-holds.md',
]) {
    test(`${path} avoids superseded blanket decision-read guidance`, () => {
        const content = read(path).replace(/\s+/g, ' ');
        assert.doesNotMatch(content, /never simulate competing appends|application specs never simulate/i);
        assert.doesNotMatch(content, /only decision-read spec obligation|Arc will obsolete|read protection is invisible/i);
        assert.match(content, /focused regression/);
        assert.match(content, /query-and-decision-scenarios\.md/);
    });
}

for (const path of ['rules/specs.scenarios.csharp.md', 'harnesses/copilot/instructions/specs.scenarios.csharp.instructions.md']) {
    test(`${path} keeps acquisition-failure proofs and the explicit-policy exceptions`, () => {
        const content = read(path).replace(/\s+/g, ' ');
        assert.match(content, /negative proof.*Provide\(\).*short-circuit/);
        assert.match(content, /Provide\(\).*only.*ValidationResult.*AuthorizationResult.*acquisition.*nothing usable/);
        assert.match(content, /EventsWithConcurrencyScopes/);
        assert.match(content, /\[Unprotected\]/);
        assert.doesNotMatch(content, /none beyond it|Provide\(\)` carries no validation/);
    });
}

for (const path of ['rules/specs.csharp.md', 'harnesses/copilot/instructions/specs.csharp.instructions.md']) {
    test(`${path} qualifies the xUnit default by launch path and reported measurement`, () => {
        const content = read(path).replace(/\s+/g, ' ');
        assert.match(content, /house default.*built executable/);
        assert.match(content, /running-specs\.md#local-loop/);
        assert.match(content, /dotnet test.*slower.*reported/);
    });
}

const decisionReference = 'skills/cratis-application-slice-specifications/references/query-and-decision-scenarios.md';

test('decision admission covers discovered declarations and names the body-read blind spot', () => {
    const content = read(decisionReference).replace(/\s+/g, ' ');
    assert.match(content, /using Cratis\.Arc\.Chronicle\.Testing\.Commands;/);
    assert.match(content, /DecisionReadAdmissions\.ShouldAdmitDecisionReadsIn\(typeof\(\w+\)\.Assembly\)/);
    assert.match(content, /declared.*runtime cap/);
    assert.match(content, /spec-local.*projection.*ambiguous/);
    assert.match(content, /method bodies.*not statically/);
    assert.match(content, /Admit<T>.*focused.*scenario/);
});

test('the advanced hook has a narrow purpose without an invented decision-mode requirement', () => {
    const content = read(decisionReference).replace(/\s+/g, ' ');
    assert.match(content, /AppendConcurrently.*advanced/);
    assert.match(content, /specific.*explicit need/);
    assert.match(content, /with or without decision mode.*adds no guard/);
    assert.match(content, /after response.*before.*commit/);
    assert.match(content, /UseDecisionReads.*obsolete/);
});

test('the default no-scope warning does not rule out guarded scenarios or explicit scopes', () => {
    const content = read('skills/cratis-specifications-csharp/SKILL.md').replace(/\s+/g, ' ');
    assert.match(content, /unguarded.*no-scope/);
    assert.match(content, /not a claim.*guarded.*explicit scope/);
    assert.doesNotMatch(content, /strategy that always answers/);
});

test('slow-spec guidance diagnoses measured costs and preserves discovery and coverage', () => {
    const content = read('skills/cratis-specifications-csharp/references/running-specs.md').replace(/\s+/g, ' ');
    assert.match(content, /CRATIS_SPECS_TIMINGS=1.*CRATIS_SPECS_TIMINGS_FILE/);
    assert.match(content, /startup.*discovery/);
    assert.match(content, /shared.*lifecycle/i);
    assert.match(content, /class per.*read model/);
    assert.match(content, /Discovered.*passed.*failed.*skipped/);
    assert.match(content, /measurement.*not.*universal/);
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
    assert.match(content, /\[Authorize\(Policy = "[^"]+"\)\]/);
    assert.match(content, /public AuthorizationResult Provide\(CurrentActor\? actor\) =>\s*actor is null\s*\? AuthorizationResult\.Failure/);
    assert.match(content, /SKILL\.md#validators-are-not-an-authorization-boundary/);
    assert.doesNotMatch(content, /IFeatureAccess|access\.CanEnable/);
    assert.match(content, /per-stream/);
    assert.match(content, /not[^.]*event payloads/i);
    assert.doesNotMatch(content, /AssemblyQualifiedName|Type\.GetType|\.GetAwaiter\(\)\.GetResult\(\)/);
});

test('read-model injection includes caller keys without an unconditional command-key claim', () => {
    const content = read('skills/cratis-arc-command/references/read-model-injection.md');
    assert.match(content, /LookUpBy<CallerSubject>/);
    assert.match(content, /IReadModelKeyProvider/);
    assert.match(content, /command-identity\.md/);
    assert.match(content, /supplied matching value is refused with `InvalidLookUpBy`/);
    assert.match(read('skills/cratis-arc-authentication-authorization-and-identity/references/product-sources.md'), /supplied matching value[^|]*refused with `InvalidLookUpBy`/);
    assert.doesNotMatch(content, /in all three, under `Off`/i);
    assert.doesNotMatch(content, /resolves it[^.]*by the command's resolved key/i);
});
