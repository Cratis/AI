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

## Where a profile lives

Every profile is **one file**. Reviewing a profile means opening that file, not
finding it inside a seven-hundred-line array.

```text
profiles/
├── manifest.json                    the shared shell: schema version, state, owning
│                                    repositories, versioning, authority,
│                                    confidentiality, subscription, contribution flow
├── public/                          audience "public"
│   ├── public-fundamentals.json
│   ├── …
│   ├── cratis.json                  id: cratis — the bare id, a file, not a folder
│   └── cratis/                      an id containing "/" is a real subdirectory
│       ├── arc.json                 id: cratis/arc
│       ├── chronicle.json
│       ├── application.json
│       └── full.json
└── cratis-engineering/              audience "cratis-engineering"
    ├── engineering-base.json
    └── …
```

The two audience directory names are the resolver's own vocabulary:
`indexProfiles` in `tooling/resolve-profiles.mjs` assigns `public` to everything
in `profiles/public/` and `cratis-engineering` to everything in
`profiles/cratis-engineering/`. A profile's id is exactly its path under its
audience directory with `.json` removed, and the generator refuses a file whose
declared `id` disagrees, so no two files can claim the same profile.

Each file carries the whole profile object, `id` included, so it stands alone and
stays valid JSON on its own.

### `distribution/profile-catalog.json` is generated

`distribution/profile-catalog.json` is the **aggregate**, produced by
`tooling/generate-profile-catalog.mjs` from `profiles/manifest.json` plus every
profile file, with each audience array ordinally sorted by id. It stays committed
because every consumer — the resolver, the human catalog, the release planner,
the subscription validator — reads a real file on disk.

It is never hand-edited. Change a profile in its own file and regenerate:

```bash
node tooling/generate-profile-catalog.mjs
```

CI runs the generator and then `git diff --exit-code` over the aggregate, so an
edit made in the wrong place fails rather than surviving. The repository
inventory records the aggregate as `generated-profile-catalog` with
`generatedStatus: "generated"`, and the profile sources as
`authored-profile-sources`.

## What the words on this page mean

