---
applyTo: "**/*.cs"
paths:
  - "**/*.cs"
---

# Service Lifetimes, Tenancy and the Current User

**Assume every application you build is multi-tenant.** Not "design for it later" — assume it now, even when the deployment ships with a single tenant and no tenant resolution configured. A single-tenant application is a multi-tenant one with one tenant in it, and the code shape that serves both is the same shape. The code shape that serves only one is the shape that has to be found and rewritten later, from the far side of a data migration, under production.

The same reasoning applies to the signed-in user: an application always has one, and a service that remembers *which* one is a service that will eventually answer for the wrong person.

This gives one rule with two faces:

> **A singleton may not depend on anything that belongs to a tenant, a user, or a request.**

## What is scope-bound, and therefore off limits in a singleton

In a Cratis application these resolve **per scope**, and the scope is what carries the tenant:

| Do not inject into a `[Singleton]` | Why |
| --- | --- |
| `IEventStore` — and everything off it: `IEventLog`, `IReadModels`, `IConstraints`, `IEventTypes`, `IProjections`, `IReducers`, `IPII` | resolved for the scope's namespace; a captured one is pinned to whichever namespace the root scope resolved |
| `IMongoCollection<T>`, `IMongoDatabase`, `IMongoClient` | the database name is resolved per scope from the current tenant |
| An EF Core `DbContext` | scoped for the same reason, plus it is not thread-safe |
| A read model injected directly (`[ReadModel]` records resolved by key) | same scope, same binding |
| Anything holding a resolved tenant, principal, claims, correlation id, or `HttpContext` **value** | it belongs to one request and outlives it in a singleton |

A `[Singleton]` taking any of these is a **captive dependency**: the container hands it the *root* scope's instance and keeps it for process lifetime. The root scope has no request, so it resolves no tenant — every read and write goes to the default namespace forever, regardless of who is asking.

## Why this is worse than it looks

**It does not throw. It returns nothing.** A query against the wrong namespace is a query against a database that exists and is empty, so the caller gets an empty collection, a `null` read model, or a default-valued options object — and carries on. The application starts, the pages render, the build is green, and the configuration a tenant spent an afternoon entering is simply not there.

It is also invisible while there is only one tenant. Every symptom appears on the day a second one does — which is the day you are least able to absorb a sweep of every service in the codebase.

Note that .NET's own captive-dependency detection (`ServiceProviderOptions.ValidateScopes`, on in Development for applications that add Arc) exists to catch exactly this. If a singleton in your codebase holds a scoped service and Development startup is not complaining, that path is not being exercised in Development — which is worth knowing on its own.

## What to use instead

**Default to the convention.** A type registered by the `IFoo → Foo` convention is transient and inherits the resolving scope's tenant for free. Most services need nothing more than that.

**Use `[Scoped]`** when a service must be shared within one request but not beyond it.

**Reserve `[Singleton]` for things that are genuinely process-wide** and hold no tenant-, user-, or request-bound state: `IInstancesOf<T>` aggregators, HTTP client wrappers, `IOptions<T>` readers, pure computation, and framework plumbing.

**When something must be a singleton and still needs data** — a hosted service, a dispatcher, a poller — inject `IServiceScopeFactory` and open a scope per unit of work, with the tenant established:

```csharp
// ❌ Wrong — IEventStore is scoped; this captures the root scope's default namespace forever.
[Singleton]
public class WeeklyDigestSources(IEventStore eventStore) : IWeeklyDigestSources
{
    public Task<DigestConfiguration?> GetCurrent() =>
        eventStore.ReadModels.GetInstanceById<DigestConfiguration>(DigestId.Default);
}

// ✅ Right — a scope per call, so the collaborators bind to the caller's tenant.
[Singleton]
public class WeeklyDigestSources(IServiceScopeFactory scopeFactory) : IWeeklyDigestSources
{
    public async Task<DigestConfiguration?> GetCurrent()
    {
        using var scope = scopeFactory.CreateScope();
        var eventStore = scope.ServiceProvider.GetRequiredService<IEventStore>();
        return await eventStore.ReadModels.GetInstanceById<DigestConfiguration>(DigestId.Default);
    }
}
```

**`IChronicleClient` is singleton-safe** and is the right collaborator when a flow knows which namespace it means and has no scope to resolve one from — it names the event store and namespace explicitly:

```csharp
var tenantStore = await chronicleClient.GetEventStore("MyStore", tenantId.Value);
```

