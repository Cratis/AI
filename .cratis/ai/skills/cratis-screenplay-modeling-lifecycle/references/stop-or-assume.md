# Stop or assume: triggers, question format and the interview protocol

## Interview protocol (attended and unattended)
Assume visibly during modeling; delivery blocks any guess that could encode a wrong rule,
authorization, money or time behavior. Contradictions, a third review round, a gate only the
user can accept, and approvals not yet given always stop.

- **When to ask.** Information this phase needs is missing or ambiguous: ask, using the phase
  skill's critical questions as the guide, and follow its listed follow-up trigger on the answer.
  The phase already has what it needs: skip straight to its work and do not ask for what you hold.
- **Unless told not to ask** (an unattended run, or the user said not to stop for questions), in
  modeling: do not block. Proceed on the most reasonable assumption for anything missing and state
  it plainly in this phase's record, visibly, so it can be corrected later. Never guess silently.
  This does not extend to delivery (P7-P9, gap-fill), where a guess that could encode a wrong rule,
  authorization, money or time behavior blocks as in "Delivery triggers" below. Modeling assumptions about such rules are
  recorded visibly with their address. Unconditionally, contradictions, a third review round, a gate only the user can accept, and approvals not yet given always stop.
- **Recording the outcome.** Under the phase's Interview Trail row in STATE.md write what was
  asked and decided, or, if nothing was asked, what was assumed and why
  (`handoff-template.md` section 1).
- Ask the one question that changes the model most; follow up on vague answers ("it depends",
  "usually", "sometimes") with "what decides it?". Do not interrogate for what a skill, the tool
  or the Screenplay docs already answer.
- Attended: ask, and record the answer in STATE.md as a decision.
- Unattended: assume visibly. Write each assumption with its address and the consequence if wrong,
  and record in the Interview Trail which items were **asked** and which were **assumed**.
- A decided rejection is a specification, not a note: when the user says "never X", add the
  `then denied` or `then error` specification in P3.
- One closed outcome per run. A run that neither progressed nor closed is a failure to report:
  say what blocked it and which question would unblock it.

## Question format (STATE.md, packets, edit requests)
`Qn <declaration address>: <what is missing or contradictory, one sentence> - matters because
<consequence> - <assumption in use | blocked scope>`. Write it so a reader who has not opened
the model understands it cold. "Please clarify" is not a question. A named address beats a name
inferred from prose.

## Delivery triggers (stop that scope)
- A rule stated in a `description` has no `validate`, `require`, constraint or specification.
- A specification's `given` names an event no command, reaction or capture produces in scope.
- A `description` and the specifications disagree on behavior.
- The slice depends on an event, read model or command that is neither declared nor imported,
  and it is unclear whether it should exist.

In modeling these are findings (critic) or open questions (modeling), not stops.

## Not triggers
Naming conventions, file layout, formatting, which generated hook to use, anything the phase
skill, toolchain or Screenplay docs answer, "nice to confirm".

## Calibration
A blocked scope should reliably mean a person has to decide. A wrong guess encoded into committed,
tested code is harder to catch than a paused scope; in modeling the opposite holds, because an
assumption is cheap to revise and visible to the reviewer.

## Always stop
Contradictions, a third review round, a gate only the user can accept, and approvals not yet
given for a named target. Approval is not repeated for the same scope.

## Unblocking
A scope leaves `blocked` only when its question is answered; record the answer as a decision in
STATE.md and, when durable, in the model `description`. Re-blocking a blocked scope is a no-op.
Blocked delivery scopes are reported in the packet; the main session creates any issue.
