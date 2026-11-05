---
name: cratis-arc-storage-typescript
description: Use when an Arc Node.js server must read or observe read models in MongoDB or a SQL database through Drizzle. Not for Chronicle projections, query method design or the C# EF Core and MongoDB integrations.
license: MIT
---

# MongoDB and SQL storage for an Arc Node.js server

Two optional packages connect read models to a database. Importing the package
adds its method to the builder. Both pick the database from the resolved tenant
(see `cratis-arc-tenancy-typescript`), never from a query argument, and both
need the model's `@field` declarations.

| Package | Builder method | Peer | Use for |
| --- | --- | --- | --- |
| `@cratis/arc.mongodb` | `withMongoDB` | `mongodb` `^6.21.0` | documents, change-stream observation |
| `@cratis/arc.drizzle` | `withDrizzle` | `drizzle-orm` `^0.45.0`, `rxjs` | PostgreSQL, MySQL, SQLite tables |

Query methods, argument binding and observable queries are in
`cratis-arc-query-typescript`; this skill covers the storage side.

## MongoDB

```typescript
import { field, Guid } from '@cratis/fundamentals';
import { key, query, queryOptions, readModel, service, type QueryOptions } from '@cratis/arc.core';
import { mongoCollection, type MongoCollection } from '@cratis/arc.mongodb';

export class TaskRecord {
    @field(Guid) @key() id!: Guid;
    @field(String) title!: string;
}
const tasks = mongoCollection(TaskRecord);

@readModel()
export class TaskQueries {
    @query(service(tasks), queryOptions())
    static page(items: MongoCollection<TaskRecord>, options: QueryOptions) {
        return items.queryPage({}, options);
    }
}
// builder.add(TaskQueries).withMongoDB({ client, database: 'tasks', readModels: [TaskRecord] });
```

- `@key()` marks the field stored as `_id`; without it a field named `id` is
  used; a model with neither, or with several keys, is rejected. Only `@field`
  properties are read and written.
- List every injected model in `readModels`. `mongoCollection(Type)` resolves to
  the collection in the current tenant's database.
- Options: `client` or `server` (URI), `database` (default; other tenants use
  `<database>+<tenantId>`), `databaseNameResolver(tenant, context)`,
  `serverResolver`, `namingPolicy`, `collectionName(model)`,
  `ignoreConventions`, `maxObservableItems` (1000), `maxPageSize` (100, at most
  10 000). `withMongoDB` also reads `Cratis:MongoDB:{Server,Database}`.
- Build owner filters from the verified principal
  (`items.find({ owner: principal.id })`), never from a caller-supplied filter.
- **Naming.** `defaultMongoNamingPolicy` keeps declared property names and
  pluralizes the class name (`TaskRecords`); `camelCaseMongoNamingPolicy`
  camel-cases both. To read documents a .NET service wrote with the default
  policy, spell fields as .NET does (`Title`).
- **Storage format.** `Guid` is standard UUID binary (subtype 4); a concept is
  its underlying value; `Date` a BSON date; `DateOnly` a date at 12:00 UTC;
  `TimeOnly` a date on 1970-01-01 UTC; `TimeSpan` a string; nested decorated
  models embed; `@derivedType('id')` adds `_derivedTypeId`. No global BSON
  conventions or class maps are installed.
- **Geospatial.** Declare `@field(Point)` (also `LineString`, `Polygon`) from
  `@cratis/fundamentals/geospatial`; longitude comes first. Stored as GeoJSON;
  creating `2dsphere` indexes and `$near` filters is the application's job.
- **Paging.** `queryPage(filter, options)` pushes count, sort, skip and limit
  into MongoDB. Only declared fields may sort (an unknown field, including
  `$where`, answers 400); an `_id` tiebreaker keeps order stable.
- **Observing.** `observe(filter?)` emits full lists, `observeById(id)` one
  document or `null`, `observeIterable(filter?)` an async iterable without RxJS.
  All use change streams, which need a replica set or sharded cluster; a
  standalone server fails before the initial read.
