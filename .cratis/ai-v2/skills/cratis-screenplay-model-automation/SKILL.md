---
name: cratis-screenplay-model-automation
description: Use when a .play slice needs to poll an external API, capture a change, schedule a trigger or react to an event. Not for implementing a Chronicle reactor (cratis-chronicle-react-to-fact).
compatibility: Requires the Screenplay CLI.
---

# Decide what an outside occurrence means

**Requires:** Check `screenplay --version`; restore the project's pinned CLI if missing.

1. Identify the external source, stable record key and local fact. Read references/external-translations.md when their vocabularies differ. **Done:** observing a record means the record was seen, not that a local registration command succeeded.
2. For an external record, use a capture in a Translate slice. For a modeled event or clock tick, use a reaction in an Automation slice and specify it there. For example:

```screenplay
      capture DirectoryAuthors
        source api
          api Directory
          route /authors
          poll 5m
        key id
        append DirectoryAuthorSeen
          when added
            name = $.name
```

   **Done:** the first observation produces the named fact. If redelivery produces another fact, seed the prior capture in `given`, repeat the same key in `when` and check the change condition.
3. Run `screenplay ./model` and `screenplay test model --format json` against the application model directory. **Done:** both the first delivery and the repeat scenario execute and pass, including `then no events` where required. Provider polling, checkpoints and actual deduplication still need runtime evidence.
