````instructions
---
applyTo: "**/Features/**/*.*"
---

# 🧱 Vertical Slice Architecture

## Technical Stack

- .NET 9+ with C# 13 (ASP.NET Core, minimal backend)
- React + TypeScript (Vite)
- PrimeReact as the UI component library
- Cratis Application Model with Chronicle for CQRS and Event Sourcing
- MongoDB for read models
- Vitest + Mocha/Chai/Sinon for TypeScript specs
- xUnit + Cratis.Specifications for C# integration specs

## General

- **MANDATORY: Each vertical slice MUST have its own folder with a single C# file containing ALL backend artifacts (commands, events, validators, constraints, etc.).**
- **MANDATORY: Commands have `Handle()` methods defined directly on them — DO NOT create separate handler classes.**
- Always write specs for state-change slices.
- Run `dotnet build` after backend changes to regenerate TypeScript proxies.
- Abide by all guidelines; this document overrides anything that contradicts it for Feature code.
- Drop the `.Features` part of the namespace when working within the `Features` folder (e.g. `MyApp.Projects.Registration` not `MyApp.Features.Projects.Registration`).
- Keep data integrity high: validate commands, enforce business rules, and protect inputs.
- **Complete one slice end-to-end before starting the next.**
- When adding a new slice to an existing feature, leverage any available MCP server to get information about existing vertical slices and their structure, to be able to consume events from other slices.

---

## Development Workflow — CRITICAL

Work **slice-by-slice** following this EXACT order:

1. **Backend** — Implement the C# slice (command / query / aggregator / projector + events, validators, constraints)
2. **Specs** — Write integration specs for every state-change slice
3. **Build** — Run `dotnet build` to generate TypeScript proxies
4. **Frontend** — Implement the React component(s) for this slice
5. **Composition** — Register the component in the feature's composition page
6. **Routes** — Add/update routing if the slice introduces new pages or navigation

### Rules

- Every slice MUST have both frontend and backend components.
- State-change slices MUST have specs.
- Always build after backend changes.
- Never partially implement multiple slices simultaneously.

---

## Slice Types

There are exactly **4 types** of vertical slices:

### State Change

- Triggered by a command that may fail (validation, business rules).
- A significant state change is recorded as one or more events.
- Use for anything that mutates system state.

### State View

- Projects events from other slices into a read model.
- One or more queries expose the read model.
- Queries are simple — no business logic.

### Automation

- Uses read models to make decisions and react automatically.
- Local, non-shared passive read models typical.

### Translation

- Translates events from one slice to another.
- Decouples slices, adapts events to the local domain, or integrates with external systems.
- Triggers commands in its own slice to produce new events.

---

## Folder Structure

```
Features/
├── <Feature>/
│   ├── <Feature>.tsx              ← composition page (owns layout + menu)
│   ├── <Concept>.ts               ← shared concepts for this feature
│   ├── <SliceName>/
│   │   ├── <SliceName>.cs         ← ALL backend artifacts in ONE file
│   │   ├── <Component>.tsx        ← React component(s) for this slice
│   │   └── when_<behavior>/       ← specs (state-change slices)
│   │       ├── and_<scenario>.cs
│   │       └── ...
│   └── ...
```

**❌ WRONG:**
```
Features/Projects/
├── Commands/RegisterProject.cs
├── Handlers/RegisterProjectHandler.cs
├── Events/ProjectRegistered.cs
```

**✅ CORRECT:**
```
Features/Projects/
├── Projects.tsx
├── Registration/
│   ├── Registration.cs            ← ALL artifacts: command + event + validator
│   ├── AddProject.tsx
│   └── when_registering/
│       ├── and_name_is_unique.cs
│       └── and_name_already_exists.cs
└── Listing/
    ├── Listing.cs
    └── Listing.tsx
```

---

## What Goes in a Single Slice File

A single `<SliceName>.cs` file MUST contain ALL of the following that belong to the slice:

- **Commands** — `[Command]` records with `Handle()` defined directly on them
- **Command Validators** — `CommandValidator<TCommand>` (if needed)
- **Business Rules** — `RulesFor<,>` classes (if needed)
- **Constraints** — `IConstraint` implementations (if needed)
- **Events** — `[EventType]` records
- **Read Models** — `[ReadModel]` records (State View slices)
- **Projections** — `IProjectionFor<>` implementations (State View slices)
- **Reactors** — `IReactor` implementations (Translation / Automation slices)
- **Slice-specific Concepts** — `ConceptAs<T>` types used only in this slice

**DO NOT** create separate files per artifact type, separate handler classes, or `Commands/`, `Events/`, `Handlers/` subfolders.

---

## Commands

- Records decorated with `[Command]` from `Cratis.Arc.Commands.ModelBound`.
- Immutable; use positional parameters.
- **The `Handle()` method is defined directly on the record.**
- `Handle()` returns: a single event, `IEnumerable<T>`, a tuple with events + result, or `OneOf<,>` / `Result<,>`.
- Event source resolution order:
  1. Parameter marked with `[Key]` from `Cratis.Chronicle.Keys`
  2. Parameter whose type implements `EventSourceId`
  3. Implement `ICanProvideEventSourceId` as last resort

