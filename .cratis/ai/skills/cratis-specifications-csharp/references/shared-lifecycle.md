<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Shared specification lifecycle

Requires `Cratis.Specifications.XUnit.v3` or `.XUnit` 5.0. Before 5.0 the shared
lifecycle was an opt-in on xUnit and `CRSPEC0008` was informational; check the package
version before relying on either. NUnit, TUnit and the native runner always share the
instance.

Source: [Running specifications fast](https://github.com/Cratis/Specifications/blob/main/Documentation/running-fast.md)
and [Upgrading to 5.0](https://github.com/Cratis/Specifications/blob/main/Documentation/upgrading-5.0.md).

The shared lifecycle is the house default. Plain xUnit builds a new instance per fact,
so `Establish` and `Because` would run once per fact; the shared lifecycle runs them
once per class, which is what a specification means: one context, one action,
several assertions. Construction, `Establish` and `Because` happen once, all facts share
the instance, and `Destroy` runs once after the last fact, including when
initialization failed. A throwing `Establish` or `Because` fails every fact in that
class.

The package registers the test framework. Delete any hand-written
`[assembly: Xunit.TestFramework("Cratis.Specifications.SpecificationTestFramework", ...)]`;
a duplicate fails the build with `CS0579`.

## Eligibility

A class is shared only when it derives from `Specification`, has a single public
parameterless constructor (or only framework-managed fixture arguments), and has only
plain facts. Theories, `ITestOutputHelper` constructors, custom `IAsyncLifetime`
implementations, custom fact test cases and plain xUnit classes keep the per-fact lifecycle.

Requires Cratis.Specifications 4.4.0 or later for `IDisposable` specifications to share
the lifecycle; earlier versions use per-fact construction. With shared lifecycle enabled,
construction happens once and `Destroy` then `Dispose` run once after the last
fact, even when `Destroy` fails. At 5.0.2 `IAsyncDisposable` is supported too;
async disposal wins when both interfaces are implemented. Class/collection fixtures
remain owned by xUnit, with assembly fixtures also supported on v3. Use
`[PerFactSpecificationLifecycle]` when a fresh instance per fact is needed.

`Specification.InitializeAsync()` is idempotent for a single instance. It does not make
an ineligible class shared or cache instances across classes.

## CRSPEC0008

`CRSPEC0008` is an error by default: a `should_` fact that assigns to or increments an
instance field or property of the specification, or calls `Add`, `AddRange`, `Remove`,
`RemoveAt`, `Clear` or `Insert` on one, would make the result depend on fact order.
Since 5.0.2, calls inside NSubstitute `Received.InOrder(...)` delegates are
recognized as verification, but assignments and increments there still mutate
state and are reported. Theories, per-fact classes/assemblies, immutable collection
calls and collection calls whose return value is used are excluded as documented
in the tagged 5.0 upgrade guide. Move actual mutations into `Establish` or `Because`:

```csharp
public class when_registering : Specification
{
    List<string> _registered;

    void Establish() => _registered = [];
    void Because() => _registered.Add("first");

    [Fact] void should_have_one_registration() => _registered.Count.ShouldEqual(1);
}
```

Do not lower the severity to pass the gate. When the repository must lower it, set it in
`.editorconfig` with `dotnet_diagnostic.CRSPEC0008.severity = warning`.

## Keep per-fact execution

Use the narrowest scope; the reason is a fact that genuinely needs a fresh instance.

| Scope | How |
| --- | --- |
| One class | `[PerFactSpecificationLifecycle]` on the class |
| The assembly | `[assembly: PerFactSpecificationLifecycle]` |
| The project | `<CratisSpecificationsSharedLifecycle>false</CratisSpecificationsSharedLifecycle>` |

Read [running-specs.md](./running-specs.md) for the executable loop and the 4.x → 5.0
checklist.
