# Systems and abilities

## Contents

- Code computes, abilities touch the world
- Declare a system
- Effect classes
- Inputs, returns and outcomes
- Answers that arrive later
- Implementation
- The one `invokes` verb
- What is merged and what is not

## Code computes, abilities touch the world

A model reaches something outside itself (a carrier, a ledger, a chat tool) through a `system` with `ability` declarations, not through an invented command or a free-text effect. Pure computation stays in code; anything with an external effect is an ability whose retry behavior, returned values and refusals are declared and therefore checkable. Record what an ability returned as a fact only through an event the model `produces`; an ability's result is never a fact by itself.

## Declare a system

```screenplay
concept ParcelId : Uuid
concept TrackingNumber : String

type Address
  street String
  postalCode String

system Carrier
  description "The parcel carrier's booking service"
  ability BookPickup idempotent
    description "Books a pickup for one parcel"
    parcelId ParcelId
    address Address
    returns
      trackingNumber TrackingNumber
      pickupAt DateTime
    outcome NoCapacity
      description "No pickup slot on the requested day"
  ability Quote safe
    address Address
    returns
      price Decimal
```

- A `system` belongs to the application, also when its file is imported into a module or feature. It names the business system, not a provider interface; an extension or implementation owns how.
- Everything under `ability` is optional and in any order: `description`, typed inputs, `returns`, `outcome`, `answers later`, `implementation`. Ability names are unique within a system, ignoring case (`PLAY0983`).
- Declaring an ability selects ESM v50; models without one keep their bytes and version.

## Effect classes

Write the class after the ability name. It says what a retry may do when an attempt's outcome is unknown.

| Class | Meaning | Unknown outcome |
| --- | --- | --- |
| `safe` | No external effect, such as a lookup | Retry freely |
| `idempotent` | Same idempotency key has the effect once | Retry with the same key |
| `once` | A repeat may repeat the effect | Never retry; stop for reconciliation |

`once` is the default because it is never wrong. Do not mark an ability `idempotent` unless the system really deduplicates. Any other class is `PLAY0984`.

## Inputs, returns and outcomes

- Inputs use the operation-input grammar: concepts, enums, composite types, collections, `optional`. Not `identifier` or `generated`, no subject modifier. A keyword-named input is written with `@` (`@outcome String`).
- `returns` holds at least one typed field; an ability without it returns nothing. Every type must be declared (`PLAY0986`).
- An `outcome <Name>` is a business result other than success, the external counterpart of a command refusal. It has a name and description, no payload. It cannot be named `next`, `refused`, `failed`, `returned` or `expired` (`PLAY0985`); those are invocation outlets.

## Answers that arrive later

`answers later` marks an ability whose answer arrives after the invocation returns (a person approves in chat, a partner confirms by webhook). Workflows and `approval ... via` use these.

## Implementation

An ability owns at most one `file` or tagged fence, directly or in an `implementation` wrapper (`PLAY0494` when combined). Its result is exactly one of: values matching `returns`, a declared outcome, or a failure. A hints-only block is intent and leaves the ability unrealized.

## The one `invokes` verb

`invokes` is the single verb for asking a command to run. The old forms still compile with deprecation `PLAY0397` and a repair; never author them.

| Before | After |
| --- | --- |
| `entering send <Command>` | `entering invokes <Command>` |
| `entering start <Workflow>` | `entering starts <Workflow>` |
| `then sends <Command>` | `then invokes <Command>` |
| `action <Name> sends <Command>` | `action <Name> invokes <Command>` |

## What is merged and what is not

Merged in Screenplay (decision 0159, published in 6.19.0 and 6.20.0): the abilities declaration and the `invokes` verb for workflows, state machines and specifications. Not yet taught here because the Screenplay docs had not landed when this was written: invoking an ability from reactions, workflows and state machines, `compute` nodes and `entering` bodies, and the `given`/`then invokes` specification lines for abilities; extension contracts, settings, secrets and activation; extension components on screens; and authoring extension packages with `cratis extension new` and `verify`. Until they land, an ability is a checked, typed contract that nothing runs; do not author invocation syntax from memory.

Read Screenplay's [systems and abilities](https://github.com/Cratis/Screenplay/blob/main/Documentation/screenplay/systems.md) page and [decision 0159](https://github.com/Cratis/Screenplay/blob/main/decisions/0159-systems-with-abilities-extensions-and-durable-invocations.md) for the contract.
