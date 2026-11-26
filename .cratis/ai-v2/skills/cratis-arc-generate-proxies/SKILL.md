---
name: cratis-arc-generate-proxies
description: Use when generating TypeScript command or query proxies from a C# backend or when the proxies are missing or stale after a backend change. Not for consuming a generated hook (use cratis-arc-react-bind-slice).
compatibility: Requires the .NET SDK and a TypeScript frontend with @cratis/arc, @cratis/arc.react and @cratis/fundamentals.
---

# Generate the author contracts

Build the project containing [RegisterAuthor](../cratis-arc-declare-command/SKILL.md) and [AllAuthors](../cratis-arc-expose-query/SKILL.md). `Cratis` includes `Cratis.Arc.ProxyGenerator.Build`; with `Cratis.Arc` alone reference the build package directly.

Add these properties to `Library.csproj`:

```xml
<PropertyGroup>
  <CratisProxiesOutputPath>$(MSBuildProjectDirectory)/generated</CratisProxiesOutputPath>
  <CratisProxiesSegmentsToSkip>1</CratisProxiesSegmentsToSkip>
  <CratisProxiesUseSourceFileAsOutputFile>true</CratisProxiesUseSourceFileAsOutputFile>
  <CratisProxiesSkipCommandNameInRoute>true</CratisProxiesSkipCommandNameInRoute>
</PropertyGroup>
```

Merge this section into the host project's `appsettings.json`, preserving other settings:

```json
{ "Cratis": { "Arc": { "GeneratedApis": { "RoutePrefix": "api", "SegmentsToSkipForRoute": 1, "IncludeCommandNameInRoute": false } } } }
```

1. Run `dotnet build Library.csproj -c Debug` from the project directory. Skipping the `Library` segment keeps `Features/Authors/Listing` and `Features/Authors/Registration` distinct.
2. From the skill directory run `node scripts/check-proxy.mjs /path/to/Library.csproj Features/Authors/Listing/Author.ts AllAuthors`, substituting the absolute backend project path. The file argument is relative to `CratisProxiesOutputPath`.
3. Check the generated `RegisterAuthor` targets `/api/features/authors/registration` and `AllAuthors` targets `/api/features/authors/listing/all-authors`. Compare both with the running host.
4. From a frontend module beside `generated/`, import `{ AllAuthors }` from `./generated/Features/Authors/Listing/Author`. Compile the consuming frontend with `tsc --noEmit`.

## Avoid

- Do not share the output directory between projects. Orphan cleanup deletes outputs no longer produced, even in incremental mode.
- Do not patch a generated type. Edit the C# producer and regenerate.
- Do not leave the output property empty; an empty path produces no proxies.

## Related skills

- [Use the generated query](../cratis-arc-react-bind-slice/SKILL.md)
- [Expose the query](../cratis-arc-expose-query/SKILL.md)
