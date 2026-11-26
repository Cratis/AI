<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Availability in a C# Arc host

## Contents

- Where the engine lives
- Declare with types
- Suspension
- Proxies and asking
- Manifest file and shared cases
- Pitfalls

Availability decides whether a part (module, feature, slice, command, read model) exists for a tenant, user or
system caller. It is decided before `authorize` and is not authorization. The Screenplay model side is the
`cratis-screenplay-availability` skill; this page is the C# side. Facts come from the Arc availability
documentation (`Documentation/backend/csharp/availability.md` and `availability-engine/`).

## Where the engine lives

- The engine is `Cratis.Arc.Availability`: gate expressions, evaluator, audiences, context values and the manifest.
  It does not depend on ASP.NET and does not depend on `Cratis.Choreography`.
- `arc.WithAvailability()` registers the gates, the engine, an in-memory audience source by default and startup
  validation that discovers gated parts and verifies the declared blocks once.
- `AddAvailability` registers the engine alone, for a host that is not a web application.
- `Cratis.Choreography.Availability` is an obsolete forwarder from Choreography 2.11.0. Move to the Arc types
  (`Cratis.Arc.Availability`, `.Audiences`, `.Context`); `ChoreographyContextValueSource` is now
  `AvailabilityContextValueSource`.

## Declare with types

What you write in C# is what a model can say; a typo is a compile error because nothing is named by a string.

| Screenplay | C# |
| --- | --- |
| `audience Plus` | `public class Plus : Audience;` (summary is the description) |
| `availability DataQuality` | `public class DataQuality : AvailabilityBlock` with `Lines` |
| `for`, `with`, `not`, `when` | `For<T>()`, `With<T>()`, `Not<T>()`, `When` |
| `available for Plus` | `[AvailableFor<Plus>]` (up to three audiences; any opens the gate) |
| `available with DataQuality` | `[Available<DataQuality>]` |
| `available when <condition>` | `[AvailableWhen<HasPaidInvoice>]` |
| gate on a module, feature or slice | a type deriving from `AvailabilityScope` in its namespace |
| `provide vessel Vessel from query ...` | `[ProvideContext<Vessel>(...)]` |

```csharp
public class Plus : Audience;

public class DataQuality : AvailabilityBlock
{
    protected override IReadOnlyList<AvailabilityTerm> Lines =>
    [
        For<Plus>(),
        When.On<Vessel>(_ => _.HasReported).IsTrue()
    ];
}

[Command]
[AvailableFor<Plus, Preview>]
public record ResetScore(VesselId Vessel);

[Available<DataQuality>]
public class Feature : AvailabilityScope;
```

- Every attribute is one line and every line must hold: `[AvailableFor<Plus>, AvailableFor<Preview>]` needs both.
  For either, use `[AvailableFor<Plus, Preview>]` or a block.
- `For<T>()` and `With<T>()` combine with `&`, `|` and parentheses. `Not<T>()` applies to one audience and is
  three-valued: an unknown audience keeps the gate closed. A `&` between different forms is separate lines;
  a `|` between different forms or beneath `not` cannot be stated and the generator reports it.
- Conditions come in two forms. The restricted comparison (`When.On<Vessel>(_ => _.CommercialPackage).IsNot(Package.Basic)`,
  with `Is`, `IsNot`, `IsTrue`, `In`, `NotIn`, `IsGreaterThan`, `IsAtLeast`, `IsLessThan`, `IsAtMost`) compiles to a
  Screenplay `when`. An injectable `IAvailabilityCondition` class (`When.Condition<T>()` or `[AvailableWhen<T>]`) is
  emitted as an opaque condition the model cannot read.
- Obsolete, with a migration table in the Arc docs: `[AvailableFor("name")]`, `[AvailableWith("name")]`, the
  `AvailabilityExpression` factories, `GateNamespace`, `ContextValueCatalog.Declare` and `DeclaredAudiences`.

## Suspension

Any discovered module, feature, slice or part can be suspended for a tenant, a user or the system without declaring
anything. Audiences are **granted and withdrawn**; parts are **suspended and resumed**.

- Reason `Suspended` (`AvailabilityReason.Suspended`), distinct from `NotAvailable`; both are HTTP 403.
- Checked first: before gates and before `authorize`. Suspension wins over every grant; a suspended module or feature
  suspends what is beneath it. The newest decision per level and path wins.
- `ISuspensionSource` (`GetDecisions`, `OnChanged`) is what a product implements, fed by the events `PartSuspended`
  and `PartResumed` (never `TenantSuspended`). `InMemorySuspensionSource` is the default. A source that cannot
  answer is a retryable failure (503), never a suspension.
- Part paths are the slice location joined with `/` (`Fleet/DataQuality/QualityScores`); `DiscoveredParts.Entries()`
  and `AvailabilityManifest.Parts` list what an operator can suspend.
- `/.cratis/availability` lists refused parts with their `reason`; MCP tools of a suspended part are left out.

## Proxies and asking

- Regenerate the TypeScript proxies after updating: every command and query proxy (including model-bound read model
  queries) declares `static part`. The gate stays on the server.
- `/.cratis/availability` accepts `part` and `arguments`, so a gate reading `arguments.vesselId` answers for one
  vessel with the same gate that decides execution. In code: `IUnavailableParts.Get(PartQuestion)`.
- Frontend: see the [React availability reference](../../cratis-arc-react-page/references/availability.md).

## Manifest file and shared cases

- One JSON format, `cratis.availability.manifest.json`, `format` `cratis-availability-manifest`, `version` 1, with a
  schema in `Specifications/availability` of the Arc repository. It is written by the engine (`ManifestFileBuilder`)
  and by the proxy generator at build (set `CratisAvailabilityManifest` to a path), and decided by
  `ManifestFileEvaluator`.
- `Specifications/availability/vectors` holds shared data-driven cases any Arc engine can run. Named conditions
  (code) are listed in the file but cannot be evaluated from it.

## Pitfalls

- `AddArcAvailability` configured before `AddCratis()` was once discarded (gates lost, parts failed open); use
  `arc.WithAvailability()` on a version that has the fix.
- Never use availability as authorization or the reverse; never model suspension in the Screenplay model.
- A decision failure is a retryable error, never `NotAvailable`.
