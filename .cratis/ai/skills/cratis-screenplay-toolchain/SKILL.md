---
name: cratis-screenplay-toolchain
description: "Verified tool facts for checking Cratis Screenplay `.play` models: the pinned versions of the standalone `screenplay` tool and the bundled `cratis` compiler, the exact command behind each verdict V1 to V5, the executable and renderable subsets, a diagnostics fix guide, traps, documentation contradictions, and a compiled cheat-sheet. Use when choosing a compiler, running or reading a verdict, fixing a PLAY or STAGE diagnostic, or deciding whether syntax binds or renders. Not for: what to model or the phase workflow (use `cratis-screenplay-modeling-lifecycle`), the MCP editing loop (use `cratis-screenplay-model-authoring`), rendering workflow (use `cratis-screenplay-render-and-gap-fill`)."
license: MIT
---

# Screenplay toolchain

Which tool to run, what its result means, and what each tool can and cannot admit. This
skill answers "does it compile, bind, render, and which compiler said so". The method
(what to model, in which order, with which gates) lives in
`cratis-screenplay-modeling-lifecycle`; construct syntax lives in the construct skills
(`cratis-screenplay-command-surface`, `-projections`, `-read-surface`,
`-captures-and-reactions`, `-specifications`, `-ui-composition`).

## Locate the model

Look first in the model root: the folder holding the project's `.play` files (else `Source/` or `src/`, else `Screenplay/`), or the root the project set with `mcpServers.screenplay.root` in `.cratis/ai.json`. A folder of `.play`
files is one application: always check the folder, never one file of it.

## Verified product sources

The only version table is `references/versions.md`; other skills point to it.