- **Watcher and joins.** Resolve `mongoDBWatcher` in the same scope as the
  collections: `watcher.changes(books)` streams change events;
  `watcher.observe(books, filter).join(authors, filter).select((a, b) => ...)`
  recomputes a combined result when either changes. Join only collections from
  the same scope. A non-resumable error terminates subscribers; resubscribe,
  because the watcher never silently skips an interval. It is not a durable
  event consumer.

## SQL with Drizzle

```typescript
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { DrizzleDialect, drizzleReadModel, guidCodec, sqliteColumn, type DrizzleReadModels } from '@cratis/arc.drizzle';

export const tasks = sqliteTable('tasks', {
    id: sqliteColumn(guidCodec(DrizzleDialect.SQLite))('id').primaryKey(),
    title: text('title').notNull()
});
export class TaskRecord {
    @field(Guid) @key() id!: Guid;
    @field(String) title!: string;
}
@readModel()
export class TaskQueries {
    @query(service(drizzleReadModel(TaskRecord)), queryOptions())
    static page(rows: DrizzleReadModels<TaskRecord>, options: QueryOptions) {
        return rows.queryPage(undefined, options);
    }
}
// builder.add(TaskQueries).withDrizzle({ dialect: DrizzleDialect.SQLite, database,
//     readModels: [{ type: TaskRecord, table: tasks }] });
```

- Each `@field` needs a column under the **same property key** of the Drizzle
  table object (the SQL column name is yours); the table needs a primary key.
  Registration fails otherwise. Columns not on the model are never selected.
- Options: `dialect` (`DrizzleDialect.PostgreSQL | MySQL | SQLite`), `database`
  (default tenant only), `databaseFactory(tenant, context)` (sync or async; the
  application caches and disposes), `readModels`, `maxPageSize`, `observation`.
  With neither a factory nor a matching `database`, access fails with
  `A tenant is required for Drizzle access`.
- **Codecs** map Arc types to columns: `guidCodec(dialect)` (`uuid`, `char(36)`,
  `text`), `conceptCodec(Concept, ConceptCodecKind.String | Number, dialect)`,
  `dateOnlyCodec`, `timeOnlyCodec`, `timeSpanCodec`, `jsonCodec(dialect,
  validate)`, wrapped by `pgColumn`, `mysqlColumn` or `sqliteColumn`. A concept
  class declares `static readonly valueType` because generics are erased.
- **Schema.** Arc checks table against model at startup and never creates,
  alters or migrates the database. Add the column to the table, the model and a
  migration together (for example a drizzle-kit migration you own).
- **Writes** go through `drizzleDatabase<TDatabase>()` injected into `handle()`;
  `database.native` is the Drizzle database. `queryPage` pushes count, sort,
  limit and offset into SQL.
- **Observation is opt-in.** `DrizzleObservation.InProcess` sees only writes
  announced with `database.notifyChanged(table)` in this process.
  `DrizzleObservation.PostgreSQLNotify` sees committed changes from any process:
  install the trigger SQL from `postgresqlChangeTrigger(table, { schema })` in an
  application migration and pass a listener factory returning a **new, dedicated**
  `pg.Client` through `nodePostgresListener` (`pg` `^8`). Arc does not create
  database objects at runtime. NOTIFY is not a durable log: states during a
  disconnect are not replayed. Details in `cratis-arc-query-typescript`,
  `storage-observation-and-compliance.md`.

## Pitfalls

- A singleton holding a collection or connection keeps the first tenant; keep
  handles in scoped services or resolve through the tokens.
- Do not slice arrays in memory to page a database result; use `queryPage`.
- A read model class used for storage needs `@field` metadata; a missing one
  fails with `MongoDB model <Type> requires @field metadata`.

## Verify

Run the package's specs against the real engine where you can (MongoDB needs a
replica set for `observe`). `cratis-arc-testing-typescript` covers
`QueryScenario` for query shape; it does not prove database behavior.
