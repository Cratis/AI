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

Package-owned background operations use Arc's in-process `ISystemExecution.AsSystem()` scope for
credential refresh, sign-in completion, model discovery, rate limits and usage recording. The policy
recognizes Arc's system authentication type together with its system subject. This is a server-side
execution scope, not an application-user role. Hosts must reserve that authentication type and
subject combination for Arc system execution; application authentication must not issue identities
with that combination.

Authorization is enforced through Arc's command/query pipeline. Calling other handlers directly is
not a replacement for running that pipeline.
