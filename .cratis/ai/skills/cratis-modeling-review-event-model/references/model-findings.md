# Model findings

## What does the fact tell its consumers?

**Registration or correction?** If `AuthorUpdated` is the only clue, ask how the consumer distinguishes the two. If it must compare snapshots or guess from changed properties to decide whether to welcome a new author, it can welcome someone after a spelling correction. [Identify the business act](../../cratis-modeling-design-event-model/SKILL.md) and record the values that explain it. A correction can be about a single property; the suffix alone proves nothing.

**Request or result?** If recording `RegisterAuthor` makes the list show an author even when registration is refused, the list is counting requests as successes. Record `AuthorRegistered` on acceptance (the `cratis-chronicle-record-event` skill, when installed). Receipt of a request can itself be a fact when receipt, not registration, is the outcome.

**Display total or business value?** If a separate “author count changed” fact exists solely for a count already derivable from registrations, the two counts can disagree. Derive the list total in the view (the `cratis-chronicle-project-view` skill, when installed). Keep a price actually agreed or a measurement actually taken: recalculation is not evidence of what the parties agreed or observed.

**Fact data or entity copy?** Serializing the entire author on each edit can leave readers guessing which change mattered. If `AuthorId` merely repeats the append address, a mismatch also leaves readers choosing between IDs. Record the values that explain the fact (the `cratis-chronicle-record-event` skill, when installed); obtain this history’s identity from event context. Keep another party’s identifier when the relationship is part of the fact.

## Whose history changes?

**Collection mistaken for an instance.** If all authors share the source ID `authors` solely for listing, a reader cannot select one author’s history by source ID. Address each author individually (the `cratis-chronicle-record-event` skill, when installed) and project the collection. Sharing Chronicle’s event log is normal; sharing the append address is the issue here. A group that makes a collective decision may have its own history.

**Reference mistaken for a destination.** A book borrowing fact carrying `MemberId` can feed several views, but it has not also been appended to the member’s history. If a loan limit relies on facts addressed to the member, that decision can miss the borrowing. Guard the decisions on the affected histories (the `cratis-chronicle-protect-decision` skill, when installed) and commit separately addressed facts in one atomic batch if both must succeed together. A batch alone does not guard a read; extra views alone do not require extra facts.

## Can the slice deliver the promised result?

**Missing value origin.** Suppose the Authors list promises a registration date, but no input, trusted context, prior fact or agreed derivation supplies it. Substituting the append time silently chooses a meaning. Ask whether the reader needs occurrence time or a business date; [trace its producer and mapping](../../cratis-modeling-design-event-model/SKILL.md), or leave the date unresolved. An input needed only to refuse a command need not appear in its event.

**Observation mistaken for follow-up.** If seeing Aster in Directory counts as proof that Library sent a welcome, a delivery failure disappears from the model. [Distinguish inbound translation from local automation](../../cratis-modeling-design-event-model/SKILL.md): `DirectoryAuthorSeen` establishes observation; a welcome request is a separate outcome, not evidence of delivery.

**One promise, independent requests.** If one click issues two sequential commands for an all-or-nothing decision, refusal of the second can leave the first committed. [Model one decision with one commit for its facts](../../cratis-modeling-design-event-model/SKILL.md), or describe the partial outcomes if the owner intends two decisions. Several actions on a screen, or alternatives that select only one command, do not imply partial execution. For the latter, bind the selected action (the `cratis-screenplay-model-interaction` skill, when installed) when using Screenplay.
