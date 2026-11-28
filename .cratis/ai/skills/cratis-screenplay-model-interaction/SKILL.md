---
name: cratis-screenplay-model-interaction
description: Use when a modeler needs to bind a Screenplay form or screen to an operation, navigation destination or performer-specific action. Not for React bindings; use the `cratis-arc-react-bind-slice` skill (installed by the `cratis/arc/react` profile) for those.
compatibility: Requires the Screenplay CLI.
---

# Bind the Add author form and authors list

Use the command and observable query from [declaring the Authors slice](../cratis-screenplay-declare-slice/SKILL.md). In the existing `model/Authors/registration.play`, insert the form directly under `module Library`. Insert each `screen` block inside the existing slice that owns its command or query, alongside those declarations. The headers below show placement; do not redeclare the slices in another file.

1. Bind the form to `RegisterAuthor` and label the editable name. Do not add an `id` field. The AddAuthor dialog (`cratis-components-submit-form` skill in `cratis/components`) initializes the generated command with a fresh ID.
2. Make Add a screen action: it does not require a selected row. Navigate to Authors only after successful submission.
3. Bind the list to `AllAuthors` so the screen uses the modeled collection instead of a second local list.

```play
module Library
  form AddAuthorForm for RegisterAuthor
    field name label "Name"
  feature Authors
    slice StateChange RegisterAuthor
      screen AddAuthor
        action RegisterAuthor for screen
          label "Add"
          navigate to Authors
    slice StateView ListAuthors
      screen Authors
        data Author[] via query AllAuthors
        title "Authors"
        toolbar authorActions
          item addAuthor navigate to AddAuthor
            label "Add author"
```

From the directory containing `model`, run `screenplay export model --format ui --output screens.json`. In `screens.json`, verify the Authors screen title, the toolbar item's `AddAuthor` destination, the Add action's `RegisterAuthor` command and `Authors` destination, and the live `AllAuthors` data binding. Check the form separately in `registration.play`: `form AddAuthorForm for RegisterAuthor` binds the editable name; a screen export alone need not contain the form declaration.

For an inspection gesture, bind the screen's collection with `data Author[] via query AllAuthors`. Put the interaction on the table displaying that collection, not at screen level. With an existing `AuthorDetails` screen whose input is `authorId`, pass the activated row's key explicitly:

```play
screen Authors
  data Author[] via query AllAuthors
  table AuthorRows
    column name
    on double click
      navigate to AuthorDetails
        with authorId from item.id
```

Keep Add as `action RegisterAuthor for screen`: it needs no selected row. The inspection gesture above passes `item.id` directly rather than making the user enter it in a form.

For an action `for item`, explicit bindings win, then compatible case-sensitive field names. A required non-generated scalar identifier may use a single key of the same nominal concept. Two UUIDs are not interchangeable just because they share a primitive. Where several collections could supply the subject, narrow to one displayed table or bind explicitly. Never choose the first row to resolve ambiguity.

If the command returns `registeredAuthorId`, pass it to the destination with `with authorId from registeredAuthorId` under the `navigate to AuthorDetails` action. Put the navigation in the form's `on submit` block. If the interaction issues the command directly with `execute <Command>`, put the navigation in its `on success` block. Use the bare returned name, not `$response.registeredAuthorId`, and check that the target renderer binds it. A failed submission has no returned value; do not read an old selection as a substitute.

For conditional actions, the first matching `when` wins. An `otherwise` branch is not a way to run a row action with no row. A change handler should act on the changed item, not the previous selection. A visibility guard is never the command's authorization policy.

A template with typed slots describes the repeated structure: the implementing screen supplies its own data and actions, respecting slot cardinality. A performer-backed query similarly declares an interface, not a second portable implementation. Preserve its inputs, result cardinality and policy; find provider evidence for its parameters rather than inferring them from the screen's dependency alone. For a C# attachment, see [snapshot and live performer bodies](references/csharp-performers.md).

For a decision that generates an identifier, attaches code, or compares time-sensitive inputs, [choose the command contract](references/decision-inputs.md) before you bind the form.

## Optional variant: gate Library as a preview

Leave the [acceptance walkthrough](../cratis-screenplay-accept-model/SKILL.md) ungated. If the entire Library module is a preview, declare this audience at the model root:

```play
audience LibraryPreview
  description "Callers with the Library preview"
```

Add the shared gate under the existing `module Library`, alongside `form AddAuthorForm`:

```play
module Library
  available for LibraryPreview
```

The form inherits the module gate, not a screen gate. Gating only `AddAuthor` and `RegisterAuthor` leaves the form able to invoke an unavailable command (`PLAY1139`). The module gate also covers the Authors screen, `AllAuthors`, and other screens, commands and queries in Library; it does not stop events or projections.

Hide gated screens and actions when the gate is closed or unresolved. Keep any existing command permission check; availability doesn't grant permission. Model specifications assume availability. On the target, check that a caller outside the audience cannot open Add, run the command or read the list, and that a caller inside the audience without permission is still denied.

If the same screen renders differently across profiles, [trace the shell and data provision](references/shell-and-data.md) before editing the component or adding a second command. For locale-dependent text, [write companion strings](references/localized-strings.md).

For an opt-in Scene web form that collects query arguments, [wire the TypeScript host](references/typescript.md). The component is not portable Screenplay form syntax; on other targets bind the actual query through the host's own form.

## When it goes off the usual path

- **Submission is refused:** keep the registration screen open and show the command's outcome. Navigate to Authors only on success.
- **A gesture is in the UI export but does nothing:** check renderer support and record the gap. An exported interaction is not a working target interaction.

## Related skills

- [Model automation](../cratis-screenplay-model-automation/SKILL.md) for system-triggered work on a local fact rather than a librarian's action.
- [Model translation](../cratis-screenplay-model-translation/SKILL.md) when an outside observation must first become a local fact.
- [Declare the slice](../cratis-screenplay-declare-slice/SKILL.md) to define the operation inputs and results.
- Use the `cratis-arc-react-bind-slice` skill (installed by the `cratis/arc/react` profile) to implement the accepted interaction.
