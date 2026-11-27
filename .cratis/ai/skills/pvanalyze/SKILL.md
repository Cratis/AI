---
name: pvanalyze
description: Use when an existing .nettrace file needs offline GC, JIT, CPU stack, allocation, exception or call-tree analysis from the command line. Not for collecting traces, live processes or memory dumps.
license: MIT
compatibility: Requires the Microsoft.NETCore.App 10.x runtime, checked with `dotnet --list-runtimes`; a .NET 11 SDK alone is not enough. Some commands need traces collected with allocation, DATAS or verbose runtime events.
---

<!-- Modified by Cratis from Managed Code's original (MIT): frontmatter, install, scope and the changes listed in NOTICE. Upstream: https://github.com/managedcode/dotnet-skills (catalog/Tools/pvanalyze/skills/pvanalyze/SKILL.md; see NOTICE) -->

# pvanalyze

Cratis rules in `.cratis/ai/rules/` and the `cratis-*` skills win where they differ. `pvanalyze` reads `.nettrace` files that already exist. Collecting a trace, attaching to a process, installing a profiler and capturing dumps belong to the `profiling`, `dotnet-trace-collect` and `dump-collect` skills, with explicit approval; never make them the default first step of an analysis.

## Install

Read [references/install.md](references/install.md) before the first run. It explains the preflight (`dotnet --list-runtimes` must show Microsoft.NETCore.App 10.x), the approved nuget.org-only restore into an owned directory and the stop conditions. Copy these two assets into that directory's `.config/` as install.md describes:

- [assets/dotnet-tools.json](assets/dotnet-tools.json) holds the exact tool pin; use it as the only source of the version.
- [assets/NuGet.Config](assets/NuGet.Config) limits restore to nuget.org.

Run commands as `dotnet tool run pvanalyze -- <arguments>` from that directory. Do not install globally, use floating `dnx`, build from source or overwrite an existing manifest.

## Workflow

1. Confirm the trace path and whether it was collected with the events the question needs.
2. Copy the trace into an owned directory. Parsing writes a sibling `.pvanalyze.etlx` cache, so never analyze a trace in a directory you do not own.
3. Run `pvanalyze info <trace>` first to verify the file opens and contains the expected processes. Use `events --list` to see what was collected.
4. Pick one focused command and bound its output:
   - `gcstats` for GC count, heap size and pause questions
   - `alloc` for allocation by type
   - `datas` for Dynamic Adaptation To Application Sizes heap-count tuning
   - `jitstats` for JIT compilation cost
   - `cpustacks` for top CPU methods, module or namespace grouping and SpeedScope export
   - `calltree` for hot paths and caller/callee exploration
   - `events` and `exceptions` for provider, event type, payload, PID, TID or thrown-exception filtering
   - `timeline` and `snapshot` for time-bucketed or point-in-time context
5. Prefer `--format json` when another tool consumes the output, and add `--from`/`--to` only after a baseline run shows the interesting window.
6. Report the command, process, window and filters used, plus generated files such as a `.speedscope.json`.

Read [references/commands.md](references/commands.md) for the options of each command, and [references/overview.md](references/overview.md) for trace prerequisites and when to choose a different skill.

## Constraints

- A signal absent from the trace makes the result inconclusive. An empty `alloc`, `datas`, `exceptions` or `cpustacks` result is not evidence of zero allocations, no exceptions or no CPU time; check `events --list` and say what to recollect.
- Treat unexpected, empty or partially parsed output as inconclusive. The tool reading a trace does not prove it understands every runtime event.
- Run `clean` only on the owned copy. It removes `.pvanalyze.etlx` cache files.
- Analysis does not authorize editing product code; report findings and let the task decide the change.
- Static allocation review of source code and microbenchmarks belong to other skills.

## Validate

- `dotnet tool list --local` shows the version in the manifest, and `pvanalyze --help` and `info --help` run.
- `pvanalyze info <trace>` reads the trace before deeper analysis starts.
- JSON output parses when `--format json` is used.
