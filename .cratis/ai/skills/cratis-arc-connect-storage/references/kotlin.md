# Connect the writer and reader to the same store

For a document writer choose Spring Data MongoDB; for a relational writer choose JPA. Register the repository in the Spring host and resolve it inside the operation's checked tenant scope. Map the document collection or entity table to the one the writer actually populates: a Kotlin type name is not evidence of a collection name.

Persist a known ID through the application, read it through the repository and repeat under a second tenant. If a projected collection must change name, build the new collection by replay, compare its contents, then switch readers. Renaming the mapping alone strands existing documents.
