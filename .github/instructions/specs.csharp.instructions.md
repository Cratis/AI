---
applyTo: "**/for_*/**/*.cs, **/when_*/**/*.cs"
---

# How to Write C# Specs

Extends the base [Specs Instructions](./specs.instructions.md) with C#-specific conventions.

The `Cratis.Specifications` library was built to maintain the approach, structure, and syntax of Machine.Specifications (MSpec) — a BDD framework that makes specs read like a human-language specification. The `Establish → Because → should_` flow maps directly to "Given → When → Then" and keeps specs focused on *one action, one setup, one set of assertions*.

## Frameworks

- [xUnit](https://xunit.net/) for test execution.
- [NSubstitute](https://nsubstitute.github.io/) for mocking — chosen for its clean API that reads naturally.
- [Cratis.Specifications](https://github.com/Cratis/Specifications) for BDD-style specification by example.
- Spec projects are named `<Source>.Specs` (e.g. `Infrastructure.Specs`).

## Base Class

`Specification` from `Cratis.Specifications` must be at the root of every spec's inheritance chain.
It discovers `Establish`, `Because`, and `Destroy` methods by convention — no attributes needed.

## BDD Pattern

The three-phase pattern makes every spec self-explanatory: `Establish` sets up the world, `Because` performs the single action under test, and `should_*` facts verify individual outcomes. No test framework attributes are needed on `Establish` or `Because` — `Cratis.Specifications` discovers them by convention.

| Method | Purpose | Notes |
|---|---|---|
| `void Establish()` | Setup — called before `Because()` | Each class in the chain gets its own, called base-first |
| `void Because()` | The single action under test | Only in concrete spec files, never in reusable contexts |
| `[Fact] void should_*()` | One assertion per fact | Use `ShouldXxx()` extension methods |
| `void Destroy()` | Teardown after each test | |

All methods can be `async Task` when needed.

→ For step-by-step guidance on writing C# specs, reusable contexts, NSubstitute patterns, and assertions, invoke the **`cratis-specs-csharp`** skill.

## Using Statements

- Common usings are provided globally in `GlobalUsings.Specs.cs` (`Xunit`, `NSubstitute`, `Cratis.Specifications`, etc.) — don't duplicate them.
- Don't add a using statement for the namespace of the system under test.

## Properties — What NOT to Spec

Simple properties are compiler-verified — the type system already guarantees they work. Writing specs for them adds maintenance cost without catching real bugs. Save spec effort for code where errors actually hide: business logic, coordination between dependencies, and complex transformations.

```csharp
// ❌ Do NOT write specs for these
public string TableName => tableName;                         // Returns constructor parameter
public Key Key => key;                                        // Returns field
public IEnumerable<Property> Properties => mapper.Properties; // Simple delegation

// ✅ Only write specs for complex business logic in properties
public decimal TotalCost => Items.Sum(i => i.Cost * i.Quantity * (1 + i.TaxRate));
```

## Formatting

- Don't break long `should_` method lines — prefer one-line lambda assertions.
- Don't add blank lines between multiple `should_` methods.

## Entity Framework Core Specs

- Use SQLite in-memory database for specs involving `DbContext`.
- `SaveChanges` / `SaveChangesAsync` are virtual and can be mocked with NSubstitute.
- `DbSet` methods are virtual — mock as needed.
- Pass options when substituting: `Substitute.For<YourDbContext>(options)`.
- Simulate failures by mocking `SaveChanges` to throw exceptions.

→ For writing integration specs for vertical slice commands and queries, invoke the **`write-specs`** skill.