```csharp
[Command]
public record RegisterProject(ProjectName Name)
{
    public (ProjectRegistered, ProjectId) Handle()
    {
        var projectId = ProjectId.New();
        return (new ProjectRegistered(Name), projectId);
    }
}
```

**❌ WRONG - Do NOT create separate handler classes:**
```csharp
// ❌ DO NOT DO THIS
public class RegisterProjectHandler : ICommandHandler<RegisterProject>
{
    public Task Handle(RegisterProject command) { ... }
}
```

---

## Command Input Validation

- Use the `CommandValidator<T>` class from `Cratis.Arc.Commands` namespace to validate commands.

```csharp
public class RegisterProjectValidator : CommandValidator<RegisterProject>
{
    public RegisterProjectValidator()
    {
        RuleFor(c => c.Name).NotEmpty().WithMessage("Project name is required");
    }
}
```

---

## Business Rules

- If the command needs to validate disregarding the `EventSourceId`, use the `RulesFor<T>` class from `Cratis.Chronicle.Rules`.
- Rules cannot depend on read models from the database (eventual consistency); they depend on state built from events in the same transaction.

```csharp
public class AddItemToCartRules : RulesFor<AddItemToCartRules, AddItemToCart>
{
    public AddItemToCartRules()
    {
        RuleForState(m => m.NumberOfItems)
            .LessThan(3)
            .WithMessage("You can only add 3 items to the cart");
    }

    public int NumberOfItems { get; set; }

    public override void DefineState(IProjectionBuilderFor<AddItemToCartRules> builder) => builder
        .From<ItemAddedToCart>(_ => _.Count(m => m.NumberOfItems));
}
```

---

## Constraints

- Constraints enforce uniqueness.
- Two types: unique value per event source, and unique event type per event source.

```csharp
public class UniqueAuthorName : IConstraint
{
    public void Define(IConstraintBuilder builder) => builder
        .Unique(_ => _
            .On<AuthorRegistered>(e => e.FirstName, e => e.LastName)
            .On<AuthorNameChanged>(e => e.FirstName, e => e.LastName)
            .RemovedWith<AuthorRemoved>()
            .WithMessage("Author name must be unique"));
}

public class UserConstraints : IConstraint
{
    public void Define(IConstraintBuilder builder) =>
        builder.Unique<UserRegistered>();
}
```

---

## Events

- Records decorated with `[EventType]` from `Cratis.Events`.
- **`[EventType]` MUST have NO arguments** — the type name is used automatically.
- Immutable; use positional parameters.

```csharp
[EventType]
public record ProjectRegistered(ProjectName Name);
```

**❌ WRONG:**
```csharp
[EventType("ce956ea9-1ee0-4ce3-a2a2-a21e4c5a33d0")]
public record ProjectRegistered(ProjectName Name); // ❌ NO GUID argument

[EventType("ProjectRegistered")]
public record ProjectRegistered(ProjectName Name); // ❌ NO string argument
```

---

## Read Models & Projections

- Records decorated with `[ReadModel]` from `Cratis.Arc.Queries.ModelBound`.
- Query methods are static methods on the read model record.
- **Always use `.AutoMap()` before `.From<>()` statements.**
- **Projections MUST join events, NOT read models.**

```csharp
[ReadModel]
public record Project(ProjectId Id, ProjectName Name)
{
    public static ISubject<IEnumerable<Project>> AllProjects(IMongoCollection<Project> collection) =>
        collection.Observe();
}

public class ProjectProjection : IProjectionFor<Project>
{
    public void Define(IProjectionBuilderFor<Project> builder) => builder
        .AutoMap()
        .From<Registration.ProjectRegistered>();
}
```

**✅ CORRECT — Joining events from other slices:**
```csharp
public class LendingItemProjection : IProjectionFor<LendingItem>
{
    public void Define(IProjectionBuilderFor<LendingItem> builder) => builder
        .AutoMap()
        .From<LendOut.BookLent>(_ => _
            .UsingKey(ev => ev.ISBN))
        .Join<BookCatalog.Registration.BookRegistered>(_ => _  // ✅ JOIN EVENT
            .On(m => m.ISBN)
            .Set(m => m.Title).To(ev => ev.Title));
}
```

**❌ WRONG — Do NOT join read models:**
```csharp
.Join<BookCatalog.Listing.Book>(_ => _  // ❌ This is a read model, not an event
    .On(m => m.ISBN))
```

---

## Queries

- Built directly into the read model type as static methods.
- Favor reactive queries (`ISubject<T>`) for real-time updates.
- Name query methods descriptively: `AllProjects`, `ProjectById`, `ProjectsByStatus`.

```csharp
[ReadModel]
public record Project(ProjectId Id, ProjectName Name)
{
    public static ISubject<IEnumerable<Project>> AllProjects(IMongoCollection<Project> collection) =>
        collection.Observe();
}
```

