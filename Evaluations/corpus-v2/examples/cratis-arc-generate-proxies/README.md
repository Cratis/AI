# Authors proxy input

From this directory, use the .NET 11 SDK, npm and access to the pinned NuGet and npm packages. Generation needs neither Chronicle nor MongoDB running.

```sh
dotnet build Catalog.csproj -c Release -warnaserror
npm ci
npm run test:example
```

`Authors/RegisterAuthor.cs` owns `[Command] RegisterAuthor(AuthorId Id, string Name)`, the event-returning handler and blank-name validation. `Authors/Author.cs` owns the read row and the observable `AllAuthors` query. The build generates `generated/Authors/RegisterAuthor.ts` and `generated/Authors/Author.ts`; the latter exports both `Author` and `AllAuthors`. The UI takes `id: Guid` and `name: string` from these contracts; the list key is `author.id.toString()`. Do not substitute a handwritten hook while awaiting generation. `contract.ts` checks both the real import and rejection of a nonexistent field. The route test expects `/api/authors` and `/api/authors/all-authors`.

Running the host for a live UI journey is a separate check. Provide an isolated Chronicle store and change-stream-capable MongoDB read-model sink for the same database, plus a verified catalog-editor identity. The host intentionally contains no test authentication bypass or seeded principal. The in-memory host under `../cratis-arc-host-application/Host` is only for transport diagnostics, not the Chronicle-backed UI journey.
