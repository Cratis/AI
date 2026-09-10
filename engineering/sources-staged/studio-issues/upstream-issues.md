---
applyTo: "**/*"
---

# Register Problems Where They Get Fixed

When you hit a problem whose fix belongs in a Cratis framework repository rather than in this one, **open an issue on that repository**. Working around it here and moving on leaves the defect in place for every other application built on Cratis, and leaves the next person to rediscover it from scratch.

This applies whether or not you also work around it locally. The workaround unblocks the task; the issue is what gets it fixed.

## What belongs upstream

A problem belongs upstream when the behavior is wrong in the framework, not in how this application uses it:

- Generated output is wrong, inconsistent, or unstable across builds (proxy generator, source generators).
- An analyzer reports something incorrect, or fails to report something it documents.
- A public API behaves differently from what its own documentation says.
- An alternate implementation of an interface diverges in semantics from the primary one.
- A component renders or behaves incorrectly given documented props.
- A runtime does something the guidance says it will not.

A problem does **not** belong upstream when this application is using the framework wrongly - that is a fix here, and often a rule or skill worth updating.

## Which repository

| Area | Repository |
|---|---|
| Commands, queries, model binding, proxy generation, validation, authorization | `Cratis/Arc` |
| Event sourcing, projections, reducers, reactors, observers, storage, compliance | `Cratis/Chronicle` |
| `ConceptAs<T>`, type discovery, serialization, common primitives | `Cratis/Fundamentals` |
| React components on PrimeReact | `Cratis/Components` |
| The `Establish`/`Because`/`should_` spec base | `Cratis/Specifications` |
| Reusable GitHub workflows | `Cratis/Workflows` |
| Authentication proxy behavior | `Cratis/AuthProxy` |

When unsure which owns it, prefer the repository whose package name appears in the failing call.

## What the issue needs

Enough for someone who has never seen this application to reproduce it:

- What was expected, and what happened instead - both concretely.
- The smallest reproduction you can state, with the exact source shape that triggers it.
- The real error text, not a paraphrase.
- Why it matters beyond the immediate annoyance: what it breaks, and what it looks like when it breaks. A defect that presents as intermittent or environment-specific is worth saying so, because that is what makes it expensive to find.

State the problem rather than prescribing the fix. Suggest a direction if you have one, and leave the decision to whoever owns the code.

## After filing

Reference the issue from any workaround left behind, so the workaround can be removed when the fix lands and is not mistaken for a deliberate choice:

```csharp
// Worked around until Cratis/Arc#2547 - the generator emits a different module
// layout in Debug and Release, so the committed shape has to match Release.
```
