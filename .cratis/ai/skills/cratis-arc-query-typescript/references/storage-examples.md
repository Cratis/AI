# Storage-backed query examples

This reference holds worked MongoDB, Drizzle and Chronicle read model query examples.

```typescript
// MongoDB — register with builder.withMongoDB({ ..., readModels: [TaskRecord] })
import { query, queryOptions, readModel, service, type QueryOptions } from '@cratis/arc.core';
import { mongoCollection, type MongoCollection } from '@cratis/arc.mongodb';

const tasks = mongoCollection(TaskRecord);

@readModel()
export class TaskQueries {
    @query(service(tasks))
    static async all(items: MongoCollection<TaskRecord>): Promise<TaskRecord[]> { return items.find(); }

    @query(service(tasks), queryOptions())
    static async page(items: MongoCollection<TaskRecord>, options: QueryOptions) { return items.queryPage({}, options); }

    @query({ observable: true }, service(tasks))
    static changes(items: MongoCollection<TaskRecord>) { return items.observe(); }
}
```

```typescript
// Drizzle — register with builder.withDrizzle({ dialect, database, readModels: [{ type: TaskRecord, table: tasks }] })
import { drizzleReadModel, type DrizzleReadModels } from '@cratis/arc.drizzle';

@readModel()
export class TaskQueries {
    @query(service(drizzleReadModel(TaskRecord)), queryOptions())
    static page(tasks: DrizzleReadModels<TaskRecord>, options: QueryOptions) { return tasks.queryPage(undefined, options); }
}
```

```typescript
// Chronicle (experimental) — Samples/Library/Features/Authors/Listing/Listing.ts
import { ChronicleReadModels } from '@cratis/arc.chronicle';
import { fromEvent } from '@cratis/chronicle/projections';

@readModel()
@fromEvent(AuthorRegistered)
export class Author {
    @field(AuthorId) id!: AuthorId;
    @field(AuthorName) name!: AuthorName;

    @query({ observable: true }, service(ChronicleReadModels))
    static allAuthors(models: ChronicleReadModels): Observable<Author[]> {
        return models.observeAll(Author, author => author.id.toString());
    }
}
```
