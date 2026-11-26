---
name: cratis-screenplay-recover-intent
description: Compares inherited code or observed behavior with a proposed model. Use when recovering intent from an existing application or recording. Not for deciding a missing business rule (use cratis-modeling-discover-timeline).
compatibility: Requires the Screenplay CLI to check the candidate model.
---

# Separate what happened from what the model proposes

Trace one input in one bounded recording or host observation. Record observed behavior, inferred intent and proposed changes separately.

1. Name the caller, input and visible outcome. Record only the observations available for this journey.
2. For host observations, match the store, namespace and sequence interval to the compiled model. For event relationships use `ObservationComparison.Compare(compilation, snapshot, map)` from `Cratis.Screenplay.Observations` in the `Cratis.Screenplay` package. Pass the compiled candidate model and the host-supplied snapshot; this method does not fetch events or compare their payload values.
3. Use `ObservationIdentityMap.FromModel(compilation.Model)` for stored event names and unique command names. Supply the host producer and consumer identities for a reaction with `.With(...)`.
4. Write the smallest candidate declaration consistent with the observation. List missing facts as questions for the domain owner.

## Example: an inherited Authors screen

A recording of the Library shows a librarian submitting Aster and then seeing Aster in the list. Record the appearance as observed. A stored registration event is an inference until the matched history shows it. A blank-name refusal is unobserved, not an established rule.

Put this candidate view in `model/Authors/list.play`. It needs no imports:

```play
concept AuthorId : Uuid

module Library
  feature Authors
    slice StateView ListAuthors
      readmodel Author
        id AuthorId key
        name String
      query AllAuthors => observable Author[]
```

This declaration proposes a query; it does not identify the mechanism that updated the recorded screen.

## Avoid

- Don't read live history from an embedded board; it contains generated model information.
- Don't guess reaction identities from displayed names.
- Don't turn no match in a bounded interval into a claim that the event never happened.
- Don't treat an unreadable operation phase as a partial list of ability calls; report the reason it could not be read.

## Related skills

- [Discover the timeline](../cratis-modeling-discover-timeline/SKILL.md) for missing business decisions.
