# Cratis AI

Cratis AI is the controlled source for shared AI skills, engineering guidance,
product profiles, and generated multi-harness packages for the Cratis ecosystem.

It serves two separate audiences:

- **Developers building with Cratis** receive passive public product profiles for
  Fundamentals, Arc, Chronicle, Components, and composed applications.
- **Cratis maintainers** receive separate engineering profiles for application,
  framework, client, documentation, Studio, Stagehand, and corpus repositories.

> **Current status:** distribution remains preview/fixture-only. No supported
> public or engineering profile package has been published. Do not install this
> mixed source repository as a runtime package.

## The architecture

| Concern | Owner |
| --- | --- |
| Shared AI behavior and profile composition | `Cratis/AI` |
| Product APIs, versions, and facts | The owning Cratis product repository |
| Repository-specific context | The consuming repository |
| Generated immutable packages | `Cratis/AI.Distribution` |

Canonical skill and rule behavior is reviewed here. Generated packages flow
one way to subscribers. Improvements discovered in product repositories flow
back through issues or pull requests to this repository; generated folders are
never synchronized bidirectionally.

Read [Cratis AI distribution and subscriptions](Documentation/ai-distribution-and-subscriptions.md)
for the complete source-of-truth, profile, versioning, pinning, Pi, update,
rollback, and contribution model.

## Repository layout

```text
skills/                 Canonical public skill sources
engineering/            Canonical Cratis-maintainer skill sources
.ai/                    Legacy corpus being reconciled into profiles
catalog/                Sources, targets, authority, evidence, and coverage
distribution/           Profile, artifact, rollout, and publication contracts
tooling/                Validation and deterministic generation
Documentation/          Architecture, contribution, and usage guidance
```

`.ai/` remains valuable repository-local guidance but is not a publishable
package tree. Public and engineering artifacts select exact approved files; they
never package the repository wholesale.

## Profiles

The complete plan covers Fundamentals, Arc, Arc React, Components, Chronicle,
language-specific Chronicle clients, identity, compliance, multi-tenancy,
Cratis CLI, Lens, Screenplay, Stage, public Studio/MCP use, Chronicle MCP
passive guidance, and language-agnostic/.NET/TypeScript Specifications.

Composition profiles preserve Arc-only, Chronicle-only, Arc + Chronicle, React,
full application, and Screenplay → Stage boundaries. Public-safe engineering
profiles cover every Cratis product/repository family; private repositories add
local overlays rather than receiving confidential shared packages.

Browse the generated [package and capability catalog](catalog/generated/human-catalog/CATALOG.md)
to compare public and maintainer packages, see their included skills, and check
whether they are planned, candidates, or installable.

See [`distribution/profile-catalog.json`](distribution/profile-catalog.json),
[Profile reference](Documentation/profile-reference.md),
[developer adoption](Documentation/adopting-cratis-ai.md),
[maintainer adoption](Documentation/adopting-cratis-ai-for-maintainers.md), and
[private repository overlays](Documentation/private-repository-overlays.md),
and [release-on-merge](Documentation/releasing-cratis-ai.md).

A consuming repository will pin profiles in project-owned `.cratis/ai.json`:

```json
{
  "schemaVersion": "1.0.0",
  "channel": "cratis-engineering",
  "version": "1.0.0",
  "profiles": ["engineering-chronicle"],
  "harnesses": ["claude", "codex", "copilot", "pi"],
  "updatePolicy": "reviewed-pull-request",
  "projectContext": ".cratis/PROJECT.md"
}
```

The example is illustrative until the first package is published. Floating
versions such as `latest` are forbidden.

## Pi

Pi is a first-class distribution target. Released profiles will be ordinary
versioned Pi packages containing passive skills and references:

```bash
# User-wide maintainer base
pi install npm:@cratis/ai-engineering-base@1.0.0

# Exact project profile pin
pi install -l npm:@cratis/ai-engineering-chronicle@1.0.0
```

Project installation writes `.pi/settings.json`; after project trust, Pi
installs missing exact packages automatically. Pinned packages do not float.
Update and rollback change the exact version through a reviewed pull request.

These commands describe the released workflow and are not available until the
packages exist. See the [Pi package workflow](Documentation/ai-distribution-and-subscriptions.md#pi-package-workflow).

## Supported output formats

The generator now emits a portable Agent Plugins 1.0 package for compatible
hosts alongside Agent Skills and native adapters for Claude Code, Codex, GitHub
Copilot, Cursor, Gemini CLI, Grok Build, Deep Code, preview DeepSeek Harness,
Kiro, Junie, and Pi/npm. Copilot, Cursor, Kiro, and VS Code share the same
portable plugin identity. Claude, Grok, and Junie share one Claude-compatible
marketplace package rather than separate skill instructions.

Documentation and release records distinguish:

1. generated;
2. statically validated;
3. host-tested and supported.

Adapter generation alone is not a support or marketplace-publication claim.

## Contributing an improvement

Use the **Propose a shared Cratis AI improvement** issue form. Include:

- originating repository;
- immutable source revision;
- affected profiles and products;
- first-party product authority;
- compatibility and migration impact.

Product repositories do not publish Cratis AI packages or push generated bytes.
After canonical review, a new immutable release is generated and subscriber
repositories receive reviewed update pull requests.

## Validation

Run the complete local gate after changing release-relevant content:

```bash
node tooling/harness-registry.mjs
node tooling/generate-catalog-v2.mjs
node tooling/generate-ecosystem-artifact-coverage.mjs
node tooling/generate-human-catalog.mjs
node tooling/generate-repository-inventory.mjs
node tooling/validate-catalogs.mjs
node --test tooling/specs/*.spec.mjs
.ai/hooks/scripts/validate-ai-setup.sh
git diff --check
```

The main workflow runs for canonical skills, engineering content, catalogs,
distribution contracts, evidence, evaluations, documentation, workflows, and
tooling.

## Current release blockers

The first narrow public preview still requires:

- owner approval and exact product authority for the Fundamentals concept skill;
- enabling and exercising the approval-driven production materializer after target approval;
- scoped GitHub App credentials for generated pull requests;
- one real consumer install/update/rollback/uninstall canary;
- an immutable release channel and published installation instructions.

Until those gates pass, this repository is a source and preview-generation
system—not a supported installation endpoint.
