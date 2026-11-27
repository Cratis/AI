---
name: cratis-platform-deliver-slice
description: Use when an application author must turn an accepted slice into a working command, read model and visible screen outcome. For a change confined to the command, use cratis-arc-declare-command.
---

# Register an author and show the new row

Start with a running development host and an [accepted slice handoff](../cratis-screenplay-handoff-slice/SKILL.md): model revision, qualified slice, target, owner of the history and accepted examples. For Library, registration is a state change; the Authors list is its consuming state view. Agree that a librarian can register Aster once and see exactly one new row without refreshing. If the owner hasn't decided what happens on an empty name, resolve that before coding a validator.

1. Confirm the [host](../cratis-arc-host-application/SKILL.md) reaches the intended [Chronicle store](../cratis-chronicle-connect-application/SKILL.md) and [read-model storage](../cratis-arc-connect-storage/SKILL.md). Work in a disposable namespace. Check which artifacts the target already generates; do not edit generated output or implement a second owner for the same behavior.
2. In the registration feature, [declare RegisterAuthor](../cratis-arc-declare-command/SKILL.md) and [validate its input](../cratis-arc-validate-command/SKILL.md). Address the author's history with its typed ID. For this decision, `public AuthorRegistered Handle() => new(Name);` returns the fact for the pipeline to append. Do not append it again in the handler.
3. [Project the authors list](../cratis-chronicle-project-view/SKILL.md): the row ID comes from the event source, the name from `AuthorRegistered`. Expose it via the observable [AllAuthors query](../cratis-arc-expose-query/SKILL.md).
4. [Generate the client](../cratis-arc-generate-proxies/SKILL.md) from the backend. [Submit the command](../cratis-components-submit-form/SKILL.md) once from the dialog and [display the rows](../cratis-components-display-list/SKILL.md) from `AllAuthors`. The query supplies the new row; don't also insert one into local state.
5. As the librarian on the open Authors screen, register a fresh name. Wait for the row without reloading, then check that a fresh query returns exactly one matching row with the same identity. Verify the agreed empty-name refusal in a [backend scenario](../cratis-specifications-exercise-backend/SKILL.md): the reason identifies the name rule and no event was appended. A disabled button alone does not prove backend refusal.

If registration succeeds but the row appears only after reloading, [trace the missing update](../cratis-platform-diagnose-slice/SKILL.md) before changing the form or projection. Report the observed result against the accepted example, not a list of generated files.
