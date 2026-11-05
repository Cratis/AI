<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Command pipeline extensions, direct calls and low-level definitions

## Contents

- Global command filters
- Response value handlers
- Execution scopes and runners
- Run a command without HTTP
- Low-level definitions

Source: `Cratis/Arc.TypeScript`: `Documentation/commands/{command-filters,response-value-handlers,command-execution-scopes,calling-commands-from-code,low-level-definitions}.md`.
Read this when every command needs the same gate, a returned value should
trigger a side effect instead of reaching the client, work must wrap a command,
a job must run a command without HTTP, or Zod-based definitions are in play.

## Global command filters

`AuthorizationCommandFilter` makes access decisions and always runs first,
whatever the registration order; `CommandPipelineFilter` returns ordinary
result fragments. Both implement `onExecution(context: CommandContext)` and
return a `CommandResult` or nothing. They apply to every `@command()` class and
low-level definition and run for execute and for `POST <route>/validate`.

```typescript
@authorizationCommandFilter()
export class TenantGate implements AuthorizationCommandFilter {
    onExecution(context: CommandContext): CommandResult | void {
        if (!context.tenantId) return unauthorizedCommandResult(context, 'A tenant is required');
    }
}
@commandPipelineFilter()
class TitleGate implements CommandPipelineFilter {
    onExecution(context: CommandContext): CommandResult | void {
        // return commandFilterResult(context, { validationResults: [validation('A title is required', ['title'])] });
    }
}
builder.add(TenantGate, TitleGate);   // or addAuthorizationCommandFilter / addCommandPipelineFilter
```

A denial answers 403 with `isAuthorized: false` and an optional
`authorizationFailureReason`; validation answers 400. Register explicit tokens
as scoped or transient services. Per-definition `CommandFilter<T>` callbacks
(a `filters` list on `defineCommand`) are a different, narrower mechanism.

## Response value handlers

Return effects next to the response instead of performing them in `handle()`:
`return tuple({ id: this.id }, new AuditEntry(...))`. Arc flattens branded
tuples and `response(...)` branches, then asks every registered handler's
`canHandle(context, value)`; **every** matching handler runs, in deterministic
name order. A value no handler accepts is a candidate client response, and
**at most one** is allowed (two fail the command). Arrays are not flattened.

```typescript
@commandResponseValueHandler()
@injectable(AuditLog)
export class AuditEntryHandler implements CommandResponseValueHandler {
    constructor(private readonly log: AuditLog) {}
    canHandle(_context: CommandContext, value: unknown): boolean { return value instanceof AuditEntry; }
    handle(context: CommandContext, value: unknown): void { this.log.record(context.correlationId, (value as AuditEntry).text); }
}
```

A handler may return `rejected(...)` or `denied(...)` to fail the command but
never a client response. It runs scoped and reads `CommandContext`. Register
with `builder.add`, `discover`, `addCommandResponseValueHandler(token)`, or the
`commandResponseValueHandlers` option on `ArcServer`. The Chronicle integration
uses this mechanism to append returned events.

## Execution scopes and runners

Low-level `defineCommand({ scopes: [factory] })`: Arc creates the scope objects
for every execution and records each before calling `begin`. `begin` runs before
`provide()` and `handle()`; every recorded scope then `complete`s exactly once,
in reverse order, with the result so far, including a scope whose `begin`
threw. A throwing `begin` stops later scopes and fails with 500; a throwing
`complete` removes the response and fails with 500. Scopes do not run for the
validation-only route or when authorization or validation fails, and Arc does
not make a scope transactional: read `result.isSuccess` to commit or roll back.
`@command()` classes declare no scopes; wrap every model-bound execution with
`builder.addCommandExecutionRunner((context, execute) => ...)` or the
`commandExecutionRunner` option.

## Run a command without HTTP

`app.server` (an `ArcServer`) offers direct entry points:

| Entry point | Runs | Trusts the caller with |
| --- | --- | --- |
| `handle(request, native?)` | the full HTTP pipeline for a Fetch `Request`; `null` when not an Arc route | nothing beyond an HTTP client |
| `executeCommand(name, input, context)` / `execute(instance, context)` | authorization, binding, validators, the command | the whole execution context, including allowed severity |
| `validateCommand(name, input, context)` / `validate(instance, context)` | the same without `provide` or `handle` | the whole context |
| `performQuery(name, input, context, options?)` | authorization, binding, validators, the query | the whole context except allowed severity |

Names are namespace plus class (`Tasks.Registration.RegisterTask` when
discovered, bare `RegisterTask` when added), `Namespace.ReadModel.method` for
queries, and `Namespace.Name` for low-level definitions. A missing name throws.

```typescript
const context = {
    correlationId: randomUUID(),
    principal: { id: 'import-job', roles: ['system'], isAuthenticated: true },
    tenantId: 'acme', signal: AbortSignal.timeout(5_000), allowedSeverity: Severity.Warning
};
const result = await app.server.executeCommand('RegisterTask', { id, title: 'Imported' }, context);
```

- You supply the context: no authentication handler runs and no tenant is
  resolved, but authorization still checks the principal and tenant you pass,
  so pass the real ones. Choose the tenant deliberately.
- `context.allowedSeverity` is used as given (`Severity.Error` lets
  error-severity validation pass); only trusted code may raise it.
- Arc exposes a frozen copy through `currentContext()` during the call; nested
  calls get their own and the outer is restored afterward.
- Nothing is redacted or logged; never forward the result to an untrusted
  caller. No body limit applies.

## Low-level definitions

Keep `defineCommand`, `defineQuery` and `defineObservableQuery` when Zod schemas
already exist, explicit `validate` and `filters` callbacks are needed, or code
cannot use decorators. They run through the same server and pipeline:

```typescript
const create = defineCommand({
    name: 'Create', namespace: 'Tasks', schema: z.object({ id: z.string(), title: z.string() }),
    handle: ({ id, title }) => { tasks.set(id, title); return id; }
});
const server = new ArcServer({ commands: [create] });
```

The analyzer cannot see their output types; declare `clientOutput` and export a
manifest for proxy generation (`proxy-generator-options.md`). Specify them with
`ArcScenario` (`cratis-arc-testing-typescript`).
