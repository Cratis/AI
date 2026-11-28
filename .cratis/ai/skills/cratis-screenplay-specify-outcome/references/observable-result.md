# Choose the observable result

Arrange the prerequisite for **one** decision. Givens establish history, not a second action whose reactions run. A view seed can isolate a decision from replay; it cannot prove that the projection reached the seeded state. For a fixture expanded from an example, fill every top-level event property and nongenerated command input, including an optional top-level input. The binder checks the expanded step; omittable members of a nested value and partial expected view properties are different cases. Keep the caller separate from command inputs and fixtures.

| Question | What to compare |
| --- | --- |
| Which facts were accepted? | Compare the new facts, their count, payloads and addresses. Order matters unless `then events in any order` explicitly relaxes it; that does not relax count. Use `then no events` for an accepted action with no new facts, not for an authorization denial. |
| Which answer can the user read? | Assert the query arguments and exact result count. Row order does not matter. By default only stated properties are compared; `exactly` compares all. A present null is not an absent property. A valid query returning nothing is different from `then denied`. |
| Was the follow-up requested? | With `then invokes`, compare every invocation in the slice in count and order, but only the stated input fields. A refused invocation still counts. Without an invocation expectation no invocation comparison is made. Check the receiving command's facts separately. |
| Did the observer handle recovery? | Select exactly one given occurrence for `when redelivered <Event> to <Reaction>`. If duplicates match, narrow by source, route or payload. Redelivery targets the named observer without appending the trigger again. Assert new effects, not a second copy of history. |

To test a generated response, put `for` under the command action to pin its generated identifier and `generated <name> = <value>` there to pin a nonidentifier generated field. Neither is an ordinary request parameter. Use `then returns` for the declared scalar or named response fields. Check the appended fact separately if the owner depends on it.

When routing depends on tags, assert the expected tags (including order) or `no tags`; omission leaves them unchecked. Test `not empty` against whitespace when blank input can arrive without being the empty string. For a schedule, use explicit UTC instants: occurrences after `given clock` up to and including `when clock` are due. A trace of one accepted clock tick does not establish how a deployed scheduler handles downtime. For a public contract, assert the foreign input and addressed private fact in the inbound translation, and the published shape from a private fact in the outbound translation. A given foreign event is not a delivered outbound message.

For an ability call, supply deterministic answers in call order: a returned value, a named outcome or a failure. Check the branch and the invocation inputs. For an attached body, require a resolved implementation and a matching execution provider. An omitted expected route leaves it unchecked; use `no stream` when absence is part of the promise. For `given Event for …` use its explicit route or unique producer, or an eligible root projection keyed by event source that establishes a unique type. Do not invent a command to silence an ambiguous given. An unsupported or skipped scenario is not a passing one. `given caller as Persona` supplies a deterministic witness for the modeled policy, not a sample of all users. For a named external signal, use `when trigger <Trigger>` rather than advancing a clock to simulate it. For each disputed rule, record a concrete input, expected observation and the evidence still missing. Try absence, repetition, reversal, collision and a boundary value only when the expected decision changes. Keep the evaluator result separate from real adapter delivery, concurrent appends and browser interaction; prove those at the target that owns them.

For whole-model coverage, use the coverage obligations in `cratis-screenplay-accept-model` (in `cratis/screenplay`).

## Assert graph state independently from query rows

Use `given graph <Graph>` with `has node <Label> <key>` and `has edge <Type> from <source> to <target> [identified by <value>]` to seed a fixture. In `then graph <Graph>`, those forms assert existence, and `no node` and `no edge` assert absence. Use literal keys, and indent any property comparisons under `has`; absence checks take no properties. For a graph with UUID keys and a membership edge:

```play
specification RemovingMembershipKeepsItsNodes
  given graph Organization
    has node Person "6fa459ea-ee8a-4ca4-894e-db77e160355e"
    has node Group "0f8fad5b-d9cb-469f-a165-70867728950e"
    has edge MEMBER_OF from "6fa459ea-ee8a-4ca4-894e-db77e160355e" to "0f8fad5b-d9cb-469f-a165-70867728950e"
  when append MemberRemoved
    groupId = "0f8fad5b-d9cb-469f-a165-70867728950e"
    for "6fa459ea-ee8a-4ca4-894e-db77e160355e"
  then graph Organization
    no edge MEMBER_OF from "6fa459ea-ee8a-4ca4-894e-db77e160355e" to "0f8fad5b-d9cb-469f-a165-70867728950e"
    has node Person "6fa459ea-ee8a-4ca4-894e-db77e160355e"
    has node Group "0f8fad5b-d9cb-469f-a165-70867728950e"
```

Use `given clock "<instant>"` when asserting values mapped from `$eventContext.occurred`. Use `then query <Name>` and `result` to witness the graph query's returned rows separately. A missing row alone can't prove this edge was removed.
