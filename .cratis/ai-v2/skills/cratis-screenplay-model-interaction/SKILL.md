---
name: cratis-screenplay-model-interaction
description: Binds screens, actions and forms to modeled operations. Use when declaring a Screenplay form, navigation destination or performer-specific action. Not for React bindings (use cratis-arc-react-bind-slice).
compatibility: Requires the Screenplay CLI.
---

# Bind the Add author form and authors list

Use the command and observable query from [declaring the Authors slice](../cratis-screenplay-declare-slice/SKILL.md). In `model/Authors/screens.play`, declare the form directly under the module, and declare each screen inside its feature slice.

1. Bind the form to `RegisterAuthor` and label the editable name. The caller must supply the `AuthorId` requested by the command; the name is not the identifier.
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
        section addAuthor
          title "Add author"
          on click
            navigate to AddAuthor
```

From the directory containing `model`, run `screenplay export model --format ui --output screens.json`. Check that Add binds to `RegisterAuthor`, its successful destination is `Authors`, and the list reads a live collection from `AllAuthors`.

## Avoid

- Don't use `for item` on Add; reserve it for actions on a selected row.
- Don't show a generated command input as an editable field; use the returned ID when navigating to a generated entity.
- Don't treat action visibility as authorization; enforce permission at the operation.
- Don't navigate after a refused submission; refresh the actual state.

## Related skills

- [Declare the slice](../cratis-screenplay-declare-slice/SKILL.md) to define the operation inputs and results.
- [Bind the React slice](../cratis-arc-react-bind-slice/SKILL.md) to implement the accepted interaction.
