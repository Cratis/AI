# Cratis AI

Cratis AI is the canonical set of rules, agents, prompts, and skills used when
building with or contributing to Cratis.

## Repository layout

```text
.cratis/ai/          Canonical AI corpus and availability manifest
Source/
  Harness.Setup/     TypeScript tool that maintains repository harness adapters
  Pi.Plugin/         Published @cratis/pi package
  Verification/      Corpus, profile, package, and skill behavior verification
.claude/             Claude Code adapters
.github/             GitHub Copilot adapters and the quality/release workflow
.agents/             Codex adapters
.pi/                 Pi adapters
.cursor/             Cursor adapters
.opencode/           OpenCode adapters
```

There is one corpus: `.cratis/ai`. Harness folders point to it and must not carry
independent copies.

## Managed installation

The Cratis CLI provides the complete repository-managed path:

```bash
cratis ai install \
  --harnesses claude,codex,copilot,cursor,opencode,pi \
  --profiles cratis/application \
  --languages csharp,typescript
```

The CLI reads `.cratis/ai/manifest.json`, resolves the matching skills through
`.cratis/ai/profile-catalog.json`, installs managed content in `.cratis/ai`, and
creates native harness adapters. It records hashes in
`.cratis/ai.manifest.json`, refuses to overwrite user-owned paths, and stops
update or uninstall when managed content was changed unless `--force` is used.

## Native plugins

Native plugins remain an independent single-harness choice. Claude Code, Codex,
GitHub Copilot, and Cursor use the marketplace manifests in this repository. Pi
uses the published package:

```bash
pi install -l npm:@cratis/pi
```

`@cratis/pi` reads `.cratis/ai.json` when present and exposes skills matching the
selected profiles and languages. Without the file, it exposes every packaged
skill. The package also contributes rules, prompts, agents, the subagent tool,
and Cratis quality hooks. It yields to an existing managed CLI installation so
resources and extensions are never registered twice. It does not create the
shared corpus, configure other harnesses, or provide managed update and
uninstall protection.

OpenCode can consume the standard `.opencode` and `AGENTS.md` adapters directly.

## Maintain harness adapters

After adding or removing an agent, prompt, or harness asset, synchronize the
repository adapters:

```bash
npm ci --prefix Source/Harness.Setup
npm run setup --prefix Source/Harness.Setup
npm run check --prefix Source/Harness.Setup
```

## Verify quality

All quality checks live in `Source/Verification` or the package they compile:

```bash
npm ci --prefix Source/Pi.Plugin
npm ci --prefix Source/Verification
npm run check --prefix Source/Pi.Plugin
npm run check --prefix Source/Verification
npm run verify --prefix Source/Verification
npm test --prefix Source/Verification
(cd Source/Pi.Plugin && npm pack --dry-run)
```

The verification suite uses Pi's `DefaultResourceLoader` directly, without a
model or credentials, to prove that project context, all 53 skills, 18 prompts,
and the three managed extensions are actually discovered. It also verifies the
canonical skill and rule paths exposed to Claude, Codex, Copilot, Cursor, and
OpenCode.

Skill verification scenarios live beside the skill as `verification.json` and
state an input plus deterministic assertions. Verification answers whether the
content works and remains internally consistent. The repository deliberately
has no provenance ledger, evidence chain, generated inventory, or distribution
tooling pipeline.

## Release

`.github/workflows/publish.yml` is the single workflow. It verifies
the corpus and packages, checks semantic release intent, uses
`cratis/release-action` to calculate the version after merge, and publishes
`@cratis/pi` when a release is requested by the merged pull request label.
