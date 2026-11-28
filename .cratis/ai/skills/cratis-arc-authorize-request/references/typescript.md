# Enforce admission at the server in TypeScript

In the Node host, put `@roles('Editor')` on a command class, not its `handle` method. Use `@authorize({ policy: 'Finance' })` for a registered policy. On a read model, explicit query-method metadata replaces the class declaration: `@allowAnonymous()` deliberately opens the query. Identity detail enrichment does not enforce any of these requirements.

Call as an editor and as a signed-in non-editor; only the editor should reach the handler. HTTP discovery and OpenAPI default to anonymous in Development and require authentication elsewhere. Outside Development, without authentication configured, the HTTP OpenAPI route is not mapped. Give the production generator credentials rather than making a data query anonymous. Roles decide who calls, not which records they see. Scope reads to the verified `currentContext()?.principal` and deny when the required identity is absent.

Observable admission runs at subscription time. If entitlement may change during a subscription, register a scoped guard service and put its token in `query.observableEmissionGuards`. Have the guard return `DenyAndTerminate` when access lapses. Revoke access while subscribed: the next result should end the subscription without sending another row.
