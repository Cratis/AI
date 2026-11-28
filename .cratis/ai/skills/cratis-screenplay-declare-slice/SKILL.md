---
name: cratis-screenplay-declare-slice
description: Use when a modeler needs to encode an agreed command, event or derived view in a Screenplay .play file. Not for discovering the business story (use cratis-modeling-discover-timeline).
compatibility: Requires the Screenplay CLI.
---

# Declare the command, event and list in the model

Start with an [application workspace](../cratis-screenplay-onboard-workspace/SKILL.md) and an agreed command or query outcome. Choose the owning slice:

- **State change** (`StateChange`): a command decides which facts to record.
- **State view** (`StateView`): a query presents a read model derived from facts.

For system-initiated work, use [automation](../cratis-screenplay-model-automation/SKILL.md); for a crossing between vocabularies, use [translation](../cratis-screenplay-model-translation/SKILL.md).

Put `StateChange` and `StateView` slices under the intended `module` and `feature` declarations. Those declarations set the address, not the application name or file path. In `model/Authors/registration.play`, put the registration command and fact in one slice and the list in a separate view slice.

Check how the model is loaded before adding a file. Folder input includes every `.play` below it, including scratch models. A root **file** includes only itself and files reached by quoted imports. A quoted pattern is relative to the importing file; placing the import inside a module or feature assigns its contents to that container. An unquoted import names an external contract, not a file. A slice visible in a folder compile but absent from the actual root-file build may simply be unreachable.

1. Declare `concept AuthorId : Uuid`. Mark the command's `id` with `identifier`.
2. Map each command input needed by the event. Use `for` to address the event to its owner.
3. Give the read model a key. Default to the event source for a view of one history. Choose an explicit business key on each relevant `from` handler, using `from <Event> key <property>`, when the view uses a different key. Use a projection by default to map facts to displayed fields. Choose a reducer instead when the view needs a calculation the projection cannot declare.
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

    slice StateChange RemoveAuthor
      command RemoveAuthor
        id AuthorId identifier
        produces AuthorRemoved
          for id

      event AuthorRemoved

    slice StateView ListAuthors
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

From the Library directory run `screenplay model` to compile the folder. Expect `PLAY0533` for a command with no invocation yet; the [Add author screen](../cratis-screenplay-model-interaction/SKILL.md) supplies the registration action. Add the [registration and refusal examples](../cratis-screenplay-specify-outcome/SKILL.md), then run `screenplay test model --format json`.

## When it goes off the usual path

- **Removal leaves the author in the list:** check that `AuthorRemoved` addresses the same author ID as `AuthorRegistered`; `remove with AuthorRemoved` matches the event source in this projection.
- **The source key differs from a payload ID:** use `$eventSourceId` if the row identifies that history. Use the payload ID only if it identifies the row by design. Don't duplicate the source ID in the payload just to display it.

For optional values write the type followed by `optional`. The `?` spelling diagnostic `PLAY0479` is informational, so a warnings-as-errors pass alone will not detect it. Do not bulk-rewrite `query Q => observable?`; there `observable` is the result type name, not a live-query marker.

Use `description` to record meaning. Put the reasoning behind a tradeoff in `documentation` on an eligible declaration such as the slice, command or read model, not on a query or individual reaction trigger. Neither text enforces a rule. A waiting view may consume a later slice's completion fact: board position describes the story, not runtime ownership or a ban on feedback.

If a decision reads the wrong instance or a list lookup is ambiguous, [separate read identity from event routing](references/read-identity.md) before adjusting the query. If a replay creates extra rows, resurrects a departed variant or loses a joined value, [trace the projection by occurrence](references/projection-replay.md).

## Related skills

- [Discover the timeline](../cratis-modeling-discover-timeline/SKILL.md) before encoding an unresolved ownership decision.
- [Specify the outcome](../cratis-screenplay-specify-outcome/SKILL.md) to check the destination and payload.
