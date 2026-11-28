---
name: cratis-screenplay-author-extension
description: Use when a maintainer needs to create a reusable Screenplay extension package with an ability contract and backend. Not for consuming an existing provider in a translation slice (use cratis-screenplay-model-translation).
compatibility: Requires the Cratis CLI, Cratis extension templates, Bash and the SDK for the selected backend.
---

# Build and check a backend ability

Use a package when several applications need the same integration contract. Keep Library's decision to welcome an author in the model; package the greeting capability, not that business policy. For a UI-only npm package choose `--kind package --component react` instead of a backend extension.

1. From the parent of a new package directory, scaffold the C# backend (.NET 10 SDK for this template):

   ```sh
   cratis extension new -n LibraryGreeting --version 1.9.2 --backend csharp --frontend none --publisher example --no-prompts
   cd LibraryGreeting
   ```

2. Read `contract.play` first. The template targets `net10.0`. Its contract declares `requires stage "^5"`, but the generated `Cratis.Stage.Extensions` package reference uses `Version="*"` and can restore 6.x. In `src/backend-csharp/LibraryGreeting/LibraryGreeting.csproj`, replace `*` with `5.30.0` before building. Its generated sample declares `setting greeting public` and `ability Greet safe`, with `name String` input and a returned `message String`. Its manifest names the runtime, assembly, assets and host requirements. Use a compatible host such as Stage 5.30.0, not the Stage 6 renderer host. Don't widen the range without proving compatibility. Never put credentials in the public greeting setting.
3. Keep `src/backend-csharp/LibraryGreeting/Program.cs` and the contract in agreement. The sample registers `Greet` with `EffectClass.Safe`; `Greeter.Greet` takes the resolved greeting and JSON input. For `{"name":"Aster"}` and no setting it returns the message `Hello, Aster!`. A blank name yields `NotSent` because no effect occurred. Don't reuse that outcome for a side effect whose completion is unknown. Change the contract, registration, handler and specifications together when replacing this sample.
4. From the package root, run the generated specifications, build the backend and lay out the files exactly as they ship. Treat `backend/` and `dist/extension/` as build outputs: packaging replaces `dist/extension/`, so keep hand-edited files in source.

   ```sh
   bash scripts/test.sh
   bash scripts/build.sh
   bash scripts/package.sh
   cratis extension verify dist/extension -o json
   ```

   Verify `contract`, `manifest` and `contents` passed. `EXTV020` means the declared backend is missing: compare its path and filename with the packaged assembly, not the source tree. Verification doesn't execute the backend; a skipped handshake (`EXTV070`) is not a pass and fails `--strict`. Before using the package, load it in a compatible Stage host and exercise the named ability against its returned message. Packaging and verification don't publish anything. For adding a released package to a model, [consume it from a reviewed lock](references/consume.md).
