# Cratis AI

This repository ships two things from one source of truth:

- **`Cratis.AI` (NuGet)** is the backend package: AI providers, pools, tiers,
  concurrency, conversations, agents, worker/harness scheduling, and usage.
  Add it with `dotnet add package Cratis.AI`; the
  [backend quick start](./Documentation/backend-quick-start.md) takes you to a first chat call,
  and backend documentation starts at [Documentation/index.md](./Documentation/index.md).
- **The Cratis AI corpus and tooling** are the skills and rules coding agents use
  when building with or contributing to Cratis, plus the tools that install and
  verify them.

## Which entry point do you need?

| You want to | Start here |
| --- | --- |
| Use the backend package in an application | [Backend quick start](./Documentation/backend-quick-start.md), then the [Documentation index](./Documentation/index.md) and [Architecture](./Documentation/architecture.md) |
| Give a repository the skills and rules | [Managed installation](#managed-installation) below |
| Use the corpus from a single harness | [Native plugins](#native-plugins) below |

The rest of this README covers the corpus and its tooling.

## Repository layout

```text
.cratis/ai/          The corpus: skills, rules, profile catalog and installer manifest
Source/
  Harness.Setup/     Maintains this repository's own harness adapters
  Pi.Plugin/         Published @cratis/pi package
  ScreenplaySession/ Stack-neutral Screenplay guidance published as the session bundle
  Verification/      Corpus, catalog, package and guard checks
Evaluations/         Compiled examples that keep skill examples honest
.claude/ .github/ .agents/ .pi/ .cursor/ .opencode/   Harness adapters that link to .cratis/ai
```

There is one corpus: `.cratis/ai`. Harness folders link to it and carry no copies.
`AGENTS.md`, `CLAUDE.md` and `.github/copilot-instructions.md` link to
[`.cratis/ai/rules/general.md`](.cratis/ai/rules/general.md), the one page every session reads.

## Managed installation

Choose the profile that matches the repository:

| Profile | For |
| --- | --- |
| `cratis/application` | Build an application on Cratis: model a business flow, implement its backend and UI slices, run and diagnose them. |
| `cratis/engineering` | Change a Cratis platform repository: follow its library contracts, verify the change and prepare the PR and release note. |

```bash
cratis ai install \
  --harnesses claude,codex,copilot,cursor,opencode,pi \
  --profiles cratis/application \
  --languages csharp,typescript
```

The CLI reads `.cratis/ai/manifest.json`, resolves the profile's skills through
`.cratis/ai/profile-catalog.json`, installs them in `.cratis/ai` and creates the
adapters each harness reads. It records hashes in `.cratis/ai.manifest.json`,
refuses to overwrite files it does not own, and stops an update or uninstall when
managed content was edited unless `--force` is used.

[Installing and using the corpus](./Documentation/corpus-installation.md) covers
status, update, uninstall and what a session sees.
[Migration](./Documentation/corpus-migration.md) lists what the earlier corpus had
that this one does not, and what each earlier profile ID installs now.

## Native plugins

Claude Code, Codex, GitHub Copilot and Cursor can install the corpus as a plugin
from the marketplace manifests in this repository; `.cratis/ai/plugin.json` is the
Copilot plugin manifest. A plugin exposes every skill and applies no profile. The
`version` in these manifests is a manifest version, not the release version: change
it in all of them together; verification fails when they differ.

Pi uses the published package:

```bash
pi install -l npm:@cratis/pi
```

`@cratis/pi` reads `.cratis/ai.json` when present and exposes the skills its
profiles select; without the file it exposes every packaged skill. It stands down
when the CLI already manages the repository.

## Contribute

Review a change to a skill, rule, hook, MCP entry or adapter as you would review
code: it influences what coding agents execute in other repositories. Check any
package name, registry and install command against the intended upstream source.
`.github/CODEOWNERS` routes these paths to `@Cratis/core`.

[Authoring skills](./Documentation/authoring-skills.md) has the checklist a skill
must meet and the files that change with it.
[Compatibility](./Documentation/compatibility.md) lists the product releases the
skills were checked against.

```bash
corepack enable
yarn install --immutable
yarn workspace @cratis/harness-setup run check
yarn workspace @cratis/ai-verification run verify
```

Install once at the repository root; the workspaces share one `yarn.lock`.

## Release

`.github/workflows/publish.yml` is the only release workflow. It verifies
the corpus and packages, checks semantic release intent, uses
`cratis/release-action` to calculate the version after merge, and publishes
`@cratis/pi` when a release is requested by the merged pull request label.
Each release also attaches the Screenplay session bundle (`screenplay-session.zip`
and its `.sha256`) to the GitHub release; see
[Screenplay session bundle](Documentation/screenplay-session-bundle.md).
`.github/workflows/verify-pull-request-policy.yml` is a thin caller of the
organization pull-request policy gate. It checks release intent and fails a
release-bound pull request whose description would not publish as release
notes. The local PR-body checker recognizes this caller as well as the legacy
`verify-release-notes` and `verify-semver-label` callers.

## Acknowledgments

Event Modeling is the work of Adam Dymitruk; Martin Dilger's *Understanding
Eventsourcing* shapes much of the method the modeling and Screenplay skills teach.
This corpus has adapted material from
[agentic-engineer](https://github.com/Nebulit-GmbH/agentic-engineer) by Martin
Dilger and [Nebulit GmbH](https://nebulit.de), used with their explicit consent,
and from the MIT-licensed
[TrogonStack agentskills](https://github.com/TrogonStack/agentskills) by Straw Hat,
LLC.
