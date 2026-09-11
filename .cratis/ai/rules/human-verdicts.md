---
applyTo: "**/*"
---

# Questions only a human may settle

Some questions must stop the work and raise a verdict request rather than be answered by
reasoning about them. Every line is tagged **[contract]** (binding) or **[convention]**
(the house default) per the Three Levels of Authority in [`general.md`](./general.md).

## Stop and ask

- **[contract] Product, scope or domain rulings** — what is built, for whom, what it
  promises, and where the boundary of this piece of work is.
- **[contract] Legal, licensing and compliance sign-off.**
- **[contract] Anything touching secrets** — obtaining, rotating, storing, or moving a
  credential, token or key. Never place a secret value in a file, a record, or a message.
- **[contract] Consent and personal data** — collecting it, sharing it, or changing what
  a subject was told.
- **[contract] Live environments** — anything that runs against production or against
  data someone else depends on.
- **[contract] Releases and publication** — cutting a version, publishing a package,
  pushing an image, or anything that notifies people outside the work.
- **[contract] Destructive or irreversible actions** — deletion, bulk mutation, history
  rewriting, or any change with no prepared inverse. See the Interactive Agent Mutation
  Protocol in [`general.md`](./general.md).
- **[contract] Overriding an accepted decision** — a decision in force is changed by
  superseding it, not by working around it; see
  [`decision-records.md`](./decision-records.md).

## How to ask

- **[contract] A missing answer is a blocker, never a default.** Do not pick the likely
  answer and proceed. Record the blocker from the `work-item.blocker` set in
  [`catalog/vocabulary.json`](../../catalog/vocabulary.json) and stop.
- **[contract] One verdict request states one question, its kind, and the dispositions
  that answer it** — the `verdict-request.kind` set in the vocabulary names the four
  kinds and what may answer each.
- **[contract] An answer authorizes exactly what it names.** Approval of one plan,
  manifest or target set is not approval of a changed one.
- **[convention] Bring the facts with the question.** State what is known, what was
  tried, and what each answer would cause — a verdict request that makes the human
  reconstruct the situation is a slower blocker, not a faster one.
- **[convention] Record the disposition where the question was asked**, so the answer
  outlives the session that received it.
