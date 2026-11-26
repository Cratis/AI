---
name: cratis-screenplay-model-automation
description: Use when a .play slice needs an external capture, trigger, schedule or reaction. Not for implementing a Chronicle reactor (cratis-chronicle-react-to-fact).
---

# Decide what an outside occurrence means

1. Name the source, stable identity and local fact before choosing a transport. **Done:** a directory record observed for the first time means DirectoryAuthorSeen, not RegisterAuthor and not proof that a registration succeeded.
2. For an external record, default to a capture in a Translate slice with a typed key and an explicit change condition. For a modeled event or clock tick, use a reaction in an Automation slice instead; put its specification in that slice, not the producing slice. Read references/external-translations.md when mapping a provider's vocabulary. **Done:** the [directory capture](../../../../Evaluations/corpus-v2/examples/cratis-screenplay-model-automation/model/import.play) appends once on `when added`, keyed by the directory ID.
3. Run `screenplay ./model --warnaserror` and `screenplay test model --format json` from the fixture. **Done:** SeeingAster emits the named fact and SeeingAsterAgain seeds the same record and expects `then no events`. Record polling, restart checkpoints and provider deduplication as untested runtime obligations; pass those obligations to the reactor owner only when implementing the effect.
