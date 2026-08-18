# Hooks — enforcement, not persuasion

Everything else in `.ai/` is text an agent may or may not follow. The files here are the part
that runs. They convert the mechanically-checkable Cratis invariants into deterministic checks
that fire whether or not the model remembered the rule.

Three layers:

| Layer | Event | Script | Cost | Effect |
|---|---|---|---|---|
| Pattern pass | `PostToolUse` on a write | `scripts/cratis-pattern-scan.sh` | zero tokens until a match | appends a one-line reminder to context, never blocks |
| Hard block | `PreToolUse` on a write | `scripts/cratis-guard-writes.sh` | zero | exits **2** — the write does not happen |
| Quality gate | `Stop` | `scripts/cratis-quality-gate.sh` | one build/test run, only when relevant files changed | exits **2** — the turn does not end |

They are wired for Claude Code in [`.claude/settings.json`](../../.claude/settings.json).
The markdown files in this folder (`agent-stop.md`, `pre-commit.md`) remain *lifecycle guidance* —
they describe what a hook should do for tools that have no wiring yet.

> `.ai/` is the source of truth (see [`../rules/managing-ai-rules.md`](../rules/managing-ai-rules.md)).
> Hooks are the one surface with no folder adapter: Claude reads `.claude/settings.json`,
> Copilot would read `.github/hooks/*.json`. Only the Claude wiring exists today.

## What is enforced

Rule numbers refer to the numbered list in [`../rules/general.md`](../rules/general.md).

**Blocked outright** (`PreToolUse`, exit 2):

- Editing a file whose header marks it as Cratis-generated output — rule 15 `[contract]`
- Writing content that opens with such a header (hand-authoring a "generated" proxy)
- `Directory.Packages.props`, `global.json`, `NuGet.config`, `yarn.lock`, `package-lock.json`,
  `pnpm-lock.yaml`, `packages.lock.json` — the Source-of-Truth Discipline rule
- `.env`, `.env.*`, `*.env` — secrets

The generated-file check is anchored: the marker must be a comment opener at the start of one of
the first five lines. A rule file or a document that merely *mentions* the marker is not blocked.

**Flagged** (`PostToolUse`, exit 0 + context):

| Pattern id | Rule | Detects |
|---|---|---|
| `cratis-automap-call` | 10 `[contract]` | `.AutoMap()` in a file that never calls `.NoAutoMap()` |
| `cratis-ieventlog-in-handle` | 14 `[contract]` | `IEventLog` in a `Handle(` signature, wrapping across up to 5 lines |
| `cratis-nullable-event-property` | 6 `[contract]` | a nullable property inside a type declared with `[EventType]` |
| `cratis-route-on-readmodel` | 12 `[contract]` | `[Route(` inside a type declared with `[ReadModel]` |
| `cratis-controller-base` | 1 `[contract]` | `: ControllerBase` in a file that imports `Microsoft.AspNetCore.Mvc` |
| `cratis-primereact-dialog-import` | 16 `[convention]` | `from 'primereact/dialog'` |

The two `within_type_attribute` patterns are not line greps — the scanner tracks C# attribute
blocks and type scope (positional record, multi-line declaration, or braced body), so a nullable
property is only reported when it really sits inside an `[EventType]`.

**Gated** (`Stop`, exit 2): the app-pinned commands from the Quality Gates table in
`general.md` and the steps in [`agent-stop.md`](./agent-stop.md) — Debug build, specs, Release
build (with `-p:CratisProxiesOutputPath=` per `general.md`, so the proxy generator does not
re-run and touch already-correct generated files), frontend lint / compile / compile-specs /
test, and `validate-ai-setup.sh` for corpus changes.

## The corpus validator

`scripts/validate-ai-setup.sh` sits outside the three layers: it validates `.ai/` itself, and both
the `Stop` gate and the `ai-corpus` CI job run it. Structural, adapter and Codex checks are
**fatal**; the content drift guards **warn**.

### Package subpath existence — `scripts/validate-package-subpaths.sh` (warn)

