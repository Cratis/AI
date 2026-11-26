# Hand off Library author registration

`accepted.esm.json` is the export of `model` scoped to `Library.Authors.RegisterAuthor`. `registration-example.json` records its revision, input, result and dependent `Library.Authors.ListAuthors` slice. Run `screenplay export model` for the full revision. The listing specification belongs to the dependency, not the excerpt.

Install the fixture's Playwright and Chromium. Supply `AUTHORS_TARGET_ADAPTER` as the file URL of a trusted module exporting async `startIsolatedAuthors({revision,authorId})`. It starts an authorized, disposable Library host and returns a loopback `authorsUrl`, `editorStorageState` for the librarian, and async `close()`. Run `npm run test:journey`. It verifies the registration export before driving the shared application journey. Without the host the journey cannot run. Run the backend refusal spec separately: disabled submission is not proof of backend validation.
