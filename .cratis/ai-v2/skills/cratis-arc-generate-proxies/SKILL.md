---
name: cratis-arc-generate-proxies
description: Use when backend changes have no matching TypeScript proxy or generated types are stale. Not for consuming generated hooks in React (cratis-arc-react-bind-slice).
compatibility: Requires the .NET SDK, Node.js and the consuming project's TypeScript compiler.
---

# Generate the client from the backend

1. Find the project compiling the command and read model, not the project serving static assets. Locate `CratisProxiesOutputPath` and its relationship to the UI imports. **Done:** one known assembly owns `RegisterAuthor` and `AllAuthors`, and the output directory is dedicated to generated code. If the property is empty the build may succeed without generating anything.
2. Set the generator's route prefix, namespace segments to skip and command-name inclusion to match the running host. Reference `Cratis.Arc.ProxyGenerator.Build` in the owning backend project and run `dotnet build -c Debug` there. **Done:** the generated command has the changed members, and the generated query uses the expected endpoint. Never fix a stale route in the `.ts` output; correct the project or runtime options and regenerate.
3. In the consuming TS project install the locked Arc dependencies and run `npx --no-install tsc --noEmit`. Import both generated classes, assign a typed author ID and name, and include a negative type assertion on a retired member. **Done:** the valid import compiles and the old member still fails type checking. If the generated file exists but the check imports a different one, inspect module resolution before changing the command. Pass the actual output paths, not hand-written lookalikes, to [Bind the slice in React](../cratis-arc-react-bind-slice/SKILL.md).

After building, run `node scripts/check-proxy.mjs /path/to/Catalog.csproj Authors/RegisterAuthor.ts 'class RegisterAuthor'` from the skill directory with the project's actual file and expected changed text. It prints the matching file or reports an empty Debug output setting, missing file or absent contract text.