| Package | Version | Purpose |
| --- | --- | --- |
| `Cratis.Screenplay.Tool` | `4.66.0` (`c89198b`) | standalone compiler, binder and MCP server |
| cratis CLI | `3.27.1` (`a327e89`) | bundles Screenplay 4.60.1 and Stage 4.24.0 (also v3.28.0 and `main`, until cli#253 ships); `render`, `generate`, `prologue` |
| Stage | `4.24.1` (`2cadf59`) | renders ESM v1 to v3 (C# backend plus a React/Vite scaffold on Arc 22.25.0); the cratis CLI still bundles 4.24.0 |
| Arc / Chronicle | `22.50.5` / `19.32.0` | code-level facts cited here |

Facts were read with `git show <tag>:<path>` and probed on the installed tools. Behaviour
was probed on 4.63.1 and re-checked on 4.66.0. 4.65.0 adds command named-rule `implementation` blocks (handlers and operation phases already had the wrapper; it is rejected on concept rules, built-in property rules and whole-command `require`/`validate` bodies); 4.66.0 is editor tooling only. Neither changes execution.
Re-verify before claiming another version behaves the same.

## Ground rules

1. **Never invent syntax.** Copy shapes from `references/cheat-sheet.md` and the compiled
   examples it names, or from a compiled documentation example. Construct keywords are
   closed.
2. **Check the folder, warnings as errors.** `screenplay <folder> --warnaserror` or
   `cratis screenplay validate <folder> --warnings-as-errors`. Warnings hide defects:
   PLAY0029 (a misspelt keyword or a `type` inside a slice) drops a construct silently.
3. **Pick the compiler deliberately and name it.** Standalone `screenplay` for V1 to V3 on
   the current language; `cratis` for `render` and as the V1 fallback. The bundled compiler
   rejects ESM v6 and reports a false PLAY0285 on cascades (cli#242). Report tool and
   version with every verdict.
4. **Know the mode** (design, executable, renderable) and write from its subset.
5. **Capability is not correctness.** The tool you ran decides what is accepted today; the
   domain and the documented semantics decide what is correct. On conflict keep the correct
   model and record a tool gap; never reshape a model to silence a tool.
6. **Never remove `@pii`, `@sensitive`, authorization, list queries, automations or rules
   to reach V3 or a render.** Report the verdict as blocked with the codes.
7. **A clean verdict proves only its own layer.** "Not run" with the reason is a valid
   result. Specifications written or bound are never specifications passing.
8. **Let the tool resolve what it can.** Revisions, identities and renames come from the
   tool, never from hand computation; discover tool, version and root once per session and
   reuse them until the root, the tool or a call changes. Re-resolve only when a value actually
   needs to change: a failed or stale call, a different model root, a changed tool, version or
   configuration, or an explicit override.

## The two compilers

| | Standalone `screenplay` 4.66.0 | `cratis screenplay ...` 3.27.1 |
| --- | --- | --- |
| Check a folder | `screenplay <folder> --warnaserror --no-color` (exit 0 pass, 1 fail; an empty folder also exits 0, so read "N file(s) compiled") | `cratis screenplay validate <folder> --warnings-as-errors -o json-compact` (0 pass, 5 fail, 1 missing path or no files) |
| ESM admitted | v1 to v6 | v1 to v5 (bundled Screenplay 4.60.1) |
| Automation, Translate, reactions, captures, clocks, triggers | bind | PLAY0268, for example "Slice '<name>' of type '<type>' is not admitted by ESM v1." |
| Cascade specs | compile | false PLAY0285 (cli#242) |
| File argument | follows imports | ignores imports, false PLAY0165 warnings (cli#244): validate the folder |
| MCP | `screenplay mcp <folder>`; 29 tools | `cratis screenplay mcp [root]`; 29 tools; registered by `cratis ai install` |

Exact messages, exit codes and the MCP roots bug: `references/versions.md`.

## Verdicts

Independent results, not a ladder. Commands and report format: `references/verdicts.md`.

| Verdict | Meaning | How |
| --- | --- | --- |
| V1 | authorable (compiles, warnings as errors) | the folder command above |
| V2 | executable diagnostics read | MCP `open-workspace`, then `read-workspace view=executable-diagnostics` |
| V3 | binding-ready (binds, no blocking executable diagnostics) | `executableReady` true and no error-severity diagnostic in V2; informational PLAY0269/0270 are reported separately |
| V4 | reference specifications run | the Screenplay reference execution route only (none ships in the pinned tools: `V4 not run: no route`); rendered Debug tests are V5.tests, never V4 |
| V5 | rendered and target-verified | `cratis render`, then Debug build and tests; report admission, publication, build and tests separately |

V2 and V3 need MCP: send `initialize`, then `notifications/initialized`, and start the
server with a fixed root (a dynamic root hits the roots bug on 4.63.1 and the bundled
4.60.1). A subagent without MCP reports "V2 not run: no MCP in this agent".

One line per verdict, tool first, for example `V1 pass (screenplay 4.66.0, 3 files)` and
`V3 blocked: PLAY0268 x3 (list query, @pii)`. Name the source identity (commit plus the digest from
the source-identity helper (`cratis-screenplay-modeling-lifecycle` `references/verdicts-and-modes.md` "Source identity")) the verdict ran on; keep it apart from the MCP
`modelRevision`, which is semantic and, without `.screenplay/identities.json`,
changes with the root folder name.

## Subsets (write from the one your mode needs)

- **Design**: every construct family parses; use it to model first. Compiled shapes:
  `references/cheat-sheet.md`.
- **Executable** (binds, V3): `references/executable-subset.md`. Keyed optional queries
  only; no handler (PLAY0268, with or without `implementation`/`hint`); `reads` and
  `concurrency` do not bind (PLAY0271); no `@pii`; v6 constructs only on the standalone tool.
- **Renderable** (V5): `references/renderable-subset.md`. Stage 4.24 renders ESM v1 to v3
  `StateChange`/`StateView` slices; Automation and Translate are gap-fill (Stage#79).
- **Event sources, streams and command routes**: authorable and validatable, but never
  bound (`PLAY0268`: allocated, not implemented ESM version), run or rendered
  (`STAGE-ESM-016`); gap-fill with the model as contract (`references/sources-and-streams.md`).

## Edit strategy

- **Discover the capabilities available** (tool, version, `tools/list`, model root) once,
  then prefer typed, identity-preserving MCP operations (`propose-ast`, `propose-rename`,
  `propose-repair`, `propose-extract-inline-event`).
- **Bounded text edits** are for edits that leave catalog addresses unchanged (descriptions,
  rule and expression bodies, mappings between existing members): a small `.play` diff
  followed by V1. Without `.screenplay/identities.json`, plain text edits are fine. Never use a
  text edit to get around an MCP refusal.
- **Catalog-changing edits** belong to the identity owner (the session that owns MCP). When
  `.screenplay/identities.json` exists, adding, removing or renaming an addressed element
  (declarations, properties of commands, events, read models, composite types and triggers,
  queries, query arguments, specifications), moving declarations, creating, deleting, renaming
  or moving a mapped `.play` document (`IdentityMappingConflict`) and persisted event contract
  evolution go through MCP, and `id` pins alone
  are not enough: a session without MCP returns the request to the owning session.
- AST JSON costs several times the text it replaces; use it where a typed operation is the
  only identity-safe route.
- Proposals are connection-local (at most 16); `apply` writes `.screenplay/identities.json`
  and is not crash-atomic; never retry `apply` after `ApplyOutcomeUnknown`. Loop details:
  `cratis-screenplay-model-authoring`.

## Top traps (all 44, with fixes: `references/traps.md`)

1. Clean V1 is not executable: only MCP (V2) or `render` binds.
2. Write `for <identifier>` on every `produces`.
3. PLAY0029 is a warning: validate with warnings as errors.
4. Validate the folder; name the compiler (cli#244, cli#242).
5. Mappings to undeclared projection targets and undeclared events in `remove with`/capture
   `append` pass V1 and fail binding (V2/V3, PLAY0273); a declared read-model property that
   nothing maps is reported by no tool: run V3 and walk field lineage by hand.
6. A reaction's `invokes` has no caller: a gated command rejects it; keep the gate.
7. Read-model identity is one `query XById => RM optional` with `by xId XId`, and the identifier equal to the
   projection's key (see trap 12); never `identifier` on a read model.
8. Projection `key` routes only on `from`; joins never create; `all` is per source.
9. `null` only for optional read-model properties in specifications.
10. `then` events are exhaustive and ordered; after `when append` they list only what followed.
11. Declare an event once, in its producing slice.
12. Quoted `import "glob"` is your own files; unquoted `import Ctx.Event` is a foreign
    contract and does not bind.
13. A handler never binds; `numbers exact` never binds; descriptions are never rendered.

## Gate

Before a verdict leaves this skill: tool and version named; the folder (not a file) was
checked; warnings were treated as errors; each verdict is a result or "not run" with the
reason; blocked verdicts list codes and keep the protection they blocked on.

## Verify

- [ ] The command ran on the folder and its exit status was read, not inferred from output.
- [ ] `screenplay --version` and `cratis --version` were read; `which -a cratis` shows no
      stale copy ahead on `PATH`.
- [ ] Every PLAY0029 and unresolved-name warning is fixed, not silenced.
- [ ] A V3 or render claim names the compiler that bound it.
- [ ] Nothing was removed to pass a verdict.
- [ ] Any new example fence compiles with the standalone tool; unmarked fences also pass
      `cratis screenplay validate --warnings-as-errors`.

## Route near misses

- What to model, phases, gates: `cratis-screenplay-modeling-lifecycle`.
- MCP editing loop, proposals, identities: `cratis-screenplay-model-authoring`.
- Construct depth: `cratis-screenplay-command-surface`, `cratis-screenplay-projections`,
  `cratis-screenplay-read-surface`, `cratis-screenplay-captures-and-reactions`,
  `cratis-screenplay-specifications`, `cratis-screenplay-ui-composition`.
- Rendering and gap-fill: `cratis-screenplay-render-and-gap-fill`,
  `cratis-stage-rendering-and-sandbox`.
- Running systems (Chronicle server operations through the `cratis` CLI, with its authorization boundaries): `cratis-chronicle-cli-operations`.

## Lineage

Attribution and sources: `references/provenance.md`.
