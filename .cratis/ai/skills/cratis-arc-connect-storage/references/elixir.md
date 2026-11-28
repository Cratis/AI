# Connect the writer and reader to the same store

Configure `mongodb: [server: ..., database: ..., naming_policy: :camel_case]` on the Arc application, obtaining credentials from deployment configuration. Start `{Cratis.Arc.MongoDB, application: MyApp.Arc}` **after** `MyApp.Arc` in the supervision tree. The configured database serves the default tenant; check the named tenant's resolved database separately.

Use atom keys for struct field filters and string keys for raw Mongo field names. Treat `{:error, :duplicate}` as a refused write, not a successful update. For distributed tenants, `connection_resolution` selects connection placement and credentials per tenant; do not forward a caller's OIDC token as a database credential. Write and read one scoped document before testing change streams on a replica set or sharded cluster.
