<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Typed examples, overrides and event routes

## Contents

- Typed examples
- Effective values
- Event routes
- Operation and recovery intent

## Typed examples

`example <Name> : <EventOrCommandOrReadModel>` declares a possibly partial typed
fixture at document/module/feature/slice scope. Its underlying type resolves in
the declaration scope, not the use scope. It can state properties, description,
`for` and command generated fixtures, not callers/clocks or a whole scenario.
Examples share the type namespace and use the current event generation. They
cannot inherit from examples or serve as query results/returns/trigger/capture
fixtures. They are specification data, not operational `seed` events.

This complete example compiled and its two reference scenarios passed on 4.125.0:

```screenplay
concept ProjectId : Uuid
module Projects
  feature Registration
    example DefaultProject : RegisterProject
      name = "Default"
    slice StateChange Register
      command RegisterProject
        projectId ProjectId identifier
        name String
        produces event ProjectRegistered
          name String = name
      specification RegisteringTheDefault
        when DefaultProject
          projectId = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
        then ProjectRegistered
          for "3fa85f64-5717-4562-b3fc-2c963f66afa6"
          name = "Default"
      specification OverridingTheName
        when DefaultProject name = "Override"
          projectId = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
        then ProjectRegistered
          for "3fa85f64-5717-4562-b3fc-2c963f66afa6"
          name = "Override"
```

## Effective values

An example occupies the ordinary name slot in given/event, given readmodel,
when command, when append, then event or then readmodel. One assignment may be
inline after the name; more stay indented. There is **no with keyword**.
Step values override example values by property name; objects/lists replace
whole values, never recursively merge. Indented `for` replaces its destination;
generated fixtures merge by name. A new step-only value is authored, not an
override. Each step/declaration assigns a property once (PLAY0519); malformed
headers are PLAY0518.

After expansion, required given-event/read-model, command, append and expected
event fields must be complete (binding PLAY0524); examples can remain partial.
Read-model assertions retain subset matching unless `exactly` is authored.
Even unused example values or values overridden at every use are type-checked.
No default fixture values are invented. A command action must belong to the
specification's own slice even when a qualified example resolves elsewhere.

MCP `find-fixtures` reports effective authored/example/override origins and
replaced values. Source-bound runner failures retain that provenance; canonical
ESM contains merged values only, equivalent to hand-expansion. ESM-only runners
cannot reconstruct source origins.

## Event routes

Event occurrences in `given`, `when append` and `then` accept `stream Source.Stream`
with nested scalar `streamId = <literal>` or a complete composite part block.
These select ESM v8 and reference-execute at 4.125.0; the complete checked model
is in toolchain `references/sources-and-streams.md`. Command actions take their
route from the command declaration, never the fixture.

Routed history/appends need typed concrete `for`; routed expectations may omit
it. `then ... no stream` expects no route; no route in a then is a wildcard.
`no stream` is invalid on given/appends. Event examples can supply routes, but
steps replace the entire route, independently of `for`; an inherited route
cannot be changed back to a wildcard. Literal compatibility/route contradiction
checks use resolved source/stream types, not guessed text (PLAY0547–PLAY0551).
At Screenplay 4.127.0, route literals must be nonempty, well-formed NFC text
(refused, not normalized); Double integer ids are within ±(2^53−1), while Exact
has no such bound but remains unadmitted. Invalid specification routes report
PLAY0549. Contradictions compare canonical scalar ids and every composite part,
so UUID casing is immaterial. Composite mappings supply each named part once,
using literals only; encoding escapes `%`/`|` and preserves declaration order.
Source: v4.127.0 `event-sources.md`, `specifications.md`, `diagnostics.md`.

CLI 3.41.0 rendering rejects versions above v7 before planning, even though
source compilation and reference routing pass.

## Operation and recovery intent

Operation failure/request/compensation forms are authoring-only (PLAY0268):
`given operation <Name> fails`, `then operation <Name>` with a partial input
subset, and leaf `then compensated <Name>`. See command-surface
`references/operations.md` for the complete checked authoring fixture.

Refusal selectors, redelivery to one observer and `then no events` likewise
remain unadmitted; they are not executed append scenarios. Forms, matching,
acknowledgement and their whole-model refusal boundary are in
captures-and-reactions `references/refusals-and-redelivery.md`.

Authority: Screenplay `v4.125.0:Documentation/screenplay/specifications.md`.
