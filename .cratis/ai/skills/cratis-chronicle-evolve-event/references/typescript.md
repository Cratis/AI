# Register the Node target/source pair

Keep the same `@eventType(id, 1)` and `@eventType(id, 2)` identity across the two classes. Use `@eventTypeMigration(AuthorRegistered, AuthorRegisteredV1)` on `IEventTypeMigration<AuthorRegistered, AuthorRegisteredV1>`. In `upcast` map the old fields to new ones with `builder.properties(...)`; in `downcast` the builder types reverse. When splitting a name, include a value with missing or extra separators in the fixture instead of assuming two tokens reconstruct the original.
