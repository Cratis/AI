---
name: cratis-screenplay-model-translation
description: Use when modeling a Translate slice that turns an outside observation or public event into a private local fact, or adapts private facts to a public event. Not for acting on an already-local fact.
compatibility: Requires the Screenplay CLI.
---

# Translate across a boundary

Choose by what crosses the boundary:

- **Outside records:** use an inbound API capture when the other system supplies a snapshot to poll.
- **Outside public events:** use an inbound event capture when the other system publishes facts.
- **Your public contract:** use `direction outbound` when another system needs facts from yours. Use a projection targeting one public event and expose only the contract's fields. [Transport that event](../cratis-chronicle-publish-contract/SKILL.md) through the outbox and inbox; delivery alone doesn't translate it to a local fact.

For inbound capture, name the private local fact, choose the stable key and map only the fields that fact needs. If it triggers more work, join a separate [automation](../cratis-screenplay-model-automation/SKILL.md) at the local fact, not at the polling schedule.

## Import an author from a directory

This directory already returns the Library's author ID as `id`.

```play
module Library
  feature Authors
    slice Translate ImportAuthors
      direction inbound
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

Run `screenplay test model --format json` on the composed model. Require both capture specifications to execute and pass; they supply observations without polling the actual directory.

## Receive a public event instead of polling

Declare the public event's origin and name it under `source events`. Key the append from the incoming payload; it need not be the incoming event's own history address. Use `when append`, not `when capture`, to stimulate an event capture.

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

## When it goes off the usual path

- **A changed field matters:** seed the prior observation for the same key, then supply the new value. A first observation is an addition, not a transition.
- **The provider reuses keys:** settle which immutable source identity belongs to the same author before writing the mapping. Don't substitute the display name or silently merge histories.
