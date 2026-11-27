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

## Receive a public event instead of polling

When the input is another application's public event, use an explicitly inbound slice, declare the event's origin and name that event under `source events`. Key the append from the incoming payload; it need not be the incoming event's own history address. For an event capture, test with `when append`, not `when capture`.

```play
module Library
  feature Authors
    slice Translate ReceiveAuthorAnnouncements
      direction inbound
      event AuthorAnnounced from "directory"
        id String
        name String
      event AuthorAnnouncementReceived
        name String
      capture AuthorAnnouncements
        source events
          from AuthorAnnounced
        key id
        append AuthorAnnouncementReceived
          when added
            name = $.name
      specification ReceivingAsterAnnouncement
        when append AuthorAnnounced
          id = "author-42"
          name = "Aster"
        then AuthorAnnouncementReceived
          for "author-42"
          name = "Aster"
```

## Avoid

- Don't treat the first observation as a change from a previous value; supply prior state when testing a transition.
- Don't key an author by name; different directory IDs may have the same display name.

## Related skills

- [Model an interaction](../cratis-screenplay-model-interaction/SKILL.md) when a librarian initiates the action on screen.

- [Specify the outcome](../cratis-screenplay-specify-outcome/SKILL.md) for accepted and refused commands.
- [React to an event](../cratis-chronicle-react-to-fact/SKILL.md) for the runtime implementation.
