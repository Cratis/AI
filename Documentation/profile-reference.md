# Cratis AI profile reference

Profiles are generated views over approved capabilities. They do not create a
second authored copy of a skill. Every package listed here remains planned until
its profile and targets are explicitly approved.

The `public-` and `engineering-` prefixes identify the subscription channel and
audience. They do not indicate repository or package confidentiality. The
`cratis/` namespace added by [Cratis/AI#264](https://github.com/Cratis/AI/issues/264)
is a third, channel-free namespace: a `cratis/*` selection derives the public
channel instead of declaring it.

For a generated view with plain-language package descriptions, included skills,
availability, trust, and evidence, browse the
[package and capability catalog](../catalog/generated/human-catalog/CATALOG.md).

## Public product profiles

| Profile | Intended package | Current state |
| --- | --- | --- |
| `public-fundamentals` | `@cratis/ai-fundamentals` | First preview source candidate |
| `public-arc` | `@cratis/ai-arc` | Legacy source migration planned |
| `public-arc-ef-core` | `@cratis/ai-arc-ef-core` | EF Core migration source requires canonical Arc persistence authority |
| `public-arc-react` | `@cratis/ai-arc-react` | Legacy source migration planned |
| `public-components` | `@cratis/ai-components` | Partial legacy sources; content gaps |
| `public-chronicle` | `@cratis/ai-chronicle` | Legacy source migration planned |
| `public-cratis-cli` | `@cratis/ai-cli` | Content gap |
| `public-cratis-cli-terminal-workbench` | `@cratis/ai-cli-workbench` | Terminal Workbench content gap |
| `public-chronicle-web-workbench` | `@cratis/ai-chronicle-web-workbench` | Browser Workbench content gap |
| `public-lens` | `@cratis/ai-lens` | Content gap |
| `public-screenplay` | `@cratis/ai-screenplay` | Content gap |
| `public-stage` | `@cratis/ai-stage` | Content gap |
| `public-studio` | `@cratis/ai-studio` | Classification-only public-safe MCP source candidate; no implementation operation admitted |
| `public-chronicle-mcp` | `@cratis/ai-chronicle-mcp` | Classification-only passive source candidate; no tool or prompt admitted, executable server remains product-owned |

## Chronicle client profiles

| Profile | Intended package | Authority state |
| --- | --- | --- |
| `public-chronicle-client-dotnet` | `@cratis/ai-chronicle-dotnet` | Content gap |
| `public-chronicle-client-kotlin` | `@cratis/ai-chronicle-kotlin` | Chronicle.Kotlin authority required |
| `public-chronicle-client-elixir` | `@cratis/ai-chronicle-elixir` | Chronicle.Elixir authority required |
| `public-chronicle-client-typescript` | `@cratis/ai-chronicle-typescript` | Chronicle.TypeScript authority required |
| `public-chronicle-client-python` | `@cratis/ai-chronicle-python` | Chronicle.Python authority required |
| `public-chronicle-client-java` | `@cratis/ai-chronicle-java` | Authority gap; no verified Java client |

Do not translate .NET guidance into another language and call it client support.
Each client profile requires language-native API, toolchain, error, lifecycle,
and host evidence from its owning repository.

## Identity, compliance, and tenancy overlays

| Profile | Intended package | Scope |
| --- | --- | --- |
| `public-arc-identity` | `@cratis/ai-arc-identity` | Authentication providers, authorization, claims, frontend identity |
| `public-chronicle-compliance` | `@cratis/ai-chronicle-compliance` | Subjects, keys, erasure, retention, privacy, audit |
| `public-chronicle-multi-tenancy` | `@cratis/ai-chronicle-multi-tenancy` | Chronicle namespace isolation and tenant resolution |

These remain separate because identity has different meanings across Arc,
Chronicle compliance, event-source identities, and product-specific roles.

## Specification by Example profiles

| Profile | Intended package | Scope |
| --- | --- | --- |
| `public-specifications` | `@cratis/ai-specifications` | Language-agnostic philosophy, contexts, naming, observability |
| `public-specifications-dotnet` | `@cratis/ai-specifications-dotnet` | Cratis.Specifications, C#, NSubstitute, scenario families |
| `public-specifications-typescript` | `@cratis/ai-specifications-typescript` | TypeScript/React, Vitest, Chai, Sinon, view models |

Language-specific profiles compose the shared philosophy rather than restating
it independently.

## Public composition profiles

| Profile | Intended package | Composition |
| --- | --- | --- |
| `public-application-arc-only` | `@cratis/ai-application-arc` | Fundamentals + Arc + .NET specifications; no Chronicle assumptions |
| `public-application-chronicle-dotnet` | `@cratis/ai-application-chronicle-dotnet` | Fundamentals + Chronicle + .NET client/specifications; no Arc assumptions |
| `public-application-arc-chronicle` | `@cratis/ai-application-arc-chronicle` | Fundamentals + Arc + Chronicle backend |
| `public-application-react` | `@cratis/ai-application-react` | Fundamentals + Arc + Arc React + Components + specifications |
| `public-application` | `@cratis/ai-application` | Full Arc + Chronicle + React + Components application |
| `public-modeling-screenplay-stage` | `@cratis/ai-modeling-screenplay-stage` | Screenplay authoring through Stage runtime/specification handoff |

Composition packages contain generated views of approved component skills, not
separately authored copies.

## Namespaced meta-profiles

Meta-profiles are the stable names a consuming repository subscribes to. They
compose the existing composition profiles and add no capability of their own, so
the Arc-versus-Chronicle decoupling below is a property of the composition, not
an editorial promise.

| Profile | Intended package | Composition | Chronicle implied | Arc implied |
| --- | --- | --- | --- | --- |
| `cratis/arc` | `@cratis/ai-meta-arc` | `public-application-arc-only` + `public-arc-ef-core` + `public-arc-identity` | No | Yes |
| `cratis/chronicle` | `@cratis/ai-meta-chronicle` | `public-application-chronicle-dotnet` + `public-chronicle-compliance` + `public-chronicle-multi-tenancy` + `public-chronicle-web-workbench` | Yes | No |
| `cratis/application` | `@cratis/ai-meta-application` | `public-application` | Yes | Yes |
| `cratis/full` | `@cratis/ai-meta-full` | `cratis/application` + `cratis/arc` + `cratis/chronicle` + `public-modeling-screenplay-stage` | Yes | Yes |

`cratis/full` is a diamond over the other three: every profile it reaches
transitively appears exactly once in a resolved manifest, annotated with each
meta-profile that pulled it in.

## Language profiles

Language selection used to exist only as a `languages` field on a product
profile. These entries make it a composable unit.

| Profile | Intended package | Language |
| --- | --- | --- |
| `public-language-csharp` | `@cratis/ai-language-csharp` | C# |
| `public-language-typescript` | `@cratis/ai-language-typescript` | TypeScript |
| `public-language-kotlin` | `@cratis/ai-language-kotlin` | Kotlin |
| `public-language-elixir` | `@cratis/ai-language-elixir` | Elixir |

These are the **composition mechanism only**. Their content — and honesty about
languages with no verified client — stays owned by
[Cratis/AI#178](https://github.com/Cratis/AI/issues/178), so each entry is
currently `content-gap` and carries no capability.

They deliberately compose no product profile. Wiring
`public-language-kotlin` to `public-chronicle-client-kotlin` would make a
language selection imply Chronicle, which is the same coupling the Arc and
Chronicle meta-profiles exist to avoid. Chronicle-specific language guidance
stays in the Chronicle client profiles above.

## Public-safe engineering profiles

All shared engineering packages are public-safe. Confidential facts remain in
repository-local overlays.

| Profile | Intended package |
| --- | --- |
| `engineering-base` | `@cratis/ai-engineering-base` |
| `engineering-application` | `@cratis/ai-engineering-application` |
| `engineering-fundamentals` | `@cratis/ai-engineering-fundamentals` |
| `engineering-arc` | `@cratis/ai-engineering-arc` |
| `engineering-arc-ef-core` | `@cratis/ai-engineering-arc-ef-core` |
| `engineering-arc-react` | `@cratis/ai-engineering-arc-react` |
| `engineering-components` | `@cratis/ai-engineering-components` |
| `engineering-chronicle` | `@cratis/ai-engineering-chronicle` |
| `engineering-chronicle-clients` | `@cratis/ai-engineering-chronicle-clients` |
| `engineering-cratis-cli` | `@cratis/ai-engineering-cli` |
| `engineering-lens` | `@cratis/ai-engineering-lens` |
| `engineering-screenplay` | `@cratis/ai-engineering-screenplay` |
| `engineering-stage` | `@cratis/ai-engineering-stage` |
| `engineering-studio` | `@cratis/ai-engineering-studio` |
| `engineering-stagehand` | `@cratis/ai-engineering-stagehand` |
| `engineering-chronicle-mcp` | `@cratis/ai-engineering-chronicle-mcp` |
| `engineering-specifications` | `@cratis/ai-engineering-specifications` |
| `engineering-documentation` | `@cratis/ai-engineering-documentation` |
| `engineering-ai` | `@cratis/ai-engineering-ai` |
| `engineering-workflows` | `@cratis/ai-engineering-workflows` |

Every engineering profile composes `engineering-base`. Studio and Stagehand
packages may contain only public-safe contribution behavior. Their private
architecture, deployment, roadmap, infrastructure, support, and incident
workflows stay local to their private repositories.

## Trust and publication

A planned profile is not an installation or support claim. Approval requires:

- named owner and reviewer;
- immutable product/source authority;
- exact skill revision and digest;
- public-safe content and licensing review;
- security, behavior, positive/negative trigger, collision, and portability
  evidence;
- profile and artifact runtime approval;
- real host and consumer lifecycle evidence.

Executable CLI, Lens, Studio MCP, and Chronicle MCP implementations remain owned
and distributed by their product repositories. Cratis AI packages only passive
selection, installation, safety, interpretation, and workflow guidance unless a
separate executable package is explicitly reviewed.
