---
name: cratis-screenplay-model-interaction
description: Use when a .play model needs screens, forms, navigation or performer-specific availability. Not for binding a React component to generated operations (cratis-arc-react-bind-slice).
---

# Bind the input screen before the success destination

1. Mark the performer, screen-wide versus selected-row subject, and source of each input. **Done:** Add author does not require a selected Author; Name is form input, not a property copied from a list row. Record who supplies the new AuthorId.
2. Bind Authors to AllAuthors and navigate on click to AddAuthor. Attach the form to RegisterAuthor, then navigate back only on success. Read references/shell-and-locales.md when a shell or translated label changes the route. **Done:** the [screen declarations](../../../../Evaluations/corpus-v2/examples/cratis-screenplay-model-interaction/model/screens.play) distinguish opening the form from executing Add.
3. Gate the action for CatalogEditors. Read references/authentication-and-context.md when availability depends on a performer. **Done:** the model distinguishes unavailable from unauthorized; a hidden button cannot satisfy a command permission check.
4. From the fixture run `screenplay ./model --warnaserror`, `screenplay export model --format ui --output screens.json` and `node --test acceptance.test.mjs`. **Done:** the exported query, command identity, input and success target resolve; verify the authored unavailable case separately where the export omits audience gates. Hand the bindings and negative state to [UI verification](../cratis-specifications-observe-ui/SKILL.md) for actual interaction evidence.
