# Generate the author contracts

For an event-sourced command and a live page, [deliver the whole slice](../../cratis-platform-deliver-slice/SKILL.md): generate after the event has a projection and the view has a query. A command proxy alone cannot update the list.

Build the project containing [RegisterAuthor](../../cratis-arc-declare-command/SKILL.md) and [AllAuthors](../../cratis-arc-expose-query/SKILL.md). `Cratis` includes `Cratis.Arc.ProxyGenerator.Build`; with `Cratis.Arc` alone reference the build package directly.

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

## When it goes off the usual path

- **Imports still name a renamed endpoint:** check the old file's generated marker, the configured output root, and the consuming barrel. Regenerate from the owning project, update imports, then compile the consumer. Do not restore the obsolete proxy.

## Avoid

- Use one output tree per independent generator and keep handwritten files and public barrels outside it. Each generation run deletes generated-marked files that the current endpoints no longer produce. By default it does not wipe the whole directory first; setting `CratisProxiesSkipOutputDeletion` to `false` makes it do so.
- Do not patch a generated type. Edit the C# producer and regenerate.
- Do not leave the output property empty; an empty path produces no proxies.

## Related skills

- [Use the generated query](../../cratis-arc-react-bind-slice/SKILL.md)
- [Expose the query](../../cratis-arc-expose-query/SKILL.md)

## Compare the route on both sides

Match `CratisProxiesApiPrefix` to `GeneratedApis:RoutePrefix` and `CratisProxiesSegmentsToSkip` to `GeneratedApis:SegmentsToSkipForRoute`. The two `CratisProxiesSkipCommandNameInRoute` / `CratisProxiesSkipQueryNameInRoute` build flags are **inverses** of the corresponding runtime `IncludeCommandNameInRoute` / `IncludeQueryNameInRoute`. A reverse proxy path base precedes the generated route, not part of its namespace. Inspect one generated URL and call the deployed route. A clean build proves generation, not mapping.

Local validation only checks what the client knows. Remote validation exercises the server rules but is not a command execution. If the contract changed, regenerate from the producer and recompile the consumer rather than adjusting a stale client's local rules.
