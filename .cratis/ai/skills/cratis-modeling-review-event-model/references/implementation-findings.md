# Implementation findings

## Where is the decision enforced?

**Only the form refuses.** Inspect the command’s execute path, including its active validators; an empty handler is not evidence of missing validation. If the server accepts a blank name despite an agreed refusal, another caller can bypass the form. Keep the immediate feedback and apply blocking input validation to the server command (the `cratis-arc-validate-command` skill, when installed).

**One copy left.** Two borrowers can each see one copy in a display query. If their appends do not check for intervening stock changes, both can take it. Inspect the read used to decide, its key, the events that change availability and the guard actually applied at commit:

- In Arc/.NET with Chronicle, an eligible read-model parameter in a command validator constructor or handler can protect the decision under effective read protection `On`. Check that the read is not marked unprotected. If it guards the right book and stock-changing events, using a read model is not a defect.
- In standalone Chronicle, even a passive read alone is not a guard. Bind the stock decision to the append (the `cratis-chronicle-protect-decision` skill, when installed) so a competing change refuses the borrowing. If the guard is not visible, ask which append guard covers this book before reporting a race.
- If the actual rule is uniqueness or creation at most once, use an append-time kernel constraint (the `cratis-chronicle-constrain-append` skill, when installed). A successful preflight check cannot reserve the value.

## What happens on rebuild or retry?

**Rebuilding the list sends a welcome.** If the mapping that reconstructs the Authors view calls the mail service, rebuilding that answer can contact authors again. Keep the projection responsible for the view (the `cratis-chronicle-project-view` skill, when installed); put the intentional external effect in a reaction to the committed fact (the `cratis-chronicle-react-to-fact` skill, when installed).

**Retry sends a second welcome.** The receiver accepts the first request, but the handler fails before recording success. `OnceOnly` controls replay, not ordinary recovery; a fresh request ID on recovery also hides the duplicate from the receiver. If only one welcome is intended, reuse a stable delivery identity (the `cratis-chronicle-react-to-fact` skill, when installed) that the receiver deduplicates, or record a receipt atomically with the effect. Writing a receipt after a separate external call leaves the same failure window.

## Will stored history still mean what it did?

**A rename changes the stored event type ID.** Readers expecting the new ID can miss existing registrations; reusing the old ID for a different act can make readers misinterpret them. Preserve the effective stored ID for the same fact. If its schema changes, map compatible representations across generations (the `cratis-chronicle-evolve-event` skill, when installed). Give a different fact its own ID. A class rename that preserves stored identity and shape is not this failure.

**Deletion offered as undo or erasure.** Dropping a registration row from history loses the explanation for a business reversal. When the reversal belongs in the history, record the correcting fact (the `cratis-chronicle-record-event` skill, when installed). When the goal is privacy, hiding a list row does not erase the underlying data. Protect personal data (the `cratis-chronicle-protect-personal-data` skill, when installed) with surrogate identifiers and protected content. Subject-key erasure addresses fields encrypted for that subject; authorized targeted redaction replaces selected event payloads with markers, retaining sequence positions and audit metadata. Neither establishes that released copies, read models or backups are clean. Identify what remains and its retention policy separately.
