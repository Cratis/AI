---
applyTo: "**/*"
---

# Work records and comments

A work item says what is being asked for and what it is waiting on. A comment is a
notification with a cost, so it carries exactly one kind of content. The value sets are
closed and live in [`catalog/vocabulary.json`](../../catalog/vocabulary.json) — do not
invent a word one of them already names. Every line is tagged **[contract]** (binding) or
**[convention]** (the house default) per the Three Levels of Authority in
[`general.md`](./general.md).

## Work items

- **[contract] Exactly one `next:` per item**, from the `work-item.next` set: `triage`,
  `human-decision`, `human-input`, `owner-acceptance`, `ai-plan`, `ai-candidate`,
  `human-review`, `owning-system`, `none`.
- **[contract] Exactly one `blocker:` per item**, from the `work-item.blocker` set:
  `none`, `authority`, `owner`, `scope`, `dependency`, `evidence`, `security-privacy`,
  `capacity`, `external-system`, `stale`. `none` means not blocked — an item is never
  left without one.
- **[contract] A blocker names what would unblock it.** "Blocked" without the missing
  fact, decision or actor is a status, not a blocker.
- **[contract] Closure states a disposition** from the `closure.disposition` set:
  `fully-resolved`, `partly-addressed`, `not-addressed`. Anything less than fully
  resolved names what remains and where it went.
- **[convention] Age is never evidence.** An old item is not a stale item; `stale` means
  the premise no longer holds.

## Comments

- **[contract] One kind per comment**, from the `comment.kind` set. A comment that
  acknowledges, reports status and asks a question is three comments' worth of content
  and none of their clarity.
- **[contract] A comment is warranted only when it changes what a reader must do** —
  a request, an answer, a material change of state, or evidence someone needs. Progress
  narration is not.
- **[contract] At most one mention per request revision.** Re-mentioning the same person
  for the same unanswered request is noise, not escalation.
- **[contract] A correction is its own comment.** Never edit an earlier comment to make
  it look right; post a `correction` that says what was wrong.
- **[convention] Link, do not restate.** Point at the evidence or the decision record
  rather than copying it into a comment where it will drift.
