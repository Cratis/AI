---
name: cratis-screenplay-model-translation
description: Use when a modeler needs to translate external observations into local facts or private events into a public contract. For reacting to a local fact, use cratis-screenplay-model-automation.
compatibility: Requires the Screenplay CLI.
---

# Translate across a boundary

Choose the direction first. In Screenplay, an inbound capture maps outside data into a private local fact. Default to an API capture for snapshots the provider exposes for polling. Choose an event capture when the provider publishes its own facts. Choose outbound instead when the Library owns the fact and another system needs a public contract.

For an inbound capture, name the private local fact, choose a stable key and map only the fields that fact needs. If the local fact triggers more work, [model a separate automation](../cratis-screenplay-model-automation/SKILL.md) that observes it.

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
          for "directory-feed"
          id = "author-42"
          name = "Aster"
        then AuthorAnnouncementReceived
          for "author-42"
          name = "Aster"
```

## Publish a Library contract

Use `direction outbound`. Declare `public event AuthorPublished` without a foreign origin. Project private facts into that one public event; expose only its contract fields. This example uses `AuthorRegistered` from [Declare the slice](../cratis-screenplay-declare-slice/SKILL.md).

```play
module Library
  feature Authors
    slice Translate PublishAuthor
      direction outbound
      public event AuthorPublished
        name String

      projection AuthorPublication => AuthorPublished
        from AuthorRegistered
          name = name

      specification PublishingAster
        when append AuthorRegistered
          for "11111111-1111-4111-8111-111111111111"
          name = "Aster"
        then AuthorPublished
          for "11111111-1111-4111-8111-111111111111"
          name = "Aster"
```

[Transport the public event](../cratis-chronicle-publish-contract/SKILL.md) through the outbox and inbox. Test delivery separately; these model specifications don't run polling or transport.

If the outside system needs a new reusable provider package rather than just a boundary mapping, [author the extension](../cratis-screenplay-author-extension/SKILL.md) separately. Declaring a translation does not install or activate a backend.

## When it goes off the usual path

- **The provider reuses keys:** settle which immutable source identity belongs to the same author before writing the mapping. Don't substitute the display name or silently merge histories.
