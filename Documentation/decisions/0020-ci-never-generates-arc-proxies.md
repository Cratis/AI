<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# 0020 - CI never generates Arc proxies

## Status

Proposed

Supersedes item 4 of `0004-proxy-route-shape-and-package-layout.md` only; items 1-3 and 5 of
that record stand. The organization ruled on November 11, 2026 that continuous integration never
builds or generates Arc proxies on pull request and verify builds. Named-decider attribution
remains pending; this record does not claim acceptance on behalf of an unidentified person.
Related: Cratis/AI#1130.

## Context

Arc's proxy generator runs after every build whenever `CratisProxiesOutputPath` is non-empty.
The `verify` job rebuilt `Cratis.AI` only to regenerate `Source/Cratis.AI.Proxies/generated` and
diff it against the committed tree. That made every pull request pay for generation, and the
generator's output (including a wall-clock header) was a recurring source of CI noise.

This decision applies to `.github/workflows/publish.yml` and the contributor workflow for the
committed proxies. It holds until explicitly superseded. Arc's own future skip property is out
of scope because it is not released.

## Decision

- Pull request and verify builds pass `-p:CratisProxiesOutputPath=`, which disables generation.
- Amendment: from Arc 22.185.1, CI passes `-p:CratisProxiesSkip=true`, Arc's released skip property, instead of the empty output path. The decision itself (CI never generates) is unchanged.
- The proxy-only build and the "Verify generated proxies are up to date" drift gate are removed.
- The npm release build keeps generating, so the published `@cratis/ai` always ships fresh proxies.
- Contributors refresh the committed tree locally with
  `dotnet build Source/Cratis.AI/Cratis.AI.csproj` and commit the result under
  `Source/Cratis.AI.Proxies/generated`.

Alternative not taken: keep the drift gate. It catches a forgotten refresh before release, but it
contradicts the organization rule; the release build regenerating proxies removes the stale-package risk.

## Consequences

A pull request can merge with committed proxies that differ from what the code would generate; the
next local build shows the difference and the release package is unaffected. Pull request builds
are faster and no longer depend on generator output.

Done when: no pull request or verify path in `publish.yml` generates proxies and the npm release job does.
Verify by: reading `publish.yml` and confirming the `dotnet-verify` builds pass the property.
