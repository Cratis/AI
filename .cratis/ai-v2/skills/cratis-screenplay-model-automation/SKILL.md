---
name: cratis-screenplay-model-automation
description: Use when modeling a Screenplay Automation slice where a local fact, due work or a system trigger starts work without a person. Not for importing external observations (use cratis-screenplay-model-translation).
compatibility: Requires the Screenplay CLI.
---

# React to a local fact

1. For immediate follow-up, start with a reaction to one local fact. Name what triggers it, the system actor, the inputs it needs and the effect it requests.
2. Use `invokes` when a command must decide. Choose `produces` only when the reaction already knows which fact to record and which event source to address. Map the event source explicitly when it is the command's target.
3. If the command is gated, declare the system's required roles; don't borrow a user's identity. Specify the addressed effect and handle only the intended refusal. Keep a capture in a separate [translation](../cratis-screenplay-model-translation/SKILL.md); consume its local `DirectoryAuthorSeen` fact here.

## Example: request one welcome per directory author

Use `AuthorId` from [Declare the slice](../cratis-screenplay-declare-slice/SKILL.md) and `DirectoryAuthorSeen` from the directory translation. Here the directory row ID is already the Library's `AuthorId`. The Library system requests a welcome, not delivery of the message. The command can record only one request per author; acknowledge just that constraint refusal on redelivery.

```play
module Library
  feature Authors
    slice Automation WelcomeDirectoryAuthor
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
        then DirectoryWelcomeRequested
          for "11111111-1111-4111-8111-111111111111"
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
```

Run `screenplay test model --format json` on the composed model. Require both automation specifications to execute and pass. [Implement the runtime reaction](../cratis-chronicle-react-to-fact/SKILL.md) with a reactor after commit; verify target support and test any external delivery separately.

## When it goes off the usual path

- **Work must wait or be retried:** model a read model of pending work. Give each item a stable key and facts that open and close it, including cancellation if the work can be withdrawn.
- **The command lives in another slice:** assert the handoff with `then invokes` here, and assert the command's events in its own slice. A specification runs only its own slice's follow-up behavior.
- **A provider may have performed the effect before losing its reply:** retry with the same provider idempotency key and verify provider behavior separately. A unique request fact doesn't make an external effect exactly once.
