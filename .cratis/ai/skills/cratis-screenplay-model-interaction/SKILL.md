---
name: cratis-screenplay-model-interaction
description: Use when a modeler needs to bind a Screenplay form or screen to an operation, navigation destination or performer-specific action. Not for React bindings (use cratis-arc-react-bind-slice).
compatibility: Requires the Screenplay CLI.
---

# Bind the Add author form and authors list

Use the command and observable query from [declaring the Authors slice](../cratis-screenplay-declare-slice/SKILL.md). In `model/Authors/screens.play`, declare the form directly under the module, and declare each screen inside its feature slice.

1. Bind the form to `RegisterAuthor` and label the editable name. Do not add an `id` field. The [AddAuthor dialog](../cratis-components-submit-form/SKILL.md) initializes the generated command with a fresh ID.
2. Make Add a screen action: it does not require a selected row. Navigate to Authors only after successful submission.
3. Bind the list to `AllAuthors` so the screen uses the modeled collection instead of a second local list.

```play
module Library
  form AddAuthorForm for RegisterAuthor
    field name label "Name"
  feature Authors
    slice StateChange AddAuthorInput
      screen AddAuthor
        action RegisterAuthor for screen
          label "Add"
          navigate to Authors
    slice StateView BrowseAuthors
      screen Authors
        data Author[] via query AllAuthors
        title "Authors"
        toolbar authorActions
          item addAuthor navigate to AddAuthor
            label "Add author"
```

From the directory containing `model`, run `screenplay export model --format ui --output screens.json`. In `screens.json`, verify the Authors screen title, the toolbar item's `AddAuthor` destination, the Add action's `RegisterAuthor` command and `Authors` destination, and the live `AllAuthors` data binding. Check the form separately in `screens.play`: `form AddAuthorForm for RegisterAuthor` binds the editable name; a screen export alone need not contain the form declaration.

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

## Gate an interaction

If Add author is a preview feature, declare this audience at the model root. Add the gate under `screen AddAuthor` and `command RegisterAuthor`. The top-level form remains ungated: `screenplay model` can report `PLAY1139`. Render that form only from the gated screen and handle a not-available result from the command.

```play
audience AuthorRegistrationPreview
  description "Callers with the author registration preview"
```

```play
available for AuthorRegistrationPreview
```

Hide Add when the gate is closed, including when it cannot be resolved. Keep any existing command permission check; availability doesn't grant permission. Model specifications assume availability. On the target, check that a caller outside the audience cannot open Add or run the command, and that a caller inside the audience without permission is still denied.

## When it goes off the usual path

- **Submission is refused:** keep the registration screen open and show the command's outcome. Navigate to Authors only on success.
- **A gesture is in the UI export but does nothing:** check renderer support and record the gap. An exported interaction is not a working target interaction.

## Related skills

- [Model automation](../cratis-screenplay-model-automation/SKILL.md) for system-triggered work on a local fact rather than a librarian's action.
- [Model translation](../cratis-screenplay-model-translation/SKILL.md) when an outside observation must first become a local fact.
- [Declare the slice](../cratis-screenplay-declare-slice/SKILL.md) to define the operation inputs and results.
- [Bind the React slice](../cratis-arc-react-bind-slice/SKILL.md) to implement the accepted interaction.
