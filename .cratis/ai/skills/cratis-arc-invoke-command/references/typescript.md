# Execute through the command pipeline

Use `server.execute(instance, context)` for a registered class instance; use `server.executeCommand(name, input, context)` for a named command and unbound input. Carry the verified principal and tenant. A resolved promise is not proof of success. Inspect authorization, validation results and exceptions before consuming the response. Distinguish no transport response from a completed refusal; do not retry an ambiguous write blindly.

| Stage | If it stops |
| --- | --- |
| Authentication, tenant selection/membership | 401, or 400 missing required tenant / 403 nonmember |
| Parse, declared authorization, bind, request authorization | malformed request 400 or denial 403 |
| Context resolution and global authorization filters | resolution failure or denial; handler does not run |
| Global filters, validation and definition filters | findings 400, filter exceptions 500 |
| Provide and handle, response handling and operations | classify the returned outcome; do not use a failed response |

## Reactors that return commands (Chronicle)

Return an Arc `@command()` instance or a non-empty array of commands only. Arc executes each through its full command pipeline. See `cratis-chronicle-react-to-fact` for handler matching and replay declarations; handlers receive parsed JSON content, not event-class instances. `ARCCHR0006` flags typed command-returning handlers with neither `@onceOnly()` nor an explicit replay handler. Ensure returned commands tolerate a failed partition re-delivering a batch whose earlier commands already succeeded. Spec replay and re-delivery separately: replay must not run a live command, and re-delivery must not repeat the committed effect.

With `@cratis/chronicle` 6.29.0 or later, opt in to `withChronicle({ ..., activateArtifactsInScopes: true })` on the Arc-owned client. Arc DI resolves reactors and reducers in one scope per delivered batch, with the Chronicle namespace as tenant and no principal. Explicit registrations win.

For a caller-owned client, pass `chronicleArtifactActivator(() => app.server, eventStore)` as `artifactActivator` and `reactorCommandResultHandler(() => app.server, eventStore)` as `reactorResultHandler` when constructing the client, then set `activateArtifactsInScopes: true` with the client in `withChronicle`. Build Arc before observation starts and dispose Arc before the client.