Naming the namespace is a deliberate, readable statement that this code crosses a tenant boundary. Capturing a scoped service is the same crossing made by accident.

## The current user is not process-wide either

Never capture the signed-in user, their principal, claims, roles, or any value derived from them in a singleton. The service will answer with whoever happened to arrive first.

The distinction that matters: **the accessor is fine, the value is not.** `IHttpContextAccessor` is itself a singleton and safe to inject; what must not happen is reading a value out of it once and keeping it. A current-user service is a singleton only when every method reads through the accessor on each call and stores nothing:

```csharp
// ✅ Fine as a singleton — nothing about a user is retained between calls.
[Singleton]
public class CurrentUser(IHttpContextAccessor httpContextAccessor) : ICurrentUser
{
    public UserName GetUserName() =>
        httpContextAccessor.HttpContext?.User.FindFirst("preferred_username")?.Value ?? UserName.NotSet;
}
```

Anything that *derives* something per user and would like to keep it — a resolved profile, a permission set, a per-user client — is not a singleton. If it must be one for cost reasons, it holds a cache **keyed by the user**, never a single field.

## Off-request work has to carry its tenant

Reactors, hosted services, background dispatch and scheduled jobs run with no HTTP request, so there is nothing for a tenant resolver to read. Chronicle observers are themselves instantiated per namespace, but the collaborators they call are not — a reactor that reaches a tenant-blind singleton has left its namespace behind without saying so.

Such a flow must state its tenant explicitly: resolve the event store through `IChronicleClient` with the namespace named, or open a scope inside a window where the current tenant is established. Whichever mechanism an application uses, it is the flow's job to say which tenant it is acting for — never to inherit whatever the root scope happens to be.

## Caching

A process-wide cache of tenant data is the same bug wearing a performance justification. If a singleton caches, the tenant (and where relevant the user) is **part of the key** — never an implicit assumption that there is only one. The same holds for `static` fields: a `static` cache of anything tenant-scoped is shared by every tenant in the process.

## Enforce it, do not remember it

This class of mistake is silent, so review will not reliably catch it and a convention will not hold. Add an architecture spec that fails the build:

```csharp
public class and_a_singleton_depends_on_a_scoped_service : Specification
{
    static readonly Type[] _scopeBound =
    [
        typeof(IEventStore), typeof(IEventLog), typeof(IReadModels), typeof(IMongoDatabase)
    ];

    string[] _offenders;

    void Establish() =>
        _offenders =
        [
            .. typeof(SomeTypeInTheAssembly).Assembly.GetTypes()
                .Where(type => type.HasAttribute<SingletonAttribute>())
                .Where(type => type.GetConstructors().Any(constructor => constructor.GetParameters().Any(IsScopeBound)))
                .Select(type => type.FullName!)
        ];

    static bool IsScopeBound(ParameterInfo parameter) =>
        _scopeBound.Contains(parameter.ParameterType) ||
        (parameter.ParameterType.IsGenericType &&
         parameter.ParameterType.GetGenericTypeDefinition() == typeof(IMongoCollection<>));

    [Fact]
    void should_find_none() => _offenders.ShouldBeEmpty();
}
```

Extend the list with whatever else is scope-bound in the application (its `DbContext`, its own scoped services). The spec is cheap, it runs on every build, and it is the only thing that keeps the rule true a year from now.

## Framework repositories

The tenancy argument is an application concern, but the underlying rule is not: a singleton capturing a scoped service is a captive dependency wherever it appears. Framework code holds to it for the same reason, minus the multi-tenancy framing.

## Checklist

- [ ] No `[Singleton]` takes `IEventStore` or anything off it, a MongoDB collection/database/client, or a `DbContext`.
- [ ] No `[Singleton]` retains a user, principal, claims, tenant, or `HttpContext` value between calls.
- [ ] Singletons that need data take `IServiceScopeFactory` (or `IChronicleClient` with the namespace named).
- [ ] Every cache in a singleton — and every `static` cache anywhere — is keyed by tenant, and by user where relevant.
- [ ] Off-request flows state which tenant they act for rather than inheriting the root scope.
- [ ] An architecture spec fails the build when any of the above regresses.

## See also

- `csharp.md` — dependency injection conventions and `[Singleton]`.
- The **multi-tenancy** skill — Chronicle namespaces and Arc tenant resolution.
- `reactors.md` — per-namespace observer behavior.
