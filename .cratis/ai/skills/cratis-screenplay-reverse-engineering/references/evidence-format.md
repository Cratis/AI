# Evidence format (reverse engineering)

Rows use the single shared schema in
[evidence-format.md](../../cratis-screenplay-event-modeling/references/evidence-format.md):
fields, source kinds, strength, merge rule and classification are defined there and not repeated
here. Prefix every id `RE-` (`RE-E1`) so it cannot collide with another lane's rows at merge. Write `evidence.jsonl` (and the `EVIDENCE.md` rendering) in `.ai-work/screenplay/<slug>/re/`;
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

## Probe budget and table

A batch of API probes against one command counts as one L2 walk state, not one per case, so
the default walk budget does not forbid boundary sweeps. Keep one compact table per command
in `captures/` and cite its file from the rule rows:

| case | input | outcome | message |
|---|---|---|---|
| name empty | `""` | rejected | verbatim text |
| name 101 chars | 101 x | rejected | verbatim text |

## Example row

```json
{"id":"RE-E2","fact":"form rejected with \"Berth is already taken for these dates\"","sources":[{"kind":"walk","locator":"OBS-9, captures/screens/OBS-9.png","strength":"observed"}],"strength":"Observed","classification":"intent","unknowns":["is the check atomic under concurrent requests"],"candidate":"Booking/ReserveBerth","decision":"undecided"}
```

## Rules

- Every candidate element cites at least one evidence id; a slice with none is removed or sent
  back to intake.
- Cite ids in a slice `description` ("Evidence: RE-E1, RE-E2") and keep the detail in the table.
