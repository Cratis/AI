---
name: cratis-arc-authorize-request
description: Use when an Arc model-bound command or query must require sign-in or restrict access to a role. Not for selecting a tenant (use cratis-arc-isolate-tenant).
compatibility: Requires the Cratis package and a configured authentication provider.
---

# Restrict author registration to editors

Require sign-in by default with `[Cratis.Arc.Authorization.Authorize]`. Choose a role or named policy when signing in is not enough to perform the operation; declare the requirement on the command or query, not in a field validator.

For a role requirement, add Arc's authorization attribute to the [existing command](../cratis-arc-declare-command/SKILL.md) in `Features/Authors/Registration/RegisterAuthor.cs` (`Library.Features.Authors.Registration`). Use the role name issued by your identity provider. Leave `Handle`, `AuthorId` and the event unchanged.

```csharp
// Add to the existing RegisterAuthor declaration, alongside [Command].
[Cratis.Arc.Authorization.Authorize(Roles = "catalog-editor")]
```

Execute through the pipeline as an anonymous caller, a signed-in reader and a catalog editor. Both refused results have `IsAuthorized` false and append nothing; the editor succeeds. If the HTTP request reaches Arc and produces an unauthorized command result, Arc maps that result to HTTP 403. Check the server verdict rather than whether the UI shows the registration button.

On queries, put the attribute on the read model for a shared requirement or on an individual query method to replace that query's requirement. Invocation authorization does not continually recheck a live subscription.

## When it goes off the usual path

- **A sensitive subscription can outlive permission:** implement `IGuardObservableQueryEmission` to look up current access for the captured caller and deny delivery after revocation. Keep query authorization and tenant filtering. Revoke access after the first result and verify that subsequent protected data does not arrive on each exposed transport.

## Avoid

- Do not authorize only in React; protect the server operation.
- Do not add method and model role lists together; the method declaration takes precedence.
- Do not test access by invoking `Handle` directly; this bypasses the pipeline.

## Related skills

- [Check tenant membership](../cratis-arc-isolate-tenant/SKILL.md)
- [Exercise the backend](../cratis-specifications-exercise-backend/SKILL.md)
