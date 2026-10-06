# Provenance

## Origin

This skill is an original Cratis work, condensed from verified research on the Screenplay
language, the standalone tool, the cratis CLI and Stage, then re-verified against product
source at the tags in `versions.md` and probed on the installed tools (Screenplay 4.66.0 and
cratis 3.28.2). Every version, diagnostic and exit-code row cites its evidence there or in
the file that holds it.

## External material

| Source | Use | Licence handling |
| --- | --- | --- |
| TrogonStack/agentskills `7b249d3ee42d8b7e11fa564141ebd5fbc37aadf1` (MIT, Copyright (c) 2025 Straw Hat, LLC) | none: no passage of this skill is adapted from it | no third-party notice needed in `LICENSE` |

## Adapted closely (Martin Dilger and Nebulit GmbH, with agreement)

Source: https://github.com/Nebulit-GmbH/agentic-engineer at commit `07b0f30648d663cb588d7e2c7aa031af9dfc21f2`,
by Martin Dilger and Nebulit GmbH (https://nebulit.de). The repository carries no licence file; this material
is adapted with the agreement of Martin Dilger and Nebulit GmbH.

| Source file | Used in | How |
|---|---|---|
| `.claude/skills/connect/SKILL.md`: resolve the connection once per session, reuse it, re-resolve only when a value actually needs to change | `SKILL.md` "Ground rules" 8, `references/verdicts.md` V2 start-up | Now adapted closely; board token/config prompts not adopted, translated to tool, version and model root |
| `.claude/skills/load-slice/SKILL.md`: scoped, identity-first reads instead of loading everything | `SKILL.md` "Edit strategy" | Idea; our own wording kept |
| `.claude/skills/learn-eventmodelers-api/SKILL.md`: load the tool reference on demand; prefer the typed tool over raw calls | `SKILL.md` "Ground rules" 8, "Edit strategy" | Idea; our own wording kept; the 934-line API catalog has no Screenplay equivalent to adopt |

## Sources read for facts

- Screenplay `v4.66.0` (`c89198b`): `Documentation/screenplay/` (grammar, commands, queries,
  specifications, reactions, diagnostics, mcp), `decisions/0017`, `0020`, `0022` to `0024`,
  `Source/DotNET/Screenplay/Semantics/` (binder, versions, execution),
  `Source/DotNET/Screenplay.Mcp/` (connection, catalog, schemas, workspaces, visualization),
  `Source/DotNET/Tool/Program.cs`. Also `v4.60.1` and `v4.63.1` for the differences from the compiler bundled in cratis 3.27.1
  and earlier.
- Stage `v4.24.0` (`fa48546`, unchanged in `Rendering.Cratis` admission at `v4.24.1`): `Source/Rendering.Cratis/` (surface ledger, planner, pure
  transition admission, scaffold), `Documentation/guides/customize-rendered-application.md`.
- cratis `v3.28.2` (`141c499`; `Render/`, `Run/`, `Prologue/` and `Screenplay/Generate*` are unchanged since `v3.27.1`, `a327e89`): `Source/Cli/Commands/Render/`, `ScreenplayMcpRoot.cs`,
  `Documentation/reference/screenplay.md`.
- Arc `v22.50.5` and Chronicle `v19.32.0` for the code-level facts cited in `versions.md`.
- Open issues cited as limits: cli#242, #243, #244, #245; Screenplay#377, #379, #383, #384,
  #388; Stage#79, #165, #178, #197; Chronicle#3744, #4123, #4131.

## Changes from the earlier toolkit

- Folded the version facts into one `versions.md` (the only version table in the corpus).
- Replaced the readiness script with the MCP view and field that carry the same result; no
  script ships.
- Moved the MCP loop to `cratis-screenplay-model-authoring`; this skill keeps only the facts
  needed to run a verdict and the edit strategy summary.
- Re-checked every documentation contradiction at v4.66.0; resolved the clock boundary and the
  ESM v7 and v11 allocations; added numbers-exact, concurrency, approval-policy, visualization,
  bodied-reducer, file-mode and cascade rows.
- Corrected the code-attachment rule (a handler never binds, with or without `hint`), the
  automation rendering rule (Stage renders no Automation or Translate slices) and the
  Stage output description (a React/Vite scaffold is emitted too).
- Verdict names follow the frozen V1 to V5 (V2 is executable diagnostics, V3 binding-ready);
  the earlier "authoring accepted" meaning of V2 was dropped because it proves only that the
  source compiled.
