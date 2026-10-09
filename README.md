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

OpenCode can consume the standard `.opencode` and `AGENTS.md` adapters directly.

## Maintain harness adapters

After adding or removing an agent, prompt, or harness asset, synchronize the
repository adapters:

```bash
npm ci --prefix Source/Harness.Setup
npm run setup --prefix Source/Harness.Setup
npm run check --prefix Source/Harness.Setup
```

## Author skills

Skills follow the [Agent Skills specification](https://agentskills.io/specification) and
Anthropic's [skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices).
Every skill is read by Claude Code, Codex, Copilot, Cursor, OpenCode and Pi, so keep to the portable
frontmatter fields: `name`, `description`, `license`, `compatibility`, `metadata` and `allowed-tools`.

The verification enforces the structural rules:

- `name` is 1-64 lowercase letters, digits and single hyphens, matches its directory, and does not
  contain `anthropic` or `claude`.
- `description` is 1-1024 characters, says what the skill does and when to use it, and contains no
  tag-like text. Write `IProjectionFor`, not `IProjectionFor<T>`: the Skills API rejects angle brackets.
- The `SKILL.md` body stays within 500 lines and 20,000 characters (the specification's "under 5,000
  tokens"). It loads in full whenever the skill triggers and stays in context, so it holds the decision
  rules, the core workflow, the traps, the version pins and the pointers. Detail that only some tasks
  need goes into `references/`.
- Every other file is linked directly from `SKILL.md`. Agents may only preview a file that is reached
  through another reference file.
- A reference file longer than 100 lines opens with a `## Contents` list of its `##` headings, so a
  partial read still shows everything the file covers. Generate it rather than writing it by hand:
  `yarn workspace @cratis/ai-verification run contents` (add `--check` to verify). A file that is one
  fenced example, introduced within its first 30 lines, needs no list.

The guidance that cannot be checked mechanically:

- Link a reference with the situation that calls for it: "Read `references/x.md` when ...", not
  "see `references/x.md`".
- Keep the traps an agent must know before it acts in `SKILL.md`, near the top. Claude Code keeps only
  the first 5,000 tokens of a skill after compaction.
- Give a default and say when to use the alternative, rather than a list of equal options.
- State capability limits against the version the skill pins ("on Screenplay 4.66.0"), never as
  "today", "yet" or "currently".
- Name the MCP server with the tool: the `screenplay` server's `apply` tool.
- Use one term per concept throughout a skill.
- Explain why a rule exists instead of raising its volume.

### Evaluate skills

Behavior evaluations live in `Evaluations/skills/<name>/trigger.json` and `evals.json`, outside the
shipped corpus. CI checks their shape and runs runner specs; it never spends model usage. Locally,
use an installed, logged-in `pi` or `claude` (default models: `openai-codex/gpt-6.1-sol` with medium
thinking, or `sonnet`). These commands make paid model calls:

```bash
yarn workspace @cratis/ai-skill-evaluation run evaluate trigger --skill cratis-arc-command --harness pi --runs 3
yarn workspace @cratis/ai-skill-evaluation run evaluate outputs --skill cratis-arc-command --harness claude --runs 1
yarn workspace @cratis/ai-skill-evaluation run evaluate grade --run <output-run-directory> --grader-model opus
yarn workspace @cratis/ai-skill-evaluation run evaluate report --run <run-directory>
```

Results and raw transcripts stay untracked in `.ai-work/skill-evaluations/`. Harnesses run in
neutral temporary workspaces outside the repository, removed afterward. Each batch uses a private
copy of the skills; pi's temporary agent directory contains only authentication, not host system
prompts or settings. Claude has a read-only tool allowlist and no configured MCP servers; its init
listing must contain the target in with-skills runs and no corpus skills in baseline runs. Output
tasks run with all corpus skills and without them; graders have no tools, and passes require quoted
answer evidence.
Trigger runs stop at the first skill load or six tool calls; a rate ≥ 0.5 counts as triggered.
Reports show failures, assertion discrimination, and paired token/time deltas. Review actual answers
alongside grades: model grading and a few repetitions are signals, not proof of correctness.

Use repeatable `--skill` options to select skills, `--limit 2` for a smoke batch, `--model` and
`--thinking` to override models, `--concurrency` (default 4, maximum 16), and `--timeout` (default
240 seconds per call, maximum 600). Claude's `--listing-budget 60000` avoids description truncation;
its bundled skills and usage-dependent listing remain confounds. To resume, repeat the same command
and options with `--run <directory>` (relative to the invocation directory, or the repository root
when yarn's workspace dispatcher replaces `INIT_CWD` with the package directory); completed
JSONL keys are skipped and changed evaluations or corpus revisions are rejected. Grading and reports
read results under the run lock; a stale lock reports its PID and manual recovery instructions.
Missing harnesses, login failures and timeouts exit 2, never pass.

Follow [output evaluation](https://agentskills.io/skill-creation/evaluating-skills) and
[description optimization](https://agentskills.io/skill-creation/optimizing-descriptions): realistic
near-misses, repeated trigger queries, baseline outputs and objective assertions. Replace assertions
that always pass or fail in both conditions; keep a fixed balanced train/validation split when tuning
descriptions and do not use held-out failures to guide edits.

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
model or credentials, to prove that project context, every skill, 18 prompts,
and the managed extensions are actually discovered. It also verifies the
canonical skill and rule paths exposed to Claude, Codex, Copilot, Cursor, and
OpenCode.

Static skill checks live beside the skill as `verification.json`. They record
an example input and assert that required guidance is present in `SKILL.md`, or
in the reference file named by an assertion's `file`; they do not run
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

## Acknowledgments

The Screenplay event-modeling skills adapt material from
[agentic-engineer](https://github.com/Nebulit-GmbH/agentic-engineer) by
Martin Dilger and [Nebulit GmbH](https://nebulit.de), with their agreement,
and from the MIT-licensed
[TrogonStack agentskills](https://github.com/TrogonStack/agentskills) by
Straw Hat, LLC. Several Arc and Chronicle code skills and the Screenplay and
slice agents also adapt agentic-engineer material. Event Modeling itself is the work of Adam Dymitruk; Martin
Dilger's *Understanding Eventsourcing* shapes much of the method. Each skill's
`references/provenance.md` lists exactly what it adapts, and its `LICENSE`
carries the notices.
