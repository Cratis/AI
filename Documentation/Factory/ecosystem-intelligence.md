# Cratis ecosystem intelligence

## Ground rules

Factory selection is evidence-driven and composable. Repository mode is resolved
before application or framework knowledge is loaded. Installed or resolved
dependencies outrank prose and source-workspace placeholder versions.

Arc, Chronicle, Components, and the Chronicle clients are distinct capability
surfaces:

- Arc.Core is valid without Chronicle. Chronicle behavior is activated only by
  explicit Chronicle or Arc/Chronicle integration evidence.
- Arc.React and Arc.React.MVVM are React packages. Generated Arc proxies do not
  exist merely because a frontend dependency is present.
- Cratis Components is a React and PrimeReact component library with Arc proxy
  integration. It has no direct Chronicle package dependency.
- `@cratis/chronicle` is a Node and TypeScript client, not a frontend package.
- `io.cratis:chronicle` is the shared idiomatic Kotlin and Java artifact.
- `cratis_chronicle` is the idiomatic Elixir and OTP client.
- Generated `*.contracts` packages are low-level transport contracts and never
  substitute for an idiomatic client.

## Composable application profiles

- `application-arc-dotnet`
- `application-chronicle-dotnet`
- `application-arc-react`
- `application-cratis-components`
- `application-chronicle-typescript`
- `application-chronicle-jvm`
- `application-chronicle-elixir`

The golden application stack is the composition of the first four profiles. Arc
without Chronicle is simply the Arc profile without a Chronicle profile; it is
not treated as an error or silently upgraded to event sourcing.

## Framework profiles

- `framework-arc`
- `framework-components`
- `framework-chronicle`
- `framework-chronicle-typescript`
- `framework-chronicle-jvm`
- `framework-chronicle-elixir`

Framework identity is based on an explicit project manifest or a normalized
canonical Git remote. Folder names and source shapes are supporting evidence
only. Application vertical-slice agents are never selected for a framework
repository.

## Current verified discovery

The deterministic resolver has been exercised directly against the local Arc,
Components, Chronicle, Chronicle.TypeScript, Chronicle.Kotlin, and
Chronicle.Elixir repositories. Each resolved to its exact framework profile, the
repository investigator, and the read-only investigation workflow.

Executable fixtures cover:

- The full .NET, Arc, Chronicle, React, and Components stack.
- Arc without Chronicle.
- TypeScript Chronicle without a frontend.
- Kotlin/JVM and Elixir Chronicle consumers.
- Low-level contracts without an idiomatic client.
- Components with missing React/Arc.React peer evidence.
- Components framework identity.
- An unknown ecosystem.

The resolver returns every profile match and rejection reason, content hashes
for selected knowledge, requirement-relative negative capabilities, warnings,
and blockers. Detection may identify a technology before a suitable
implementation agent exists; in that case execution is blocked rather than
routed to an almost-correct agent.

## Remaining intelligence work

- Read lock and restore artifacts before declared version ranges.
- Add compatibility evaluation for Arc package-train skew and Components peer
  ranges.
- Add language evidence to split Kotlin and Java specialist selection while
  keeping their shared artifact.
- Define specialized framework and client implementation agents and workflow
  gates.
- Detect analyzer packages separately from runtime packages.
- Add explicit proxy-output configuration and generated-file provenance checks.
- Validate repository identity through signed or policy-owned catalog updates in
  hosted environments.
