---
name: cratis-screenplay-declare-slice
description: Use when encoding an agreed state change or its view as a command, event or list in a Screenplay .play file. Not for discovering the business story (use cratis-modeling-discover-timeline).
compatibility: Requires the Screenplay CLI.
---

# Declare the command, event and list in the model

Choose a slice by what it does:

- **State change** (`StateChange`): a command decides which facts to record.
- **State view** (`StateView`): a query presents a read model derived from facts.
- **Automation** (`Automation`): a system acts on local facts or due work. [Model automation](../cratis-screenplay-model-automation/SKILL.md).
- **Translation** (`Translate`): adapt outside observations to local facts or private facts to a public contract. [Model translation](../cratis-screenplay-model-translation/SKILL.md).

In `model/Authors/registration.play`, put the command and its event inside a `StateChange` slice. Give the list a separate `StateView` slice in the same feature.

1. Declare `concept AuthorId : Uuid`. Mark the command's `id` with `identifier`.
2. Map each command input needed by the event. Use `for` to address the event to its owner.
3. Give the read model a key. Default to the event source for a view of one history. Choose an explicit business key on each relevant `from` handler, using `from <Event> key <property>`, when the view uses a different key. Map the payload to the displayed fields.
4. Bind the list query to the collection. Run an example for a known ID and check the returned row.

## Example: register an author and list the name

```play
concept AuthorId : Uuid

module Library
  feature Authors
    slice StateChange RegisterAuthor
      command RegisterAuthor
        id AuthorId identifier
        name String
        produces AuthorRegistered
          for id
          name = name

      event AuthorRegistered
        name String

    slice StateView ListAuthors
      event AuthorRemoved

      readmodel Author
        id AuthorId key
        name String

      projection AuthorProjection => Author
        from AuthorRegistered
          id = $eventSourceId
          name = name

        remove with AuthorRemoved

      query AllAuthors => observable Author[]

      specification ListingAster
        given AuthorRegistered
          for "11111111-1111-4111-8111-111111111111"
          name = "Aster"
        then query AllAuthors exactly
          result
            id = "11111111-1111-4111-8111-111111111111"
            name = "Aster"
```

From the Library directory run `screenplay model` to compile the folder. Expect `PLAY0533` until the [Add author screen](../cratis-screenplay-model-interaction/SKILL.md) issues the command. Add the [registration and refusal examples](../cratis-screenplay-specify-outcome/SKILL.md), then run `screenplay test model --format json`.

## When it goes off the usual path

- **An event from another history enriches the row:** name the `from` event that creates it and the related event source matched by `join <Name> on <Property>`. A join updates existing rows; it doesn't create them. Check that an unrelated source doesn't change the row and that the event named in `remove with` makes it disappear from the query.
- **The source key differs from a payload ID:** use `$eventSourceId` if the row identifies that history. Use the payload ID only if it identifies the row by design. Don't duplicate the source ID in the payload just to display it.

## Related skills

- [Discover the timeline](../cratis-modeling-discover-timeline/SKILL.md) before encoding an unresolved ownership decision.
- [Specify the outcome](../cratis-screenplay-specify-outcome/SKILL.md) to check the destination and payload.
