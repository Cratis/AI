---
name: migrate-dotnet10-to-dotnet11
description: Use when moving a .NET 10 project or solution to the .NET 11 SDK or adding a net11.0 target, or when a build or behavior change appears after that move. Not for new .NET 11 projects, other version upgrades or .NET Framework migrations.
license: MIT
---

<!-- Modified by Cratis from dotnet's original (MIT): frontmatter, scope, workflow and the changes listed in NOTICE. Upstream: https://github.com/dotnet/skills (plugins/dotnet-upgrade/skills/migrate-dotnet10-to-dotnet11/SKILL.md; see NOTICE) -->

# .NET 10 → .NET 11 migration

Cratis rules in `.cratis/ai/rules/` (including `csharp.md`) and the `cratis-*` skills win where they differ. This skill is a checklist of known breaking changes, not the exhaustive .NET 11 compatibility contract: confirm each change against the linked Microsoft compatibility page before teaching or applying a fix, and report contradictions instead of guessing.

## Scope

- Use for upgrading a repository's SDK, retargeting to `net11.0`, or diagnosing build errors and behavior changes after either.
- Do not use for greenfield projects, upgrades from .NET 9 or earlier, .NET Framework migrations, or cosmetic modernization unrelated to the upgrade.
- Distinguish the SDK and compiler version from the runtime target. A .NET 11 SDK (C# 15) can build `net10.0` targets; libraries that multi-target `net10.0;net11.0` keep both. Drop `net10.0` only when the repository's support policy says so.
- Follow the C# 14/15 feature guidance in the `csharp` rule instead of adopting language features here. In particular, no new public union types in libraries that also target `net10.0`, no `closed` on existing public types, and no runtime-async.
- Keep the repository's approved SDK pin (`global.json`) and package pins. With Central Package Management, change `Directory.Packages.props` only where the approved upgrade scope requires it.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| Project or solution path | Yes | The `.csproj`, `.sln` or `.slnx` entry point to migrate |
| Build and test commands | No | The repository's gate commands; detect them from its guidance when not given |
| Technology areas | No | ASP.NET Core, EF Core, cryptography, containers; detect from SDK attributes and package references |

## Workflow

### Step 1: Assess

1. Find how the repository builds and tests, and which gates CI runs.
2. Run `dotnet --version` to confirm the approved SDK is installed. Stop and report if it is not; do not install one.
3. Identify the technology areas from the project:
   - `Microsoft.NET.Sdk.Web` → ASP.NET Core; `Microsoft.EntityFrameworkCore.*` → EF Core.
   - Cryptography, mTLS or macOS usage → cryptography reference.
   - Compression, TAR or `NamedPipeClientStream` usage → core-libraries reference.
   - `BackgroundService` usage → an exception from `ExecuteAsync` now makes `RunAsync`/`Run` throw, so the process exits non-zero (the host already stopped before).
   - Dockerfiles, CI SDK versions, old hardware or NativeAOT → runtime and SDK references.
4. Establish a baseline with the repository's normal build on the current target, and record pre-existing warnings. Do not delete `bin`/`obj` unless the repository's guidance allows it.

### Step 2: Update targets within the approved scope

1. Where the upgrade scope includes the runtime target, add `net11.0` (`<TargetFrameworks>net10.0;net11.0</TargetFrameworks>` for libraries) or retarget applications. Keep `net10.0` in multi-targeted libraries.
2. Update Microsoft package versions only as far as the approved scope requires, in the existing central location.
3. Restore and build with the repository's commands. Capture all errors and warnings.

### Step 3: Resolve build errors

Read only the references that match the technology areas and the actual errors:

| Reference | Read when |
|-----------|-----------|
| [csharp-compiler-dotnet10to11.md](references/csharp-compiler-dotnet10to11.md) | A C# compiler error or warning appears after the SDK or target change |
| [core-libraries-dotnet10to11.md](references/core-libraries-dotnet10to11.md) | Code uses compression, TAR, `MemoryStream`, `NamedPipeClientStream`, `BackgroundService`, `Environment.TickCount` or the Japanese calendar |
| [sdk-msbuild-dotnet10to11.md](references/sdk-msbuild-dotnet10to11.md) | A restore, publish, pack or MSBuild warning appears, or CI and SDK settings change |
| [aspnetcore-dotnet10to11.md](references/aspnetcore-dotnet10to11.md) | The project uses ASP.NET Core OpenAPI or Blazor |
| [efcore-dotnet10to11.md](references/efcore-dotnet10to11.md) | The project uses Entity Framework Core, Cosmos DB or SQL Server |
| [cryptography-dotnet10to11.md](references/cryptography-dotnet10to11.md) | The project uses cryptography APIs, client certificates or runs on macOS |
| [runtime-jit-dotnet10to11.md](references/runtime-jit-dotnet10to11.md) | Deployment targets include older hardware, embedded devices or NativeAOT |

For each error, find the matching entry, confirm on the linked Microsoft page that it applies to the SDK and target in use, and apply the smallest documented fix. A change the references do not list is not proof the change is absent.

### Step 4: Review behavioral changes

Behavioral changes compile but change runtime results. Use the references to decide which apply to the code, and cover each applicable one with a test or an explicit decision:

- Compression, ZIP and TAR reading and writing behavior.
- `MemoryStream` capacity and exception types.
- `BackgroundService` exceptions that now propagate from `RunAsync` and change the exit code.
- Client certificate chain validation and cryptography availability by platform.
- EF Core provider behavior, including Cosmos DB async-only I/O.
- Hardware minimums and NativeAOT output names for the deployment targets.

### Step 5: Update infrastructure within scope

1. Dockerfiles and CI: change SDK or image tags only as far as the approved upgrade scope requires, using the repository's tag convention.
2. `global.json`: edit the existing file and preserve other keys such as `rollForward`; use the SDK version the repository approves.
3. Verify deployment targets meet the hardware requirements in the runtime reference.

### Step 6: Verify

1. Run the repository's full gates: build, tests and any CI checks for the changed projects.
2. Build and test container images when the repository ships them.
3. A clean build does not finish an upgrade. Run behavioral tests for the applicable changes from Step 4 and review the diff for unintended behavior changes.
4. Report which references were consulted, which Microsoft pages confirmed applicability, and which gates were run.

## Pitfalls

| Pitfall | Correction |
|---------|------------|
| Dropping `net10.0` because the SDK is 11 | The SDK version is not the target; keep supported targets |
| Upgrading every Microsoft package to 11.x | Change only pinned versions the approved scope requires |
| Treating the bundled references as complete | They are a starting checklist; verify against Microsoft documentation |
| Declaring done after a clean build | Run behavioral tests and CI gates |
| Adopting C# 15 features during the migration | Follow `csharp.md`; migration is not a feature change |
