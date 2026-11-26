---
name: cratis-screenplay-declare-slice
description: Declares a state change and its view in Screenplay. Use when encoding an agreed command, event or list in .play. Not for discovering the business story (use cratis-modeling-discover-timeline).
compatibility: Requires the Screenplay CLI.
---

# Declare the command, event and list in the model

In `model/Authors/registration.play`, put the command and its event inside a `StateChange` slice. Give the list a separate `StateView` slice in the same feature.

1. Declare `concept AuthorId : Uuid`. Mark the command's `id` with `identifier`.
2. Map each command input needed by the event. Use `for` to address the event to its owner.
3. Give the read model a key. In its projection map the event source identity to the key and the payload to the displayed fields.
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

## Avoid

- Don't put the name in `for`; `for` takes the author ID.
- Don't add a second projection or reducer for `Author`.
- Don't assume the source supplies missing payload fields; map `name` explicitly.

## Related skills

- [Discover the timeline](../cratis-modeling-discover-timeline/SKILL.md) before encoding an unresolved ownership decision.
- [Specify the outcome](../cratis-screenplay-specify-outcome/SKILL.md) to check the destination and payload.
