---
name: cratis-screenplay-model-automation
description: Use when modeling a Screenplay Automation slice where a local fact, due work or a system trigger starts work without a person. Not for importing external observations (use cratis-screenplay-model-translation).
compatibility: Requires the Screenplay CLI.
---

# React to a local fact

1. For immediate follow-up, start with a reaction to one local fact. Name what triggers it, the system actor, the inputs it needs and the effect it requests.
2. Use `invokes` when a command must decide. Choose `produces` only when the reaction already knows which fact to record and which event source to address. Map the event source explicitly when it is the command's target.
3. If the command is gated, declare the system's required roles; don't borrow a user's identity. Specify the addressed effect and handle only the intended refusal. Keep a capture in a separate [translation](../cratis-screenplay-model-translation/SKILL.md); consume its local `DirectoryAuthorSeen` fact here.

Choose scheduled work when a clock, not a recorded fact, determines when to act: `every 15 minutes` for an interval or `at 08:00` for a daily UTC time. Choose `when <Trigger>` for a declared or host-provided signal. Neither supplies an event source: `produces` needs `for` with an available key or literal text. Add a pending-work view when items must survive a delay, retry or cancellation.

## Example: request one welcome per directory author

Use `AuthorId` from [Declare the slice](../cratis-screenplay-declare-slice/SKILL.md) and `DirectoryAuthorSeen` from the directory translation. Here the directory row ID is already the Library's `AuthorId`. The Library system requests a welcome, not delivery of the message. The command can record only one request per author; acknowledge just that constraint refusal on redelivery.

```play
module Library
  feature Authors
    slice StateChange RequestDirectoryWelcome
      event DirectoryWelcomeRequested
        name String

      constraint OneDirectoryWelcome
        unique event DirectoryWelcomeRequested

      command RequestDirectoryWelcome
        id AuthorId identifier
        name String
        produces DirectoryWelcomeRequested
          for id
          name = name

      specification RecordingAstersWelcomeRequest
        when RequestDirectoryWelcome
          id = "11111111-1111-4111-8111-111111111111"
          name = "Aster"
        then DirectoryWelcomeRequested
          for "11111111-1111-4111-8111-111111111111"
          name = "Aster"

      specification RefusingADuplicateWelcomeRequest
        given DirectoryWelcomeRequested
          for "11111111-1111-4111-8111-111111111111"
          name = "Aster"
        when RequestDirectoryWelcome
          id = "11111111-1111-4111-8111-111111111111"
          name = "Aster"
        then error

    slice Automation WelcomeDirectoryAuthor
      reaction OnDirectoryAuthorSeen
        runs as system
        when DirectoryAuthorSeen
          name
          invokes RequestDirectoryWelcome
            id = $eventSourceId
            name = name
            on refused by constraint OneDirectoryWelcome
              acknowledge

      specification RequestingAstersWelcome
        when append DirectoryAuthorSeen
          for "11111111-1111-4111-8111-111111111111"
          name = "Aster"
        then invokes RequestDirectoryWelcome
          id = "11111111-1111-4111-8111-111111111111"
          name = "Aster"

      specification RedeliveringAfterWelcomeRequested
        given DirectoryAuthorSeen
          for "11111111-1111-4111-8111-111111111111"
          name = "Aster"
        given DirectoryWelcomeRequested
          for "11111111-1111-4111-8111-111111111111"
          name = "Aster"
        when redelivered DirectoryAuthorSeen to OnDirectoryAuthorSeen
        then invokes RequestDirectoryWelcome
          id = "11111111-1111-4111-8111-111111111111"
          name = "Aster"

    slice Automation CheckPendingWelcomes
      event DirectoryWelcomeReviewDue

      reaction ReviewPendingWelcomes
        every 15 minutes
          produces DirectoryWelcomeReviewDue
            for "directory-welcomes"

      specification CheckingPendingWelcomesOnTheQuarterHour
        given clock "2026-10-05T08:00:00Z"
        when clock "2026-10-05T08:15:00Z"
        then DirectoryWelcomeReviewDue
          for "directory-welcomes"
```

Run `screenplay test model --format json` on the composed model. Require the command, invocation, redelivery and clock specifications to execute and pass. The invocation checks its typed inputs and `then` accounts for unexpected new facts. The separate command examples show the recorded fact on first request and the refusal on duplicate. [Implement the runtime reaction](../cratis-chronicle-react-to-fact/SKILL.md) with a reactor after commit; verify target support and test any external delivery separately.

## When it goes off the usual path

- **Pending work can be withdrawn:** give each item a stable key and model the fact that closes it on cancellation so it stops appearing in the pending-work view.
- **The command lives in another slice:** assert the handoff with `then invokes` here, and assert the command's events in its own slice. A specification runs only its own slice's follow-up behavior.
- **A provider may have performed the effect before losing its reply:** retry with the same provider idempotency key and verify provider behavior separately. A unique request fact doesn't make an external effect exactly once.
