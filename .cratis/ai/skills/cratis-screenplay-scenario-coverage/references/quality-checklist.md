# Quality checklist

The scenario quality checklist.

- Every command has a success spec, a spec per rule, and state-violation specs where a lifecycle
  exists; every gated command and query has its own denial.
- Givens state the facts and their sources; outcomes list the exact events or the exact message.
- Tag-sensitive outcomes assert the exact ordered list (duplicates included) or `no tags`; omission means unchecked, not empty. Syntax and compiler prerequisite: [then-event tags](../../cratis-screenplay-specifications/references/event-tags.md).
- Include missing, extra, reordered and duplicate-tag boundary cases wherever routing or classification depends on tags.
- Missing tag expectations in a board or fixture view are not proof of coverage: those views omit them. Inspect source or executable `expectedTags` and record reference execution evidence.
- Every read model has population, update and (where it removes) removal specs.
- Alternative paths, compensation and external failure are specified or carry a reason.
- Each matrix cell holds a value; each `n/a` is a domain reason.
- No command has only two specs (success and one rejection) unless every other type was reviewed
  and found inapplicable for a domain reason.
- Read models are a separate, equally mandatory pass: a model with dozens of command specs and no
  read-model spec is not scenario-complete. Population, then update or removal where an event
  supersedes a row.
- The why behind each business rule is written down (slice `documentation`), not only the what.
- Good and bad forms of givens, outcomes and rejections: `references/scenario-examples.md`.
