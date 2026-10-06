# Feature reasoning descriptions

Durable rationale goes in `description` text (it survives canonical printing; `//` comments do
not), only for a real "why". Written as the last step of P3, once the feature's model and
specifications are complete, describing the finished shape, for features with real decisions. A
simple feature needs one or two sentences or nothing. P4 only checks that they exist; if one is
missing, or the self-check forces a model change, return to a modeling batch, author it, and
rerun V1 on the changed revision.

Descriptions never reach rendered code (Stage#178) and are not part of the canonical semantic
revision (`modelRevision`), so editing one does not change it; they do change the source identity
(`verdicts-and-modes.md`). Model the rule first: a rule
that exists only in a description is unenforced in rendered scope.

Cover, briefly and only where real:
1. Scope: the business process and the identities its streams are keyed by.
2. Assumptions beyond the brief, and why (each also listed in STATE.md).
3. Rules kept as constraints or specifications rather than events, so a missing event is not read
   as an oversight; state-dependent rules marked NOT enforced in the model today, with the named
   target enforcement.
4. Corrections made mid-way (re-ordering, re-slicing) that a reader might otherwise undo.
5. Read-model choices: shared views, deliberate fan-in, views split per component, and a
   deliberate omission ("this view drops cancelled bookings").
6. Integration and capability gaps: outside facts, mode gaps.

Slice, command, event and read-model descriptions: one sentence per genuine decision at that
element. Counts, verdicts and session notes belong in STATE.md, never in the model.

## Worked example
`worked-example.md` shows a feature description carrying items 1-3, a constraint instead of a
second event type, and a decided rejection as a specification.
