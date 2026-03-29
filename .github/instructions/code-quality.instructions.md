---
applyTo: "**/*"
---

# Code Quality

Good code is not just code that works — it is code that can be understood, changed, and extended safely. The principles below are the foundation for writing code that remains maintainable as the system grows. They are not abstract ideals; each one has a concrete, practical consequence for how you write and structure code in this project.

## Composition over Inheritance

Prefer composing behavior from smaller, focused collaborators over building class hierarchies. Inheritance couples the child tightly to the parent's internal structure — a change to the parent can break every subclass. Composition keeps collaborators independent and replaceable.

```csharp
// ❌ Inheritance — child is tightly coupled to parent internals
public class ReportExporter : BaseExporter
{
    public override void Export(Report report) { ... }
}

// ✅ Composition — behavior is injected and interchangeable
public class ReportExporter(IExportStrategy strategy)
{
    public void Export(Report report) => strategy.Execute(report);
}
```

**Rules:**
- Never extend a concrete class to add or change behavior — inject a collaborator instead.
- Use interfaces and `ConceptAs<T>` record wrappers rather than inheritance chains.
- Inheritance is acceptable only for framework integration points where a base class is part of a well-defined extension mechanism (e.g. `Specification`, `Migration`, `AggregateRoot`).

## Single Responsibility Principle

Every type and every method should have **one reason to change** — it should do one thing and do it well. A class that fetches data, transforms it, validates it, and sends an email has four reasons to change. When any of those concerns shifts, you have to touch — and risk breaking — all the others.

**Rules:**
- A class or method that requires a comment explaining what each section does is a sign it should be split.
- Methods longer than ~20 lines are a signal they are doing too much — extract collaborators or helper methods.
- If a class needs both a repository and an email service, question whether it has two responsibilities.
- Follow the [File Size Guideline](#file-size-200-line-guideline) below.

## Open/Closed Principle

Types should be **open for extension, closed for modification**. Once a type is in use, changing its internals to support new behavior risks breaking existing callers. Instead, design extension points — interfaces, strategies, event hooks — that allow new behavior to be added without touching existing code.

```csharp
// ❌ Modified every time a new format is added
public class ReportFormatter
{
    public string Format(Report report, string formatType)
    {
        if (formatType == "csv") return FormatAsCsv(report);
        if (formatType == "json") return FormatAsJson(report);
        // New format → modify this class
        throw new UnknownFormat(formatType);
    }
}

// ✅ New formats are added by implementing the interface — no existing code changes
public interface IReportFormatter
{
    string Format(Report report);
}

public class CsvReportFormatter : IReportFormatter { ... }
public class JsonReportFormatter : IReportFormatter { ... }
// New format → add a new class, nothing else changes
```

**Rules:**
- Prefer strategy interfaces over `switch`/`if-else` chains that grow over time.
- Use dependency injection and `IInstancesOf<T>` to discover implementations by convention.
- Design public APIs as contracts (interfaces/records) rather than concrete implementations.

## Separation of Concerns

Each layer and each module should own exactly one concern. Mixing concerns — for example, querying the database and formatting the HTTP response in the same method — creates entanglement that makes both concerns harder to change or test independently.

**Rules:**
- Keep domain logic out of infrastructure: domain types must not reference EF Core, MongoDB, or HTTP concepts directly.
- Keep infrastructure out of command handlers: handlers express intent in domain terms; they delegate to collaborators for persistence, messaging, and I/O.
- Projections build read models; they must not trigger commands or produce side effects.
- Reactors handle side effects; they must not directly read or write the event log.

## Low Coupling

Coupling is the degree to which one module depends on the internals of another. High coupling means a change in one place forces changes everywhere else. Low coupling means modules can evolve independently.

**Rules:**
- Depend on abstractions (interfaces, records), not on concrete implementations.
- Use constructor injection — it makes dependencies explicit and testable.
- Avoid reaching through an object to call methods on its dependencies (`a.B.C.Do()` is a sign of tight coupling).
- Limit the number of dependencies a single type takes in its constructor — more than four or five is a signal it is doing too much.
- Never reference types from unrelated features directly; go through a shared contract or event instead.

## High Cohesion

Cohesion measures how closely related the responsibilities within a module are. A highly cohesive class has all its methods and properties working together toward a single goal. A low-cohesion class is a collection of unrelated utilities that happen to live in the same file.

**Rules:**
- Group code by feature (vertical slices), not by technical role — everything for a behavior belongs together.
- If you find yourself writing methods in a class that use completely different sets of fields, the class likely needs to be split.
- Utilities and helpers are acceptable only when the operations they provide are genuinely shared across features; otherwise, keep logic in the feature that owns it.

## File Size — 200-Line Guideline

A file exceeding **200 lines** is a strong signal that it contains too many responsibilities. This is not a hard limit — some files are legitimately longer — but whenever you find yourself adding to a file that already approaches this size, stop and ask: can this be split?

**Rules:**
- When a file crosses 200 lines, look for natural split points: a sub-concept that could become its own type, a behavior that could move to a collaborator, or a section that belongs in a different layer.
- Aim for files that can be understood in a single reading without scrolling.
- Instruction and documentation files follow the same principle — a guide over 200 lines usually contains multiple distinct topics that deserve their own files.

## Cross-Cutting Concerns

Cross-cutting concerns — logging, validation, authorization, error handling, metrics, caching — affect many parts of the system but belong to none of them. Scattering them through business logic creates noise and duplication. Centralizing them in infrastructure keeps domain code clean.

**Rules:**
- Never write logging statements directly inside command handlers, projections, or domain types. Use the `[LoggerMessage]` pattern in a co-located `*Logging.cs` partial class.
- Never perform authorization checks inside domain logic — express them as attributes or middleware applied at the boundary.
- Never duplicate error-handling or retry logic across handlers — centralize it in a pipeline or middleware.
- Use the command pipeline (`ICommandPipeline`), middleware, and decorators to apply cross-cutting concerns at the infrastructure layer so that domain code remains unaware of them.
- When you notice the same infrastructural pattern appearing in two or more places (logging a specific event, catching a specific exception, checking a specific condition), extract it into a shared cross-cutting mechanism rather than duplicating it.
