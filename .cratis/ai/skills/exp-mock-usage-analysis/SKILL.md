---
name: exp-mock-usage-analysis
description: Use when auditing existing NSubstitute setups in C# specifications for unused, unreachable or over-configured substitutes. Not for writing new specifications, replacing a mocking library or measuring coverage.
license: MIT
---

<!-- Modified by Cratis from dotnet's original (MIT): frontmatter, applicability, Specification lifecycle, NSubstitute scope and the changes listed in NOTICE. Upstream: https://github.com/dotnet/skills (plugins/dotnet-experimental/skills/exp-mock-usage-analysis/SKILL.md; see NOTICE) -->

# Mock usage analysis

Cratis rules in `.cratis/ai/rules/` (including `specs.csharp.md`) and the `cratis-*` skills win where they differ. Use the `specs.csharp` rule for writing or restructuring specifications; this skill only audits setups that already exist.

Trace each NSubstitute setup through the production code's execution path to find setups that no scenario exercises. A review request is not authority to edit or run anything: report findings, and edit only when asked.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| Specification files | Yes | The contexts to audit, including every base context in the inheritance chain |
| Production code | Yes | The code under test; control flow cannot be traced without it |

## Workflow

### Step 1: Read the whole scenario

Read the concrete specification, every base context it inherits from (for example `given/all_dependencies.cs`) and the production code. A scenario is the context chain run base-first:

1. Each class's `Establish()` from the base context down.
2. The concrete class's single `Because()`.
3. Every `should_*` fact, which all share that one run.

### Step 2: Trace each setup per scenario

Identify every `Substitute.For<T>()`, `.Returns(...)`, `.Throws(...)` and `Arg` matcher. Follow the production method for the inputs `Because()` supplies and classify each setup:

| Classification | Meaning |
|----------------|---------|
| **Used** | `Because()` reaches the call, or an assertion reads the result |
| **Unreachable** | A guard, early return or throw leaves the method before the call in this scenario |
| **Unused** | The method under test never calls it for any input |
| **Duplicated** | The same setup repeats across scenarios; not a defect on its own |

Rules that prevent false findings:

- A setup in an inherited `Establish()` is used when any scenario that inherits it uses it. Unused by one `should_*` fact is not unused by the scenario, because every fact shares the setup that `Because()` runs through.
- Judge a setup against the scenarios that inherit it. A shared base context may be correct for most derived specs and unnecessary for one; report that distinction.
- `.Received()` and `.DidNotReceive()` are assertions, not stubbing. A specification that only asserts an interaction at an external boundary, such as a publisher, repository write or HTTP client, is valid even without a return-value assertion.
- Duplicated setup is not automatically redundant. Propose extraction only into a scenario-local shared base context that every duplicating scenario uses, never a global mutable fixture or an order-dependent setup.
- Look for early returns, guard clauses, exceptions thrown before a dependency is touched, and branches that dispatch to a different collaborator.

### Step 3: Check replaceable substitutes

- A substituted `ILogger<T>` can be `NullLogger<T>.Instance` unless the specification asserts log output.
- A substituted `IOptions<T>` can be `Options.Create(new T { ... })`.
- A substitute for a plain record or value object can be a real instance.

Keep substitutes at external boundaries (databases, HTTP clients, message queues, third-party APIs) and security-sensitive collaborators. Do not recommend replacing collaborators with concrete services in general.

### Step 4: Report

For each finding, give the specification and setup line, the scenario that makes it unnecessary and the production path that proves it, and the smallest removal or scenario-local change. Name correctly placed boundary substitutes explicitly. Mark every finding a static hypothesis unless the selected specifications were actually run.

```csharp
// given/an_order_handler.cs: Establish is shared by all derived scenarios
void Establish() => _prices.GetPrice(Arg.Any<string>()).Returns(10m);
// when_handling_unknown_customer: Because returns at the customer guard before _prices is called,
// so this scenario never uses the stub. Sibling scenarios do; keep the base setup and report
// the one scenario that could stop inheriting it.
```

## Validation

- [ ] The full context chain and the production code were read and traced.
- [ ] Each finding names a specific scenario and setup line and the path that proves it.
- [ ] No setup was flagged only because one assertion does not read it.
- [ ] `Received`/`DidNotReceive` usage and boundary substitutes were treated as valid.
- [ ] Findings are labeled static hypotheses unless specifications were run.

## Pitfalls

| Pitfall | Correction |
|---------|------------|
| Reading only the concrete spec file | Read inherited `Establish` contexts too |
| Flagging a base setup because one fact ignores it | Judge it by the whole scenario |
| Treating verify-only specifications as dead | `Received` at a boundary is a valid assertion |
| Deleting duplicated setup across scenarios | Extract only scenario-local shared contexts |
| Editing while reviewing | Report findings; edit only when asked |
