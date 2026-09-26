---
name: cratis-arc-validation-typescript
description: Add a rejection rule to a Cratis Arc command or query in a Node.js TypeScript server with Arc for TypeScript — choosing between @field shape, authorization, ConceptValidator, CommandValidator, QueryValidator with an arguments model, ModelValidator, readModelForValidation, and rejected()/denied() from provide() or handle(); the ruleFor vocabulary, which rules are copied into generated proxies, the validation() helper, severity filtering and the X-Allowed-Severity cap, and asserting rule failures in @cratis/arc.testing specs. Use when an Arc for TypeScript command or query must refuse work under some condition. Do not use to define a new command or query, for the .NET or Kotlin/Java validation shapes, or for append-time Chronicle constraints and concurrency.
license: MIT
---

# Validate an Arc command or query in TypeScript (Node.js server)

A rule in Arc for TypeScript lives where the information it needs is available,
and as early as that allows. Validators run before `handle()` and also answer on
the command's `POST <route>/validate`, so a form can ask before the user
submits. Every rejection comes back as a `ValidationResult` with a message and
the member it concerns — never as a thrown error.

Arc for TypeScript is a **source preview**: `@cratis/arc.core` and the other
server packages are not published to npm, and the API may change. The published
`@cratis/arc` client is separate; it runs the client-safe rules the proxy
generator copies into generated proxies. Setup is in
`cratis-arc-command-typescript`.

## Verified product sources

Verified against `Cratis/Arc.TypeScript` `main` at commit `94d398d` (tag
`v0.33.0` plus three commits), reading `Source/Core/validation/**` (including
`index.ts`, `ValidationResult.ts`, `Severity.ts`, `RuleBuilder.ts`),
`Source/Core/commands/Outcome.ts`, `Documentation/commands/command-validation.md`,
`validation-severity-filtering.md`, `command-outcomes.md`,
`Documentation/queries/validation.md`, `Documentation/concepts.md`,
`Documentation/proxy-generation/validation.md`, `Source/Testing`, and the
`Samples/Tasks` validators. At that commit `ValidationResult` is an exported
**type** (an interface); results are built with the `validation(...)` function.
There are no static `ValidationResult.error(...)`-style factories.

## Choose where to reject

| The decision depends on | Put it in | Runs on `/validate` | Caller sees |
| --- | --- | --- | --- |
| The request's shape: types, required/optional fields | `@field` plus `@optional()`/`@nullable()`/`@defaultValue()` | Yes | 400 `malformedRequest`, no message or members |
| Who is calling | `@roles`, `@authorize`, a policy | Yes | 401 or 403 |
| One value, wherever it appears | `ConceptValidator` on the concept | Yes | 400 with your message and member |
| The command's own fields, or a service | `CommandValidator` | Yes | 400 with your message and member |
| Stored state for the command's key | `CommandValidator` rule calling `readModelForValidation` | Yes | 400 with your message and member |
| Data you load anyway to do the work | `provide()` returning `rejected(...)` or `denied(...)` | No | 400 or 403 |
| A decision only the handler can make | `handle()` returning `rejected(...)` or `denied(...)` | No | 400 or 403 |

- **Reject as early as the information allows.** Everything through the
  `readModelForValidation` row answers on `/validate`.
- **Keep access control out of validators.** A trusted caller can lower the
  blocking severity and let validation results through; nothing lowers
  authorization or `denied(...)`.
- A stored-state check tells you what was true when it ran. A rule that must hold
  under concurrency belongs at the storage boundary (for Chronicle, a constraint
  or concurrency scope — `cratis-chronicle-event-constraints`).

## Command rules — `CommandValidator`

`Samples/Tasks/Features/Tasks/Registration/Registration.ts` keeps the validator
in the slice file with its command:

```typescript
import { command, CommandValidator, validator } from '@cratis/arc.core';

@validator(RegisterTask)
export class RegisterTaskValidator extends CommandValidator<RegisterTask> {
    constructor() {
        super();
        this.ruleFor(command => command.title).notEmpty().withMessage('A title is required');
        this.ruleFor(command => command.title).maxLength(100).withMessage('A title can have at most 100 characters');
    }
}
```

- `@validator(Target)` supplies the runtime target that the erased generic
  cannot. It registers nothing globally: `discover()` picks the exported class up
  from the folder, or pass it to `builder.add(RegisterTask, RegisterTaskValidator)`
  and to `CommandScenario.for(...)`. A validator that is never imported is never
  registered.
- One validator per **exact** target class; a duplicate target fails at build.
- Rules on a concept member receive the unwrapped primitive — `TaskTitle` rules
  accept a `string`.
- Every rule runs; a failure does not stop the others, so a form sees every
  problem at once. Any result above the allowed severity blocks `handle()`.

## Value rules — `ConceptValidator`

A rule that belongs to the value goes on the concept, once.
`Samples/Tasks/Features/Tasks/TaskTitleValidator.ts`:

