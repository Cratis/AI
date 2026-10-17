<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Rendering Date and DateTime comparisons

Requires Stage 4.141.0 to render ESM v26 comparisons; older renderers refuse them
with `STAGE-ESM-046`. Check `cratis --version` and its bundled Stage before rendering;
a newer standalone Screenplay does not upgrade the CLI renderer.

The Cratis renderer emits comparisons in command `require`, `produces when` and
command/property validation rules. Date compares calendar days with `DateOnly`;
DateTime compares UTC instants with `DateTimeOffset` at tick precision, not text
or millisecond precision. Absence passes validation rules. Date predicates are
server-side `.Must` rules; no client-side date comparator is extracted.

Every compared DateTime command property carries Arc's `ExplicitOffset` marker:
input without an offset or `Z` is rejected. A compared DateTime concept binds as
`DateTimeOffset` and converts back to the concept in events, rules and responses.
That workaround cannot preserve every shape. `STAGE-ESM-046` names the property for:

- a compared DateTime concept carrying compliance;
- an optional compared DateTime concept;
- a compared DateTime property whose name is not camel case.

Keep compliance and optionality: these are gaps, not reasons to change the model.
Date comparisons from protected-read operands are not rendered. Reaction date
conditions are not admitted by the language. Legacy engines retain `-046`.

## Input and expectation differences

With a named authorization policy, an unauthorized caller sending an unbindable
date body receives Validation rather than 403: Arc binds the body before Stage's
named policy evaluates. Test this boundary; do not claim identical denial ordering.
Rendered DateTime `then` expectations compare instants, while reference expectations
remain ordinal text comparisons; the binder requires expected event values to match
the produced spelling.

## Verify

Run `cratis render <root> --name <App> --destination <out>`, then build and test the
rendered project in Debug, in separate bounded calls. Admission/publication, build
and specification outcomes are separate results. Check valid offset inputs,
offset-less rejections and calendar-day/UTC-instant boundaries; retain any typed
refusal rather than replacing the comparison with text ordering.
