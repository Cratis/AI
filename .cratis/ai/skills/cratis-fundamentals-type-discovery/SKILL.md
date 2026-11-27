---
name: cratis-fundamentals-type-discovery
description: Use when a Cratis handler set, filter chain, strategy set or dispatcher must discover every implementation of an abstraction. Not for selecting one service implementation at composition time.
license: MIT
---

# Cratis implementation discovery

`services.AddSingleton<IFoo, Foo>()` looks free at the registration line. The
cost arrives later: a new implementation in another folder does nothing until
someone remembers the line, a removed one leaves a registration that fails at
startup, and every specification setup has to mirror the composition root.

`IInstancesOf<T>` moves that knowledge into the implementation. Adding or
removing one becomes a single-file change.

## Verified product sources

| Package | Purpose |
| --- | --- |
| `Cratis.Fundamentals` | `IInstancesOf<T>`, `IImplementationsOf<T>`, `ITypes`, convention bindings and the bundled `Cratis.Fundamentals.TypeDiscovery.Generator` |

Reverify against the Cratis Fundamentals repository before claiming support for
another version.

## Route near misses

- The consumer needs **one** implementation chosen at composition time:
  constructor-inject the interface and let the `IFoo → Foo` convention resolve
  it. This skill does not apply.
- The method **returns** a sequence of values to a caller: `IEnumerable<T>` (or
  `IReadOnlyList<T>`) is still the right return type. The rule is about
  *injecting* implementations of an abstraction, not about returning values.
- You only need the **types**, never instances: inject `IImplementationsOf<T>`,
  which enumerates `Type` rather than `T`.

## When you need this

The consumer of an abstraction has to iterate, filter, or fan out to **every**
registered implementation:

- Anything plural that delegates to a set — `*Handlers`, `*Filters`,
  `*Validators`, `*Formatters`, `*Strategies`, `*Providers`, `*Resolvers`.
- A dispatcher that asks each implementation `CanHandle(...)` and forwards to
  the one that says yes.
- A composite that fans one input out to all implementations and aggregates.

## Step 1 — Confirm the implementations are discoverable

Discovery normally uses compile-time generated providers, not a walk of
`DefinedTypes`. Reflection is the fallback when no generated providers exist.

- Use concrete, non-generic implementations. Generated contract maps exclude
  open-generic implementors. An assembly's own provider can include its internal
  types; references emitted from another assembly require public types.
- `T` is an interface or abstract class (`where T : class`).
- Instances resolve by concrete type, so each implementation needs a self-binding.
  `AddSelfBindings()` honors `[Singleton]`, `[Scoped]`, and `[IgnoreConvention]`;
  it excludes static/abstract/interface/exception types, System/Microsoft
  namespaces, and classes with primitive or record-typed constructor parameters.
  `IFoo → Foo` bindings require matching names in the same namespace and exactly
  one implementation; they do not replace self-bindings for a discovered set.

The host must call `services.AddTypeDiscovery()` to register `ITypes`,
`IInstancesOf<>`, and `IImplementationsOf<>`, plus the convention binding setup.
Arc's `AddCratisArc` does this; a plain host must do it.
No per-implementation registration is needed when self-binding applies.

The Fundamentals NuGet package carries the generator as an analyzer. A project
reference does **not** carry it: reference the generator explicitly, otherwise
only Fundamentals' own provider may contribute. A captured `ITypes` universe
never gains late-loaded assemblies. `AddTypeDiscovery()` reuses the default
universe while the provider set is unchanged; a later call rebuilds it if new
providers registered, without changing earlier consumers.

## Step 2 — Choose the lifetime with an attribute

```csharp
using Cratis.DependencyInjection;

[Singleton]
public class CsvReportFormatter(IClock clock) : IReportFormatter
{
    public bool CanHandle(ReportRequest request) => request.Format == "csv";
    public string Format(Report report) => /* … */;
}
```

⚠️ `[Singleton]` lives in **`Cratis.DependencyInjection`**, not `Cratis`. That
is the using directive to add when it does not resolve.

The convention reads exactly three attributes:

| Attribute | Lifetime |
| --- | --- |
| `[Singleton]` | Singleton |
| `[Scoped]` | Scoped |
| neither | **Transient** |

`[IgnoreConvention]` opts a type out of convention binding entirely.

Skip `[Singleton]` only when the implementation genuinely holds per-call state.
The `IFoo → Foo` convention still applies to transients — do not register them
explicitly either.

## Step 3 — Inject `IInstancesOf<T>` in the consumer

