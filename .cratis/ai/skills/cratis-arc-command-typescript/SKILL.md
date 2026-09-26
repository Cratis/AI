---
name: cratis-arc-command-typescript
description: Define a Cratis Arc command in a Node.js TypeScript server with Arc for TypeScript — project setup from the source preview, ArcApplication.createBuilder() and discovery, the @command() class with @field inputs, handle() and provide(), outcome helpers, service injection, authorization, returning Chronicle events through withChronicle, generated artifact metadata and proxies, hosting on the standalone host, Express, Fastify, Hono or the Fetch entry, and CommandScenario specs. Use when adding or changing a command in an Arc for TypeScript server, or bootstrapping such a server. Do not use for the .NET or Kotlin/Java Arc command shapes, for a React frontend that calls generated proxies, for validation-only changes, or for query/read-model definition.
license: MIT
---

# Define an Arc command in TypeScript (Node.js server)

Arc for TypeScript (`Cratis/Arc.TypeScript`) is the Node.js server implementation
of Arc. A command is a decorated class that carries the input and handles itself;
Arc supplies the route, body binding, validation, authorization, and the
`CommandResult` envelope. There is no controller and no route to write.

## Source preview — read this first

- **None of the server packages is published to npm.** `@cratis/arc.core`,
  `@cratis/arc.express`, `@cratis/arc.fastify`, `@cratis/arc.hono`,
  `@cratis/arc.testing`, `@cratis/arc.mongodb`, `@cratis/arc.drizzle`,
  `@cratis/arc.chronicle`, `@cratis/cratis`, `@cratis/arc.proxygenerator` and
  `@cratis/eslint-plugin-arc-core` are a source preview (0.x versions, published
  only as GitHub pre-releases). The API may still change. `npm install @cratis/arc.core` fails.
- **`@cratis/arc` is a different package.** `@cratis/arc`, `@cratis/arc.react` and
  `@cratis/arc.react.mvvm` are the published **client** runtime, built from
  `Cratis/Arc`. Generated proxies import them in the frontend. The server packages
  never depend on them. Never tell a user to install `@cratis/arc` to get a
  server.
- `@cratis/arc.chronicle` and `@cratis/cratis` are additionally marked
  **experimental**.

## Verified product sources

Verified against `Cratis/Arc.TypeScript` `main` at commit `94d398d` (tag
`v0.33.0` plus three commits), reading `Source/Core/index.ts` and the package
`index.ts` exports, `Documentation/**`, and the `Samples/Tasks` and
`Samples/Library` applications. Every API named here exists at that commit.
Chronicle SDK: `@cratis/chronicle` peer `^6.7.0`; the Library sample pins
`6.14.0`. Fundamentals: `@cratis/fundamentals` `^7.19.6`.

Host setup, the Fetch entry, and the storage integrations are in
[references/hosting-and-storage.md](references/hosting-and-storage.md). Returned
Chronicle events and their specs are in
[references/chronicle-events.md](references/chronicle-events.md).

## Set up a project

Consume the preview in one of two ways:

| Path | How | Use when |
| --- | --- | --- |
| Inside a clone | Put the application under `Samples/<Name>` in a clone of `Cratis/Arc.TypeScript`; reference packages as `workspace:^` | Experimenting, or changing Arc while building on it |
| Packed tarballs | In the clone: `yarn install`, `yarn build`, then `yarn workspace @cratis/arc.core pack --out <file>` per package; `npm install <file>.tgz` in your project | A separate repository |

Use `yarn pack`, not `npm pack` — Yarn rewrites `workspace:^` dependencies to
version ranges; npm does not, and the tarball then fails to install. A
`workspace:^` dependency outside the clone fails at install.

- Node.js 22.19 or later (the core runs on 22; the workspace build needs 22.19;
  24 LTS is recommended).
- ES modules only: `"type": "module"` in `package.json`.
- Peer dependencies of `@cratis/arc.core`: `@cratis/fundamentals` `^7.19.6`,
  `@opentelemetry/api` `^1.9.0`; `rxjs` `^7.8.2` is an optional peer, needed for
  RxJS observable queries.
