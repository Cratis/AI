<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Typed inbox messages

Each lane has an inbox directory under `<work-root>/inbox/<lane-id>/`. A sender
writes one file per message into the recipient's inbox and keeps a copy in its
own `<work-root>/outbox/`. Messages are work records: they live only under
`.ai-work/` and never enter git history.

## Message types

| Type | Sent when | Extra required fields |
|---|---|---|
| `claim` | A lane takes unowned work | `target`, `lease-until` |
| `delivery` | Work is ready for the coordinator | `branch`, `head`, `gate-result` |
| `blocked` | Waiting longer than the blocked-report threshold | `blocker`, `need`, `since` |
| `question` | A consequential choice needs an answer | `options`, `recommendation` |
| `decision` | An answer to a `question`, or a ruling | `answers`, `decider` |
| `capacity` | A lane can take or must shed work | `available`, `until` |
| `roll-call` | The coordinator asks for state | `reply-by` |

Every message also carries `from`, `to`, `type`, `topic`, `sent` (UTC) and a
body of at most ten lines. A delivery names a full `head` SHA and the exact
gate result, never "tests pass".

## File naming

`<from>-to-<to>-<topic>-<utc>.md`, where `<utc>` is `YYYYMMDDTHHMMSSZ`. Example:
`A1-to-B2-schema-review-20250101T120000Z.md`.

## Reading your inbox

A lane reads only messages addressed to it. Match the lane id as a **whole
token** and exclude your own outbound files, otherwise one id that is a prefix of
another reads the wrong mail.

```bash
# Accept files addressed to A1; reject A10-to-..., and reject files A1 sent.
ls "<work-root>/inbox/A1" | grep -E '^[A-Za-z0-9]+-to-A1-' | grep -v -E '^A1-to-'
```

Checkable behavior with the ids `A1` and `A10`:

| File name | Result |
|---|---|
| `B2-to-A1-schema-review-20250101T120000Z.md` | accepted |
| `B2-to-A10-schema-review-20250101T120000Z.md` | rejected (different token) |
| `A1-to-B2-schema-review-20250101T120000Z.md` | rejected (your own outbound file) |

Never match with an unanchored substring such as `grep A1`, which also accepts
`A10`. After reading, move the file to `<work-root>/inbox/<lane-id>/read/`.

## A good message

```markdown
from: B2
to: A1
type: delivery
topic: schema-review
sent: 20250101T120000Z
branch: schema-migration
head: 0123456789abcdef0123456789abcdef01234567
gate-result: gate command exit 0, run 1234567890

The migration and its specs are on `schema-migration`. Owned files only.
Verified with the gate command from the brief; nothing else was run.
```

## A bad message

```markdown
hey, I think I'm done with the schema thing, tests were passing earlier,
can you merge when you get a chance?
```

It has no type, no recipient, no branch or SHA, no gate result, and "earlier"
is memory rather than evidence. The recipient cannot act on it without asking.
