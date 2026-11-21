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

const reactPageSkill = 'skills/cratis-arc-react-page';
const commandResultReference = 'skills/cratis-arc-command/references/command-result.md';
const dataPageReference = `${reactPageSkill}/references/data-page.md`;

for (const path of [
    `${reactPageSkill}/SKILL.md`, `${reactPageSkill}/references/dialogs.md`,
    `${reactPageSkill}/references/queries-and-commands.md`, `${reactPageSkill}/references/availability.md`,
    'rules/react.md', 'harnesses/copilot/instructions/react.instructions.md',
    'agents/frontend-developer.md', 'harnesses/pi/agents/frontend-developer.md',
    'harnesses/opencode/agents/frontend-developer.md',
]) {
    test(`${path} routes result classification to its single owner`, () => {
        const content = read(path);
        assert.match(content, /command-result\.md/);
        assert.doesNotMatch(content, /\| Flag \| Meaning/);
        assert.doesNotMatch(content, /redirectToLogin\(/);
        assert.doesNotMatch(content, /isAuthorized && isValid && !hasExceptions/);
        assert.doesNotMatch(content, /CommandDialog` (?:handles all|performs all of this)/);
    });
}

test('the result owner includes optional retry and missing-handler flags and acquisition outcomes', () => {
    const content = read(commandResultReference).replace(/\s+/g, ' ');
    for (const member of [
        'readonly isRetryable?: boolean', 'readonly isMissingHandler?: boolean',
        'isSuccess', 'isAuthorized', 'isValid', 'hasExceptions', 'response',
        'severity', 'message', 'members', 'state', 'reason', 'reasonDetail',
    ]) {
        assert.ok(content.includes(member), `${member} remains in the result contract`);
    }
    assert.match(content, /IsSuccess.*IsAuthorized && IsValid && !HasExceptions/);
    assert.doesNotMatch(content, /!IsRetryable && !IsMissingHandler/);
    assert.match(content, /[Vv]alidators.*refusals.*usable facts/);
    assert.match(content, /Provide\(\).*acquisition.*nothing usable/);
    assert.match(content, /Handle\(\).*duplicate business validation/);
});

test('protected-read pairs retain the draft and do not become invalid input', () => {
    const content = read(commandResultReference);
    assert.match(content, /concurrencyViolation[^\n]*ReadChanged/);
    assert.match(content, /concurrencyViolation[^\n]*ReadIncomplete/);
    assert.doesNotMatch(content, /dependencyUnavailable[^\n]*ReadIncomplete/);
    const prose = content.replace(/\s+/g, ' ');
    for (const term of ['draft', 're-read', 'deliberate retry', 'developer English']) {
        assert.ok(prose.includes(term), `${term} remains part of refusal recovery`);
    }
    assert.match(prose, /Never mark.*input invalid/);
    assert.match(prose, /Unknown reasons.*not automatically protected-read/);
    assert.match(prose, /never show them raw/);
    assert.match(prose, /reason.*reasonDetail/);
    assert.match(prose, /rule.*members/);
});

test('the result owner exposes the raw-message helper gap without promising sanitization', () => {
    const content = read(commandResultReference).replace(/\s+/g, ' ');
    for (const reason of ['dependencyUnavailable', 'validatorFailed', 'concurrencyViolation', 'constraintViolation', 'frameworkFailure']) {
        assert.ok(content.includes(reason), `${reason} has a client treatment`);
    }
    assert.match(content, /CommandForm.*raw validation messages/);
    assert.match(content, /toastCommandResult.*joins/);
    assert.match(content, /showErrors=\{false\}/);
    assert.match(content, /validationAnnouncement/);
    assert.match(content, /onValidationFailure.*not suppress/);
    assert.match(content, /exceptionMessages/);
    assert.match(content, /exceptionStackTrace/);
});

test('server validation under read protection is feedback, not a commit reservation', () => {
    const content = read(`${reactPageSkill}/references/queries-and-commands.md`).replace(/\s+/g, ' ');
    for (const term of ['/validate', 'autoServerValidate', 'false', '500', 'On', 'fresh', 'Provide()', 'Handle()']) {
        assert.ok(content.includes(term), `${term} remains documented`);
    }
    assert.match(content, /not.*reservation/);
    assert.match(content, /cannot reuse/);
    assert.match(content, /does not promise execution success/);
});

test('availability presentation separates unknown, observation errors and a host not opted in', () => {
    const content = read(`${reactPageSkill}/references/availability.md`).replace(/\s+/g, ' ');
    for (const term of [
        '@cratis/arc.react/availability', 'AvailabilityContext', 'AvailabilityProvider', 'RequireAvailable',
        'useAvailability', 'useAvailableItems', 'whileLoading', 'unavailable', 'Availability.everything',
        'isKnown', 'NotAvailable', 'isNotAvailable', 'isRetryable',
    ]) {
        assert.ok(content.includes(term), `${term} remains documented`);
    }
    assert.match(content, /presentation only, never authorization/);
    assert.match(content, /last successful decision/);
    assert.match(content, /first query fails.*unknown/);
    assert.match(content, /unknown, error and not opted in/);
    assert.match(content, /entry without a part is always kept/);
    assert.match(read(`${reactPageSkill}/SKILL.md`), /references\/availability\.md/);
});

for (const path of ['rules/components.md', 'harnesses/copilot/instructions/components.instructions.md']) {
    test(`${path} owns the peer range and routes conditional DataPage detail`, () => {
        const content = read(path);
        assert.match(content, />=20\.3\.1 <24/);
        assert.doesNotMatch(content, />=20\.3\.1 <23/);
        assert.match(content, /references\/data-page\.md/);
        assert.doesNotMatch(content, /DataPageSelection<|event\.value|mapQueryArguments/);
    });
}

test('the page skill routes compatibility to the rule rather than maintaining another range', () => {
    const content = read(`${reactPageSkill}/SKILL.md`);
    assert.match(content, /rules\/components\.md/);
    assert.doesNotMatch(content, /20\.3\.1|below (?:23|24)/);
});

test('Page and DataPage have one main landmark owner', () => {
    const content = read(dataPageReference);
    for (const term of ['landmark={false}', '@cratis/components/Common', '<main>', '<div>', 'showTitle']) {
        assert.ok(content.includes(term), `${term} remains documented`);
    }
    assert.match(content, /DataPage.*forwards/);
    assert.match(read(`${reactPageSkill}/SKILL.md`), /landmark=\{false\}/);
});

test('AutoCommandFields uses the existing form shell rather than nesting AutoCommandForm', () => {
    const content = read(`${reactPageSkill}/references/dialogs.md`).replace(/\s+/g, ' ');
    for (const term of ['AutoCommandFields', '@cratis/components/CommandForm', 'exclude?', 'keyof TCommand', 'property descriptors']) {
        assert.ok(content.includes(term), `${term} remains documented`);
    }
    assert.match(content, /creates no form shell/);
    assert.match(content, /do not nest/);
    assert.match(content, /Steppers and column layouts are not supported/);
});

test('the DataPage reference owns typed committed selection and server mapping detail', () => {
    const content = read(dataPageReference).replace(/\s+/g, ' ');
    for (const term of [
        'MenuItem<AccountSummary>', 'DataPageSelection<', 'selectionMode', 'selectedItem', 'readonly TDataType[]',
        'null | undefined', 'committed', 'dataKey', 'reference', 'event.value',
        'disableOnUnselected', 'DataTableSelectionChangeEvent<TDataType>', 'DataTableServerQuery<TArguments>',
        'DataTableServerQueryState', '@cratis/components/DataTables', 'mapQueryArguments', 'baseArguments',
        'globalFilter', 'filters', 'sort', 'debounceMs', '250', 'filteredEmptyMessage', 'onGlobalFilterChange',
    ]) {
        assert.ok(content.includes(term), `${term} remains documented`);
    }
    assert.match(content, /disabled item cannot dispatch/);
    assert.match(content, /zero-argument callbacks/);
    assert.match(content, /not deep-frozen/);
    assert.match(content, /resets paging/);
    assert.match(content, /disables local filtering and sorting/);
    assert.match(content, /debounced.*filters and sorting apply immediately/);
    assert.doesNotMatch(content, /`command` \| `\(\) => void`|`disabled` \| `boolean`/);
});

test('React page evaluation inputs retain bounded tasks and balanced triggers', () => {
    const { evals } = JSON.parse(read('../../Evaluations/skills/cratis-arc-react-page/evals.json'));
    const { queries } = JSON.parse(read('../../Evaluations/skills/cratis-arc-react-page/trigger.json'));
    assert.ok(evals.length >= 3 && evals.length <= 5);
    assert.ok(queries.length >= 16 && queries.length <= 20);
    const positives = queries.filter((query: { shouldTrigger: boolean }) => query.shouldTrigger).length;
    const negatives = queries.length - positives;
    assert.ok(positives >= 8 && positives <= 10);
    assert.ok(negatives >= 8 && negatives <= 10);
    for (const term of ['ReadChanged', 'ReadIncomplete', 'isRetryable', 'isMissingHandler', 'availability', 'landmark', 'AutoCommandFields', 'DataPageSelection']) {
        assert.ok(JSON.stringify(evals).includes(term), `${term} has evaluation coverage`);
    }
});
