---
name: cratis-modeling-review-event-model
description: Use when reviewing an existing event model or its implementation for event modeling or event sourcing mistakes. Not for designing slices or tracing the impact of a changed rule (use cratis-modeling-design-event-model).
---

# Review an event model or its implementation

Pick one outcome that matters to a caller. In Library, the librarian registers Aster and sees that author in the open Authors list. Start with the evidence available: a sketch, an agreed example with code, or a Screenplay model. Identify only the command or trigger, decision inputs, addressed fact and consuming view or effect needed to explain the outcome.

If there is nothing yet to review, [design from the agreed timeline](../cratis-modeling-design-event-model/SKILL.md). To reconstruct what the code does rather than critique it, use `cratis-modeling-trace-existing-behavior`. For designing Screenplay streams and their consistency rules, use `cratis-screenplay-streams-and-consistency` in `cratis/screenplay`.

- Read [model findings](references/model-findings.md) when the question concerns what happened, whose history changed, where a value came from or which outcome a slice promises.
- Read [implementation findings](references/implementation-findings.md) when inspecting how the command is handled, facts are stored or effects are delivered. With only a sketch, skip runtime checks.

Report findings in order of consequence. Name the affected element, distinguish observed results from inference, and explain which agreed outcome fails or how a concrete failure could occur. Give the smallest correction and the task that owns it.

> **RegisterAuthor — blank name accepted.** The agreed example requires refusal with no append. The form blocks submission, but the supplied server request result and event history show a blank name accepted and recorded. A caller outside the form can therefore register an unnamed author. Keep the form feedback; enforce the name rule on the server command (`cratis-arc-validate-command` skill).

If intent, guard or destination is unknown, ask one question that would settle it. A suspicious name alone is not a finding. If nothing consequential emerges, report “no findings in the examined path” and name what was not examined. A review does not confer acceptance: report without editing, running mutations or requiring new specifications.
