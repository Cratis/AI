# Provenance

## Origin

This skill is an original Cratis work, condensed from verified research on the Screenplay
language, the standalone tool, the cratis CLI and Stage, then re-verified against product
source at the tags in `versions.md` and probed on the installed tools (Screenplay 4.64.0 and
cratis 3.27.1). Every version, diagnostic and exit-code row cites its evidence there or in
the file that holds it.

## External material

| Source | Use | Licence handling |
| --- | --- | --- |
| TrogonStack/agentskills `7b249d3ee42d8b7e11fa564141ebd5fbc37aadf1` (MIT, Copyright (c) 2025 Straw Hat, LLC) | none: no passage of this skill is adapted from it | no third-party notice needed in `LICENSE` |
| idea from Nebulit-GmbH/agentic-engineer@07b0f30:`.claude/skills/connect/SKILL.md`, written independently | resolve the tool connection once per session and reuse it until something changes (Ground rule 8, `references/verdicts.md` V2 start-up) | no text reused; repository has no licence |
| idea from Nebulit-GmbH/agentic-engineer@07b0f30:`.claude/skills/load-slice/SKILL.md`, written independently | scoped, identity-first reads instead of loading the whole model | no text reused |
| idea from Nebulit-GmbH/agentic-engineer@07b0f30:`.claude/skills/learn-eventmodelers-api/SKILL.md`, written independently | load tool reference on demand; "let the tool resolve what it can" (Ground rule 8) | no text reused |

## Sources read for facts

- Screenplay `v4.64.0` (`7e16162`): `Documentation/screenplay/` (grammar, commands, queries,
  specifications, reactions, diagnostics, mcp), `decisions/0017`, `0020`, `0022` to `0024`,
  `Source/DotNET/Screenplay/Semantics/` (binder, versions, execution),
  `Source/DotNET/Screenplay.Mcp/` (connection, catalog, schemas, workspaces, visualization),
  `Source/DotNET/Tool/Program.cs`. Also `v4.60.1` and `v4.63.1` for the bundled-compiler and
  cascade differences.
- Stage `v4.24.0` (`fa48546`): `Source/Rendering.Cratis/` (surface ledger, planner, pure
  transition admission, scaffold), `Documentation/guides/customize-rendered-application.md`.
- cratis `v3.27.1` (`a327e89`): `Source/Cli/Commands/Render/`, `ScreenplayMcpRoot.cs`,
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
- Re-checked every documentation contradiction at v4.64.0; resolved the clock boundary and the
  ESM v7 and v11 allocations; added numbers-exact, concurrency, approval-policy, visualization,
  bodied-reducer, file-mode and cascade rows.
- Corrected the code-attachment rule (a handler never binds, with or without `hint`), the
  automation rendering rule (Stage renders no Automation or Translate slices) and the
  Stage output description (a React/Vite scaffold is emitted too).
- Verdict names follow the frozen V1 to V5 (V2 is executable diagnostics, V3 binding-ready);
  the earlier "authoring accepted" meaning of V2 was dropped because it proves only that the
  source compiled.
