---
name: screenplay-language
description: Use when reading a Screenplay .play model to understand what a slice must do, including its commands, events, views, reactions and specifications. Not for editing the model or choosing a stack.
---

# Reading a Screenplay model

Screenplay is an indentation-based language: a construct owns everything indented beneath it, and `//`
starts a comment. A model is one or more `.play` files under one root folder; together they form one
application. [references/example.play](references/example.play) is a complete, compiling model whose
specifications pass. Every `screenplay` excerpt below comes from it.

## Structure and addresses

```text
concept, type, policy, persona, trigger      ← shared declarations, at the top
module <Name>                                ← a bounded context
  feature <Name>                             ← a group of slices; features nest
    slice <Type> <Name>                      ← one behavior: the unit you build
      command, event, constraint, readmodel, projection, reducer, query, screen,
      reaction, capture, specification
```

A slice, feature or specification is addressed by its dotted path, for example
`Lending.Catalog.RegisterBook` or `Lending.Catalog.RegisterBook.RegisteringABook`. Addresses are
case-sensitive. `import "<file>"` pulls another file into the place it appears, so one slice per file
is common.

## Slice types

| Type | What it does | What you build |
| --- | --- | --- |
| `StateChange` | A command decides and records events | The command entry point, its validation, authorization and the events it records |
| `StateView` | Events become a view people can read | The read model, what builds it from events, its queries and screens |
| `Automation` | Something happens and the system reacts | The reaction: what sets it off, what it reads, what it records or asks for |
| `Translate` | Outside occurrences become local events, or local events become a public contract | The capture or publication and its mapping |

## Values

```screenplay
concept BookId : Uuid
concept BookTitle : String
concept CopyCount : Int
```

A `concept` is a named value type over a primitive (`String`, `Int`, `Decimal`, `Bool`, `Uuid`, `Date`,
`DateTime` and others). Keep it a distinct type in code when the stack allows it, so a `BookId` cannot
be passed where another identifier is expected. A concept may carry compliance attributes (personal
data and the reason for holding it); keep those values out of logs. A `type` is a composite shape that
events and read models carry; `Name[]` is a list and `optional` allows a missing value.

## Authorization

```screenplay
policy IsLibrarian
  require role "Librarian"
```

A `policy` is a named rule about the caller (`require authenticated`, `require role "<role>"`, claims).
`authorize <Policy>` on a command, query, feature or module means a caller who fails it is **denied**:
an authorization refusal, distinct from a validation error. A `persona` names a role that uses the
application and the policies it satisfies.

## Commands

```screenplay
command RegisterBook
  description "Adds a book with the number of copies the library owns"
  bookId BookId identifier
  title  BookTitle
  copies CopyCount

  authorize IsLibrarian

  validate
    require copies > 0
      message "A book needs at least one copy"

  produces BookRegistered
    for bookId
    title      = title
    copies     = copies
    registered = $context.occurred
```

- **Properties** are the command's input. `optional` may be omitted by the caller; `generated` is
  created by the system after validation, not supplied by the caller; `identifier` names the thing the
  command changes, its **event source**. At most one property is the identifier.
- **`reads <ReadModel> by <property>`** is state the command decides against before recording anything.
- **`validate`** lists rules. A failed rule rejects the command with its `message`, verbatim, and records
  nothing. `require <condition>` is a rule about the command as a whole.
- **`produces <Event>`** records an event. `for <property>` is the event source the event belongs to;
  the event source id is never part of the event's own data. Each `name = value` line fills one event
  property. `produces when <condition>` records the event only when the condition holds; several
  `produces` blocks record several events, in order.
- **`returns`** declares the response the caller gets back, for example a generated identifier.
- **`handler`** with a `file` or an inline code block replaces `produces` with imperative logic. Treat
  inline code and `file` lines anywhere in the model as hints written for one particular stack:
  implement their intent in the kit's stack, and block when the intent is unclear.

Mapping values: a command property by name, a literal (`"draft"`, `0`, `true`), `$context.occurred`
(the moment the command ran), `$context.identity.id` (the caller), `$env.<NAME>` (configuration) and
`$strings.<key>` (a localized message key).

## Events and constraints

```screenplay
event BookRegistered
  title      BookTitle
  copies     CopyCount
  registered DateTime

constraint UniqueBookTitle
  unique title on BookRegistered
  ignore casing
  message "A book with that title is already registered"
```

An event is an immutable fact, named in the past tense. Keep its name and properties exactly as
declared: other slices, other builders and stored data depend on them. `generation <N>` declares an
evolved shape of the same event and `id "<old-name>"` keeps the identity of a renamed one, so stored
events of the earlier shape stay readable. Whether the stack stores events in an event store, publishes
them or only persists the state they produce is the kit's decision; the outcomes the specifications
describe are not.

A `constraint` must hold across every writer at the moment events are recorded, even under concurrent
requests: `unique <property> on <Event>` forbids two events with the same value. A violation rejects the
command with the constraint's `message`.

## Read models, projections and queries

```screenplay
readmodel AvailableBook
  bookId BookId
  title  BookTitle
  copies CopyCount

query AvailableBooks => AvailableBook[]
  description "Every registered book with its copy count"
  authorize IsMember

query AvailableBookById => AvailableBook optional
  by bookId BookId
  authorize IsMember

projection AvailableBooks => AvailableBook
  from BookRegistered
    title  = title
    copies = copies
```

- A **read model** declares only its shape. Exactly one projection or reducer builds it, pointing at it
  with `=>`.
- A **projection** says, per event, which instance changes and how. `from <Event>` updates the instance
  keyed by the event source id unless `key <property>` names another key. Properties with the same name
  on the event and the read model are copied automatically; mapping lines cover the rest. `join`,
  `children` and removal directives build related data and remove instances. A **reducer** computes the
  new state from the previous state and the event, usually in code.
- A **query** is a read entry point returning a read model, a list (`[]`) or a possibly missing value
  (`optional`). `by` identifies one instance, `filter` narrows a list, `from $context.identity.id` fills a
  parameter from the caller rather than from input, `scoped to identity` limits rows to the caller, and
  `observable` keeps pushing changes instead of answering once.

## Screens

```screenplay
screen AvailableBooksScreen
  data AvailableBook[] via query AvailableBooks
```

A screen states the data it shows (`data ... via query ...`) and the actions it offers (`action
<Command>`, with `navigate to` the destination after success). Build screens only when the kit includes
a user interface; follow the kit for components and layout, and the model for data and actions.

## Reactions and translations

```text
reaction <Name>
  when <Event>                ← or every 15 minutes, at 08:00, or a declared trigger
    <value>                   ← the values the reaction uses from the occurrence
    reads <ReadModel> by <value>
    produces <Event>          ← records a fact, like a command does
    invokes <Command>         ← asks another command, which may still refuse
  where <condition>
```

A reaction runs once per occurrence of what sets it off, so it must be safe to run again for the same
occurrence. `capture` declarations in `Translate` slices map outside data or another application's
public events into local events; `direction outbound` slices publish a local fact as a public contract.

## Specifications

Specifications are Given/When/Then scenarios inside the slice. They are the acceptance criteria for the
slice; [references/specifications.md](references/specifications.md) explains every clause and how to turn
each one into a test.

## Constructs you cannot build yet

Some syntax is accepted by the language but not yet executable; the tools report it with diagnostic
`PLAY0268` and mark it syntax-only. Build the intent when it is clear and the kit supports it,
otherwise report the slice as blocked and name the construct.
