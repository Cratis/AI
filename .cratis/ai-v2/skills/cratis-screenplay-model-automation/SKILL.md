---
name: cratis-screenplay-model-automation
description: Models translation and automated action in Screenplay. Use when a .play feature imports external data, reacts to an event or initiates scheduled work. Not for implementing the reactor (use cratis-chronicle-react-to-fact).
compatibility: Requires the Screenplay CLI.
---

# Import an author from a directory

In `model/Authors/import.play`, describe what the Library receives, how it identifies a directory entry and which local event it records on the first observation.

1. Identify the source and the stable key it supplies. Use the directory ID as the key; a change of name does not identify a new author.
2. Map the input's name to the local event. `when added` means the first sighting of that key.
3. Give the same prior observation in the repeat example. `then no events` distinguishes a successful repeat from a refusal.

```play
module Library
  feature Authors
    slice Translate ImportAuthors
      capture DirectoryAuthors
        source api
          api Directory
          route /authors
          poll 5m
        key id
        append DirectoryAuthorSeen
          when added
            name = $.name

      event DirectoryAuthorSeen
        name String

      specification SeeingAster
        when capture DirectoryAuthors
          id = "11111111-1111-4111-8111-111111111111"
          name = "Aster"
        then DirectoryAuthorSeen
          for "11111111-1111-4111-8111-111111111111"
          name = "Aster"

      specification SeeingAsterAgain
        given capture DirectoryAuthors
          id = "11111111-1111-4111-8111-111111111111"
          name = "Aster"
        when capture DirectoryAuthors
          id = "11111111-1111-4111-8111-111111111111"
          name = "Aster"
        then no events
```

From the application directory run `screenplay test model --format json`. These examples exercise translation of supplied observations; they do not poll an actual directory.

## Avoid

- Don't treat the first observation as a change from a previous value; supply prior state when testing a transition.
- Don't bypass the deciding command in a reaction. Test its invocation in the reaction and the resulting event in the command.
- Don't assume a scheduled result is still eligible; have the command recheck the current deadline and state.

## Related skills

- [Specify the outcome](../cratis-screenplay-specify-outcome/SKILL.md) for accepted and refused commands.
- [React to an event](../cratis-chronicle-react-to-fact/SKILL.md) for the runtime implementation.
