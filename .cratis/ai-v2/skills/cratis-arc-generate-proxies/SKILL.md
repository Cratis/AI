---
name: cratis-arc-generate-proxies
description: Generates TypeScript contracts from the backend project. Use when author proxies are missing or stale after a C# change. Not for consuming a generated hook (use cratis-arc-react-bind-slice).
compatibility: Requires the .NET SDK and a TypeScript frontend with @cratis/arc, @cratis/arc.react and @cratis/fundamentals.
---

# Generate the author contracts

Build the project containing [RegisterAuthor](../cratis-arc-declare-command/SKILL.md) and [Author](../cratis-arc-expose-query/SKILL.md). The `Cratis` package includes `Cratis.Arc.ProxyGenerator.Build`; a backend using only `Cratis.Arc` needs a direct reference to the build package.

Add these properties to `Catalog.csproj`:

```xml
<PropertyGroup>
  <CratisProxiesOutputPath>$(MSBuildProjectDirectory)/generated</CratisProxiesOutputPath>
  <CratisProxiesSegmentsToSkip>1</CratisProxiesSegmentsToSkip>
  <CratisProxiesUseSourceFileAsOutputFile>true</CratisProxiesUseSourceFileAsOutputFile>
  <CratisProxiesSkipCommandNameInRoute>true</CratisProxiesSkipCommandNameInRoute>
</PropertyGroup>
```

These properties assume the Library host's `appsettings.json` has `Cratis:Arc:GeneratedApis:RoutePrefix` set to `api`, `SegmentsToSkipForRoute` to `1` and `IncludeCommandNameInRoute` to `false` in the same section. Match the generator to the host: `RegisterAuthor` uses `/api/authors`; `AllAuthors` reads `/api/authors/all-authors`.

1. From the backend project directory run `dotnet build Catalog.csproj -c Debug`. An empty output path writes nothing.
2. Open `generated/Authors/Author.ts`. Skipping the root segment of `Catalog.Authors` leaves `Authors`; the source filename groups `Author` and `AllAuthors` in `Author.ts`.
3. Import `{ AllAuthors }` from `./generated/Authors/Author` in a frontend module next to `generated`. After changing a C# member, rebuild the backend and run `tsc --noEmit` in the frontend.

## Avoid

- Do not share the output directory between projects. Each generator can delete files it no longer produces, even in incremental mode.
- Do not patch a generated contract or copy it by hand. Edit C# and build again.
- Do not guess the output path. Inspect `dotnet msbuild Catalog.csproj -getProperty:CratisProxiesOutputPath`; `scripts/check-proxy.mjs` can also check a generated member.

## Related skills

- [Use the generated query](../cratis-arc-react-bind-slice/SKILL.md)
- [Expose the query](../cratis-arc-expose-query/SKILL.md)
