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
- **Skill hints.** A skill declares trigger globs in `metadata.cratis-hint-paths` in its
  `SKILL.md` frontmatter, as one string of whitespace-separated globs
  (`cratis-hint-paths: "**/for_*/**/*.ts **/for_*/**/*.tsx"`). It sits under `metadata`
  because Agent Skills allows only `name`, `description`, `license`, `compatibility`,
  `metadata` and `allowed-tools` at the top level, and the key is Cratis-specific on
  purpose: Claude Code reads a plain `paths` key in `SKILL.md` as conditional activation
  and would hide the skill until a matching file is touched. After a successful `write` or `edit` of a
  matching file, one advisory line names every matching skill with its glob and its
  `SKILL.md`. Each skill is hinted at most once per session. A skill is not hinted
  when it is already in context: read in the session (a shell command counts only
  when a reader such as `cat`, `sed`, `head`, `tail`, `less`, `bat`, `rg` or `grep`
  opens its `SKILL.md` or a file under `references/`), preloaded by pi-subagents
  (`skills: a, b`, and only when the skill's text follows the header: pi-subagents
  writes the header even when its loader could not read a symlinked `.pi/skills`),
  or expanded by `/skill:name`. The skills considered are the ones Pi loaded for the
  session plus the repository's selected skills: the managed `.cratis/ai/skills`, or
  from the packaged extension the skills that `.cratis/ai.json` selects, so a
  session whose Pi skill list is empty (for example a pi-subagents agent with
  `skills: false`) or holds only personal skills is still hinted. A skill the
  repository did not select is never hinted, and none is added if the selection
  cannot be resolved. Hints never block a call and never touch the system prompt.

The extension works in a session without a UI and without `cratis-rules`. The
packaged copy stands down when a managed installation (`.cratis/ai.manifest.json`)
already delivers path guidance: through its own `.pi/extensions/cratis-path-guidance`,
or through any `.pi/extensions/cratis-rules` that is not the current universal-only
version, because every earlier version delivers path-scoped rules itself (in the
system prompt or on `tool_result`); one that cannot be recognised counts as
delivering them. Until `cratis ai update` installs the managed copy, such an older
installation keeps its rules in full sessions but not the skill hints, and no rule is
delivered twice. Subagents that load only the allowlisted extensions below get no
path guidance in such an installation until `cratis ai update` installs the managed
copy.

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

### System One skill relevance (experimental)

The `cratis-system-one` Pi extension, from either channel, measures whether a
[System One model](https://typesafe.ai/blog/introducing-system-one-models-and-jev) helps with the
skill corpus. In shadow mode it asks, in the background, which of the loaded skills would help with a
prompt, and records the scores next to the `SKILL.md` files the model actually read. It changes
nothing the model sees and never delays a prompt.

It is off until *you* run `/system-one setup`, which states what is sent (skill names, the first
sentence of each description, and the first 1,200 characters of each prompt you type in an
interactive session in a repository set up with Cratis AI; never subagent tasks, `@file` contents or
tool output), asks you to confirm, and probes the backend before saving to a private file in Pi's
agent directory. A repository's `.cratis/ai.json` can only opt out or narrow it (a problem in that
file switches it off), and environment variables can never enable it. See
[the extension README](.cratis/ai/harnesses/pi/extensions/cratis-system-one/README.md) for backends,
privacy and the report, and the
[consent and privacy decision](Documentation/decisions/0017-system-one-consent-and-privacy.md).

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
model or credentials, to prove that project context, all 70 skills, 18 prompts,
and the six managed extensions are actually discovered. It also verifies the
canonical skill and rule paths exposed to Claude, Codex, Copilot, Cursor, and
OpenCode.

Static skill checks live beside the skill as `verification.json`. They record
an example input and assert that required guidance is present; they do not run
that input through a model, compile examples, or prove writing quality.
Behavioral assessment needs a separate task exercise and review of its output. The repository deliberately
has no provenance ledger, evidence chain, generated inventory, or distribution
tooling pipeline.

## Release

`.github/workflows/publish.yml` is the only release workflow. It verifies
the corpus and packages, checks semantic release intent, uses
`cratis/release-action` to calculate the version after merge, and publishes
`@cratis/pi` when a release is requested by the merged pull request label.
`.github/workflows/verify-release-notes.yml` is a thin caller of the
organization release-notes check, which fails a release-bound pull request
whose description would not publish as release notes.
