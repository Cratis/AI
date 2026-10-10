# Feature reasoning documentation

Use `description` for a short summary; durable rationale goes in a nonempty fenced
Markdown `documentation` block, only for a real "why". Write feature reasoning as
the last step of P3, once the model and specifications are complete, describing the
finished shape. A simple feature needs one or two sentences or nothing. P4 checks
that substantive decisions have their reasoning; if missing, or a self-check forces
a model change, return to a modeling batch, author it and rerun V1 on that revision.

Screenplay v4.127.0 `slices.md` accepts one `documentation` block directly on a
module, feature, slice, command, event, read model or reaction (not under its trigger).
Use a `markdown` fence; empty, malformed or repeated blocks report PLAY0558, with
PLAY0477 retained for events. Specifications accept `description`, not documentation;
put their longer reasoning on the owning slice. Projections/screens do not accept it.
Canonical printing retains documentation on its owner. It is report-only (PLAY0270),
absent from executable bytes and `modelRevision`; edits change source identity
(`verdicts-and-modes.md`). Neither description nor documentation is rendered as code
(Stage#178): model the rule first, never treat prose as enforcement.

Cover, briefly and only where real:
1. Scope: the business process and the identities its streams are keyed by.
2. Assumptions beyond the brief, and why (each also listed in STATE.md).
3. Rules kept as constraints or specifications rather than events, so a missing event is not read
   as an oversight; state-dependent rules marked NOT enforced in the model today, with the named
   target enforcement.
4. Corrections made mid-way (re-ordering, re-slicing) that a reader might otherwise undo.
5. Read-model choices: shared views, deliberate fan-in, views split per component, and a
   deliberate omission ("this view drops cancelled bookings").
6. Integration and capability gaps, each substantive one (outside facts, cross-feature or
   cross-module dependencies, mode gaps) as: the finding, the viable resolutions, and the
   open question or decision that records the choice (`Qn <address>`, or the decision in
   STATE.md), so the documentation and the question agree.
7. A closing line for a feature with real decisions: what is covered (declaration kinds and
   the specification matrix in words, not a counter that goes stale). Review results and
   verdicts are never written into documentation (it is authored before review and would change
   the reviewed source identity); they live in STATE.md and the packet.

Write for the next person or session who opens the model cold, not for whoever just built it.
Add a note **at any phase**, at the element it applies to, when an assumption fills a gap the
brief left open, an alternative was rejected, or a constraint is not obvious; never as routine
narration of what a step did. Complete the feature's reasoning at the end of P3.
If a feature's story is genuinely simple, say so briefly rather than padding; where real
decisions sit behind it, documentation preserves why they were made.

Slice, command, event, read-model and reaction documentation: one sentence per genuine
decision at that element. Counts, verdicts and session notes belong in STATE.md, never in the model.

## Worked example
`worked-example.md` shows feature documentation carrying items 1-3, a constraint instead of a
second event type, and a decided rejection as a specification.
