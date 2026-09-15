---
name: cratis-fundamentals-type-discovery
description: Wire a type that must enumerate every implementation of an abstraction by injecting IInstancesOf<T> from Cratis.Types and deleting the hand-maintained service registrations. Use when a handler set, filter chain, strategy set, or dispatcher fans out to all implementations. Do not use for ordinary single-service dependency injection.
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

| Package | Version | Purpose |
| --- | --- | --- |
| `Cratis.Fundamentals` | `7.18.2` | `IInstancesOf<T>`, `IImplementationsOf<T>`, `[Singleton]`, `[Scoped]`, `[IgnoreConvention]`, the convention bindings |

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

`IInstancesOf<T>` finds types by convention across the loaded assemblies. The
requirements are only:

- Each implementation is a non-abstract `public class`.
- It implements the interface directly, not through a layer that hides it.
- `T` is an interface or abstract class — the interface is declared
  `where T : class`.

No assembly attribute and no registration call is needed.

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

**It resolves an instance from the service provider on every enumeration**, not
once at construction. That is what makes a scoped or transient implementation
behave correctly, and it is why materializing with `.ToArray()` is worth doing
only when you genuinely need a stable snapshot within one operation.

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

## What breaks

- **`[Singleton]` does not resolve.** The using directive is
  `Cratis.DependencyInjection`, not `Cratis`.
- **An implementation is silently absent from the set.** Its assembly is not
  loaded at the point of enumeration, it is not `public`, it is abstract, or it
  carries `[IgnoreConvention]`.
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
