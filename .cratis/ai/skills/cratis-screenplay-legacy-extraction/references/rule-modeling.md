# Modeling legacy rules truthfully

## Refusals
- Input or constraint rejection: declarative `validate`, `require` or constraint, plus a
  `then error "<exact legacy message>"` specification.
- Authorization refusal: `authorize` with a policy (role, claim, authenticated, or an
  ownership policy) plus `then denied`, with caller fixtures carrying the roles or claims.
  Every command and query under an inherited module or feature `authorize` gets its own
  `then denied` spec. A role gate with no executable form is a recorded gap.
- Legacy HTTP status and check order (for example 409 before 403) are facts about the old
  system: record them in the slice description and the evidence row, not in the model logic.

## State-dependent rules
A rule that depends on stored state (current status, existing records, balances) is written
as `reads <View>` + `require <expr> message "…"` and the slice description says it is **NOT
enforced in the model today** (PLAY0268/0271 at binding are expected in design mode;
Screenplay#129/#209). Name the invariant, the race it leaves open, and the target:
`[ProtectedDecision]` + `DecisionRead<T>` (Arc 22.39.0 and later; hand-written code only,
not available in Stage-rendered applications, which pin Arc 22.25.0), or a Chronicle
`concurrency` scope on the event source or stream, or a constraint where one fits. Forbidden: caller-supplied copies of state
in `require`, boolean inputs standing in for a rule (`confirmsX == true`), and rules hidden in
`handler`/`implementation hint` prose. Descriptions are not rendered (Stage#178), so a rule
that exists only in prose is unenforced; list it in LOSS.md too.

## Unique indexes
When the business meaning is clear, write `unique <prop> on <every event that sets the
value>` with `released by <removal event>` and a pinned `message`, and list the open
questions: collation and case, whether the value may be reused after release, soft-deleted
rows. A constraint covers only the events it names, so name them all. Use a bare `rule` only
when no constraint form fits, and record that as a loss. Purely technical keys stay out.

## Other defaults
- No nullable event properties by default; a required value or a separate event.
- Never PII on the event-source id; one data subject per event or stream.
- Tokens, magic links and signed URLs are not facts (a keyed hash or reference at most).
- Do not store clock-relative state (`IsOverdue`) in views; store the deadline.
