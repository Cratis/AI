# Cratis AI profile reference

Profiles are generated views over approved capabilities. They do not create a
second authored copy of a skill. Every package listed here remains planned until
its profile and targets are explicitly approved.

Every profile id lives in the `cratis/` namespace. `cratis` is the one bare id —
the maximal public bundle — and everything else is namespaced under it:
`cratis/chronicle`, `cratis/chronicle/kotlin`, `cratis/language/csharp`,
`cratis/engineering`. The namespace does not indicate repository or package
confidentiality; it is the one consumer-facing naming scheme. The only
engineering profile is `cratis/engineering`, and it carries general Cratis
maintainer guidance only — product-specific contributor guidance lives in the
owning product repository.

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
│   ├── cratis.json                  id: cratis — the bare id, a file, not a folder
│   └── cratis/                      an id containing "/" is a real subdirectory
│       ├── fundamentals.json        id: cratis/fundamentals
│       ├── fundamentals/
│       │   └── type-discovery.json  id: cratis/fundamentals/type-discovery
│       ├── arc.json                 id: cratis/arc
│       ├── arc/
│       │   ├── core.json            id: cratis/arc/core — the Arc capability base
│       │   ├── csharp.json          id: cratis/arc/csharp — a language-scoped cell
│       │   └── kotlin.json
│       ├── chronicle.json           id: cratis/chronicle
│       ├── chronicle/…
│       ├── application.json
│       ├── application/…
│       ├── full.json
│       └── full/…
└── cratis-engineering/              audience "cratis-engineering"
    └── cratis/
        └── engineering.json         id: cratis/engineering — the single profile
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
| `cratis/fundamentals` | `@cratis/ai-fundamentals` | First preview source candidate |
| `cratis/arc/core` | `@cratis/ai-arc` | Preview source candidate; the Arc capability base |
| `cratis/arc/client-kotlin` | `@cratis/ai-arc-client-kotlin` | Content gap; anchored to [Cratis Arc.Kotlin](https://github.com/cratis/arc.kotlin) until guidance is verified |
| `cratis/arc/ef-core` | `@cratis/ai-arc-ef-core` | EF Core migration source requires canonical Arc persistence authority |
| `cratis/arc/react` | `@cratis/ai-arc-react` | Preview source candidate; composes `cratis/arc/core` |
| `cratis/components` | `@cratis/ai-components` | Preview source candidate |
| `cratis/chronicle/core` | `@cratis/ai-chronicle` | Preview source candidate; the Chronicle capability base |
| `cratis/cli` | `@cratis/ai-cli` | Content gap |
| `cratis/cli/terminal-workbench` | `@cratis/ai-cli-workbench` | Terminal Workbench content gap |
| `cratis/chronicle/web-workbench` | `@cratis/ai-chronicle-web-workbench` | Browser Workbench content gap |
| `cratis/lens` | `@cratis/ai-lens` | Content gap |
| `cratis/screenplay` | `@cratis/ai-screenplay` | Content gap |
| `cratis/stage` | `@cratis/ai-stage` | Content gap |
| `cratis/studio` | `@cratis/ai-studio` | Classification-only public-safe MCP source candidate; no implementation operation admitted |
| `cratis/chronicle/mcp` | `@cratis/ai-chronicle-mcp` | Classification-only passive source candidate; no tool or prompt admitted, executable server remains product-owned |

`cratis/arc/core` and `cratis/chronicle/core` carry the language-agnostic
capability base of their product. The unscoped `cratis/arc` and
`cratis/chronicle` compositions include them through the overlays and
language-scoped cells that compose them.

## Chronicle client profiles

| Profile | Intended package | Authority state |
| --- | --- | --- |
| `cratis/chronicle/client-dotnet` | `@cratis/ai-chronicle-dotnet` | Content gap |
| `cratis/chronicle/client-kotlin` | `@cratis/ai-chronicle-kotlin` | Chronicle.Kotlin authority required |
| `cratis/chronicle/client-elixir` | `@cratis/ai-chronicle-elixir` | Chronicle.Elixir authority required |
| `cratis/chronicle/client-typescript` | `@cratis/ai-chronicle-typescript` | Chronicle.TypeScript authority required |
| `cratis/chronicle/client-python` | `@cratis/ai-chronicle-python` | Chronicle.Python authority required |
| `cratis/chronicle/client-java` | `@cratis/ai-chronicle-java` | Authority gap; no verified Java client |

Do not translate .NET guidance into another language and call it client support.
Each client profile requires language-native API, toolchain, error, lifecycle,
and host evidence from its owning repository.

## Identity, compliance, and tenancy overlays

| Profile | Intended package | Scope |
| --- | --- | --- |
| `cratis/arc/identity` | `@cratis/ai-arc-identity` | Authentication providers, authorization, claims, frontend identity |
| `cratis/chronicle/compliance` | `@cratis/ai-chronicle-compliance` | Subjects, keys, erasure, retention, privacy, audit |
| `cratis/chronicle/multi-tenancy` | `@cratis/ai-chronicle-multi-tenancy` | Chronicle namespace isolation and tenant resolution |
| `cratis/fundamentals/type-discovery` | `@cratis/ai-fundamentals-type-discovery` | `IInstancesOf<T>` implementation discovery and the DI lifetime conventions |

These remain separate because identity has different meanings across Arc,
Chronicle compliance, event-source identities, and product-specific roles.

`cratis/fundamentals/type-discovery` is separate for a different reason:
`cratis/fundamentals` is the selected passive-preview package, and the preview
authority pins it to exactly one target. A second skill added there would change
what the already-requested preview publishes.

## Documentation profile

| Profile | Intended package | Scope |
| --- | --- | --- |
| `cratis/documentation` | `@cratis/ai-documentation` | Diátaxis documentation-writing guidance: classify a page as tutorial, how-to, reference, or explanation, then draft it in that style |

Like the language profiles, it composes nothing and implies no product: a
repository bundles `cratis/documentation` next to whichever product or language
profiles it already uses when it wants documentation-writing guidance for its
own docs. The internal Cratis multi-repository docs workflow (placement,
navigation wiring, rendering) stays with `cratis/engineering`.

## Review profiles

| Profile | Intended package | Scope |
| --- | --- | --- |
| `cratis/review` | `@cratis/ai-review` | General, performance, and security review criteria for a Cratis application |

It composes nothing on purpose. A reviewer reads code they did not write, and
selecting review criteria must not imply installing Arc, Chronicle, or
Components guidance.

## Specification by Example profiles

| Profile | Intended package | Scope |
| --- | --- | --- |
| `cratis/specifications` | `@cratis/ai-specifications` | Language-agnostic philosophy, contexts, naming, observability |
| `cratis/specifications/dotnet` | `@cratis/ai-specifications-dotnet` | Cratis.Specifications, C#, NSubstitute, scenario families |
| `cratis/specifications/typescript` | `@cratis/ai-specifications-typescript` | TypeScript/React, Vitest, Chai, Sinon, view models |

Language-specific profiles compose the shared philosophy rather than restating
it independently.

## Public composition profiles

| Profile | Intended package | Composition |
| --- | --- | --- |
| `cratis/application/arc-only` | `@cratis/ai-application-arc` | Fundamentals + Arc + .NET specifications; no Chronicle assumptions |
| `cratis/application/chronicle-dotnet` | `@cratis/ai-application-chronicle-dotnet` | Fundamentals + Chronicle + .NET client/specifications; no Arc assumptions |
| `cratis/application/arc-chronicle` | `@cratis/ai-application-arc-chronicle` | Fundamentals + Arc + Chronicle backend |
| `cratis/application/react` | `@cratis/ai-application-react` | Fundamentals + Arc + Arc React + Components + specifications |
| `cratis/modeling/screenplay-stage` | `@cratis/ai-modeling-screenplay-stage` | Screenplay authoring through Stage runtime/specification handoff |

Composition packages contain generated views of approved component skills, not
separately authored copies.

## Namespaced meta-profiles

Meta-profiles are the stable names a consuming repository subscribes to. They
compose the profiles above and add no capability of their own, so the
Arc-versus-Chronicle decoupling below is a property of the composition, not an
editorial promise.

The namespace carries **two dimensions**: product and language.

- `cratis/<product>` — everything for one product (`arc`, `chronicle`,
  `application`, `full`), across every language it supports.
- `cratis/<product>/<language>` — a **language-scoped cell**: that product, in
  that language. The language means the language you write that side of the
  stack in.

Language support today:

- **Arc** supports **C#** and **Kotlin** ([Arc.Kotlin](https://github.com/cratis/arc.kotlin)).
  There is deliberately no `cratis/arc/typescript` or `cratis/arc/elixir` cell yet.
- **Chronicle** has clients in **C#** (.NET), **Kotlin**, **Elixir**, and
  **TypeScript**. Java consumers are served through the Kotlin client's JVM
  interoperability, so there is no separate `java` cell; Python has no client
  yet, so there is no `python` cell either.
- **`application` and `full`** mean the same in every language. For languages
  Arc does not support yet (TypeScript, Elixir), the Arc side is removed for
  now and the cell carries the Chronicle-only application journey. The cells
  become Arc-including when Arc supports those languages.

| Unscoped product meta | Intended package | Composition | Chronicle implied | Arc implied |
| --- | --- | --- | --- | --- |
| `cratis/arc` | `@cratis/ai-meta-arc` | `cratis/arc/csharp` + `cratis/arc/kotlin` | No | Yes |
| `cratis/chronicle` | `@cratis/ai-meta-chronicle` | the four `cratis/chronicle/<language>` cells + `cratis/chronicle/compliance` + `cratis/chronicle/multi-tenancy` + `cratis/chronicle/web-workbench` (+ the `cratis-chronicle-mcp` server) | Yes | No |
| `cratis/application` | `@cratis/ai-application` | the four `cratis/application/<language>` cells plus the application component profiles (Fundamentals, Arc, Arc React, Chronicle, Components, Specifications) | Yes | Yes |
| `cratis/full` | `@cratis/ai-meta-full` | the four `cratis/full/<language>` cells | Yes | Yes |

`cratis/application` is the merged application composition: the component
profiles and the language cells in one profile. The C# cell reaches the
components directly rather than composing `cratis/application`, which keeps the
composition graph acyclic while preserving the same closure.

### Language-scoped cells

| Cell | Intended package | Composition |
| --- | --- | --- |
| `cratis/arc/csharp` | `@cratis/ai-meta-arc-csharp` | `cratis/application/arc-only` + `cratis/arc/ef-core` + `cratis/arc/identity` + `cratis/language/csharp` |
| `cratis/arc/kotlin` | `@cratis/ai-meta-arc-kotlin` | `cratis/arc/client-kotlin` + `cratis/language/kotlin` (empty until Arc.Kotlin guidance is verified) |
| `cratis/chronicle/csharp` | `@cratis/ai-meta-chronicle-csharp` | `cratis/application/chronicle-dotnet` + `cratis/chronicle/compliance` + `cratis/chronicle/multi-tenancy` + `cratis/language/csharp` |
| `cratis/chronicle/kotlin` | `@cratis/ai-meta-chronicle-kotlin` | `cratis/chronicle/client-kotlin` + `cratis/language/kotlin` |
| `cratis/chronicle/elixir` | `@cratis/ai-meta-chronicle-elixir` | `cratis/chronicle/client-elixir` + `cratis/language/elixir` (resolves empty until client authority approves) |
| `cratis/chronicle/typescript` | `@cratis/ai-meta-chronicle-typescript` | `cratis/chronicle/client-typescript` + `cratis/language/typescript` (resolves empty until client authority approves) |
| `cratis/application/csharp` | `@cratis/ai-meta-application-csharp` | the application component profiles + `cratis/language/csharp` |
| `cratis/application/kotlin` | `@cratis/ai-meta-application-kotlin` | `cratis/arc/client-kotlin` + `cratis/chronicle/client-kotlin` + `cratis/language/kotlin` |
| `cratis/application/typescript` | `@cratis/ai-meta-application-typescript` | `cratis/chronicle/client-typescript` + `cratis/language/typescript` + `cratis/specifications/typescript` (Arc removed for now) |
| `cratis/application/elixir` | `@cratis/ai-meta-application-elixir` | `cratis/chronicle/client-elixir` + `cratis/language/elixir` (Arc removed for now) |
| `cratis/full/csharp` | `@cratis/ai-meta-full-csharp` | `cratis/application/csharp` + `cratis/arc/csharp` + `cratis/chronicle/csharp` + `cratis/modeling/screenplay-stage` |
| `cratis/full/kotlin` | `@cratis/ai-meta-full-kotlin` | `cratis/application/kotlin` + `cratis/arc/kotlin` + `cratis/chronicle/kotlin` + `cratis/modeling/screenplay-stage` |
| `cratis/full/typescript` | `@cratis/ai-meta-full-typescript` | `cratis/application/typescript` + `cratis/chronicle/typescript` + `cratis/modeling/screenplay-stage` (no `cratis/arc/typescript` exists) |
| `cratis/full/elixir` | `@cratis/ai-meta-full-elixir` | `cratis/application/elixir` + `cratis/chronicle/elixir` + `cratis/modeling/screenplay-stage` (no `cratis/arc/elixir` exists) |

Two honesty rules hold across the matrix. A cell whose product has no real
surface in that language either does not exist (`cratis/arc/typescript`) or
resolves to an honestly empty package (`cratis/arc/kotlin` before its guidance
lands) — the resolver reports every such empty as a visible
`profile-capability-set` rejection, never as silent absence. And the
language-agnostic Chronicle tools — compliance, multi-tenancy, the web
workbench, and the Chronicle MCP server — stay on the unscoped
`cratis/chronicle` rather than being duplicated into every cell.

`cratis/full` is a diamond over the other three products: every profile it
reaches transitively appears exactly once in a resolved manifest, annotated with
each meta-profile that pulled it in.

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
even `cratis/full` — which composes one language-scoped cell per supported
language — reaches 44 of the 58 public profiles and misses the other 14,
among them Studio, Lens, the CLI and its workbench, review, the governed-release
methodology, and the Java and Python Chronicle clients. Those are real public
capabilities with no meta-profile that reaches them, so a repository wanting
everything had no single name to ask for.

**Its `composes` array lists every public profile id directly**, including every
`cratis/*` meta-profile, every language-scoped cell, and every leaf they already
reach. The redundancy is deliberate. `tooling/resolve-profiles.mjs` deduplicates
the closure and detects cycles, so a profile reached three ways still appears
exactly once in a resolved manifest — and a flat, exhaustive list is far easier
to keep correct than a hand-minimized one where "already covered transitively"
is a claim nobody re-checks.

`products` and `languages` follow the same convention as `cratis/full`: real
taxonomy ids rather than an empty "applies everywhere" marker. Because this
profile composes the whole catalog, they are the full union — all thirteen
products and all nine languages.

`cratis` composes **no** engineering profile, and it never will. The resolver
rejects audience-crossing composition outright, so a public request cannot reach
maintainer-audience content by any route; the guarantee is structural, not
editorial.

### The completeness guarantee is enforced, not promised

`tooling/specs/cratis-meta-profile-completeness.spec.mjs` reads
`profiles/public/` recursively **at spec-run time** and asserts that resolving
`cratis` yields exactly that id set. There is no hardcoded list to go stale.
Add a public profile and forget to add it to `cratis.json`, and the spec fails
naming the exact missing id:

```text
profiles/public/cratis.json is not the maximal public bundle:
add these ids to its "composes" array:
  cratis/brand-new-thing
```

The same file also asserts that `cratis` stays a strict superset of every other
meta-profile, that its closure reaches every `availableTargets` capability any
public profile declares, and that everything the resolver rejects is an honestly
empty profile rather than an unreachable capability.

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
| `cratis/language/csharp` | `@cratis/ai-language-csharp` | C# |
| `cratis/language/typescript` | `@cratis/ai-language-typescript` | TypeScript |
| `cratis/language/kotlin` | `@cratis/ai-language-kotlin` | Kotlin |
| `cratis/language/elixir` | `@cratis/ai-language-elixir` | Elixir |

These are the **composition mechanism only**. Their content — and honesty about
languages with no verified client — stays owned by
[Cratis/AI#178](https://github.com/Cratis/AI/issues/178), so each entry is
currently `content-gap` and carries no capability.

They deliberately compose no product profile. Wiring
`cratis/language/kotlin` to `cratis/chronicle/client-kotlin` would make a
language selection imply Chronicle, which is the same coupling the Arc and
Chronicle meta-profiles exist to avoid. Chronicle-specific language guidance
stays in the Chronicle client profiles above.

## Cross-cutting methodology profiles

Some behavior is neither a product nor a language. It is engineering method that
holds no matter what the repository ships or what it is written in.

| Profile | Intended package | Scope |
| --- | --- | --- |
| `cratis/methodology/governed-releases` | `@cratis/ai-methodology-governed-releases` | Assurance tiers, evidence ladders, lifecycle phases, supply-chain receipts, semantic-version release intent, canaries, recovery disposition |

This profile carries `products: []` and `languages: []` deliberately, and
composes nothing, for the same reason the language profiles do: a repository
that wants release methodology must not be handed Arc, Chronicle, or a language
profile along with it. `tooling/specs/resolve-profiles.spec.mjs` asserts that
resolving it alone returns exactly itself and its one capability.

## `cratis/engineering` — the engineering profiles, split by language

All shared engineering packages are public-safe. Confidential facts remain in
repository-local overlays. The whole `cratis/engineering` subtree derives the
engineering channel; it never mixes with public profiles in one subscription.

| Profile | Intended package | Carries |
| --- | --- | --- |
| `cratis/engineering/core` | `@cratis/ai-engineering-core` | The language-agnostic procedures: decision records, effect boundaries, documentation authoring |
| `cratis/engineering/csharp` | `@cratis/ai-engineering-csharp` | The C# house conventions, plus the core |
| `cratis/engineering/typescript` | `@cratis/ai-engineering-typescript` | Reserved: TypeScript conventions, plus the core (content gap until authored) |
| `cratis/engineering/kotlin` | `@cratis/ai-engineering-kotlin` | Reserved: Kotlin conventions, plus the core (content gap until authored) |
| `cratis/engineering/elixir` | `@cratis/ai-engineering-elixir` | Reserved: Elixir conventions, plus the core (content gap until authored) |
| `cratis/engineering/react` | `@cratis/ai-engineering-react` | Reserved: React conventions, plus the core (content gap until authored) |
| `cratis/engineering` | `@cratis/ai-engineering` | The umbrella: the core plus every language cell |

A repository that writes one language subscribes to its **cell** —
`cratis/engineering/csharp` for a C# repository — and loads the conventions for
the language it actually writes rather than every language at once. The
umbrella exists as the one obvious everything-selection for tooling and for
repositories that genuinely span languages, not as the default. Every cell
composes the core, so the decision-record, effect-boundary, and
documentation-authoring procedures come along regardless.

The engineering subtree deliberately carries **no product-specific contributor
guidance**. Guidance that only makes sense inside one product repository — for
example the Chronicle kernel tracing procedure built on the `Cratis.Traces`
`[Span]` source generator — lives in the owning product repository as
repository-local skills under its own `.agents/skills/`, maintained and
reviewed by that repository's owners. The shared profiles stay general; the
product repositories own their depth.

Studio and Stagehand private architecture, deployment, roadmap, infrastructure,
support, and incident workflows likewise stay local to their private
repositories.

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
| `cratis/chronicle/mcp` | `cratis-chronicle-mcp` | The profile that already carries the Chronicle MCP passive inspection guidance |
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

A consuming repository selects profiles in project-owned `.cratis/ai.json`. Every
profile derives its channel from the namespace: `cratis/engineering` derives the
`cratis-engineering` channel, everything else under `cratis` derives `public`,
and a declared channel that contradicts the derived one is rejected. A
language-scoped cell subscribes exactly like any other profile:

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

A Kotlin Chronicle client repository scopes that down to one language:

```json
{
  "schemaVersion": "1.0.0",
  "version": "1.0.0",
  "profiles": ["cratis/chronicle/kotlin"],
  "harnesses": ["claude", "codex", "copilot", "pi"],
  "updatePolicy": "reviewed-pull-request",
  "projectContext": ".cratis/PROJECT.md"
}
```

Exact versions and `updatePolicy: reviewed-pull-request` are mandatory.

Worked examples live under
[`Documentation/examples/ai-subscriptions/`](./examples/ai-subscriptions/README.md).
The commands and versions in them are illustrative until a package is published.
