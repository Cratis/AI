# C#: authorize an Arc command or query

Prerequisite: a host that already authenticates callers. The attributes are in `Cratis.Arc.Authorization`: `[Authorize]` requires sign-in, `[Roles("a", "b")]` requires one of the listed roles, `[Authorize(Policy = "name")]` runs a named policy and `[AllowAnonymous]` opens an operation on purpose.

For a role requirement, add Arc's authorization attribute to the existing command in `Features/Authors/Registration/RegisterAuthor.cs` (`Library.Features.Authors.Registration`). Use the role name issued by your identity provider. Leave `Handle`, `AuthorId` and the event unchanged.

```csharp
// Add to the existing RegisterAuthor declaration, alongside [Command].
[Cratis.Arc.Authorization.Authorize(Roles = "catalog-editor")]
```

Execute through the pipeline as an anonymous caller, a signed-in reader and a catalog editor. Both refused results have `IsAuthorized` false and append nothing; the editor succeeds. If the HTTP request reaches Arc and produces an unauthorized command result, Arc maps that result to HTTP 403. Check the server verdict rather than whether the UI shows the registration button.

On queries, put the attribute on the read model for a shared requirement or on an individual query method to replace that query's requirement. Invocation authorization does not continually recheck a live subscription.

If access depends on ownership, do not treat a caller-supplied owner ID as proof. Use the verified principal and compare it with the resource's ownership; exercise a signed-in caller who knows another owner's ID and expect refusal.

## Stop a live query when access ends

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

In an `IGuardObservableQueryEmission`, return `Allow` for other `context.QueryName` values. For this query, use the captured `context.Principal` only to identify the caller. Its WebSocket handshake claims do not refresh: calling `IsInRole` again is not a revocation check. On every emission fetch current membership, active organization and roles from the authoritative store. Return `DenyAndTerminate` unless access is confirmed for the captured `context.SubscriptionScope`, including when the lookup fails. Test without reconnecting: keep the session active, revoke the role after the first result, publish a matching change, and assert termination with no protected update.

## Rules that decide the verdict

- **Stacked attributes all have to pass.** Roles inside one attribute are alternatives.
- **A query method's declaration replaces its read model's declaration.** A method with a guest policy is reachable by guests even when the type demands a role.
- **A named policy** implements `IAuthorizationPolicy` and is registered with `builder.Services.AddArcAuthorizationPolicy<ActiveSubscription>("ActiveSubscription")`. It only sees signed-in callers unless registered with `evaluatesAnonymous: true`; then it receives an unauthenticated principal and must decide itself. Don't add `[AllowAnonymous]` beside it: the two conflict.
- **A fallback** (`IFallbackAuthorizationEvaluator`, discovered automatically) applies only to operations with no declaration on the method or its type. Any explicit declaration replaces it, so it is not a global requirement added to every operation.
- **Read the caller from `ICurrentPrincipalAccessor`**, never from a request header, a cookie or a command property. When a command decides from mutable state, such as membership, load that state as a protected read model parameter so the decision cannot use a stale copy.
- **Outside a request there is no caller.** Establish the server actor deliberately for background work; never treat a missing caller as an administrator.

## Where the caller comes from

Unsigned forwarded identity headers are ignored unless `Cratis:Arc:TrustForwardedIdentityHeaders` is `true`. Turn it on only behind an ingress that authenticates callers, replaces inbound identity headers and cannot be bypassed. Trusting unsigned headers, verifying a signed hop and validating a bearer token are three separate mechanisms; choose issuer, audience and route for a bearer token together, and never fix a failing bearer route by marking the operation anonymous.

Test three paths against the deployed listener: a direct request that skips the proxy, a request without credentials and a token for the wrong audience. All three must be refused.

`/.cratis/me` answers from the authenticated principal and returns 401 without one. `IProvideIdentityDetails` supplies presentation data and does not grant access to an Arc operation; enforce that operation's own policy. Behind AuthProxy, the endpoint also supplies the proxy's admission verdict. With the default `IdentityVerification: Required`, only a 2xx with `isAuthorized: true` admits the caller. Deliberately return `IsUserAuthorized = false` to refuse admission. A 404, other non-2xx, unavailable backend, timeout (10 seconds by default), empty or unparseable body, or missing verdict also denies. Keep the endpoint reachable and fast rather than switching to `BestEffort` to hide a fault. Test fresh admission through the proxy with a positive verdict, a negative verdict and an unavailable backend. After an account change, clear the frontend's cached identity and reconnect authorized subscriptions.

Arc also ships personal access tokens (`IPersonalAccessTokens`) for non-interactive callers. Pick the mechanism the deployment needs; no single topology is required.

A legacy client may fall back to presentation data if the identity route is absent (404), never if the server challenged or denied access (401/403). Clear cached presentation details when the account changes. Neither the cache nor a display cookie establishes a caller for a write.
