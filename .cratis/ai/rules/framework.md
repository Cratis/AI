---
applyTo: "Source/**/*.cs, Source/**/*.ts, Source/**/*.tsx, Source/**/*.csproj, Source/**/package.json"
paths:
  - "Source/**/*.cs"
  - "Source/**/*.ts"
  - "Source/**/*.tsx"
  - "Source/**/*.csproj"
  - "Source/**/package.json"
profile: framework
---

# Platform sources

This repository is a Cratis library or tool, not an application built on one.

- Match the layout of the area being edited: packages by what they build, not by feature slice. Do not add application commands, read models or slice folders to library source.
- A public type, attribute, wire shape, persisted shape, generated output or CLI option is a contract for every consumer. Find its consumers before changing it; treat a removal, rename or changed result as breaking.
- Generators and analyzers ship their output as public surface. Change the generator, not the generated file.

Use the `cratis-platform-contribute-change` skill to locate the contract and its focused check, and `cratis-platform-prepare-release-pr` for the release note and label.
