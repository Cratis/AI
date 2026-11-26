---
name: cratis-arc-generate-proxies
description: Use when backend changes have no matching TypeScript proxy or generated types are stale. Not for consuming generated hooks in React (cratis-arc-react-bind-slice).
---

# Generate the client from the backend

1. Find the project compiling the command and read model, not the project serving static assets. Locate `CratisProxiesOutputPath` and its relationship to the UI imports. **Done:** one known assembly owns `RegisterAuthor` and `AllAuthors`, and the output directory is dedicated to generated code. If the property is empty the build may succeed without generating anything.
2. Set the generator's route prefix, namespace segments to skip and command-name inclusion to match the running host. Build the project with `dotnet build Catalog.csproj -c Release -warnaserror`. **Done:** generated `Authors/RegisterAuthor.ts` exposes `id` and `name`; `Authors/Author.ts` exports `Author` and `AllAuthors` with the expected endpoint. Never fix a stale route in the `.ts` output; correct the project or runtime options and regenerate.
3. In the consuming TS project install the locked Arc dependencies and run `npm run check` (`tsc --noEmit` in the fixture). Import both generated classes, assign a typed author ID and name, and include a negative type assertion on a retired member. **Done:** the valid import compiles and the old member still fails type checking. If the generated file exists but the check imports a different one, inspect module resolution before changing the command. Pass the actual output paths, not hand-written lookalikes, to `cratis-arc-react-bind-slice`.