- TypeScript: the repository and proxy generator use TypeScript 6
  (`typescript@npm:@typescript/typescript6@^6.0.2`, command `tsc6`).

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022", "ESNext.Decorators"],
    "types": ["node"],
    "strict": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "rootDir": ".",
    "outDir": "dist"
  },
  "include": ["main.ts", "Features/**/*.ts"]
}
```

- **No `experimentalDecorators`.** Arc's decorators compile as standard TC39
  decorators, as the samples do; `ESNext.Decorators` declares `Symbol.metadata`.
  Legacy `experimentalDecorators` also work. The Library sample compiles its
  `@cratis/chronicle` 6.14 event types and projections under the same
  standard-decorator settings. Generated frontend proxies are the exception:
  they compile with `experimentalDecorators: true`.
- With `NodeNext`, relative imports carry a `.js` extension. `ESNext` +
  `Bundler` (the samples' choice) also works.
- Node's own type stripping does not transform decorators — `node main.ts`
  fails at the first `@`. Run source with `tsx watch main.ts` during
  development and compile with `tsc6` for production.
- A Vitest/Vite transform must lower standard decorators with
  `useDefineForClassFields: true` (`target: 'es2022'`,
  `experimentalDecorators: false`), or decorators silently do nothing in specs.

## Bootstrap the application

`Samples/Tasks/main.ts`:

```typescript
import { ArcApplication } from '@cratis/arc.core';
import { Tasks } from './Features/Tasks/Tasks.js';
import { metadata } from './Features/generatedMetadata.js';

const builder = ArcApplication.createBuilder();
builder.useGeneratedMetadata(metadata);
builder.services.addSingleton(Tasks);
await builder.discover(new URL('./Features/', import.meta.url));
export const app = await builder.build();
await app.run({ port: Number(process.env.PORT ?? 3000) });
```

| Call | Effect |
| --- | --- |
| `ArcApplication.createBuilder(options?)` | Starts the application; the Node builder reads `appsettings.json` (`Cratis:Arc`) and `Cratis__...` environment variables |
| `useGeneratedMetadata(metadata)` | Installs parameter and return-type metadata extracted from source. Call it **before** `discover()`/`add()` |
| `services.addSingleton(Token)` | Registers a service; `addScoped`/`addTransient` take factories. Classes can also carry `@singleton()`, `@scoped()`, `@transient()` |
| `discover(folderUrl)` | Imports every module under the folder and registers **exported**, decorated artifacts. Skips `dist`, `node_modules`, `given`, `for_*`, `index.*`, declaration files |
| `add(...types)` | Registers artifacts explicitly — required on the Fetch entry, which cannot discover |
| `build()` | Validates the whole graph (missing services, lifetime mismatches, misplaced decorators, stale metadata) and throws before any listener opens |
| `app.run()` / `app.start()` | Standalone Node host. `app.dispose()` stops it and disposes services |

`discover()` refuses a folder that contains the entry point; keep artifacts in a
dedicated folder such as `Features/`. `Cratis:Arc:Development: true` is for a
local machine only.

## Lay out the slice

House convention (not a runtime requirement): one folder per behavior, one
TypeScript file named for the behavior holding the command, its validator and —
for Chronicle — its events. Concepts shared by several slices live one level up.
Specs sit beside the slice in `for_<Subject>/when_<action>/<case>.ts`, which
`discover()` skips.

```text
Features/Tasks/
├── TaskId.ts
├── TaskTitle.ts
├── Tasks.ts
├── Registration/
│   ├── Registration.ts
│   └── for_RegisterTask/when_registering/with_valid_title.ts
└── Listing/
    └── Listing.ts
```

## Declare the command

`Samples/Tasks/Features/Tasks/Registration/Registration.ts`:

```typescript
import { field } from '@cratis/fundamentals';
import { command, CommandValidator, validator } from '@cratis/arc.core';
import { TaskId } from '../TaskId.js';
import { TaskTitle } from '../TaskTitle.js';
import { Tasks } from '../Tasks.js';

/** Register a task. */
@command()
export class RegisterTask {
    @field(TaskId) id!: TaskId;
    @field(TaskTitle) title!: TaskTitle;

    handle(tasks: Tasks): TaskId {
        tasks.register(this.id, this.title);
        return this.id;
    }
}

