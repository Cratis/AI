# Queries — Reference

Queries are **`static` methods on a `[ReadModel]` record**. Arc discovers them and generates both the HTTP endpoint and the TypeScript proxy. **There are no controllers** — `[HttpGet]`, `[FromQuery]`, and `[Route]` have no part in a query (see `general.md` rules 1 and 12).

## What makes a method a query

A static method on a `[ReadModel]` type qualifies when it is **not generic** and returns — optionally wrapped in `Task<>` — one of:

| Return shape | Query kind |
| ------------ | ---------- |
| `TReadModel` | single item, snapshot |
| `IEnumerable<TReadModel>` / `TReadModel[]` / `IQueryable<TReadModel>` | collection, snapshot |
| `IAsyncEnumerable<TReadModel>` | streamed collection |
| `ISubject<TReadModel>` | single item, observable |
| `ISubject<IEnumerable<TReadModel>>` | collection, observable |

Anything else is ignored, so a helper on the record is not mistaken for a query. Return `IQueryable<T>` when the result set can grow — Arc applies paging and sorting to it (see the **query-paging** skill; never hand-write `Skip`/`Take`).

**Parameters split in two automatically.** Every parameter the DI container recognizes as a service becomes an injected dependency; every other parameter becomes a query argument surfaced on the route and in the generated proxy. That is how `IMongoCollection<T>` and `ProjectId` sit side by side in one signature.

---

## Collection query

```csharp
[ReadModel]
[FromEvent<ProjectRegistered>]
[RemovedWith<ProjectRemoved>]
public record Project(ProjectId Id, ProjectName Name, ProjectDescription Description)
{
    public static async Task<IEnumerable<Project>> AllProjects(IMongoCollection<Project> collection)
        => await collection.Find(_ => true).ToListAsync();
}
```

## Single item, with an argument

```csharp
[ReadModel]
public record ProjectDetails([Key] ProjectId Id, ProjectName Name)
{
    public static async Task<ProjectDetails?> ProjectById(ProjectId id, IMongoCollection<ProjectDetails> collection)
        => await collection.Find(p => p.Id == id).FirstOrDefaultAsync();
}
```

`id` is a query argument; `collection` is injected.

## Observable (real-time push) query

Return `ISubject<T>` and Chronicle pushes on every projection change. The MongoDB extensions do the wiring — there is no hand-rolled change stream:

```csharp
public static ISubject<IEnumerable<Project>> AllProjects(IMongoCollection<Project> collection)
    => collection.Observe();

public static ISubject<ProjectDetails> ProjectById([Key] ProjectId id, IMongoCollection<ProjectDetails> collection)
    => collection.ObserveById(id);
```

The proxy generator produces an `ObservableQueryFor` TypeScript class instead of a `QueryFor`. Components that accept a `query` prop (like `DataPage`) detect which one they were handed and subscribe accordingly — there is no separate `observableQuery` prop.

## A read model needs no projection

`[ReadModel]` marks a query surface. When the data's source of truth is a service rather than an event stream, the record carries no projection attributes at all:

```csharp
[ReadModel]
public record ApplicationFileEntry(ApplicationFilePath Path, bool IsDirectory, long Size)
{
    public static Task<IEnumerable<ApplicationFileEntry>> FilesForApplication(
        ApplicationId applicationId,
        IApplicationSourceFiles sourceFiles)
        => sourceFiles.FilesFor(applicationId);
}
```

## Custom route — `[Path]`, never `[Route]`

Routes are derived from the read model's namespace and the method name; you rarely need to override them. When you do, use `PathAttribute` from `Cratis.Arc.Queries.ModelBound` — it targets both the class and the method, and a method-level `[Path]` wins over the type's:

```csharp
[ReadModel]
[Path("/.cratis/queries/health")]
public sealed record QueryHealth
{
    public static ISubject<QueryHealth> ObserveHealth(IQueryHealthTracker healthTracker) => …;
}
```

`[QueryHttpMethod(...)]` (also class- or method-level) sets the generated proxy's default transport; the server accepts both GET and QUERY regardless.

---

## QueryResult shape (frontend)

```ts
interface QueryResultWithState<T> {
    data: T;
    isSuccess: boolean;
    isAuthorized: boolean;
    isValid: boolean;
    validationResults: ValidationResult[];
    hasExceptions: boolean;
    exceptionMessages: string[];
    paging: { page: number; pageSize: number; totalItems: number; totalPages: number };

    // React-specific:
    hasData: boolean;       // non-null and non-empty
    isPerforming: boolean;  // request in flight
}
```

A `ValidationResult` carries `members: string[]` and a numeric `severity` — see `cratis-command/references/command-result.md`.

---

## React usage

```tsx
// Snapshot query — returns [result, requery]
const [projects, refresh] = AllProjects.use();

// With arguments
const [result] = ProjectById.use({ id: projectId });

// Observable query — returns [result] only (updates push themselves)
const [liveProjects] = AllProjects.use();
```

For full page layouts with tables and menu actions, see the `cratis-react-page` skill.

---

## Naming conventions

The **static method name** becomes the TypeScript proxy class name. Make it descriptive.

| ✅ Good | ❌ Avoid |
| ------- | ------- |
| `AllProjects` | `Get`, `GetAll`, `List` |
| `ProjectById`, `ProjectsByOwner` | `Query`, `Fetch` |
| `ActiveSessions` | `Observable`, `Live` |

An observable query does not need a `Live`/`Observe` prefix — the return type already says so, and callers use the same `.use()` hook either way.
