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
skill. The package also contributes rules, path guidance, prompts, agents, the
subagent tool, and Cratis quality hooks. It yields to an existing managed CLI installation so
resources and extensions are never registered twice. It does not create the
shared corpus, configure other harnesses, or provide managed update and
uninstall protection.

The Pi `subagent` tool, whether it comes from the package or a managed
installation, stands down for the session when another extension already
provides a delegation tool named `Agent` (such as pi-subagents, which reads the
same `.pi/agents`). It removes itself from the active tools at session start,
shows one notice when Pi has a UI, and so never offers the model two tools that
list the same agents. Without such a tool it is unchanged.

## Path guidance and subagents

The `cratis-path-guidance` Pi extension delivers the guidance that belongs to a
file at the moment the file is touched, so it costs almost nothing per session:

- **Path-scoped rules.** A rule whose `applyTo` or `paths` matches a file is
  attached to the tool result the first time that file is touched in a session.
  `cratis-rules` no longer delivers them; it keeps only the universal rules in
  the system prompt.
- **Skill hints.** A skill declares trigger globs in its `SKILL.md` `paths`
  frontmatter. After a successful `write` or `edit` of a matching file, one short
  advisory line names the skill, its `SKILL.md` and the matching glob. Each skill
  is hinted at most once per session, only when the session has the skill, and
  not when the skill was already read (with the `read` tool or through a shell
  command). Hints never block a call and never touch the system prompt.

The extension works in a session without a UI and without `cratis-rules`, and the
packaged copy stands down when the repository has its own
`.pi/extensions/cratis-path-guidance` installation.

`cratis-rules` puts every universal rule in the system prompt, about 26k tokens
on every turn. A pi-subagents agent definition (`@tintinweb/pi-subagents`) with an
`extensions:` allowlist loads only the extensions it names, so such agents get
none of the corpus harness. To give them path guidance and the write and store
guards without the universal rules, name both extensions:

```yaml
extensions: cratis-path-guidance, cratis-hooks
```

Add `cratis-rules` only to an agent that needs the universal rules as well. The
corpus's own `subagent` tool starts a full `pi` process and already loads every
extension.

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
model or credentials, to prove that project context, all 68 skills, 18 prompts,
and the managed extensions are actually discovered. It also verifies the
canonical skill and rule paths exposed to Claude, Codex, Copilot, Cursor, and
OpenCode.

Static skill checks live beside the skill as `verification.json`. They record
an example input and assert that required guidance is present; they do not run
that input through a model, compile examples, or prove writing quality.
Behavioral assessment needs a separate task exercise and review of its output. The repository deliberately
has no provenance ledger, evidence chain, generated inventory, or distribution
tooling pipeline.

## Release

`.github/workflows/publish.yml` is the single workflow. It verifies
the corpus and packages, checks semantic release intent, uses
`cratis/release-action` to calculate the version after merge, and publishes
`@cratis/pi` when a release is requested by the merged pull request label.