```typescript
import { ConceptValidator, validator } from '@cratis/arc.core';
import { TaskTitle } from './TaskTitle.js';

@validator(TaskTitle)
export class TaskTitleValidator extends ConceptValidator<TaskTitle> {
    constructor() {
        super();
        this.ruleFor(title => title.value).must(value => !value.startsWith('!'))
            .withMessage('A title cannot begin with an exclamation mark');
    }
}
```

Arc walks the declared `@field` members of commands, query arguments and nested
models, and runs the concept validator on every `TaskTitle` it meets, including
inside arrays. A failure inside `entries[]` reports `entries.title`, not an
index. The owner's own rules still run. To skip only the **direct** member's
concept rules, call `.ignoreConceptRules()` on the owner's `ruleFor(...)` chain;
descendants are still traversed. The Library sample keeps `AuthorName` and its
`AuthorNameValidator` together in `AuthorName.ts`.

`ModelValidator<T>` validates a nested model class the same way, wherever it
appears in a command or query-argument graph.

## Query rules — `QueryValidator`

A `QueryValidator` targets an explicit **arguments model** whose `@field`
declarations match the query's `argument(...)` descriptors:

```typescript
import { ConceptAs, field } from '@cratis/fundamentals';
import { QueryValidator, argument, query, readModel, validator } from '@cratis/arc.core';

export class Name extends ConceptAs<string> { static readonly valueType = String; }

export class SearchArguments {
    @field(Name) term!: Name;
}

@validator(SearchArguments)
export class SearchArgumentsValidator extends QueryValidator<SearchArguments> {
    constructor() {
        super();
        this.ruleFor(arguments_ => arguments_.term).notEmpty().withMessage('Term required');
    }
}

@readModel()
export class Search {
    @query({ argumentsModel: SearchArguments }, argument('term', Name))
    static byTerm(term: Name): string { return term.value; }
}
```

Without an arguments model, Arc still runs concept validators on each supplied,
non-null argument under that argument's name, but a `QueryValidator` has nothing
to target. Queries always use `Warning` as the allowed severity.

## Rules that read stored state — `readModelForValidation`

```typescript
import { field } from '@cratis/fundamentals';
import { command, CommandValidator, key, readModelForValidation, validator } from '@cratis/arc.core';

@command()
export class RenameTask {
    @field(String) @key() id!: string;
    @field(String) title!: string;
    handle(): void { /* rename in storage */ }
}

@validator(RenameTask)
export class RenameTaskValidator extends CommandValidator<RenameTask> {
    constructor() {
        super();
        this.ruleFor(command => command.title).mustAsync(async title => {
            const current = await readModelForValidation(TaskView, { optional: true });
            return current === null || current.title !== title;
        }).withMessage('The task already has this title');
    }
}
```

- Arc resolves the command key (`@key()`, `getKey()`, or a resolver) and asks the
  resolver that owns `TaskView` — registered by MongoDB, Drizzle, experimental
  Chronicle, or `builder.addReadModelForCommandResolver(token)`. The resolver
  receives the caller's tenant.
- `{ optional: true }` returns `null` for a missing model. Without it, a missing
  model makes the rule throw, and the caller gets `validatorFailed` instead of
  your message.
- It works **only** inside a validator of a model-bound command, during
  validation. Validators do not receive read models through their constructors.

## Rule vocabulary

| Rules | Where they run |
| --- | --- |
| `notNull`, `notEmpty`, `minLength`, `maxLength`, `length`, `emailAddress`, `phone`, `url`, `matches`, `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual` | Server; literal, unconditional uses are also copied into generated proxies |
| `empty`, `null`, `equal`, `notEqual`, `inclusiveBetween`, `exclusiveBetween`, `must`, `mustAsync` | Server only |

- `withMessage`, `withSeverity(Severity.Warning)`, and `withState(value)`
  decorate the most recent rule.
- `when(predicate)` / `unless(predicate)` condition **every rule on the chain**
  by default; pass `ApplyConditionTo.CurrentValidator` to condition only the
  latest. Conditions and predicates run on the server only.
- `must` and `mustAsync` receive `(value, model, signal)`; pass the signal to
  cancelable I/O.
- String rules exist only for strings; comparison rules only for numbers and
  temporal values. `notEmpty()` rejects `Guid.empty`.
- Email, phone, URL, regex and Unicode-length behavior is not guaranteed to match
  the client or Arc on .NET exactly. Write an explicit message and specify the
  inputs you accept.
- The generator copies rules for commands (including direct concept fields) and
  for query arguments with an explicit `argumentsModel`. A rule that stays
  server-only produces a source diagnostic. The server validates every request
  regardless.

## Services in a validator

