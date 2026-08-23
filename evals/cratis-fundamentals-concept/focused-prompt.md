# Focused Fundamentals concept behavior check

Use only the supplied Cratis skill contract. Do not use tools, network access,
model memory, or external product facts. Do not perform the coding tasks.

For every case, choose exactly one decision:

- `USE_VALUE_CONCEPT`
- `USE_EVENT_SOURCE_ID`
- `USE_NULLABLE_CONCEPT_REFERENCE`
- `SKIP_ENUM`
- `SKIP_DTO`
- `DEFER_EVENT_MIGRATION`
- `USE_SURROGATE_STREAM_ID`
- `REJECT_EVENT_SOURCE_ATTRIBUTES`
- `DEFER_ARC_IDENTITY`
- `DEFER_CHRONICLE_COMPLIANCE`

Return a JSON array only, in case order. Every item has exactly `caseId`,
`decision`, and a concise `rationale`. Do not include Markdown fences or other
commentary.

The caller appends the cases without expected decisions.
