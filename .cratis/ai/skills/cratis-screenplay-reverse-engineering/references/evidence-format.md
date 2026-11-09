# Evidence format (reverse engineering)

Rows use the single shared schema in
[evidence-format.md](../../cratis-screenplay-event-modeling/references/evidence-format.md):
fields, source kinds, strength, merge rule and classification are defined there and not repeated
here. Write `evidence.jsonl` (and the `EVIDENCE.md` rendering) in `.ai-work/screenplay/<slug>/re/`;
the merge step of the
[understanding pipeline](../../cratis-screenplay-event-modeling/references/understanding-pipeline.md)
combines it with the legacy rows. For the richer table used with source code, see
`../../cratis-screenplay-legacy-extraction/references/evidence-table-template.md`.

## Locator notes for observed systems

- A walk row cites the observation id (`OBS-7`) and the redacted route, plus the screenshot file
  when one exists.
- A HAR row cites `har:<file>#<n>` and the route template (`POST /api/berths/reserve`) with field
  names, never values, cookies or tokens.
- An OpenAPI row cites `openapi:<operation>`; a binary row cites path plus offset, symbol or
  resource, and `RUN-<n>` for an approved run.
- A person or document row cites the section or the person and date.

## Example row

```json
{"id":"E2","fact":"form rejected with \"Berth is already taken for these dates\"","sources":[{"kind":"walk","locator":"OBS-9, captures/screens/OBS-9.png","strength":"observed"}],"strength":"Observed","classification":"intent","unknowns":["is the check atomic under concurrent requests"],"candidate":"Booking/ReserveBerth","decision":"undecided"}
```

## Rules

- Every candidate element cites at least one evidence id; a slice with none is removed or sent
  back to intake.
- Cite ids in a slice `description` ("Evidence: E1, E2") and keep the detail in the table.
