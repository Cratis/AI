# Connect the writer and reader to the same store

Register the typed model with `builder.add(TaskQueries).withMongoDB({ readModels: [TaskRecord] })` after importing `@cratis/arc.mongodb`. Use the host configuration for the server and database. A model omitted from `readModels` has no injectable collection token. Bind the query dependency to that model's `MongoCollection<TaskRecord>`, not an application-wide collection from a driver singleton.

For a relational application use its Drizzle integration instead; do not mix Mongo collection tokens into the SQL query. Write one task under tenant A and perform the query as A and B. A successful connection alone proves neither collection naming nor tenancy. Mongo observation additionally needs change streams; test a second write after the subscription opens.

For Drizzle use `withDrizzle`, then `drizzleReadModel` for the mapped SQL model in a query. Verify the provider route against the migrated table; a Mongo change-stream check does not exercise a SQL observer.