```csharp
using Cratis.DependencyInjection;
using Cratis.Types;

[Singleton]
public class ReportFormatters(IInstancesOf<IReportFormatter> formatters) : IReportFormatters
{
    public bool CanHandle(ReportRequest request) =>
        formatters.Any(formatter => formatter.CanHandle(request));

    public string Format(ReportRequest request, Report report) =>
        formatters.First(formatter => formatter.CanHandle(request)).Format(report);
}
```

`IInstancesOf<T>` implements `IEnumerable<T>`, so LINQ works on it directly.

**The type set is fixed at construction; instances resolve on every enumeration**
through the service provider captured by `InstancesOf<T>`. The consumer's scope
therefore matters: the singleton above is safe only when no implementation is
scoped. A singleton captures the root provider and would make a scoped
implementation captive or fail scope validation. Use a scoped or transient
consumer resolved inside a scope when any implementation is scoped; follow the
lifetime rule in `csharp.md`. Materialize with `.ToArray()` only when one operation
needs a stable instance snapshot.

## Step 4 — Delete the dead registrations

Find every line in a composition root or service-collection extension that
registered the implementations or the consumer, and remove it:

```csharp
// Delete — IInstancesOf<T> discovers them, [Singleton] gives them their lifetime
services.AddSingleton<IReportFormatter, CsvReportFormatter>();
services.AddSingleton<IReportFormatter, JsonReportFormatter>();
services.AddSingleton<IReportFormatters, ReportFormatters>();
```

Search for every remaining reference before deleting, so nothing else was
relying on a registration for a different reason.

## Reuse derived-type discovery

Requires Fundamentals and its generator 7.26.1 for per-universe caching plus nested-generic/experimental-type generator fixes; check `dotnet list package`, or keep the older construction path until upgrading.

Use `Cratis.Serialization.DerivedTypes.For(types)` when several service
collections share the same `ITypes` instance. It returns one shared `DerivedTypes`
per universe, held weakly; distinct universes stay isolated. Do not construct one
per scope or replace a host's explicit universe with `DerivedTypes.Instance`.

The generator omits nested open-generic types from referenced Cratis packages
and handles referenced `[Experimental]` diagnostic IDs. Upgrade the generator
rather than editing its output to bypass those build failures.

## What breaks

- **`[Singleton]` does not resolve.** The using directive is
  `Cratis.DependencyInjection`, not `Cratis`.
- **An implementation is silently absent from the set.** Its assembly did not
  contribute a generated provider before the universe was built, or its type is
  abstract, generic, or inaccessible to the emitted provider. Inspect
  `ITypes.DiscoveryMode` (`Unknown`, `Generated`, `Reflected`, or `Explicit`) and
  `ITypes.Assemblies`; ask `TypeDiscoveryDiagnostics.FindMissingContributors(types)`
  for referenced assembly names that did not contribute (it loads nothing and
  may also report libraries with no discoverable types). The reflection fallback
  includes package assemblies by prefix: `Cratis` by default, configurable through
  `PackageReferencedAssemblies.Instance.AddAssemblyPrefixesToInclude(...)` before
  discovery.
- **Discovery dependencies cannot resolve.** The plain host omitted
  `services.AddTypeDiscovery()`.
- **Enumeration yields null.** The concrete type was discovered but not registered
  as itself, for example because `[IgnoreConvention]` or a self-binding exclusion
  skipped it. `InstancesOf<T>` uses `GetService(type)`, not `GetRequiredService`.
- **An implementation is a new instance every time it is touched.** It has no
  lifetime attribute, so the convention made it transient. That is correct
  behavior for the convention and usually the wrong intent — add `[Singleton]`.
- **A stale registration fails at startup.** A hand-written
  `AddSingleton<TInterface, Impl>()` survived a type being removed. Step 4 is
  what prevents it.
- **Injecting `IEnumerable<T>` seems to work and returns nothing.** That
  signature only sees hand-registered implementations. It is the failure mode
  this skill exists to remove — it fails silently and empty, not loudly.

## How it is proven

`dotnet build` — zero warnings, zero errors — then run the specifications for
the affected behavior. The non-vacuity check matters here: assert the **count**
of discovered implementations, not just that iterating them threw nothing. A
fan-out over an empty set passes every assertion that only says "nothing went
wrong".

Assert the expected `ITypes.DiscoveryMode` and contributing assembly names too.
For startup diagnostics, collect EventSource `Cratis.Fundamentals.TypeDiscovery`
with `dotnet-trace`: it reports universe construction and warns when only
Fundamentals contributed.
