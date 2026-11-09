# Process drift

Use when a model is accepted and the observed system has since changed. Do not rebuild the
model. The question is whether the system still does what the model says (process drift), not
whether its structure changed (architecture drift).

**Input:** the watermark recorded with the model (`evidence-format.md`, Watermark) and the
current state of the same sources: two OpenAPI documents, two binary or app versions, two
capture sets, or, when source is offered, `<commit>..HEAD` (`cratis-screenplay-legacy-extraction`,
`re-entry-and-passes.md`). The diff between the two states is the work list.

## Steps

1. Compare watermarks per feature. Unchanged features are reported "unchanged since
   <watermark>" and not touched.
2. For each touched feature, classify every hunk of the diff:
   - **process**: a command, field, rule or validation message, authorization, event, state
     change, read-model field, job, side effect or screen field was added, changed or removed;
   - **structure only**: a rename, move, refactor, layering, dependency or formatting change
     that leaves observable behavior alone. Report these as one count and never model them.
3. Re-derive only the flows a process hunk touches, from entry point to persisted or visible
   effect, with the probes of `probing-and-naming.md` for the changed commands and queries.
   Keep evidence ids stable; list retired ids.
4. Output two lists. The **model delta**: slices, rules and events added, changed or removed,
   with evidence ids. The **behavior changes** in business words ("a refund after 30 days is now
   rejected"), each with its locator and old versus new value.
5. Give a verdict per feature: `no drift`, `drift: model update proposed` or
   `drift: needs owner decision`. Every change is a question for the owner; an accepted decision
   is not edited from the diff. Append the new watermark only to features that were reconciled.
