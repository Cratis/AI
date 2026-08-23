# Cratis AI distribution and subscriptions

Cratis AI has one controlled source for shared AI behavior, product-specific
profiles, immutable releases, and reviewed downstream updates. It does not use
folder propagation or automatic two-way synchronization.

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
| Shared AI behavior | `Cratis/AI` | Skill workflows, trigger intent, engineering conventions, profile composition |
| Product facts | Owning product repository | Arc APIs, Chronicle semantics, Components examples, supported client versions |
| Project context | Consuming repository | Product mix, profile, credentials, endpoints, local constraints |
| Generated artifacts | `Cratis/AI.Distribution` | Immutable host packages, manifests, checksums, provenance |

`Cratis/AI` is the canonical source of shared AI behavior. A product repository
remains authoritative for its code and documentation; an AI skill cannot invent
or silently fork those facts. Release generation binds every imported product
fact to an immutable source revision.

A consuming repository never becomes a package publisher. It selects profiles,
pins a version, owns its project context, and receives reviewed update pull
requests.

## Profiles instead of one universal corpus

Different repositories need different behavior. A Chronicle framework change
should not load application vertical-slice rules; a Components change should
not load Orleans guidance; Studio and Stagehand need their own product context.

The profile catalog is [`distribution/profile-catalog.json`](../distribution/profile-catalog.json).
It defines separate public and engineering profiles.

### Public profiles

Public profiles help developers build with Cratis products:

- `public-fundamentals`
- `public-arc`
- `public-chronicle`
- `public-components`
- `public-application`, which composes the four product profiles

A repository using Chronicle without Arc subscribes only to Fundamentals and
Chronicle. A full Arc + Chronicle + React application uses
`public-application`.

### Engineering profiles

Engineering profiles add contributor behavior for Cratis-owned repositories:

- `engineering-base`
- `engineering-application`
- `engineering-framework-fundamentals`
- `engineering-framework-arc`
- `engineering-framework-chronicle`
- `engineering-framework-components`
- `engineering-studio`
- `engineering-stagehand`
- `engineering-client`
- `engineering-documentation`
- `engineering-corpus`

Profiles compose a small base rather than loading every rule and skill. Studio,
Stagehand, client, and other content-gap profiles remain unpublished until their
owning maintainers provide authoritative source behavior.

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
  "profiles": ["engineering-framework-chronicle"],
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
  "profiles": ["public-application"],
  "harnesses": ["claude", "codex", "copilot", "pi"],
  "updatePolicy": "reviewed-pull-request",
  "projectContext": ".cratis/PROJECT.md"
}
```

The schema is
[`distribution/profile-subscription.schema.json`](../distribution/profile-subscription.schema.json).
Exact versions are mandatory. `latest`, branches, and floating ranges are not
valid subscriptions.

Stagehand owns the subscriber update controller tracked internally as
`Cratis/Stagehand#39`. Its repository-scoped App discovers committed `.cratis/ai.json` files only in
repositories where it is explicitly installed. A new release opens a normal
pull request changing the subscription and host-native lock or settings files.
It never merges automatically, pushes generated corpus folders, or receives
broad organization write access.

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
pi install npm:@cratis/ai-engineering-base@1.0.0
```

This writes the exact package source to `~/.pi/agent/settings.json`.

### Project-specific profile

A Chronicle repository pins its profile in project scope:

```bash
cd Chronicle
pi install -l npm:@cratis/ai-engineering-chronicle@1.0.0
```

Pi writes `.pi/settings.json`. Commit that file after review. When another
maintainer trusts the repository, Pi installs the missing exact package.

Expected settings shape:

```json
{
  "packages": [
    "npm:@cratis/ai-engineering-chronicle@1.0.0"
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
pi install -l npm:@cratis/ai-engineering-chronicle@1.1.0
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
the `cratis-engineering-chronicle-profile` skill before planning or editing.
```

The profile skill contains generated references to shared conventions. Product
facts still come from the repository and its immutable source contracts.

## Other harnesses

The same approved skill bytes are wrapped idiomatically for each host:

| Host | Generated shape |
| --- | --- |
| Agent Skills | `skills/<name>/SKILL.md` |
| Claude Code | Claude plugin and marketplace |
| Codex | Codex plugin and marketplace |
| GitHub Copilot | Copilot plugin and marketplace |
| Cursor | Cursor plugin |
| Gemini CLI | Gemini extension |
| Grok Build | `.grok/skills/<name>/SKILL.md` and Claude compatibility |
| DeepSeek Harness | `.dsh/skills/<name>/SKILL.md` while upstream remains preview |
| Kiro | Agent Plugin power |
| Junie | Junie extension |
| Pi | Versioned npm/Git Pi package |

Release documentation distinguishes **generated**, **statically validated**, and
**host-tested and supported**. A generated wrapper is not automatically a
public marketplace listing.

### Released host examples

Each release publishes a separate root for the selected profile and host. After
reviewing and extracting the immutable host asset, native commands operate on
that root. Representative examples are:

```text
# Claude Code interactive commands
/plugin marketplace add <extracted-claude-root>
/plugin install engineering-framework-chronicle@cratis

# Codex
codex plugin marketplace add <extracted-codex-root>

# GitHub Copilot CLI
copilot plugin marketplace add <extracted-copilot-root>
copilot plugin install engineering-framework-chronicle@cratis

# Gemini CLI local verification before remote publication
gemini extensions link <extracted-gemini-root>

# Grok Build project skills
cp -R <extracted-grok-root>/.grok/skills .grok/

# DeepSeek Harness project skills
cp -R <extracted-deepseek-root>/.dsh/skills .dsh/
```

The final release page replaces placeholders with immutable URLs, checksums,
tested host versions, update commands, and uninstall commands. Do not point a
host at the multi-profile generated repository root.

## Versioning and release train

All profile packages use SemVer and one atomic release train. A release changes
shared behavior only through a reviewed `Cratis/AI` commit and records:

- approved target IDs;
- exact source paths and content digests;
- immutable AI and product source revisions;
- package/profile inventory;
- tested harness versions;
- checksums and provenance;
- canary, update, rollback, and uninstall results.

A patch release corrects behavior without changing profile intent. A minor
release adds backward-compatible skills or profiles. A major release removes,
renames, or changes trigger/behavior contracts in a way that requires consumer
migration.

Generated artifacts are bot-authored in `Cratis/AI.Distribution`. Humans review
the generated pull request but do not edit generated bytes.

The generated repository is an index and review surface, not one universal
install root. Every release publishes a separate root archive or immutable ref
for each profile and harness, for example:

```text
cratis-ai-engineering-chronicle-1.0.0-pi.tgz
cratis-ai-engineering-chronicle-1.0.0-claude.tar.gz
cratis-ai-engineering-chronicle-1.0.0-codex.tar.gz
```

Each host receives its manifest at that artifact's root. Release verification
uses the exact remote install command against the exact archive/ref rather than
a convenient staging subdirectory.

## Improvements from consuming repositories

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
3. Add the profile to `distribution/profile-catalog.json`.
4. Add focused behavior and host evidence appropriate to its risk.
5. Generate a profile package from approved targets only.
6. Canary it in one real product repository.
7. Publish it in the next atomic release train.

A profile with no approved target remains a visible content gap and cannot be
published accidentally.
