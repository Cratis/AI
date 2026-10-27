<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Action subjects

## Contents

- [State intent](#state-intent)
- [Resolve data and inputs](#resolve-data-and-inputs)
- [Diagnostics and selected repairs](#diagnostics-and-selected-repairs)
- [Complete example and explicit repair](#complete-example-and-explicit-repair)
- [Authored and effective boundaries](#authored-and-effective-boundaries)

Read when choosing selection scope, tracing command inputs, or repairing action-subject diagnostics.

## State intent

Use `for item` for an action on a record or selected collection item; use `for screen` for a selection-independent action.
The clause follows the command or guarded label, before an inline `label`:

```screenplay excerpt
action RetryItem for item label "Retry"
  with itemId from item.rowId
  with note from $context.note

action AddItem for screen

toolbar actions
  item retry action RetryItem for item
  item add action AddItem for screen
```

Only action toolbar items accept the clause; navigation and dialog items do not.
Guarded alternatives retain their arguments; toolbar items retain their UI-binding parameters.
These words are contextual: `for` remains a legal identifier, including `action for for screen`.
The excerpt illustrates syntax, not a standalone compiled model.

## Resolve data and inputs

`for item` needs one nearest `data` declaration. Local sibling data takes precedence over inherited data regardless of source order, including sections, filled slots and outlets. Missing or equally near data is not guessed.

Resolve inputs in this order:

1. Explicit input bindings win.
2. Remaining non-generated inputs use compatible, case-sensitive same-name fields.
3. A required, non-generated, scalar identifier can use a unique key with the same declared nominal concept.
4. Remaining inputs can use an existing command form or renderer input.

Primitive equality, similar spelling, optional identifiers and unmarked foreign keys are not identity proof.
Never guess the first row or first key. Multiple matching nominal keys need an explicit binding.
`for screen` does not fill plain or toolbar action inputs from a row. A guarded action may inspect a single record even with `for screen`; collection-valued data stays unresolved and warns rather than choosing a row.

Without a clause, a plain or toolbar action infers Item only for exactly one collection data context, exactly one required non-generated identifier, and one matching declared key. Otherwise Screen is the omitted default. Guarded actions retain their single-subject behavior.

## Diagnostics and selected repairs

| Code | Severity | Disposition |
| --- | --- | --- |
| `PLAY0817` | Error | Fix a malformed, duplicate or misplaced subject clause. |
| `PLAY0818` | Information | Review the omitted plain/toolbar subject inference; state intent explicitly when migrating. |
| `PLAY0819` | Warning | Compare effective inputs with legacy case-insensitive row-name binding; choose screen, item, or explicit retention. |
| `PLAY0820` | Warning | Resolve multiple matching nominal keys with an explicit input binding. |
| `PLAY0821` | Warning | Guarded `for screen` over collection-valued data cannot choose one item; correct the intended subject/data context. |

`PLAY0815` and `PLAY0816` remain specification-invocation diagnostics, not action-subject codes.
`PLAY0319` covers malformed/duplicate inputs, `PLAY0345` unknown subject fields, and `PLAY0346` missing or ambiguous guarded subjects.
Warnings require review and disposition, not blanket source refusal. A warnings-as-errors gate can still fail on them.

Inspect authored and effective inputs before accepting a repair. For `PLAY0819`, either state `for screen`, state `for item` with intended inputs, or retain previous row bindings explicitly when declaration proof is unambiguous. Do not bulk-accept a binding by spelling or invent an imported declaration.
Select a diagnostic by source location and occurrence, not message text. Two advisories can have the same message: repair only the selected occurrence, preserve the other action and unrelated syntax/comments/toolbar parameters, and leave its advisory independently repairable. Apply transactionally at the inspected revision; recompile the complete imported workspace and review remaining diagnostics before applying another repair.

## Complete example and explicit repair

The omitted-subject model expects exactly `PLAY0818` and `PLAY0819`: nominal-key inference supplies `itemId` from `rowId`, unlike legacy name matching. The comment belongs to the authored source.

```screenplay expect PLAY0818,PLAY0819
concept ItemId : Uuid
module Work
  feature Items
    slice StateView List
      readmodel Row
        rowId ItemId key
        name String
      command Retry
        itemId ItemId identifier
      query Rows => Row[]
      screen List
        data Row[] via query Rows
        action Retry // preserve this comment
```

Choose the inferred item intent explicitly. Only the action clause changes; this complete model expects no diagnostics:

```screenplay
concept ItemId : Uuid
module Work
  feature Items
    slice StateView List
      readmodel Row
        rowId ItemId key
        name String
      command Retry
        itemId ItemId identifier
      query Rows => Row[]
      screen List
        data Row[] via query Rows
        action Retry for item // preserve this comment
```

Verify with `screenplay <model-root> --warnaserror` (or the repository's declared gate), including imports. With `--warnaserror`, a pass has zero errors and warnings; a recorded disposition alone does not clear a warning. Report information separately. These fences declare compiler expectations, not proof of runtime behavior.

## Authored and effective boundaries

`resolveActionSubjects(application)` and native `ScreenActionSubjects.Resolve(application)` return a separate effective application and diagnostics. Resolution is immutable and idempotent; do not overwrite authored intent with the resolved copy. Raw compilation, canonical JSON and printing preserve authored syntax; omitted subjects and empty inputs remain absent in legacy raw JSON. Consumers must opt into resolution.

Compiler/editor acceptance does not establish executable admission, selection behavior, form/renderer input support or rendering. Scene owns runtime execution and rendering proof; inspect and verify those separately rather than treating raw authored syntax as resolved execution metadata.
