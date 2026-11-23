# pvanalyze install

## Contents

- [Preflight](#preflight)
- [Restore into an owned directory](#restore-into-an-owned-directory)
- [Run and verify](#run-and-verify)
- [Stop conditions](#stop-conditions)

The tool version is pinned by [assets/dotnet-tools.json](../assets/dotnet-tools.json), a standard local tool manifest. [assets/NuGet.Config](../assets/NuGet.Config) clears every other package source and allows only nuget.org. Do not install the tool globally, run it through a floating `dnx` call, build it from source, or run a downloaded script. Restore only after the operator approves downloading from nuget.org.

## Preflight

The published tool runs on the .NET 10 runtime. A .NET 11 SDK alone is not enough, and major-version roll-forward is not a workaround.

```bash
dotnet --list-runtimes
```

Require a `Microsoft.NETCore.App 10.x` line. If it is missing, stop and report the prerequisite gap; installing a runtime is a separate operator decision.

## Restore into an owned directory

Use a directory created for this task. Never replace an existing tool manifest or NuGet configuration: if the directory already has `.config/dotnet-tools.json`, choose another directory.

```bash
mkdir -p <task-dir>/.config
cp <skill-dir>/assets/dotnet-tools.json <task-dir>/.config/dotnet-tools.json
cp <skill-dir>/assets/NuGet.Config <task-dir>/.config/NuGet.Config
cd <task-dir>
dotnet tool restore --tool-manifest .config/dotnet-tools.json --configfile .config/NuGet.Config
```

## Run and verify

Run from the task directory so the local manifest resolves:

```bash
dotnet tool list --local
dotnet tool run pvanalyze -- --help
dotnet tool run pvanalyze -- info --help
```

`dotnet tool list --local` shows the installed version, which must match the manifest. Copy the trace into the task directory (or another owned directory) before running analysis commands, because parsing writes cache files beside it.

## Stop conditions

- No Microsoft.NETCore.App 10.x runtime: report it and stop.
- Restore needs a source other than nuget.org, credentials or a different package version: stop and ask.
- A command in [commands.md](commands.md) is missing from `--help` for the restored version: do not upgrade the pin automatically; drop that command from the plan and report it.
