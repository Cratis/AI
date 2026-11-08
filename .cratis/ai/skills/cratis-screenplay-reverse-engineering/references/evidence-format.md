# Evidence format

One file records every fact the model rests on: `EVIDENCE.md` (a markdown table), optionally
mirrored in `evidence.jsonl` (one JSON object per line) when scripts or other agents consume it.
Both live in `.ai-work/screenplay/<slug>/re/`. For the richer table used with source code
(generator disposition, traceability, field chains), see
`../../cratis-screenplay-legacy-extraction/references/evidence-table-template.md`.

## Contents

- Fields
- Strength
- Classification
- Unknowns
- Table example
- JSON lines example
- Rules

## Fields

| Field | Content |
|---|---|
| `id` | stable, never reused (`E1`, `E2`, ...) |
| `sourceKind` | `walk`, `har`, `openapi`, `screenshot`, `doc`, `binary`, `run`, `source`, `person` |
| `locator` | state id (`OBS-7`), request id or `har:<file>#<n>`, screenshot file, `openapi:<op>`, document section, binary path plus offset, symbol or resource, process-run id (`RUN-3`), file written, or `path:start-end` |
| `fact` | what was seen, in neutral words, no intent |
| `strength` | see below |
| `classification` | see below |
| `unknowns` | what this row does not establish, as a question; `none` only when true |
| `candidate` | declaration it feeds (`Booking/ReserveBerth`) or `none`; proposed, never evidence |
| `decision` | `undecided`, `keep`, `change` or `remove`, and who decided |

Evidence and decisions are separate columns: the first six fields are as-is, the last two are
target.

## Strength

| Strength | Meaning |
|---|---|
| `Confirmed` | observed in a capture or walk and corroborated by a second source kind |
| `Observed` | seen once in a walk or HAR |
| `Declared` | stated by an OpenAPI document |
| `Read` | found in source |
| `Stated` | said by a person or document |
| `Inferred` | a reading of other rows; always cites them |

## Classification

`intent`, `consequence`, `infrastructure`, `noise` or `unknown`. A write with no visible user
command behind it is a `consequence` with a subclass: `maintenance`, `correction`, `integration`, `scheduled` (only with an
evidenced trigger) or `unexplained`; never assume an automation.

## Unknowns

- Every row carries its unknowns. The common ones: the rule behind a rejection, who is allowed,
  whether the call repeats safely, what else changed, what a different role sees.
- Each unknown that blocks modeling becomes a question with an owner and an interim assumption,
  recorded as an anchored `question` note on the candidate.
- Never fill a gap by guessing and then citing the guess as evidence. A gap you could not close
  stays `unknown` in the model's notes and in the final report.

## Table example

| id | sourceKind | locator | fact | strength | classification | unknowns | candidate | decision |
|---|---|---|---|---|---|---|---|---|
| E1 | har | `har:booking.har#12` | `POST /api/berths/reserve` with `berthId`, `memberId`, `from`, `to` returned 201; the next `GET /api/reservations` lists it, and walk `OBS-8` shows it in the list | Confirmed | intent | who may reserve for another member? overlap rule? | `ReserveBerth` -> `BerthReserved` | undecided |
| E2 | walk | `OBS-9`, `captures/screens/OBS-9.png` | form rejected with "Berth is already taken for these dates" | Observed | intent (rule) | is the check atomic under concurrent requests? | refusal on `ReserveBerth` | undecided |

## JSON lines example

```json
{"id":"E1","sourceKind":"har","locator":"har:booking.har#12","fact":"POST /api/berths/reserve returned 201; GET /api/reservations then lists it","strength":"Confirmed","classification":"intent","unknowns":["overlap rule","who may reserve for another member"],"candidate":"ReserveBerth","decision":"undecided"}
```

## Rules

- Every candidate element cites at least one evidence id; a slice with none is removed or sent
  back to intake.
- Keep locators redacted: route templates and field names, not values, tokens or personal data.
- Add rows as you go; do not rewrite ids when rows are split or merged, retire them with a note.
- Cite ids in a slice `description` ("Evidence: E1, E2") and keep the detail in the table.
