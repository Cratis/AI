---
name: cratis-screenplay-model-automation
description: Use when a modeler needs a Screenplay Automation reaction to a local fact, schedule or host signal. Not for importing external observations (use cratis-screenplay-model-translation).
compatibility: Requires the Screenplay CLI.
---

# React to a local fact

1. For immediate follow-up, start with a reaction to one local fact. Name what triggers it, the system actor, the inputs it needs and the effect it requests.
2. Use `invokes` when a command must decide. Choose `produces` only when the reaction already knows which fact to record and which event source to address. Map the event source explicitly when it is the command's target.
3. For a command gated on a role, use `runs as system role "<Role>"` under the reaction with the role required by the command. Don't borrow a user's identity. Specify the addressed effect and handle only the intended refusal. Keep a capture in a separate [translation](../cratis-screenplay-model-translation/SKILL.md); consume its local `DirectoryAuthorSeen` fact here.

`reaction batches atomic` protects a batch of facts the reaction produces directly; it does not deduplicate redelivery or roll back an independently invoked command. For delayed work, let the command recheck current state before it acts.

Choose a schedule when the clock determines when to act: `every 15 minutes` for an interval or `at 08:00` for a daily UTC time. Choose an application trigger when the host raises a signal that isn't already a fact. Neither supplies an event source: use an explicit key such as `for "directory-welcomes"` under `produces`.

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
        then no events
        then invokes RequestDirectoryWelcome
          id = "11111111-1111-4111-8111-111111111111"
          name = "Aster"

    slice Automation ScheduleWelcomeReview
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

Run `screenplay test model --format json` on the composed model. Require the command, invocation, redelivery and clock specifications to pass. `then invokes` compares only the invocations and the stated input values. `then no events` separately checks that redelivery records nothing. The command's own examples check the recorded fact and duplicate refusal. [Implement the runtime reaction](../cratis-chronicle-react-to-fact/SKILL.md) with a reactor after commit; verify target support and test any external delivery separately.

For work requested by a host rather than a calendar, [replace the schedule with a host trigger](references/host-trigger.md).

## When it goes off the usual path

- **The command lives in another slice:** assert the handoff with `then invokes` here, and assert the command's events in its own slice. A specification runs only its own slice's follow-up behavior.
- **A provider may have performed the effect before losing its reply:** retry with the same provider idempotency key and verify provider behavior separately. A unique request fact doesn't make an external effect exactly once.
