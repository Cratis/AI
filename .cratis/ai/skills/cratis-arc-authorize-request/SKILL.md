---
name: cratis-arc-authorize-request
description: Use when a developer needs to require sign-in or restrict an Arc model-bound command or query by role or policy. Not for selecting a tenant (use cratis-arc-isolate-tenant).
compatibility: Requires the Cratis package and a configured authentication provider.
---

# Restrict author registration to editors

Require sign-in by default with `[Cratis.Arc.Authorization.Authorize]`. Choose a role when access depends on group membership. Choose `[Cratis.Arc.Authorization.Authorize(Policy = "catalog-edit")]` when the host already defines a policy named `catalog-edit`. Declare the requirement on the command or query, not in a field validator.

For a role requirement, add Arc's authorization attribute to the [existing command](../cratis-arc-declare-command/SKILL.md) in `Features/Authors/Registration/RegisterAuthor.cs` (`Library.Features.Authors.Registration`). Use the role name issued by your identity provider. Leave `Handle`, `AuthorId` and the event unchanged.

```csharp
// Add to the existing RegisterAuthor declaration, alongside [Command].
[Cratis.Arc.Authorization.Authorize(Roles = "catalog-editor")]
```

Execute through the pipeline as an anonymous caller, a signed-in reader and a catalog editor. Both refused results have `IsAuthorized` false and append nothing; the editor succeeds. If the HTTP request reaches Arc and produces an unauthorized command result, Arc maps that result to HTTP 403. Check the server verdict rather than whether the UI shows the registration button.

On queries, put the attribute on the read model for a shared requirement or on an individual query method to replace that query's requirement. Invocation authorization does not continually recheck a live subscription.

If access depends on ownership, do not treat a caller-supplied owner ID as proof. Use the verified principal and compare it with the resource's ownership; exercise a signed-in caller who knows another owner's ID and expect refusal.

## When it goes off the usual path

**A subscription must stop when the caller signs out:** add this guard in `Authorization/RequireActiveSession.cs` when all streams require an active session. Register an application implementation backed by the current session store with `builder.Services.AddScoped<ILibrarySessions, LibrarySessions>();` (import `Library.Authorization` and `Microsoft.Extensions.DependencyInjection`). `sid` must be the verified session claim. Arc discovers the guard; keep query authorization and tenant filtering in place.

```csharp
using System.Threading.Tasks;
using Cratis.Arc.Queries;

namespace Library.Authorization;

public interface ILibrarySessions
{
    Task<bool> IsActive(string sessionId);
}

public sealed class RequireActiveSession(ILibrarySessions sessions) : IGuardObservableQueryEmission
{
    public async Task<ObservableQueryEmissionVerdict> Guard(ObservableQueryEmissionContext context) =>
        context.Principal?.FindFirst("sid")?.Value is string id && await sessions.IsActive(id)
            ? ObservableQueryEmissionVerdict.Allow
            : ObservableQueryEmissionVerdict.DenyAndTerminate;
}
```

Revoke the session after the first result. Verify that no subsequent protected data arrives on each exposed transport.

A valid session can outlast a role or organization assignment. In a discovered `IQueryFilter`, have `OnPerform(QueryContext context)` return `QueryResult.Success(context.CorrelationId)` for other fully qualified `context.Name` values. For the protected query, return `QueryResult.Unauthorized(context.CorrelationId)` if access is denied; otherwise set `context.SubscriptionScope` to the authorized organization ID and return success. The query itself must restrict rows to that organization.

In an `IGuardObservableQueryEmission`, return `Allow` for other `context.QueryName` values. For this query, use `context.Principal` to check current access against `context.SubscriptionScope` on each emission. Return `DenyAndTerminate` if either is missing, the active organization differs, or the required role no longer applies there. Keep the session active in the test; switch organizations or revoke the role and verify the next update is withheld.

## Avoid

- Do not authorize only in React; protect the server operation.
- Do not add method and model role lists together; the method declaration takes precedence.
- Do not test access by invoking `Handle` directly; this bypasses the pipeline.

## Related skills

- [Check tenant membership](../cratis-arc-isolate-tenant/SKILL.md)
- [Exercise the backend](../cratis-specifications-exercise-backend/SKILL.md)