@validator(RegisterTask)
export class RegisterTaskValidator extends CommandValidator<RegisterTask> {
    constructor() {
        super();
        this.ruleFor(command => command.title).notEmpty().withMessage('A title is required');
    }
}
```

Rules Arc enforces:

- `@command()` from `@cratis/arc.core` marks the class; it needs a public
  instance `handle()` (which may be inherited). Name it as the action —
  `RegisterTask`, not `RegisterTaskCommand`.
- `@field(Type)` comes from **`@cratis/fundamentals`**, not Arc. Every field is
  required unless marked `@optional()`, `@nullable()`, or `@defaultValue(value)`
  (from `@cratis/arc.core`). `@enumeration(EnumObject)` restricts a scalar field.
  Arrays: `@field(Array, { genericArguments: [Item] })`.
- Domain values are `ConceptAs<T>` classes with a static `valueType`
  (`static readonly valueType = Guid;`) because generics are erased at runtime.
  A concept travels as its primitive on the wire.
- The artifact must be **exported** from a module under the discovery root, or
  it is never registered.
- `handle()` returns a value or a promise; the value becomes `response`.
  Returning nothing is success without a `response`.

### The command key

The key identifies what the command is about. It is resolved from, in order: a
registered `CommandKeyResolver`, a `getKey()` method, then the `@key()` field
(a concept unwraps to its primitive). **No key is inferred from an unmarked `id`
field.** With Chronicle, the key is the default event source.

### Route

`POST /api/<discovery-namespace>/<command-name>` in kebab case —
`Tasks.Registration.RegisterTask` serves `POST /api/tasks/registration/register-task`.
`POST <route>/validate` runs authorization and validation only, never
`provide()` or `handle()`. Pin a route across folder moves with
`@command({ namespace: 'Tasks.Registration' })` or `@path('/api/...')`, and keep
class names in bundled builds (`keepNames` in esbuild).

## Bind parameters

TypeScript erases parameter types, so Arc learns them one of two ways:

- **Generated artifact metadata** (the samples): `arc-proxygenerator --metadata`
  writes a module from source; `handle(tasks: Tasks)` then needs no decorator.
- **Explicit tokens**: `@inject(Tasks)` on `handle()` or `provide()`, one token
  or marker per parameter, in order.

Built-in markers for `@inject(...)`:

| Marker | Binds |
| --- | --- |
| `abortSignal()` | The request's `AbortSignal` — pass it to cancelable I/O |
| `commandContext()` | The `CommandContext`: `key`, `values`, `correlationId`, `principal`, `tenantId`, `signal` |
| `provided(Type)` | A value from `provide()`, matched by runtime type |
| `commandReadModel(Type, { optional? })` | The read model for the command key, from a registered resolver (MongoDB, Drizzle, Chronicle) |
| `mongoCollection(Model)` / `drizzleDatabase()` | Storage handles from the optional integrations |

`build()` fails with `Unbound handle parameters on <Type>.handle` when neither
metadata nor tokens cover a parameter. Default and rest parameters always need
explicit tokens.

## Prepare data with `provide()`

`provide()` is optional. It runs after authorization and validation, before
`handle()`, on the same instance; its value becomes the **first** `handle()`
argument, before injected services.

```typescript
import { field } from '@cratis/fundamentals';
import { command, inject, rejected, validation } from '@cratis/arc.core';

@command()
export class RenameTask {
    @field(TaskId) id!: TaskId;
    @field(TaskTitle) title!: TaskTitle;

    @inject(Tasks)
    provide(tasks: Tasks) {
        const task = tasks.byId(this.id);
        return task ?? rejected(validation('The task does not exist', ['id'], 'notFound'));
    }

    handle(task: TaskItem): void {
        task.title = this.title;
    }
}
```

For several prepared values, return `tuple(...)` and mark each `handle()`
parameter with `@inject(provided(A), commandContext(), provided(B))`.
`@inject` is accepted only on a command's `handle()` or `provide()`;
authorization decorators on `provide()` fail at build.

## Return an outcome

| Return from `provide()` or `handle()` | Result |
| --- | --- |
| A plain value, or `response(value)` | Success; the value is `response` |
| Nothing | Success without `response` |
| `rejected(...results)` | 400 with the validation results; later steps do not run |
| `denied(reason?)` | 403 with `authorizationFailureReason`; later steps do not run |
| `tuple(a, b, ...)` | At most one client response; every other value must be consumed by a response value handler (Chronicle events, command operations) or the command fails |

Outcomes are recognized by origin (a private brand), not shape — an object with
a `kind` property is ordinary data. `rejected()` with no results throws. A
thrown error is a 500 whose message is redacted unless `exposeExceptionDetails`
is enabled; do not throw for a rejection the user can act on. Rules that can
run before `handle()` belong in validators: see
`cratis-arc-validation-typescript`.

## Protect the command

```typescript
import { authorize, command, roles } from '@cratis/arc.core';