This page uses the evidence vocabulary from
[capability catalog v2](./capability-catalog-v2.md#normalized-evidence). Keep the
five states apart:

| State | Means |
| --- | --- |
| **Authored** | A human wrote it here and it was reviewed — `profiles/`, `mcp/`, every skill source |
| **Generated** | A generator produced it deterministically from authored input — `distribution/profile-catalog.json`, the human catalog, a resolved manifest, a release tree |
| **Evaluated** | An evaluation ran against it and produced evidence — no profile has passing behavior, trigger, and collision evidence yet |
| **Supported** | A support claim exists, backed by active install-or-higher evidence — **no profile is supported** |
| **Unavailable** | There is no such capability, and saying otherwise would be a fabrication — every `content-gap` and `authority-gap` profile below |

Every profile in this reference is authored. None is supported. A profile listed
here is not an installation claim.

## Resolving a profile

`tooling/resolve-profiles.mjs` is the single resolver. The human catalog, the
approved-release planner, and anything else that needs to know what a profile
contains all call it, so the catalog and the packaged release can no longer
disagree — the divergence
[Cratis/AI#254](https://github.com/Cratis/AI/issues/254) recorded, where the
release path read only `availableTargets` and dropped everything reached through
`composes`.

Run it directly to inspect a resolution:

```bash
node tooling/resolve-profiles.mjs cratis/chronicle
```

### What the resolved manifest returns, and why

The manifest is **generated**, deterministic, and explainable. Every field
answers a question a reviewer would otherwise have to answer by hand.

| Field | Answers |
| --- | --- |
| `requested` | What was asked for, deduplicated and ordinally sorted, so two callers asking for the same set get byte-identical output |
| `audience` | Which channel the whole resolution belongs to; a request that mixes audiences is rejected rather than silently split |
| `profiles` | The full transitive closure. Each entry carries `version`, `state`, `depth`, `requestedDirectly`, its own `composes`, and `includedBy` |
| `profiles[].includedBy` | **Why this profile is here** — every profile in the closure that directly composes it. Empty means it was requested directly |
| `versions` | The version stamp of every profile in the closure, so a release records exactly what it resolved |
| `skills` | Every included capability, each annotated with `includedBy` — the profiles that contribute it |
| `mcpServers` | Every included MCP server, in the same shape as skills, plus transport, authentication type, and the passive-versus-executable classification. See [MCP declarations in profiles](./mcp-declarations.md) |
| `rejected` | **Why something is not here.** Each entry names its `kind`, `id`, the profile that asked (`requiredBy`), and a `reason` string |

A profile that contributes no capability of its own appears in `rejected` as a
`profile-capability-set` entry naming its state, so an empty package is visible
rather than surprising.

### What the resolver refuses

These are failures, not exclusions. The resolver throws a
`ProfileResolutionError` carrying a coded, named reason for each:

| Cause | Reported as |
| --- | --- |
| A composition cycle | `COMPOSITION_CYCLE`, with the exact path — `a -> b -> a` |
| A composed profile that does not exist | `UNKNOWN_PROFILE`, naming the missing id and the profile that required it |
| A requested profile that does not exist | `UNKNOWN_PROFILE`, naming the request |
| A composition or a request that crosses the public and engineering audiences | `AUDIENCE_MISMATCH` |
| A combination the catalog declares mutually exclusive | `INCOMPATIBLE_COMBINATION`, with the declared reason |

The compatibility check is a hook point. The catalog declares no incompatible
combinations today, and none are invented: adding a
`compatibility.mutuallyExclusive` array to `profiles/manifest.json` is all that
is needed to start rejecting one.

Cycle detection is aligned with `graphHasCycle` from
`tooling/catalog-v2-validation.mjs`, which the resolver also runs over the whole
composition graph as a second, independent gate.

## Profile versions

Every profile carries an exact SemVer `version`. The release train stays
**atomic** — `versioning.releaseTrain` is unchanged and
`releaseOnMerge.maxProfilesPerRelease` is still `1` — and each profile now also
carries its own version stamp, which is the decision #264 asked to be recorded.

`0.0.0` means no release has been cut from that catalog entry. It is not a
published version. The exact published version is supplied by the merged release
request, and floating versions such as `latest` remain forbidden everywhere.

## Public product profiles

| Profile | Intended package | Current state |
| --- | --- | --- |
| `public-fundamentals` | `@cratis/ai-fundamentals` | First preview source candidate |
| `public-arc` | `@cratis/ai-arc` | Legacy source migration planned |
| `public-arc-ef-core` | `@cratis/ai-arc-ef-core` | EF Core migration source requires canonical Arc persistence authority |
| `public-arc-react` | `@cratis/ai-arc-react` | Preview source candidate; composes `public-arc` |
| `public-components` | `@cratis/ai-components` | Preview source candidate |
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

Each one below is deliberately **scoped**. If you want everything instead, that
is [`cratis`](#cratis--the-maximal-public-bundle) — the bare id, described in
the next section.

| Profile | Intended package | Composition | Chronicle implied | Arc implied |
| --- | --- | --- | --- | --- |
| `cratis/arc` | `@cratis/ai-meta-arc` | `public-application-arc-only` + `public-arc-ef-core` + `public-arc-identity` | No | Yes |
| `cratis/chronicle` | `@cratis/ai-meta-chronicle` | `public-application-chronicle-dotnet` + `public-chronicle-compliance` + `public-chronicle-multi-tenancy` + `public-chronicle-web-workbench` | Yes | No |
| `cratis/application` | `@cratis/ai-meta-application` | `public-application` | Yes | Yes |
| `cratis/full` | `@cratis/ai-meta-full` | `cratis/application` + `cratis/arc` + `cratis/chronicle` + `public-modeling-screenplay-stage` | Yes | Yes |

`cratis/full` is a diamond over the other three: every profile it reaches
transitively appears exactly once in a resolved manifest, annotated with each
meta-profile that pulled it in.

## `cratis` — the maximal public bundle

| Profile | Intended package | Composition | Chronicle implied | Arc implied |
| --- | --- | --- | --- | --- |
| `cratis` | `@cratis/ai-meta-cratis` | Every other public profile, listed one by one | Yes | Yes |

`cratis` is the one **bare** id in the catalog — not `cratis/something`. It is
the root of the namespace and it means what it says: requesting it resolves to
**every** public capability this repository offers, with no product and no
language excluded.

It exists because "full" was never full. The [namespaced
meta-profiles](#namespaced-meta-profiles) above are scoped compositions, and
`cratis/full` composes only the other three plus the Screenplay-to-Stage
handoff — which reaches 24 of the 42 public profiles and misses the other 18
entirely, including all four language profiles, Lens, the CLI, Studio, and
Chronicle MCP. Those are real public capabilities with no meta-profile that
reaches them, so a repository wanting everything had no single name to ask for.

**Its `composes` array lists every public profile id directly**, including the
four `cratis/*` meta-profiles and every leaf they already reach. The redundancy
is deliberate. `tooling/resolve-profiles.mjs` deduplicates the closure and
detects cycles, so a profile reached three ways still appears exactly once in a
resolved manifest — and a flat, exhaustive list is far easier to keep correct
than a hand-minimized one where "already covered transitively" is a claim
nobody re-checks.

`products` and `languages` follow the same convention as `cratis/full`: real
taxonomy ids rather than an empty "applies everywhere" marker. Because this
profile composes the whole catalog, they are the full union — all thirteen
products and all nine languages.

`cratis` composes **no** `engineering-*` profile, and it never will. The
resolver rejects audience-crossing composition outright, so a public request
cannot reach maintainer-audience content by any route; the guarantee is
structural, not editorial.

### The completeness guarantee is enforced, not promised

`tooling/specs/cratis-meta-profile-completeness.spec.mjs` reads
`profiles/public/` recursively **at spec-run time** and asserts that resolving
`cratis` yields exactly that id set. There is no hardcoded list to go stale.
Add a public profile and forget to add it to `cratis.json`, and the spec fails
naming the exact missing id:

```text
profiles/public/cratis.json is not the maximal public bundle:
add these ids to its "composes" array:
  public-brand-new-thing
```

The same file also asserts that `cratis` stays a strict superset of all four
narrower meta-profiles, that its closure reaches every `availableTargets`
capability any public profile declares, and that everything the resolver
rejects is an honestly empty profile rather than an unreachable capability.

Subscribing is the same as any other profile, and the channel is derived rather
than declared:

```json
{
  "profiles": ["cratis"]
}
```

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

## Cross-cutting methodology profiles

Some behavior is neither a product nor a language. It is engineering method that
holds no matter what the repository ships or what it is written in.

| Profile | Intended package | Scope |
| --- | --- | --- |
| `public-methodology-governed-releases` | `@cratis/ai-methodology-governed-releases` | Assurance tiers, evidence ladders, lifecycle phases, supply-chain receipts, semantic-version release intent, canaries, recovery disposition |

This profile carries `products: []` and `languages: []` deliberately, and
composes nothing, for the same reason the language profiles do: a repository
that wants release methodology must not be handed Arc, Chronicle, or a language
profile along with it. `tooling/specs/resolve-profiles.spec.mjs` asserts that
resolving it alone returns exactly itself and its one capability.

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

## MCP servers a profile requires

A profile may name MCP servers in `mcpServers`. Each name must resolve to an
authored declaration under [`mcp/`](../mcp/README.md), and the resolver includes
it in the manifest with the same `includedBy` annotation skills get.

| Profile | Requires | Why |
| --- | --- | --- |
| `public-chronicle-mcp` | `cratis-chronicle-mcp` | The profile that already carries the Chronicle MCP passive inspection guidance |
| `cratis/chronicle` | `cratis-chronicle-mcp` | Chronicle MCP inspects a running Chronicle store |

No Arc profile requires it. Doing so would reintroduce exactly the
Arc-implies-Chronicle coupling the meta-profiles exist to avoid.

**Studio MCP is an extension point only. It is not published and it is not
shipped.** `mcp/cratis-studio-mcp.json` is `extension-point-not-published` and
`resolvable: false`; the resolver refuses to place it in any manifest whatever a
profile asks for, and the validator refuses to let a profile require it. Both are
asserted in `tooling/specs/mcp-declarations.spec.mjs`. Read
[MCP declarations in profiles](./mcp-declarations.md) for the full model.

## Subscribing

A consuming repository selects profiles in project-owned `.cratis/ai.json`. The
`cratis/` namespace derives its channel instead of declaring one:

```json
{
  "schemaVersion": "1.0.0",
  "version": "1.0.0",
  "profiles": ["cratis/chronicle"],
  "harnesses": ["claude", "codex", "copilot", "pi"],
  "updatePolicy": "reviewed-pull-request",
  "projectContext": ".cratis/PROJECT.md"
}
```

The `public-` and `engineering-` namespaces still declare `channel`, and a
declared channel that contradicts the namespace is rejected. Exact versions and
`updatePolicy: reviewed-pull-request` are mandatory in every namespace.

Worked examples live under
[`Documentation/examples/ai-subscriptions/`](./examples/ai-subscriptions).
The commands and versions in them are illustrative until a package is published.
