<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Availability in Arc for Elixir (planned)

Arc for Elixir does **not** yet have availability. It is tracked as an open request in Cratis/Arc.Elixir#36
("Availability: the same model as Arc for .NET"), which starts after the C# design is built. Do not write
code that assumes it, and do not describe it as shipped. Verify the repository's
`Documentation/limits-and-gaps.md` and the issue before relying on anything here.

## What is planned (from the issue, not yet verifiable in the package)

- The same model as Arc for .NET: audiences, blocks (`for`, `when`, `with`, `not`), gates on module, feature,
  slice, command and query, module/feature/slice from `Arc.Descriptor.slice_location/2`.
- A pipeline hook that runs before authorization (today `Arc.Filter` runs after it) with the reasons `NotAvailable`
  and `Suspended` (403, and a retryable 503 when the decision cannot be made).
- The shared manifest (`cratis.availability.manifest.json`) and the shared conformance cases from Arc.
- `/.cratis/availability`, a generated proxy carrying part identity and a LiveView component to hide parts.
- An open point from the language decision: a coded reason apart from availability, once Arc for Elixir has the hook.

## What to do today

- Model availability in the Screenplay model (`cratis-screenplay-availability`) and enforce it where a hook exists
  (a Phoenix plug or your own check); say plainly that the host enforces it, not Arc for Elixir.
- Keep the vocabulary of the model: audiences are granted and withdrawn; parts are suspended and resumed.
- Treat an undecided result as closed, and a failure to decide as a retryable error, never a denial.
- For the shipped engine and typed declaration, see the C# side in `cratis-arc-hosting` (`references/availability.md`).
