# Specifications

A `specification` is a scenario inside a slice. It establishes state (`given`), performs at most one
action (`when`) and states the outcome (`then`). It is the acceptance criterion for that behavior: build
one automated test per specification, named after it, that arranges the givens, performs the action and
asserts every outcome.

```screenplay
specification RejectingADuplicateTitle
  description "Titles are unique, whatever their casing"
  given caller
    authenticated
    role "Librarian"
  given clock "2026-03-02T10:00:00Z"
  given BookRegistered
    for "0b3f6a52-7c1d-4e8f-9a2b-3c4d5e6f7a81"
    title      = "The Left Hand of Darkness"
    copies     = 3
    registered = "2026-03-02T09:00:00Z"
  when RegisterBook
    bookId = "0b3f6a52-7c1d-4e8f-9a2b-3c4d5e6f7a83"
    title  = "the left hand of darkness"
    copies = 1
  then error "A book with that title is already registered"
```

## Given

| Clause | Means | In a test |
| --- | --- | --- |
| `given <Event>` with `for <id>` | This fact was already recorded on that event source | Record the event, or seed the state it produces, before acting |
| `given readmodel <ReadModel>` | This view state already exists | Seed the view directly |
| `given caller` with `authenticated`, `role`, `claim` | Who performs the action | Run the action as that caller |
| `given caller as <Persona>` | The caller a persona describes | Same, with the persona's roles and claims |
| `given clock "<instant>"` | The current time | Fix the clock; `$context.occurred` then equals it |
| `given capture <Capture>` | Outside data already observed | Seed the outside data |

## When

| Clause | Means |
| --- | --- |
| `when <Command>` with property lines | Run the command with that input; `for <id>` names its event source |
| `when append <Event>` | Record the event directly, then check the views it changes |
| `when query <Query>` with arguments | Ask the query |
| `when clock "<instant>"` or `when trigger <Trigger>` | Time passes or a declared trigger fires |
| `when capture <Capture>` | Outside data arrives |

## Then

| Clause | Asserts |
| --- | --- |
| `then <Event>` with property lines | That event was recorded, with those values, in authored order; `for <id>` names its event source |
| `then events in any order` | The asserted events in any order, still exactly that many |
| `then no events` | Nothing was recorded |
| `then readmodel <ReadModel>` | The view instance has those values; `exactly` means no other property differs |
| `then no readmodel <ReadModel> for <key>` | That instance does not exist |
| `then query <Query>` with `arguments` and `result` blocks | The query answers those rows, in order; `exactly` compares whole rows |
| `then result` | The command's response has those values |
| `then error "<message>"` | The action was rejected with that message, verbatim, and recorded nothing |
| `then denied` | The caller was refused by authorization, which is not a validation error |

Values are literals (`"text"`, `3`, `true`, `null`), lists and objects in JSON form. A property not
mentioned in a `then` block is not asserted unless `exactly` is present. A rejection asserts the message
the model declares; when the message is a `$strings.<key>` reference, assert the key or its resolved text,
as the kit specifies.

## The model's own run is not your test

The Screenplay tools can run a model's specifications against an in-memory reference evaluator
(`run-specifications` or `screenplay test`). That proves the **model** is consistent; it does not test
your code. Use it to understand the expected outcome when a specification is hard to read, and still
write and run the test in the kit's stack.
