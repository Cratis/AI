---
name: cratis-arc-testing-typescript
description: Use when writing specs for an Arc Node.js server with @cratis/arc.testing, choosing between a direct handle() call and a pipeline scenario or testing routes and authentication. Not for React specs or framework-package tests.
license: MIT
---

# Specify an Arc Node.js server with `@cratis/arc.testing`

A spec that calls `handle()` directly skips binding, authorization, validators,
services and the result envelope. The scenarios run the real Arc pipeline
in-process, with no network listener, so a spec can prove what Arc enforces.
`@cratis/arc.testing` is runner-neutral; the samples use Vitest (describe/it
with `given`), and `node:test` works too.

## Choose the boundary that can catch the bug

| Prove | Start with | Does not prove |
| --- | --- | --- |
| A calculation or decision | direct `handle()` with explicit inputs | validation, authorization, `provide()`, services |
| Validation, authorization, `provide()`, services, response | `CommandScenario` | HTTP routing, authentication handlers, real integrations |
| Operations executing and compensating in order | `CommandScenario` with fake providers | that a real provider undid anything |
| A query's arguments, paging, sorting, result shape | `QueryScenario` | the database's own query behavior |
| A live query's emissions | `ObservableQueryScenario` | a transport or browser client |
| Route, host and authentication | `ArcScenario` with HTTP requests | business edge cases you did not send |
| Events a command appends, from pinned or seeded read models | `ChronicleCommandScenario` | aggregates, unsupported projection shapes |
| Stored events or an aggregate | `ChronicleKernelScenario` against a running kernel | n/a |

Cover decision branches with fast direct specs and add scenario specs for the
rules Arc enforces. The Chronicle scenarios are in
`cratis-arc-command-typescript` (`chronicle-events.md`).

## CommandScenario

```typescript
import { CommandScenario } from '@cratis/arc.testing';

const scenario = CommandScenario.for(ArchiveTask);      // plus validators, other artifacts
// scenario.services.addSingleton(Token, fake);          // before the first call
const result = await scenario.execute({ id: 't-1' });
result.shouldBeSuccessful();
await scenario.dispose();
```

- `CommandScenario.for(Command, ...artifacts)` takes the command and every
  decorated validator or artifact it needs; it does not discover classes.
- `execute(values | instance)` runs the full pipeline; `validate(values)` runs
  authorization and validation but never `provide()` or `handle()`.
- Register fakes on `scenario.services` before the first call
  (`addSingleton(Token, instance)`, `addScoped(Token, factory)`). Use
  `extend(builder => builder.useGeneratedMetadata(metadata))` when `handle(tasks:
  Tasks)` binds by generated metadata instead of `@inject`.
- Always `await scenario.dispose()` after the assertions (`afterAll`/`after`).
- Inputs are encoded to Arc's wire shape before the pipeline decodes them, and
  results round-trip through JSON by default; `withSerializationRoundTrip(false)`
  turns that off for a scenario.

Assertions on the result: `shouldBeSuccessful()`, `shouldNotBeSuccessful()`,
`shouldBeValid()`, `shouldHaveValidationErrors()`,
`shouldHaveValidationErrorForMember('title')`,
`shouldHaveValidationErrorBecauseOf(...)`, `shouldBeAuthorized()`,
`shouldNotBeAuthorized()`, `shouldHaveExceptions()`, `shouldNotHaveExceptions()`,
and, for operations, `shouldHaveExecutedOperation`,
`shouldHaveCompensatedOperation`, `shouldHaveNoOperationInvocations` and
`shouldHaveIndeterminateRecovery`.

### Trusted context and authorization

`scenario.withContext({ principal, tenantId, correlationId, signal })` sets the
identity a trusted direct caller passes; `withAllowedValidationSeverity(...)`
changes which severities block. Specify who may call as deliberately as what
happens: a decorator moved to the wrong class leaves an operation open and no
other spec notices. Cover nobody, somebody without the role, and somebody with
it:

```typescript
const planner = { id: 'ada', roles: ['Planner'], isAuthenticated: true };
(await scenario.execute({ id: 't-1' })).shouldNotBeAuthorized();               // anonymous
(await scenario.withContext({ principal: viewer }).execute({ id: 't-1' })).shouldNotBeAuthorized();
(await scenario.withContext({ principal: planner }).execute({ id: 't-1' })).shouldBeSuccessful();
```

## QueryScenario and ObservableQueryScenario

`QueryScenario(Model, 'method', ...artifacts)` then `perform(args, options)`
returns the `QueryResult` (paging and sorting included); `withContext` sets the
caller. `ObservableQueryScenario` opens the query through the real observable
pipeline: `collect(count, timeoutMs = 5000, args = {}, options?)` waits for up to
`count` emissions or fails at the deadline, and closes the subscription either
way. Dispose each scenario. A streaming query a scenario cannot drive throws
`StreamingQueryNotSupportedError`.

## ArcScenario: routes, hosts and authentication

`new ArcScenario({ commands: [...], queries: [...], ... })` accepts the same
registrations as `ArcServer`, plus default context fields and per-call
overrides. It delegates to a real server:

| Method | Runs |
| --- | --- |
| `executeCommand(name, input, context?)` | the direct command pipeline |
| `validateCommand(name, input, context?)` | authorization and validation only |
| `performQuery(name, input, context?, options?)` | the direct query pipeline |
| `handle(request)` | the full HTTP pipeline, authenticating with the configured handlers |

Direct calls use the context you supply; `handle` authenticates from its
handlers. `shouldHaveRuleFailure(result, { reason, member?, severity?,
correlationId? })` checks a rule failure and throws when the only failure is
`dependencyUnavailable`.

## Share a context with `given`

```typescript
export class a_task_registration {
    tasks = new Tasks();
    scenario = CommandScenario.for(RegisterTask, RegisterTaskValidator);
    constructor() { this.scenario.services.addSingleton(Tasks, this.tasks); }
}
describe('when registering a task', given(a_task_registration, context => { /* ... */ }));
```

Layout: `for_<Subject>/when_<action>/<case>.ts`, with shared setup in a `given/`
folder next to it; `discover()` skips both. See `cratis-specifications-typescript`
for the file and naming conventions. With Vitest or Vite, the transform must
lower standard decorators with `useDefineForClassFields: true`, or decorators
silently do nothing in specs.

## With `node:test`

```typescript
import { test, after } from 'node:test';
const scenario = CommandScenario.for(ArchiveTask);
after(async () => { await scenario.dispose(); });
test('archiving executes the handler', async () => {
    (await scenario.execute({ id: 't-1' })).shouldBeSuccessful();
});
```

Compile with the standard decorator configuration first; Node's type stripping
does not transform decorators.

## Pitfalls

- A scenario with fakes proves your code against the fake, not a real provider
  or database; keep integration specs for storage.
- `withContext({ tenantId })` proves the code uses the tenant it is given, not
  your resolver or storage mapping (`cratis-arc-tenancy-typescript`).
- Forgetting a validator in `for(...)` means its rules never run.

## Route near misses

- Writing the command or query itself: `cratis-arc-command-typescript`,
  `cratis-arc-query-typescript`; the rule vocabulary: `cratis-arc-validation-typescript`.
- Specification naming and fixtures in general: `cratis-specification-by-example`.