@command()
@roles('Librarian')
export class RegisterAuthor { /* ... */ }

@command()
@authorize({ policy: 'Finance' })
export class ApproveBudget { /* ... */ }
```

- No decorator allows everyone, including anonymous callers.
- `@authorize()` requires an authenticated caller; `@authorize({ policy?, roles?, schemes? })`
  a policy, a role, or a scheme; `@roles('A', 'B')` any listed role;
  `@allowAnonymous()` states anonymous access explicitly.
- Stacked decorators must **all** pass. `@allowAnonymous()` with an authenticated
  requirement on the same class fails at startup.
- Authorization belongs on the **class**. Decorators on `handle()`, `provide()`
  or any other command method fail the build (a deliberate difference from Arc
  on .NET, which ignores them).
- A decision that needs loaded data returns `denied(reason)` from `provide()`.

## Return Chronicle events

With `@cratis/arc.chronicle` registered (`withChronicle`), `handle()` returns the
event and Arc appends it after authorization, validation and `provide()` pass,
in the namespace of the resolved tenant. Arc does not require event sourcing: a
command without Chronicle calls a service, as `RegisterTask` does.

`Samples/Library/Features/Authors/Registration/Registration.ts`:

```typescript
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { command, key, roles } from '@cratis/arc.core';
import { AuthorId } from '../AuthorId.js';
import { AuthorName } from '../AuthorName.js';

@eventType()
export class AuthorRegistered {
    @field(AuthorName) name: AuthorName;
    constructor(name: AuthorName = new AuthorName('')) { this.name = name; }
}

@command()
@roles('Librarian')
export class RegisterAuthor {
    @key() @field(AuthorId) id!: AuthorId;
    @field(AuthorName) name!: AuthorName;

