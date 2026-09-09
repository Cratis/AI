# Cratis AI distribution and subscriptions

> **Audience:** Maintainers of Cratis/AI — the full distribution and subscription model. Adopters need the harness guide and scenarios, not this page.

Cratis AI has one controlled source for shared AI behavior, product-specific
profiles, immutable releases, and reviewed downstream updates. It does not use
folder propagation or automatic two-way synchronization.

For step-by-step adoption, use [developer adoption](./adopting-cratis-ai.md) or
[maintainer adoption](./adopting-cratis-ai-for-maintainers.md). Private
repositories layer [local overlays](./private-repository-overlays.md) on the
same public-safe shared packages.

> **Current availability:** the architecture and fixture generation exist, but
> no supported profile package has been published yet. The approval-driven
> materializer exists but fails closed while profiles, targets, source contracts,
> and release artifacts remain unapproved. Commands containing `1.0.0` below
> show the intended released workflow; do not run them until that version exists
> in the selected channel.

## Authority model

Four owners cooperate without duplicating authority:

| Concern | Owner | Examples |
| --- | --- | --- |
| Shared AI behavior | `Cratis/AI` `main` (authored) | Skill workflows, trigger intent, engineering conventions, profile composition, MCP declarations |
| Product facts | Owning product repository | Arc APIs, Chronicle semantics, Components examples, supported client versions |
| Project context | Consuming repository | Product mix, profile, credentials, endpoints, local constraints |
| Marketplace installation | `Cratis/AI` `main` (authored) | Four committed marketplace manifests resolving the `skills/` and `engineering/` directories |