Declare constructor dependencies with `@injectable(Service)` or
`static inject = [Service] as const`, and register the service with
`builder.services`. Arc constructs each validator once during `build()` (catching
invalid selectors early), then resolves fresh validators per execution scope. A
validator that throws, or whose dependency cannot be resolved, never reports
success: the caller gets 400 with reason `validatorFailed` or
`dependencyUnavailable`, no exception text, and the error goes to the logger.

## Reject from `provide()` or `handle()`

```typescript
import { denied, rejected, validation, Severity } from '@cratis/arc.core';

return rejected(validation('The task does not exist', ['id'], 'notFound'));
return rejected(validation('Unusually long title', ['title'], 'rule', Severity.Warning));
return denied('Only the owner can rename a task');
```

- `validation(message, members = [], reason = 'rule', severity = Severity.Error)`
  builds a `ValidationResult` (`{ severity, message, members, reason }`, plus
  optional `reasonDetail` and `state`).
- `rejected(...results)` answers 400; it throws when given no results, so an
  empty rejection can never pass as success. `denied(reason?)` answers 403 with
  `authorizationFailureReason`.
- Rejected results go through the same severity filter. When nothing above the
  allowed severity remains, `handle()` runs (from `provide()`, with `undefined`
  as the provided value) or the command succeeds without a response (from
  `handle()`).
- Throwing is for failures, not decisions: a thrown error is a 500.

## Severity filtering

`Severity` is `Unknown` (0), `Information` (1), `Warning` (2), `Error` (3).
Results at or below the **allowed severity** are removed and do not block;
results above it block and are returned. The default is `Warning`, so only
errors block.

| Caller | Allowed severity |
| --- | --- |
| HTTP command | `X-Allowed-Severity` header `0`, `1` or `2`; missing or invalid means `2`; `3` is **capped** to `2`, so errors always block |
| HTTP query | Always `Warning`; the header is ignored |
| `executeCommand` from code, or `CommandScenario.withAllowedValidationSeverity(...)` | As given, including `Severity.Error` |
| `performQuery` from code | Always `Warning` |

The HTTP cap at `Warning` is a deliberate safety difference from Arc on .NET,
which lets `X-Allowed-Severity: 3` run a command whose only problems are
errors. Do not "fix" it toward .NET behavior. `@command({ treatWarningsAsErrors: true })`
and `@query({ treatWarningsAsErrors: true })` set the generated client's flag.

## Specify the rule

```typescript
import { given, type ScenarioCommandResult } from '@cratis/arc.testing';

describe('when validating a task with an empty title', given(a_task_registration, context => {
    let result: ScenarioCommandResult;
    beforeEach(async () => {
        result = await context.scenario.validate({ id: TaskId.create(), title: new TaskTitle('') });
    });
    afterAll(async () => { await context.scenario.dispose(); });
    it('should report the authored rule for title', () => {
        result.shouldHaveValidationErrors().shouldHaveValidationErrorForMember('title');
    });
    it('should not invoke the handler', () => { context.tasks.all().should.have.lengthOf(0); });
}));
```

- Use `scenario.validate(...)` to prove the rule answers on `/validate`, and
  `execute(...)` to prove `handle()` never ran.
- Assert the member with `shouldHaveValidationErrorForMember('title')`.
  `shouldHaveValidationErrorFor(text)` passes for any message **containing** the
  text; pass the full message when the wording matters.
- `validatorFailed` and `dependencyUnavailable` never satisfy
  `shouldHaveValidationErrors()` or the member assertion — they mean no authored
  rule was established. Assert them explicitly with
  `shouldHaveValidationErrorBecauseOf('validatorFailed')`.
  `shouldHaveRuleFailure(result, { reason, member?, severity? })` from
  `@cratis/arc.testing` asserts an authored rule on a plain result.
- For a query, `QueryScenario.perform(...)` returns a result whose
  `validationResults` you assert the same way.

## Route near misses

- Defining the command or query the rule attaches to:
  `cratis-arc-command-typescript`, `cratis-arc-query-typescript`.
- Append-time uniqueness or concurrency in Chronicle:
  `cratis-chronicle-event-constraints` and the Chronicle reference in
  `cratis-arc-command-typescript`.
- The .NET validation shape: `cratis-arc-command-validation`; Kotlin/Java:
  `cratis-arc-validation-kotlin`.

## Verify

- Each rule sits in the earliest row of the table that has the information it
  needs; access control is in authorization or `denied(...)`, not a validator.
- Every validator is exported (or passed to `add()`), extends the right base
  class, and carries `@validator(ExactTarget)`.
- Rejections are `ValidationResult`s built with `validation(...)` or rule
  messages — never thrown errors, and never invented `ValidationResult.error(...)`
  factories.
- `readModelForValidation` is called only inside a model-bound command's
  validator, with `{ optional: true }` wherever absence is a legitimate state.
- Generated metadata and proxies are regenerated after a validator changes, so
  the client-copied rules match the server's.
- Specs assert the authored rule and member through `validate()` and prove
  `handle()` did not run.