    handle(): AuthorRegistered { return new AuthorRegistered(this.name); }
}
```

- The event class lives in the slice file beside the command, carries
  `@eventType()` from `@cratis/chronicle/events` and `@field` declarations, and
  is created through its **constructor** in `handle()` — the house pattern in
  both samples.
- `@key()` names the event source; without a key or `getEventSourceId()`, each
  execution gets a new UUID.
- A returned event is consumed on the server, so the result carries no
  `response`.
- Never append through the SDK inside `handle()` — that append is outside the
  command's batch.

Returning several events, events beside a response, cross-stream targets,
routing decorators, concurrency, and the in-memory `ChronicleCommandScenario`
are in [references/chronicle-events.md](references/chronicle-events.md).

## Generate metadata and proxies

`arc-proxygenerator` (package `@cratis/arc.proxygenerator`, also unpublished)
reads the TypeScript source with the compiler API — it never queries a running
server. It writes server metadata and client proxies in one run. The CLI
rejects relative paths, and the output folder must exist:

```javascript
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const path = relative => fileURLToPath(new URL(relative, import.meta.url));
const cli = fileURLToPath(new URL('./cli.js', import.meta.resolve('@cratis/arc.proxygenerator')));
mkdirSync(path('./generated'), { recursive: true });
const result = spawnSync(process.execPath, [cli,
    '--project', path('./tsconfig.json'),
    '--artifacts', path('./Features'),
    '--output', path('./generated'),
    '--metadata', path('./Features/generatedMetadata.ts'),
    ...process.argv.slice(2)], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
```

- Commit the metadata module; never edit it. Regenerate after **every** change
  to a command, read model or validator — `useGeneratedMetadata` throws
  `Stale generated artifact metadata for <Type>` otherwise. Reordering
  parameters without changing their count goes undetected, so gate CI with
  `--check-metadata` and keep `--watch` running beside `tsx` while developing.
- `--artifacts` must be the folder passed to `discover()`. Match route options
  (`--api-prefix`, `--segments-to-skip`, `--root-namespace`) to the server's
  `generatedApis` options, or proxies call URLs the server does not serve.
- Generated proxies import the **published** `@cratis/arc` and
  `@cratis/arc.react` (the docs pin `22.19.1`) plus `@cratis/fundamentals`.
  Compile them in `Bundler` resolution with `experimentalDecorators: true`, and
  import `reflect-metadata` once in the frontend entry. Consuming the proxies in
  React is `cratis-arc-react-page`.

## Host the application

`app.run()` is the standalone Node host. To mount the same built application in
Express 5, Fastify 5, Hono 4, or a Fetch API runtime, keep the builder and swap
the host — see
[references/hosting-and-storage.md](references/hosting-and-storage.md). Mount
Express's `cratisArc(arc)` **before** any body parser, or every command answers
400 `malformedRequest`.

## Specify the command

`@cratis/arc.testing` runs a command through the real pipeline in-process —
binding, authorization, validators, services, `provide()`, `handle()` — without
a listener. From `Samples/Tasks`:

```typescript
import { CommandScenario } from '@cratis/arc.testing';
import { Tasks } from '../../../Tasks.js';
import { RegisterTask, RegisterTaskValidator } from '../../Registration.js';
import { metadata } from '../../../../generatedMetadata.js';

export class a_task_registration {
    tasks = new Tasks();
    scenario = CommandScenario.for(RegisterTask, RegisterTaskValidator);

    constructor() {
        this.scenario.extend(builder => builder.useGeneratedMetadata(metadata));
        this.scenario.services.addSingleton(Tasks, this.tasks);
    }
}
```

```typescript
import { given, type ScenarioCommandResult } from '@cratis/arc.testing';
import { TaskId } from '../../../TaskId.js';
import { TaskTitle } from '../../../TaskTitle.js';
import { a_task_registration } from '../given/a_task_registration.js';

describe('when registering a task with a valid title', given(a_task_registration, context => {
    const id = TaskId.create();
    let result: ScenarioCommandResult;

    beforeAll(async () => {
        result = await context.scenario.execute({ id, title: new TaskTitle('Plan release') });
    });
    afterAll(async () => { await context.scenario.dispose(); });

    it('should succeed through the command pipeline', () => { result.shouldBeSuccessful(); });
}));
```

- `CommandScenario.for(Command, ...artifacts)` — pass the validators and other
  artifacts the command needs; it cannot discover classes that were never
  imported.
- Register fakes on `scenario.services` **before** the first call.
  `extend(builder => ...)` installs builder setup such as generated metadata.
- `execute(values)` runs everything; `validate(values)` stops before
  `provide()`/`handle()`. `withContext({ principal, tenantId, correlationId })`
  sets a trusted caller.
- `given(Context, ...)` creates **one** context per `describe`: act in
  `beforeAll`, dispose in `afterAll`. A disposed scenario cannot run again.
- Assertions on the result: `shouldBeSuccessful()`, `shouldNotBeSuccessful()`,
  `shouldBeValid()`, `shouldHaveValidationErrors()`,
  `shouldHaveValidationErrorForMember(member)`, `shouldHaveValidationErrorFor(text)`,
  `shouldHaveValidationErrorBecauseOf(reason)`, `shouldBeAuthorized()`,
  `shouldNotBeAuthorized()`, `shouldHaveExceptions()`, `shouldNotHaveExceptions()`.
- Specify authorization for three callers — anonymous, without the role, with
  it — and on `validate()` too.

Folder and naming conventions for specs are `cratis-specifications-typescript`.

## Route near misses

- A rejection rule on an existing command: `cratis-arc-validation-typescript`.
- A `@readModel()` query or observable query: `cratis-arc-query-typescript`.
- A React page that calls the generated proxies: `cratis-arc-react-page`.
- Talking to Chronicle outside Arc (a worker, direct append, reactors,
  projections): `cratis-chronicle-client-typescript`.
- The .NET command shape: `cratis-arc-command`; Kotlin/Java:
  `cratis-arc-command-kotlin`.

## Verify

- The command class is exported under the discovery root, carries `@command()`,
  has a public instance `handle()`, and carries authorization only on the class
  — never on `handle()`, `provide()` or another method.
- Every input field has `@field(Type)` from `@cratis/fundamentals`; domain values
  are concepts with a static `valueType`.
- The key is explicit (`@key()`, `getKey()`, or a resolver) wherever something
  depends on it — never an assumed `id`.
- Rejections the user can act on are `rejected(...)`/`denied(...)` or validator
  results, never thrown errors.
- Generated metadata is regenerated and `--check-metadata` passes; `build()`
  succeeds at startup.
- The command's `CommandScenario` specs pass, including the unauthorized and
  `/validate` cases.
- Guidance never claims the server packages are on npm, and never substitutes
  `@cratis/arc` (the client) for `@cratis/arc.core` (the server).