> **[Cratis/AI#264](https://github.com/Cratis/AI/issues/264) — generated
> distribution is retired.** `Cratis/AI` is installed directly from its default
> branch. There is no second repository, no release branch, no `dist/vX.Y.Z` tag
> namespace, no staged generated tree, and no checksum or provenance file to
> maintain. A host adds `Cratis/AI` as a marketplace and installs a plugin whose
> `source` is an ordinary directory here, so what it installs is exactly what a
> reviewer reads. See the
> [maintainer marketplace deployment runbook](./maintainer-marketplace-deployment-runbook.md).
>
> `Cratis/AI.Distribution` receives no further releases and is archived. Its
> published `v0.1.0` through `v0.3.0` tags keep resolving, so the evidence
> records citing them stay valid; its tags are never deleted.

The four owners do not change. What went away is a delivery mechanism, not an
authority boundary: reviewing what `main` says a skill does is now the same act
as reviewing what a host installs.

`Cratis/AI` is the canonical source of shared AI behavior. A product repository
remains authoritative for its code and documentation; an AI skill cannot invent
or silently fork those facts. Release generation binds every imported product
fact to an immutable source revision.

A consuming repository never becomes a package publisher. It selects profiles,
pins a version, owns its project context, and receives reviewed update pull
requests.

> **Where this stands today:** the versioned flow described on this page —
> exact-version Pi packages, reviewed update pull requests, rollback by pin —
> is **designed and tool-verified but not published**. No versioned profile
> package exists yet (`profiles/manifest.json` still says
> `DESIGNED_RELEASES_NOT_YET_PUBLISHED`); the only published package is the
> unsupported `@cratis/ai-fundamentals` `0.x` evaluation. Until the first
> governed release, hosts install straight off the `Cratis/AI` default branch
> through the committed marketplace manifests. The Pi commands below show the
> designed post-release workflow, not something you can run for every profile
> today.

## Assurance lanes

Packaging and support use separate lanes so passive previews can iterate without
pretending to be supported:

| Lane | Mode | Purpose | Full S9/S10 required |
| --- | --- | --- | --- |
| Candidate review | Basic | Static review artifacts only | No |
| Passive preview | Basic | Reviewed passive prerelease with basic smoke checks | No |
| Governed support | Governed | Stable support, executable/MCP, broad automation | Yes |

The basic preview lane requires deterministic generation, static standards,
secret/path checks, schemas, checksums, explicit owner review, a basic exact-package
pack/install/discovery/uninstall smoke, and rollback. It can never claim
`supported`.

The governed system remains available but sidelined. S9 and S10 become mandatory
when Cratis promises stable support, introduces executable or MCP behavior,
automates broad rollout, or promotes a stable marketplace release. The advanced
evidence catalogs and readiness engine are audited manually and weekly rather
than gating ordinary candidate and passive-preview generation.

The authored policy is
[`distribution/assurance-lanes.json`](../distribution/assurance-lanes.json).
Generated [`preview-readiness.json`](../distribution/preview-readiness.json)
currently confirms that `cratis/fundamentals` is statically ready and lists only
the remaining basic owner-setup blockers. Governed readiness remains separately
`BLOCKED` and available for later graduation.

## Profiles instead of one universal corpus

Different repositories need different behavior. A Chronicle framework change
should not load application vertical-slice rules; a Components change should
not load Orleans guidance; Studio and Stagehand need their own product context.

Profiles are authored one file each under `profiles/`: the shared shell in
`profiles/manifest.json`, public profiles in `profiles/public/`, and
public-safe engineering profiles in `profiles/cratis-engineering/`. Together they
define separate public product, language-client, overlay, composition, and
engineering profiles.

[`distribution/profile-catalog.json`](../distribution/profile-catalog.json) is
the generated aggregate of those files, produced by
`tooling/generate-profile-catalog.mjs` and read by every consumer. Never edit it
by hand. See the complete [Profile reference](./profile-reference.md).

Public coverage includes Fundamentals, Arc, Arc React, Components, Chronicle,
Chronicle clients, identity, compliance, multi-tenancy, Cratis CLI, Lens,
Screenplay, Stage, public Studio, Chronicle MCP guidance, and Specifications.
Composition profiles preserve Arc-only, Chronicle-only, Arc + Chronicle, React,
full application, and Screenplay → Stage boundaries.

The engineering audience is one profile: `cratis/engineering`, the general
Cratis-maintainer conventions (C# house style, decision records, effect
boundaries, shared documentation authoring). It deliberately carries no
product-specific contributor guidance — that lives in the owning product
repository as repository-local skills (the Chronicle kernel-tracing procedure,
for example, lives in the Chronicle repository). The maintainer audience is
identified by the profile itself, never by confidentiality: everything shared
is public-safe, and private Studio, Stagehand, client, customer,
infrastructure, roadmap, incident, and repository facts remain in
repository-local overlays that shared packages may not read or write.

Namespaced `cratis/arc`, `cratis/chronicle`, `cratis/application`, and
`cratis/full` meta-profiles are the stable names to subscribe to. Each carries a
language dimension — `cratis/chronicle/kotlin`, `cratis/application/csharp` —
scoped to one language, with Arc support limited to C# and Kotlin and the Arc
side removed from the TypeScript and Elixir application cells until Arc supports
those languages. Composition is
resolved by one shared resolver, `tooling/resolve-profiles.mjs`, which returns a
deterministic manifest naming which profile pulled in every profile, skill, and
MCP server, and why anything was excluded. A profile may also require an MCP
server; **Studio MCP is an extension point only and is never included**. See
[the profile reference](./profile-reference.md) and
[MCP declarations in profiles](./mcp-declarations.md).

Everything in the profile catalog is **authored**. A resolved manifest and the
package catalog are **generated**. No profile is **evaluated** with passing
behavior evidence and none is **supported**; every `content-gap` and
`authority-gap` profile is **unavailable**. Those five words carry the meanings
[capability catalog v2](./capability-catalog-v2.md#normalized-evidence) gives
them, and this page never mixes them.

## Repository subscription

A Cratis repository records intent in project-owned `.cratis/ai.json`. The file
contains no shared rule text; it only selects a channel, exact release, profiles,
and harnesses.

Chronicle framework example:

```json
{
  "schemaVersion": "1.0.0",
  "channel": "cratis-engineering",
  "version": "1.0.0",
  "profiles": ["cratis/engineering"],
  "harnesses": ["claude", "codex", "copilot", "pi"],
  "updatePolicy": "reviewed-pull-request",
  "projectContext": ".cratis/PROJECT.md"
}
```

Full application example:

```json
{
  "schemaVersion": "1.0.0",
  "channel": "public",
  "version": "1.0.0",
  "profiles": ["cratis/application"],
  "harnesses": ["claude", "codex", "copilot", "pi"],
  "updatePolicy": "reviewed-pull-request",
  "projectContext": ".cratis/PROJECT.md"
}
```

The schema is
[`distribution/profile-subscription.schema.json`](../distribution/profile-subscription.schema.json).
Exact versions are mandatory. `latest`, branches, and floating ranges are not
valid subscriptions.

Cratis/Workflows#73 tracks the subscriber update controller after the Stagehand
proposal was closed as not planned. Its repository-scoped App will discover
committed `.cratis/ai.json` files only in repositories where it is explicitly
installed. A new release opens a normal
pull request changing the subscription and host-native lock or settings files.
It never merges automatically, pushes generated corpus folders, or receives
broad organization write access.

## Managed multi-tool installation

Native marketplaces remain the easiest path for an individual developer. For a
team that needs the same exact skills across several AI tools, Cratis evaluated
Microsoft Agent Package Manager (APM) 0.28.0 as an optional managed-team path.

The disposable public and engineering evaluations demonstrated:

- exact Git commit and content-hash locks;
- frozen installation on a second machine;
- deployment to shared Agent Skills and host-native locations;
- nonzero drift detection after an installed skill was modified;
- repair from the lock;
- update to a new revision and rollback to the previous revision;
- clean uninstall; and
- byte-for-byte preservation of `AGENTS.md`, `.cratis/PROJECT.md`, and an
  unrelated local skill.

This is promising, but it is not a supported Cratis installation path yet. APM
is pre-1.0, does not support Pi, writes package-managed copies into host skill
directories, and skipped organization-policy discovery in the disposable
fixtures because they had no Git remote. Managed adoption therefore waits for a
published package, a real application and framework collision/context canary,
and fail-closed organization policy.

Until those gates pass:

- `.cratis/ai.json` remains the Cratis profile and project-context intent;
- Pi keeps its exact npm/Git package settings;
- APM may not replace native marketplaces or the reviewed subscriber PR; and
- Workflows#73 should reuse APM resolution, lock, audit, and uninstall behavior
  if the real canary passes instead of rebuilding those features.

The bounded evidence and adoption gates are recorded in
[`distribution/apm-managed-install-evaluation.json`](../distribution/apm-managed-install-evaluation.json).

## Pi package workflow

Pi is a first-class host, not a copied adapter directory. Pi packages can load
skills from npm or Git and can be installed globally or into project settings.
See the official [Pi package reference](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/packages.md)
and package gallery at [pi.dev/packages](https://pi.dev/packages). Because Pi packages and
skills can execute or instruct powerful actions, Cratis public and base profile
packages remain passive and are reviewed before publication.

### Maintainer-wide defaults

A maintainer may install a passive base profile globally after release:

```bash
pi install npm:@cratis/ai-engineering@1.0.0
```

This writes the exact package source to `~/.pi/agent/settings.json`.

### Project-specific profile

A Chronicle repository pins its profile in project scope:

```bash
cd Chronicle
pi install -l npm:@cratis/ai-engineering@1.0.0
```

Pi writes `.pi/settings.json`. Commit that file after review. When another
maintainer trusts the repository, Pi installs the missing exact package.

Expected settings shape:

```json
{
  "packages": [
    "npm:@cratis/ai-engineering@1.0.0"
  ],
  "enableSkillCommands": true
}
```

Pi exposes package skills through normal automatic discovery and
`/skill:<name>` commands. Packages remain passive: they contain skills and
static references, not executable extensions.

A repository normally subscribes to the complete profile. For a deliberately
narrow repository, record `skillAllowlist` in `.cratis/ai.json` and use Pi's
package filter object:

```json
{
  "packages": [
    {
      "source": "npm:@cratis/ai-chronicle@1.0.0",
      "skills": [
        "skills/cratis-chronicle-projection",
        "skills/cratis-chronicle-read-model"
      ],
      "extensions": []
    }
  ]
}
```

Omitting `skills` loads the profile's complete approved skill set; an empty
array loads none. The update bot keeps `.cratis/ai.json` and `.pi/settings.json`
aligned.

### Updating a pinned Pi profile

Pinned packages do not float during `pi update`. A reviewed update pull request
changes both `.cratis/ai.json` and `.pi/settings.json` to the new exact version.
Then run:

```bash
pi install -l npm:@cratis/ai-engineering@1.1.0
pi list
```

Run the repository gates before merging. Rollback restores the previous exact
version in both files and runs `pi install -l` with that version.

### Project context and always-on guidance

Packages never overwrite `AGENTS.md`, `.cratis/PROJECT.md`, `.pi/settings.json`,
or other project-owned files. Each repository keeps a minimal bootstrap that:

1. identifies its project context file;
2. names the selected Cratis profile skill;
3. records repository-specific constraints.

For example:

```markdown
# Repository AI bootstrap

Read `.cratis/PROJECT.md` before changing code. For Cratis framework work, load
the `cratis-cratis/engineering-profile` skill before planning or editing.
```

The profile skill contains generated references to shared conventions. Product
facts still come from the repository and its immutable source contracts.

## Other harnesses

The same approved skill bytes are wrapped idiomatically for each host:

| Host | Generated shape |
| --- | --- |
| Agent Skills | `skills/<name>/SKILL.md` |
| Agent Plugins 1.0 | Portable `plugin.json` + `skills/` package for compatible hosts |
| Claude Code | Claude plugin and marketplace |
| Codex | Codex plugin and marketplace |
| GitHub Copilot / VS Code | Copilot marketplace around the portable Agent Plugin |
| Cursor | Cursor marketplace around the portable Agent Plugin |
| Gemini CLI | Gemini extension |
| Grok Build | Separate Claude-compatible marketplace and native `.grok/skills/<name>/SKILL.md` archives; neither archive duplicates the other discovery path |
| VS Code, Qwen Code, Hermes Agent, OpenClaw, Grok Bot, NanoClaw | One standalone Agent Plugins 1.0 archive per host: root `plugin.json` plus `skills/<name>/SKILL.md` |
| Amp, Devin, GitHub CLI skills, Goose, OpenHands, Replit, Zed | One native archive per host containing `.agents/skills/<name>/SKILL.md` |
| OpenCode | `.opencode/skills/<name>/SKILL.md` |
| Augment / Auggie | `.augment/skills/<name>/SKILL.md` |
| Cline | `.cline/skills/<name>/SKILL.md` |
| Kilo | `.kilo/skills/<name>/SKILL.md` |
| Visual Studio Copilot | `.github/skills/<name>/SKILL.md` |
| Windsurf / Devin Desktop | `.windsurf/skills/<name>/SKILL.md` |
| Factory / Droid | `.factory/skills/<name>/SKILL.md` |
| Deep Code | `.deepcode/skills/<name>/SKILL.md` from the current official contract |
| DeepSeek Harness | `.dsh/skills/<name>/SKILL.md` as a separately labeled preview contract |
| Kiro | The same portable Agent Plugin installed as a Power |
| Junie | The same Claude-compatible Cratis marketplace and plugin |
| Pi | Versioned npm/Git Pi package |

Release documentation distinguishes **generated**, **statically validated**, and
**host-tested and supported**. These S5b roots are generated and statically
validated only. Their runtime, installation, publication, promotion,
marketplace availability, and support booleans remain false. A generated
wrapper is not automatically a public marketplace listing.

S9 real-host execution is a separate opt-in evidence lane. Ordinary tests do
not execute detected host binaries. A canary requires an exact client version,
allowlisted isolated environment, denied egress, complete phase report, and
project-context snapshot. Synthetic fixture runs remain non-supporting even
when local install and removal pass. S10 release readiness is a separate
production gate and currently remains blocked; generated wrappers and candidate
artifacts do not authorize publication or marketplace availability.

S8 also generates four isolated static project-layout fixtures for 68 rule files
and two general-instruction files. They are not added to this archive table,
do not alter the 34 S5b roots, and are not release assets. They contain no
manifest or package identity and exist only to validate exact native layout and
byte projection before S9 real-host canaries.

### S5b archive and extraction contract

Every harness receives a separate archive named
`cratis-ai-<profile>-<version>-<harness>.tar.gz` (Pi alone remains an npm-style
`.tgz`). Extract one archive as its own root; do not extract several harness
archives over the same directory. Agent Plugins 1.0 archives expose exactly
`plugin.json` and `skills/` at the extraction root. Direct Agent Skills archives
retain the exact project discovery root shown above. The canonical `SKILL.md`,
license, references, and assets are byte-identical in every projection.

OpenCode uses its documented native `.opencode/skills` project root. Its
`.agents/skills` compatibility root remains recorded for cross-tool use but is
not duplicated inside the OpenCode artifact.
NanoClaw receives plain Agent Plugins 1.0 because the current evidence does not
establish an additional NanoClaw manifest field. Junie retains its existing
provisional Claude-compatible artifact; no new Junie-native format is inferred.
The existing `.deepcode` and `.dsh` outputs remain separate and are not copied
into the new host archives.

The generated archives contain no rules, prompts, agents, commands, hooks, MCP,
LSP, scripts, or executable extensions. Offline Agent Plugins roots pass the
universal 1.0 validator and the strict passive profile. Direct roots pass strict
Agent Skill validation and passive payload safety. These checks do not execute a
host and do not provide an installation command where the official lifecycle
evidence does not provide one.

### Released host examples

Each release publishes a separate root for the selected profile and host. After
reviewing and extracting the immutable host asset, native commands operate on
that root. Representative examples are:

```text
# Claude Code interactive commands
/plugin marketplace add <extracted-claude-root>
/plugin install cratis/engineering@cratis

# Codex
codex plugin marketplace add <extracted-codex-root>

# GitHub Copilot CLI
copilot plugin marketplace add <extracted-copilot-root>
copilot plugin install cratis/engineering@cratis

# Gemini CLI local verification before remote publication
gemini extensions link <extracted-gemini-root>

# Grok Build uses the extracted Claude-compatible marketplace
# through Grok's Marketplace UI

# Deep Code project skills
cp -R <extracted-deepcode-root>/.deepcode/skills .deepcode/

# Preview DeepSeek Harness project skills
cp -R <extracted-deepseek-root>/.dsh/skills .dsh/
```

The final release page replaces placeholders with immutable URLs, checksums,
tested host versions, update commands, and uninstall commands. Do not point a
host at the multi-profile generated repository root.

### All-passive candidate review bundles

The candidate lane packages every currently materializable public-safe passive
skill without treating unreviewed content as a release. It produces one public
review bundle and one engineering review bundle across all 34 passive harness
shapes:

```bash
node tooling/package-passive-candidate-assets.mjs \
  candidate-passive-public-package \
  /tmp/cratis-public-candidates \
  0.0.1-candidate.1

node tooling/package-passive-candidate-assets.mjs \
  candidate-passive-engineering-package \
  /tmp/cratis-engineering-candidates \
  0.0.1-candidate.1
```

The public bundle currently contains 34 targets and the engineering bundle
contains 7. Four additional modeled targets remain explicitly accounted for but
excluded: Chronicle and Studio MCP guidance cannot enter a materialized artifact,
and the observable-query HTTP and documentation visual-QA sources contain
private-or-local endpoint/path examples that fail the public artifact scanner.
Four superseded legacy skills remain explicitly repository-only. The two
candidate manifests therefore account for all 49 skill components: 41 packaged,
4 target exclusions, and 4 retained legacy exclusions. Canonical sources are not
rewritten or silently sanitized.

Each bundle contains one deterministic archive per harness, exact immutable
source revision and digest records, a candidate SBOM, static support matrix,
portable-compliance and assurance receipts, `REVIEW.md`, and `SHA256SUMS`.
The primary candidate manifest and complete component-coverage record conform to
closed schemas under `distribution/` and bind each schema's SHA-256 so a later
review cannot silently reinterpret the generated record.
Both bundles also carry the same closed component-coverage record, which
accounts for all 137 modeled components without pretending that agents,
commands, prompts, rules, hooks, or extensions are skills.
Evaluation files remain source evidence but are not runtime skill payload. The
Pi archive is npm-private, Codex installation is `NOT_AVAILABLE`, and only
`0.0.N-candidate.N` versions are accepted.

The manual, read-only **Package Passive Candidate Assets** workflow emits one
atomic candidate-review batch containing the public bundle, engineering bundle,
and native non-skill snapshots, with a top-level digest-bound manifest and exact
checksum closure. It uploads that batch for seven days. Reviewed generated
skill copies stay inside that batch under `candidates/<artifact>/<version>/`.
Every approval, installation, publication, runtime, support, and promotion flag
remains false.
The workflow additionally emits four deterministic native non-skill review
snapshots for the 35 rule/instruction components with generated-static
projections and explicitly records the two rules that have no such contract.
These snapshots have no package identity or host activation.

Candidate materialization is review coverage—not release materialization, host
evidence, marketplace availability, or permission to install these bundles into
a production repository. The bundles are workflow artifacts a reviewer
downloads; the workflow that used to open a bot pull request into
`Cratis/AI.Distribution` for one exact candidate version was removed with the
rest of the cross-repository distribution machinery.

### Approval-pending Fundamentals review assets

While target approval remains open, maintainers can generate deterministic,
short-lived review assets without granting installation or publication status:

```bash
node tooling/package-fundamentals-preview-assets.mjs \
  /tmp/fundamentals-preview 0.1.0-preview.1
```

The output contains one root-native `tar.gz` asset per harness, an npm-compatible
but npm-private Pi `.tgz`, `preview-assets.json`, `preview-sbom.json`, and
`SHA256SUMS`. Stable/non-preview versions are rejected, and the Codex preview
metadata marks installation `NOT_AVAILABLE`. It binds
the exact immutable concept source revision and digest. The manifest state is
`PREVIEW_ASSETS_APPROVAL_PENDING`; approval, supported installation,
publication, and promotion are all false.

The read-only **Package Fundamentals Preview Assets** workflow produces the same
assets with seven-day retention for owner review and disposable canaries. These
assets must not be published, installed as a supported release, or submitted to
a marketplace.

## Versioning and release train

A deliberately identified release PR is the recurring human approval. It adds
one immutable `distribution/releases/v<version>.json` request. Pull-request CI
materializes and verifies every requested profile; merging that PR to `main`
automatically generates distribution/GitHub assets, runs canaries, publishes one
exact npm profile through trusted OIDC, and promotes only after publication
succeeds. Unpublished draft state is cleaned up; an immutable npm version is
never described as rolled back. Subscriber and marketplace delivery remain
disabled handoffs until their separate implementation gates pass. See
[Release Cratis AI](./releasing-cratis-ai.md).

All profile packages use SemVer and one atomic release train. A release changes
shared behavior only through a reviewed `Cratis/AI` commit and records:

- approved target IDs;
- exact source paths and content digests;
- immutable AI and product source revisions;
- package/profile inventory;
- tested harness versions;
- checksums and provenance;
- canary and reinstall recovery results;
- truthful generated/static/host-tested support status; and
- update, rollback, and uninstall evidence when those lifecycle paths have
  actually run for the exact release.

A patch release corrects behavior without changing profile intent. A minor
release adds backward-compatible skills or profiles. A major release removes,
renames, or changes trigger/behavior contracts in a way that requires consumer
migration.

**The marketplace path publishes nothing.** A host installing `Cratis/AI` reads
a committed marketplace manifest on `main` and resolves a plugin whose `source`
is the `skills/` or `engineering/` directory in this repository. There are no
generated bytes on that path, so there is nothing to keep machine-written and no
verification control plane to mirror — reviewing the authored file *is* the
guarantee.

The candidate-review and fixture lanes below still produce generated artifacts
as local or workflow-artifact output for review. Those are review coverage, not
a release channel, and nothing publishes them to another repository.

The generated repository is an index and review surface, not one universal
install root. Every release publishes a separate root archive or immutable ref
for each profile and harness, for example:

```text
cratis-ai-cratis/engineering-1.0.0-pi.tgz
cratis-ai-cratis/engineering-1.0.0-claude.tar.gz
cratis-ai-cratis/engineering-1.0.0-codex.tar.gz
```

Each host receives its manifest at that artifact's root. Release verification
uses the exact remote install command against the exact archive/ref rather than
a convenient staging subdirectory.

## Improvements from consuming repositories

See [Maintaining shared Cratis AI behavior](./maintaining-shared-ai-behavior.md)
for the complete internal maintainer workflow, including ownership decisions,
temporary local workarounds, proposal evidence, canonical implementation, and
downstream adoption.

There is intentionally no automatic two-way or multi-way file sync. File sync
creates competing authorities, merge ambiguity, accidental publication, and
unreviewed behavior drift.

When a product repository improves a shared skill:

1. Keep the immediate product fix in the owning repository when it is a product
   fact or local context.
2. Open **Propose a shared Cratis AI improvement** in `Cratis/AI`.
3. Include the originating repository, immutable revision, affected profiles,
   product authority, behavior change, and compatibility impact.
4. Update canonical skill/rule source in `Cratis/AI` through review.
5. Generate and release a new immutable version.
6. The update bot opens pull requests for subscribed repositories.
7. Each repository runs its own canary and gates before merging.

This is multi-source contribution with one canonical merge point, followed by
one-way generated delivery. It is not bidirectional synchronization.

## Adding a new product profile

For a product such as Studio or Stagehand:

1. The product owner defines authoritative repositories, supported versions,
   and project profile.
2. Add canonical product/engineering skills in `Cratis/AI`; keep environment
   facts in the product repository.
3. Add one profile file under `profiles/public/` or
   `profiles/cratis-engineering/`, then regenerate the aggregate with
   `node tooling/generate-profile-catalog.mjs`.
4. Add focused behavior and host evidence appropriate to its risk.
5. Generate a profile package from approved targets only.
6. Canary it in one real product repository.
7. Publish it in the next atomic release train.

A profile with no approved target remains a visible content gap and cannot be
published accidentally.