---

## Reactors

- Used to react to events from other slices (Translation/Automation slices).
- Methods follow the signature: `public Task <EventTypeName>(<EventTypeName> evt, EventContext context)`.
- Reactors can trigger commands in their own slice to produce new events.

```csharp
public class StockKeeping(IStockKeeper stockKeeper, ICommandPipeline commandPipeline) : IReactor
{
    public async Task BookReserved(BookReserved @event, EventContext context) =>
        await commandPipeline.Execute(new DecreaseStock(@event.Isbn, await stockKeeper.GetStock(@event.Isbn)));
}

[Command]
public record DecreaseStock(ISBN Isbn, BookStock StockBeforeDecrease)
{
    public StockDecreased Handle() => new(Isbn, StockBeforeDecrease);
}

[EventType]
public record StockDecreased(ISBN Isbn, BookStock StockBeforeDecrease);
```

---

## Concepts

- Prefer `ConceptAs<T>` from `Cratis.Concepts` over raw primitives in domain models, commands, and events.
- Concepts shared between slices → feature folder.
- Concepts shared between features → Features root folder.
- Prefer one file per concept type.

---

## Specs (Integration Tests)

- Specs are integration tests placed in the slice folder that contains the command being tested.
- We do not need any `for_` folders for integration specs — go straight to the `when_` folders.
- Specs specify the behavior of the command, not implementation details.

```csharp
using Cratis.Arc.Commands;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.XUnit.Integration.Events;
using context = MyApp.Authors.Registration.when_registering.and_there_already_exists_one_with_same_name.context;

namespace MyApp.Authors.Registration.when_registering;

[Collection(ChronicleCollection.Name)]
public class and_there_already_exists_one_with_same_name(context context) : Given<context>(context)
{
    public class context(ChronicleOutOfProcessFixture fixture) : given.an_http_client(fixture)
    {
        public const string AuthorName = "John Doe";
        public CommandResult<Guid> Result;

        Task Establish() => EventStore.EventLog.Append(AuthorId.New(), new AuthorRegistered(AuthorName));

        async Task Because()
        {
            Result = await Client.ExecuteCommand<RegisterAuthor, Guid>("/api/authors/register", new RegisterAuthor(AuthorName));
        }
    }

    [Fact] void should_not_be_successful() => Context.Result.IsSuccess.ShouldBeFalse();
    [Fact] void should_have_appended_only_one_event() => Context.ShouldHaveTailSequenceNumber(EventSequenceNumber.First);
}
```

---

## Frontend

- React + TypeScript frontend code lives **in the same slice folder** as its corresponding backend code.
- Use PrimeReact as the UI component library.
- Each feature has a composition page at its root that composes the slices together.

### Commands (TypeScript)

- Automatically generated from C# commands by the Cratis ProxyGenerator when running `dotnet build`.
- Use the `.use()` method to get a React hook for the command.
- Execute with `.execute()` and check the returned `CommandResult`.

### Queries (TypeScript)

- Automatically generated from C# read models.
- Use `.use()` for a simple hook or `.useWithPaging(pageSize)` for paginated data.

### Dialogs

- **Never** import `Dialog` from `primereact/dialog`. Use Cratis component wrappers.
- When a dialog executes a Cratis Arc command on confirm, use **`CommandDialog`** from `@cratis/components/CommandDialog`.
- When a dialog only collects data, use **`Dialog`** from `@cratis/components/Dialogs`.
- Do not render manual `<Button>` components for dialog actions.

### Listing Views

```tsx
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { AllProjects } from './AllProjects';

const pageSize = 10;

export const Listing = () => {
    const [allProjectsResult, , setPage] = AllProjects.useWithPaging(pageSize);

    return (
        <DataTable
            lazy
            paginator
            value={allProjectsResult.data}
            rows={pageSize}
            totalRecords={allProjectsResult.paging.totalItems}
            alwaysShowPaginator={false}
            first={allProjectsResult.paging.page * pageSize}
            onPage={(event) => setPage(event.page ?? 0)}
            scrollable
            scrollHeight={'flex'}
            emptyMessage="No projects found.">
            <Column field="name" header="Name" />
        </DataTable>
    );
};
```

### Composition Page

```tsx
import { Page } from '../../Components/Common';
import { AddProject } from './Registration/AddProject';
import { Listing } from './Listing/Listing';
import { DialogResult, useDialog } from '@cratis/arc.react/dialogs';
import { Menubar } from 'primereact/menubar';
import { MenuItem } from 'primereact/menuitem';
import * as mdIcons from 'react-icons/md';

export const Projects = () => {
    const [AddProjectDialog, showAddProjectDialog] = useDialog(AddProject);

    const menuItems: MenuItem[] = [
        {
            label: 'Add Project',
            icon: mdIcons.MdAdd,
            command: async () => { await showAddProjectDialog(); }
        }
    ];

    return (
        <Page title="Projects">
            <Menubar model={menuItems} />
            <Listing />
            <AddProjectDialog />
        </Page>
    );
};
```

````
