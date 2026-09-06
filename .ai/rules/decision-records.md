---
applyTo: "**/*"
---

# Decision records

A decision is a durable choice with a decider and a date. It is documentation, not a
work record: it lives in `decisions/` (or the repository's documented decisions folder)
and is reviewed like any other documentation. Every line below is tagged **[contract]**
(binding — breaking it makes the record untrustworthy) or **[convention]** (the house
default) per the Three Levels of Authority in [`general.md`](./general.md).

- **[contract] Read before you change.** Before an architectural, contract, scope or
  cross-cutting change, read the accepted decisions in force for the paths you are about
  to touch. A decision you did not read still binds the change.
- **[contract] Cite the ids.** Name the decision ids you relied on, on the work item, in
  the pull request body, and in a commit trailer. A change that silently contradicts an
  accepted record is a defect even when the code is correct.
- **[contract] Never rewrite an accepted record's decision text in place.** The decision
  text is what people relied on. Correct a typo or add clarifying context under a dated
  banner that says what changed and why; change the choice itself only by superseding.
- **[contract] Supersede with two-way pointers.** A superseding record names the record
  it replaces, and the replaced record is marked `superseded` with a pointer forward.
  A reader arriving at either one must be able to reach the other.
- **[contract] Status and stage are the closed sets in
  [`catalog/vocabulary.json`](../../catalog/vocabulary.json)** — `decision.status`,
  `decision.stage`, `decision.class`, `decision.reversibility`. Do not invent a word for
  a state one of those sets already names.
- **[contract] Accepted is not implemented, and implemented is not verified.** Move the
  stage only on the evidence the next stage requires; see
  [`verification-discipline.md`](./verification-discipline.md).
- **[convention] One decision per record.** A record that settles three questions cannot
  be superseded for one of them.
- **[convention] Record what was rejected and why.** The alternative not taken is the
  part a future reader needs most, and the part nobody remembers.
- **[convention] A handover may summarize decisions; it never holds the only copy.**
  See [`local-work-artifacts.md`](./local-work-artifacts.md).
