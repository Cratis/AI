# Implementation findings

## Where is the decision enforced?

**Only the form refuses.** Inspect the command’s execute path, including its active validators; an empty handler is not evidence of missing validation. If the server accepts a blank name despite an agreed refusal, another caller can bypass the form. Keep the immediate feedback and apply blocking input validation to the server command (`cratis-arc-validate-command` skill).

**One copy left.** Two borrowers can each see one copy in a display query. If their appends do not check for intervening stock changes, both can take it. Inspect the read used to decide, its key, the events that change availability and the guard actually applied at commit:

- In Arc/.NET with Chronicle, an eligible read-model parameter in a command validator constructor or handler can protect the decision under effective read protection `On`. Check that the read is not marked unprotected. If it guards the right book and stock-changing events, using a read model is not a defect.
- In standalone Chronicle, even a passive read alone is not a guard. Bind the stock decision to the append (`cratis-chronicle-protect-decision` skill) so a competing change refuses the borrowing. If the guard is not visible, ask which append guard covers this book before reporting a race.
- If the actual rule is uniqueness or creation at most once, use an append-time kernel constraint (`cratis-chronicle-constrain-append` skill). A successful preflight check cannot reserve the value.

## What happens on rebuild or retry?

**Rebuilding the list sends a welcome.** If the mapping that reconstructs the Authors view calls the mail service, rebuilding that answer can contact authors again. Keep the projection responsible for the view (`cratis-chronicle-project-view` skill); put the intentional external effect in a reaction to the committed fact (`cratis-chronicle-react-to-fact` skill).

**Retry sends a second welcome.** The receiver accepts the first request, but the handler fails before recording success. `OnceOnly` controls replay, not ordinary recovery; a fresh request ID on recovery also hides the duplicate from the receiver. If only one welcome is intended, reuse a stable delivery identity (`cratis-chronicle-react-to-fact` skill) that the receiver deduplicates, or record a receipt atomically with the effect. Writing a receipt after a separate external call leaves the same failure window.

## Will stored history still mean what it did?

**A rename changes the stored event type ID.** Readers expecting the new ID can miss existing registrations; reusing the old ID for a different act can make readers misinterpret them. Preserve the effective stored ID for the same fact. If its schema changes, map compatible representations across generations (`cratis-chronicle-evolve-event` skill). Give a different fact its own ID. A class rename that preserves stored identity and shape is not this failure.

**Deletion offered as undo or erasure.** Dropping a registration row from history loses the explanation for a business reversal. When the reversal belongs in the history, record the correcting fact (`cratis-chronicle-record-event` skill). When the goal is privacy, hiding a list row does not erase the underlying data. Protect personal data (`cratis-chronicle-protect-personal-data` skill) with surrogate identifiers and protected content. Subject-key erasure addresses fields encrypted for that subject; authorized targeted redaction replaces selected event payloads with markers, retaining sequence positions and audit metadata. Neither establishes that released copies, read models or backups are clean. Identify what remains and its retention policy separately.
