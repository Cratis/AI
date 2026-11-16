# AI administration

Provider management now requires administrator authorization. Commands and queries for providers,
provider pools, credentials, agents and their skills, usage, and decision-engine configuration all
require the package-registered Arc policy `Cratis.AI.Management`.

## Register administrators

`AddCratisAI` registers the policy automatically. The default `IAIAdministrators` implementation
denies all callers. Supply your application's authority with the builder:

```csharp
services.AddCratisAI(ai => ai
    .WithSecretProtector<ApplicationSecretProtector>()
    .WithAgents<ApplicationAgents>()
    .WithAdministrators<ApplicationAIAdministrators>());
```

Implement `Cratis.AI.Providers.IAIAdministrators` using your authenticated caller and current tenant's
administrative permissions. For example, an application with a trusted `AIAdministrator` role can use:

```csharp
public class ApplicationAIAdministrators : IAIAdministrators
{
    public ValueTask<bool> IsAdministrator(ClaimsPrincipal principal, CancellationToken cancellationToken) =>
        ValueTask.FromResult(principal.IsInRole("AIAdministrator"));
}
```

The example uses `System.Security.Claims`, `Cratis.AI.Providers` and the application's usual threading
imports. The role is an example, not a role assigned or inferred by the package. Scope decisions to
your application's authenticated identity and tenant. Unauthenticated requests are denied, and a failed
authority check does not grant access. No management endpoint is exempt for ordinary authenticated
users.

## Selection and internal execution

Administrator permission is separate from permission to use a provider. Updating its allowed team
members also requires the existing `IProviderSelectionAuthority` check, including when calling its
handler directly. See [provider team members](provider-team-members.md).

Package-owned operations use an internal asynchronous execution scope together with Arc's
`ISystemExecution.AsSystem()` for credential refresh, sign-in completion, model discovery, rate limits
and usage recording. The internal scope remains available across asynchronous command execution,
including execution within an ordinary user's request, and is cleared when the operation completes.
System identity claims alone do not grant management permission; callers outside the package-owned
scope must satisfy `IAIAdministrators`.

**Breaking behavior:** consuming applications executing management commands in-process through
`ISystemExecution.AsSystem()` must now be admitted by their `IAIAdministrators` implementation.

A refreshed subscription credential is returned only after its recording command succeeds. A refused
or failed recording command does not produce a refreshed credential.

Authorization is enforced through Arc's command/query pipeline. Calling other handlers directly is
not a replacement for running that pipeline.
