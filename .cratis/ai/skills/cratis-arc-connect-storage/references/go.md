# Connect the writer and reader to the same store

Create a typed binding with `mongodb.NewCollection[Author](client, options)` from the Mongo integration. Handle the returned error during composition; a borrowed driver client remains owned by the host. Resolve operations using the checked request scope rather than replacing the tenant with a process-wide default.

Have a scoped query fetch a known inserted author. Verify its ID and database, repeat under another tenant and confirm the first value does not leak. Test watching separately on a deployment that supports change streams.