Every other drift guard asserts that a string should *not* appear. This one is the other direction,
and the only guard that knows what a package is. It extracts each `@cratis/<pkg>/<subpath>` the
corpus names — fenced blocks, inline spans and table cells alike — from `.ai/rules`, `.ai/skills`,
`.ai/agents` and `.ai/prompts`, then resolves it against the `exports` map of the package installed
in `node_modules`. The exports map is exact and machine-readable, so a miss is a genuine miss.
`.ai/hooks` is deliberately *not* one of the default roots — this page names bogus subpaths as
examples, and a guard that reports its own documentation is a guard people switch off.

It exists because nothing in the repository could catch documenting
`@cratis/components/Notifications` (a subpath that first ships in **3.0.0**) while the pin is
**2.6.1**. A prose-pattern matcher has no notion of a package, a version, or an exports map; a
developer following the corpus got a module-resolution failure.

**Warn, never fail — the tradeoff.** The observation is exact but the conclusion is not: "the corpus
names an API that does not exist" and "this repository is pinned behind the version the corpus
documents" look identical from the exports map. This script propagates to every Cratis repository,
and the `ai-corpus` CI job checks out the tree and installs nothing — so failing would be a
permanent no-op in CI while turning repos red locally for their own dependency pin. The warning
names the file, the line and the installed version, and leaves the judgement to a human.

**Silent when it cannot judge.** No `jq`, no `node_modules`, a package this repository does not
depend on, or a package published without an `exports` map: skipped without a word. "Not installed"
is not a finding.

**Version-qualified lines are not drift.** The corpus deliberately documents some 3.0.0+ APIs
against a 2.x pin, marked inline as `(**≥ 3.0.0**)`. A reference is cleared when a line mentioning
it in the same file also carries a version — a dotted number, an `N.x`, or either inequality
spelling. Qualification is judged per *(file, reference)* rather than per line, because the corpus
states a requirement once and then mentions the subpath again unqualified nearby; per-line matching
would fire on exactly the lines someone had just fixed correctly. The check is deliberately generous
in the same direction: it would rather miss a stale line than warn about a correct one.

**What it deliberately does not check.** Named imports (`import { Toaster } from '…'`) are out —
barrel re-exports make that roughly 5% false-positive. Bare identifiers in prose are out — naive
matching runs 40–60% wrong and needs a curated allowlist. So a fabricated *type* that never appears
in an import path is invisible to it: this guard would not have caught `ReactorSideEffect`. It
checks module specifiers, nothing else.

Run it standalone, optionally over other roots, and add `CRATIS_HOOKS_SUBPATH_REPORT=1` to see every
reference and how it resolved rather than only the failures.

## Configuration is data, not code

Neither the pattern list nor the gate commands live in a script. A consuming repository
customises both without forking anything:

| File | Purpose |
|---|---|
| `scripts/cratis-patterns.json` | shipped pattern set; its header `$comment` documents every field |
| `scripts/cratis-patterns.local.json` | optional; merged over the above by `id` — add patterns, or set `"enabled": false` to silence one |
| `scripts/quality-gates.json` | shipped gates; `changed` globs decide when a gate runs, `requires` decides whether it *can* |

A gate whose `requires.commands` are not on `PATH`, or whose `requires.paths` do not exist, is a
**no-op with a message on stderr** rather than a failure — that is how a repository with no .NET
solution or no frontend stays quiet.

**Profile note.** The C# patterns are application-profile and scoped to `Source/**/*.cs` here. A
framework-profile repository (Arc, Chronicle, Fundamentals, Components — see
[`../rules/framework.md`](../rules/framework.md)) has no vertical slices and should disable them
in its `cratis-patterns.local.json`.

**One property gates the proxy generator.** The generator's MSBuild target is
`Condition="'$(CratisProxiesOutputPath)' != ''"`, so clearing that property with
`-p:CratisProxiesOutputPath=` is the *only* way to make it no-op. There is no
`DisableProxyGenerator` property — MSBuild silently accepts unknown `-p:` names, so passing one
looks like it works and changes nothing. `.github/workflows/planner-build.yml` matches the shipped
gates: Release clears the path, Debug does not, because `general.md` makes the Debug build the
canonical trigger for regenerating the TypeScript proxies the frontend phase depends on.

## Escape hatches

Each is an explicit, auditable opt-out — none of them is a default.

