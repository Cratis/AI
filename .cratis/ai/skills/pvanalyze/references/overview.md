# pvanalyze overview

## Contents

- [What the tool is](#what-the-tool-is)
- [When to choose pvanalyze](#when-to-choose-pvanalyze)
- [Trace prerequisites](#trace-prerequisites)
- [Operational notes](#operational-notes)

## What the tool is

`pvanalyze` is a command-line analyzer for .NET `.nettrace` files. It runs on macOS, Linux and Windows without the PerfView GUI and prints text, JSON or SpeedScope output. It reads traces with `Microsoft.Diagnostics.Tracing.TraceEvent` and caches a converted copy as a sibling `.pvanalyze.etlx` file for repeated reads.

Upstream project: <https://github.com/adityamandaleeka/pvanalyze>. `pvanalyze --help` and each command's `--help` list the options of the pinned version; trust them over any prose here.

## When to choose pvanalyze

Choose `pvanalyze` when:

- a `.nettrace` file already exists
- the answer should be terminal, JSON or SpeedScope output
- the workflow runs on a platform without the PerfView GUI, in scripts, in CI or by an agent

Choose the `profiling` or `dotnet-trace-collect` skills when the task is process discovery, live counters, provider selection or collecting the trace. Use dump skills for crash dumps; `pvanalyze` does not read dumps.

## Trace prerequisites

A command can only report what the trace contains:

- `alloc` needs allocation events in the runtime provider at verbose level.
- `datas` needs DATAS events, available on .NET 9 or later, with verbose GC runtime events.
- `cpustacks` and `calltree` need CPU sample events.
- `exceptions` needs exception events.

Use `events --list` to see what was collected before drawing a conclusion. A missing signal makes a result inconclusive; it never shows that the activity did not happen. The tool reading a trace does not guarantee it parses every runtime event of every runtime release; report unexpected or empty output as inconclusive rather than as a finding.

## Operational notes

- Keep the original `.nettrace`: replay cannot recreate events that were never collected.
- Work on a copy in an owned directory, because parsing writes `.pvanalyze.etlx` and lock files beside the input.
- Prefer `--format json` when another tool consumes the output, and `cpustacks --format speedscope --output <file>` for flame graph viewers.
