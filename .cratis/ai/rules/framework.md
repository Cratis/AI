---
applyTo: "**/*.cs,**/*.ts,**/*.tsx,**/*.go,**/*.kt,**/*.kts,**/*.java,**/*.ex,**/*.exs,**/*.csproj,**/package.json,**/go.mod"
paths:
  - "**/*.cs"
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.go"
  - "**/*.kt"
  - "**/*.kts"
  - "**/*.java"
  - "**/*.ex"
  - "**/*.exs"
  - "**/*.csproj"
  - "**/package.json"
  - "**/go.mod"
profile: framework
---

# Platform sources

This repository is a Cratis library or tool, not an application built on one.

- Match the layout of the area being edited: packages by what they build, not by feature slice. Do not add application commands, read models or slice folders to library source.
- A public type, attribute, wire shape, persisted shape, generated output or CLI option is a contract for every consumer. Find its consumers before changing it; treat a removal, rename or changed result as breaking.
- Run the existing focused check that covers the change. Add or extend a spec only for uncovered public behavior.
- Generators and analyzers ship their output as public surface. Change the generator, not the generated file.

Use the `cratis-platform-contribute-change` skill to locate the contract and its focused check, and `cratis-platform-prepare-release-pr` for the release note and label.

## Platform .NET conventions

Cratis .NET repositories build with SDK 11 (C# 15) and set `LangVersion` to `latest`. Libraries target `net10.0;net11.0`: language-only features work on both, but new .NET 11 runtime or library APIs need `#if NET11_0_OR_GREATER` and a net10 fallback.

- In new code, use extension blocks for new extension APIs, `field` instead of hand-written backing fields, and `System.Threading.Lock` instead of `object` for locks. Leave existing extension classes alone.
- Use collection expression arguments (`[with(capacity: n), .. items]`, `[with(comparer), .. items]`) instead of constructors, and labeled `break`/`continue` instead of flags or `goto` in nested loops (IDE0410).
- Use `closed` only for new internal class hierarchies in .NET 11 code; adding it to an existing public type is breaking. Do not introduce `union` types, runtime-async or the memory-safety preview features.
- SDK 11 reports IDE0001/IDE0002 (simplify names and member access) in the IDE and `dotnet format --verify-no-changes`, not in builds. IDE0370 (unnecessary `!`) also runs in builds when explicitly enabled, for example by `EnforceCodeStyleInBuild` with `dotnet_analyzer_diagnostic.severity = warning`. Keep existing warning-level enforcement and fix its findings.
- IDE0370 analyzes each target separately. Remove each `!` unnecessary on every target. If another target still needs a flagged `!`, a multi-target library may set `dotnet_diagnostic.IDE0370.severity = suggestion` in its own `.editorconfig`, with a tracking issue and a build of all targets. Never use `none` or a shared or global setting; the exception does not apply to net11-only executables.
