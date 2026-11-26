---
name: cratis-screenplay-model-automation
description: Use when modeling how a Translate slice imports external data into local events, including its capture, stable key and first-observation behavior. Not for implementing the reactor (use cratis-chronicle-react-to-fact).
compatibility: Requires the Screenplay CLI.
---

# Import an author from a directory

In `model/Authors/import.play`, describe what the Library receives, how it identifies a directory entry and which local event it records on the first observation.

1. Name the `Directory` API and `/authors` route under `source api`. Set `key id`.
2. Under `append DirectoryAuthorSeen`, set `when added` and map `name = $.name`.
3. Add the two specifications below. Give the same ID and name as prior state for the repeat case.

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

From the application directory run `screenplay test model --format json`. For this file alone require two executed and two passed. These examples exercise translation of supplied observations; they do not poll an actual directory.

## Avoid

- Don't treat the first observation as a change from a previous value; supply prior state when testing a transition.
- Don't key an author by name; different directory IDs may have the same display name.

## Related skills

- [Specify the outcome](../cratis-screenplay-specify-outcome/SKILL.md) for accepted and refused commands.
- [React to an event](../cratis-chronicle-react-to-fact/SKILL.md) for the runtime implementation.
