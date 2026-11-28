# Execute through the command pipeline

Use `server.execute(instance, context)` for a registered class instance; use `server.executeCommand(name, input, context)` for a named command and unbound input. Carry the verified principal and tenant. A resolved promise is not proof of success. Inspect authorization, validation results and exceptions before consuming the response. Distinguish no transport response from a completed refusal; do not retry an ambiguous write blindly.

| Stage | If it stops |
| --- | --- |
| Authentication, tenant selection/membership | 401, or 400 missing required tenant / 403 nonmember |
| Parse, declared authorization, bind, request authorization | malformed request 400 or denial 403 |
| Context resolution and global authorization filters | resolution failure or denial; handler does not run |
| Global filters, validation and definition filters | findings 400, filter exceptions 500 |
| Provide and handle, response handling and operations | classify the returned outcome; do not use a failed response |

## Extend the pipeline

- **Access versus ordinary filters.** Implement `AuthorizationCommandFilter` for access or `CommandPipelineFilter` for ordinary refusals; both implement `onExecution(context)` and may return a result fragment or nothing. Register classes with `@authorizationCommandFilter()` or `@commandPipelineFilter()` and `builder.add()`/`discover()`. For an explicit scoped or transient service token, call `addAuthorizationCommandFilter(token)` or `addCommandPipelineFilter(token)`. Authorization runs before ordinary filters and validation on both execute and `/validate`. Within each group, options (`authorizationCommandFilters` / `commandPipelineFilters`) run before explicit registrations, then discovered or added classes. A low-level definition's `filters` is a per-command validation hook, not a global filter.
- **Wrap validated execution.** Use `builder.addCommandExecutionRunner((context, execute) => ...)` to set up a boundary around preparation, execution and response processing. Call and await `execute()` inside that boundary. The `commandExecutionRunner` option is outermost, then builder runners wrap in registration order. Validation alone never starts runners.
- **Consume a returned effect.** Implement `CommandResponseValueHandler` with `canHandle(context, value)` and `handle(context, value)`. Register with `@commandResponseValueHandler()` and `builder.add()`/`discover()`, or call `addCommandResponseValueHandler(token)` for a registered service (`commandResponseValueHandlers` on `ArcServer`). Arc flattens branded tuples and `response(...)` branches, not arrays; every accepting handler runs in deterministic name order. Keep at most one unhandled value for the client response. A handler can refuse, not supply a client response.

Spec the refusal through the command pipeline: for a verified caller denied by the authorization filter, assert the denied result and no handler effect. For an allowed caller with invalid input, assert the ordinary filter's refusal and again no handler effect. Include an accepted input to prove execution is actually wired.

## Reactors that return commands (Chronicle)

Return an Arc `@command()` instance or a non-empty array of commands only. Arc executes each through its full command pipeline. See `cratis-chronicle-react-to-fact` for handler matching and replay declarations; handlers receive parsed JSON content, not event-class instances. `ARCCHR0006` flags typed command-returning handlers with neither `@onceOnly()` nor an explicit replay handler. Ensure returned commands tolerate a failed partition re-delivering a batch whose earlier commands already succeeded. Spec replay and re-delivery separately: replay must not run a live command, and re-delivery must not repeat the committed effect.

With `@cratis/chronicle` 6.29.0 or later, opt in to `withChronicle({ ..., activateArtifactsInScopes: true })` on the Arc-owned client. Arc DI resolves reactors and reducers in one scope per delivered batch, with the Chronicle namespace as tenant and no principal. Explicit registrations win.

For a caller-owned client, pass `chronicleArtifactActivator(() => app.server, eventStore)` as `artifactActivator` and `reactorCommandResultHandler(() => app.server, eventStore)` as `reactorResultHandler` when constructing the client, then set `activateArtifactsInScopes: true` with the client in `withChronicle`. Build Arc before observation starts and dispose Arc before the client.
