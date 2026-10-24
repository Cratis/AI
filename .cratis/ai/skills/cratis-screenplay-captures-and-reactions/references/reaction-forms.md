<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Reaction trigger and effect forms

Excerpts from `complete-examples.md`: "Reaction on a declared trigger with `where`
and `invokes`" and "Reaction with `produces` and `invokes`".

```screenplay excerpt
slice Automation NotifyOnBuildFailure
  reaction NotifyOnFailure
    description "Tells the owning team when a watched build fails"
    when BuildFinished
      repository
      outcome
      invokes SendFailureNotice
        repository = repository
        outcome    = outcome
    where outcome == "failed"
```

| Form | Runs |
| --- | --- |
| `when <Name>` | on that event, declared trigger, or registered trigger |
| `every <n> seconds\|minutes\|hours\|days` | on that interval (`n` ≥ 1) |
| `at HH:mm` | every day at that time |
| `at HH:mm on <Weekday>` | every week on that day |
| `at HH:mm on day <n>` | every month on that day (`n` is 1–31) |

Time is strictly `HH:mm`. Weekday is the full English name. A bare name under a
trigger selects a value from the occurrence; it is not a new declaration. Taking
a value absent from the event/trigger shape is reported.

```screenplay excerpt
reaction Provisioner
  when InvitationAccepted
    workspaceId
    produces WorkspaceProvisioned
      for workspaceId
      workspaceId = workspaceId
    invokes SendWelcomeMail
      workspaceId = workspaceId
      template    = "welcome"
```

A `produces` without `for` appends to the source of the triggering event. Clock,
application and built-in triggers need an explicit destination. Producing requests
an append subject to constraints; invoking also runs command authorization,
validation and requirements and may reject. They are not interchangeable.

## Indentation and destinations

A reaction declares **at least one trigger**; everything under a trigger is optional.
`produces`, `invokes`, `file` and inline code belong inside the trigger block,
under `when`/`every`/`at`. `description`, `where` and `runs as` sit at reaction level.
Outdenting an effect gives *Expected a trigger in reaction body, got 'invokes …'*
(PLAY0137): the compiler is looking for another trigger where the effect is.

Inline `produces event <Name>` is command-only (`PLAY0474` in a reaction).
Declare reaction-produced events separately and use plain `produces <Name>`.
Do not extend the inline command destination default or its repairs to reactions.
A clock, application or built-in trigger has no source event, so its `produces`
needs `for`: a value the trigger carries, or literal text.

**Who is the caller of an `invokes`?** Nobody unless `runs as` declares the actor;
read the main skill's *Caller-less invokes and unprotected reads* before writing one.

These are declarations, not implementations. A trigger can carry a `file` or
inline tagged fence beside its consequences; the model inventories role, owner
and content hash but does not execute that attachment. Stage mixed-effect
refusals and reference unsupported outcomes remain separate checks.

## Narrowing and reads

**`where` belongs to the reaction, not to one trigger**: it says which occurrences
are worth running for, whatever set them off. A second `where` is an error;
combine conditions with `and`/`or` instead. It uses the same condition grammar as
`produces … when` and `require`: `==`, `!=`, ordering operators, `contains` for a
substring anywhere, `starts with` for one at the beginning, and parentheses.
These text-condition operators parse but refuse executable binding (PLAY0268);
literal property text rules are a separate v24 contract, not a workaround.

A trigger names the views its automation decides from with
`reads <View> [as <alias>] [by <trigger value>]`, like a command's `reads`.
The `by` names a value that trigger takes (else PLAY0442).
**Clock triggers read whole views.** `by` under them is PLAY0443.
Read [trigger reads](trigger-reads-example.md) for aliases (PLAY0410–0412,
PLAY0177), the `@reads` escape (PLAY0175, PLAY0444) and reserved `for each`.
The complete example in `complete-examples.md`, "Trigger `reads` on an event and
on the clock", is authoring-valid; its `file` bodies stop it binding at ESM v6.
Reads are declared, not enforced; keep decisions and protection in the invoked command.