| Variable | Effect |
|---|---|
| `CRATIS_HOOKS_ALLOW_PROTECTED_WRITES=1` | allows one protected write; this is the "unless explicitly asked" case for dependency manifests |
| `CRATIS_HOOKS_SKIP_SCAN=1` | disables the pattern pass |
| `CRATIS_HOOKS_SKIP_GATE=1` | disables the quality gate |
| `CRATIS_HOOKS_GATE_DRYRUN=1` | prints which gates would run, and why, then exits 0 |
| `CRATIS_HOOKS_PATTERNS=<path>` | replaces the pattern file |
| `CRATIS_HOOKS_GATES=<path>` | replaces the gate file |
| `CRATIS_HOOKS_SUBPATH_REPORT=1` | prints every `@cratis/*` subpath reference and how it resolved, not only the failures |

## Design constraints

- **POSIX-safe bash**, `set -euo pipefail`, quoted expansions, no `eval`. Verified on bash 3.2
  (macOS system bash) — no `mapfile`, no associative arrays, no GNU-only flags, `LC_ALL=C` on
  every sort and compare.
- **Gate commands are an argv array**, executed directly. They never pass through a shell.
- **`jq` is the only dependency.** Every script
  degrades to a silent no-op when it is missing — a hook must never break a session.
- **Fail safe.** Malformed config, empty stdin, a missing file, a binary file, a file over 2 MB:
  all exit 0 silently.
- **No secrets, no file dumps.** Gate output is capped at `maxOutputLines`; the pattern pass
  prints a path, a line number and a fixed message — never file content.
- **No re-entry.** The `Stop` hook returns immediately when `stop_hook_active` is true, so a
  blocked turn cannot loop.
- **Each pattern fires once per file per session**, tracked under
  `${TMPDIR}/cratis-hooks/<session-id>/`, so a long edit loop cannot flood context.
- **The gate never edits code.** It builds, tests and lints. The one side effect is that a Debug
  build regenerates TypeScript proxies, which is the documented purpose of that build.

## Verifying a change

The scripts read hook JSON on stdin, so they are directly testable:

```bash
# Pattern pass — expect exit 0, and JSON on stdout only when something matched
jq -nc '{session_id:"t", cwd:"'"$PWD"'", tool_name:"Edit",
         tool_input:{file_path:"'"$PWD"'/Source/Planner/Work/Starting/Starting.cs"}}' \
  | .ai/hooks/scripts/cratis-pattern-scan.sh; echo "exit=$?"

# Hard block — expect exit 2
jq -nc '{session_id:"t", cwd:"'"$PWD"'", tool_name:"Edit",
         tool_input:{file_path:"'"$PWD"'/Directory.Packages.props", new_string:"x"}}' \
  | .ai/hooks/scripts/cratis-guard-writes.sh; echo "exit=$?"

# Quality gate — show the dispatch plan without running anything
jq -nc '{session_id:"t", cwd:"'"$PWD"'", stop_hook_active:false}' \
  | CRATIS_HOOKS_GATE_DRYRUN=1 .ai/hooks/scripts/cratis-quality-gate.sh
```

The subpath guard takes corpus roots as arguments, so it is testable in both directions without
touching the corpus — point it at a scratch folder holding a known-bad reference, then at the real
roots. A one-sided test passes vacuously; run both.

```bash
# Negative — expect a warning naming the file and line
mkdir -p /tmp/scratch-corpus
echo "import x from '@cratis/components/ThisDoesNotExist';" > /tmp/scratch-corpus/drift.md
.ai/hooks/scripts/validate-package-subpaths.sh .ai/rules /tmp/scratch-corpus

# Positive — expect silence, and the report to show every real reference resolving
CRATIS_HOOKS_SUBPATH_REPORT=1 .ai/hooks/scripts/validate-package-subpaths.sh
```

Run `bash -n` on every script and `jq .` on every JSON file before committing.

## Note on `.claude/settings.local.json`

That file currently carries `allow` entries for `Bash(git push *)` and `Bash(gh pr *)`. Local
settings take precedence over project settings, so they may override the `ask` entries this
layer adds in `.claude/settings.json`. Remove them there if you want the confirmation prompt back.
