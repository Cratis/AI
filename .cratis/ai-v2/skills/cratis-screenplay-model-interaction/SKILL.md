---
name: cratis-screenplay-model-interaction
description: Use when a .play screen needs a form, navigation, a query binding or actions available to a particular performer. Not for wiring React hooks (cratis-arc-react-bind-slice).
compatibility: Requires the Screenplay CLI.
---

# Bind the input screen before the success destination

**Requires:** Check `screenplay --version`; restore the project's pinned CLI if missing.

1. Identify the performer and whether opening the form requires a selected row. Bind editable fields to the declared command and list data to its query. **Done:** each input has a source, including any identifier the performer never enters.
2. Separate navigation that opens the form from the action that submits it. Read references/shell-and-locales.md when shell routes or translated labels are involved. For example, a screen-wide submit action names its audience and success destination:

```screenplay
      screen AddAuthor
        action RegisterAuthor for screen
          label "Add"
          available for CatalogEditors
          navigate to Authors
```

   **Done:** opening the form does not execute the command, and rejection does not navigate to the success destination.
3. Run `screenplay ./model --warnaserror` and `screenplay export model --format ui --output screens.json` against the application model directory. **Done:** the exported query, action identity and navigation target resolve. If the export has screens but lacks identities, inspect stderr for a missing executable model. Check the authored audience gate separately from server authorization; read references/authentication-and-context.md when availability depends on the performer. Pass the expected interactions to [Test what the actor can do](../cratis-specifications-observe-ui/SKILL.md).
