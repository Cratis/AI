---
name: cratis-components-submit-form
description: Use when a developer binds typed fields to a generated command in a create or edit dialog and submits it on OK. Not for a yes/no confirmation (use cratis-components-coordinate-feedback).
compatibility: Requires @cratis/components, @cratis/arc.react and @cratis/fundamentals.
---

# Open a dialog to register an author

Default to one `CommandDialog` for a short submission. Bind the state change's input to the generated command. Submitting requests the change; it does not prove that an event committed.

1. Under the app's `Arc` and `CratisComponentsProvider`, create `Features/Authors/Registration/AddAuthor.tsx`. Import the generated command from the private `generated/Features/Authors/Registration` folder. For the generated `id: Guid`, call `Guid.create()`. Use `initialValues` for the ID the reader doesn't type. Bind the Name field directly to the command property.

```tsx
import { useState } from 'react';
import { CommandDialog } from '@cratis/components/CommandDialog';
import { InputTextField } from '@cratis/components/CommandForm';
import { Guid } from '@cratis/fundamentals';
import { RegisterAuthor } from '../../../generated/Features/Authors/Registration/RegisterAuthor';

export function AddAuthor() {
    const [initialValues] = useState(() => ({ id: Guid.create() }));
    return <CommandDialog<RegisterAuthor> command={RegisterAuthor} title="Add author"
        okLabel="Add" initialValues={initialValues}>
        <InputTextField<RegisterAuthor> value={author => author.name} title="Name" />
    </CommandDialog>;
}
```

2. Open that dialog from the Authors screen (`Features/Authors/Registration/AddAuthorButton.tsx`). Render the component returned by `useDialog` once, beside the button. `useDialog` supplies this custom dialog's context. To also offer the shared confirmation and busy dialogs, [register DialogComponents](../cratis-components-coordinate-feedback/SKILL.md) in `App.tsx`.

```tsx
import { useRef } from 'react';
import { useDialog } from '@cratis/arc.react/dialogs';
import { AddAuthor } from './AddAuthor';

export function AddAuthorButton() {
    const button = useRef<HTMLButtonElement>(null);
    const [Dialog, show] = useDialog(AddAuthor);
    async function open() {
        await show();
        button.current?.focus();
    }
    return <><button ref={button} type="button" onClick={open}>Add author</button><Dialog /></>;
}
```

3. Import `AddAuthorButton` from `../Registration/AddAuthorButton` in `Features/Authors/Listing/Authors.tsx` and render it beside the list, independent of row selection. Add no submit handler. OK runs the command. The dialog stays open on failure so the reader can correct the name; keep both field errors and the form summary visible.

Choose `StepperCommandDialog` when one command genuinely needs several stages. Import `{ StepperCommandDialog, StepperPanel }` from `@cratis/components/CommandDialog`. Replace both `CommandDialog` tags with `StepperCommandDialog`, and wrap each field group with `<StepperPanel header="Author details">…</StepperPanel>` using a distinct header per step. Next and Previous move between panels without executing; the final Submit runs the command only after validation across all steps. Verify that returning to fix a required field on an earlier step preserves the other inputs and enables one final submission.

For editing, pass the selected ID and name to `show({ id, name })`. In the edit dialog, capture that opening's snapshot with `const [initialValues] = useState(() => ({ id, name }));`. Pass it to `CommandDialog` as above. `useDialog` unmounts the dialog on close, so the next opening starts with its own values. Pass `validateOnInit` when the prefilled values may be invalid and errors should appear on open.

Read the generated command type before choosing field accessors; use its property names, not the labels shown in the dialog. Put required values already known to the caller in `initialValues`, not `onBeforeExecute` (validation runs first). For a `Date` property, choose `CalendarField` from `@cratis/components/CommandForm`; set `showTime` when the time is required. Put caller-owned post-save effects in `onSuccess`, not in a click or close handler.

## Avoid

- Don't execute a second command when the dialog closes.
- Don't put `CommandForm` inside `CommandDialog`; the dialog already contains the form. To generate fields inside an existing form or dialog, use `AutoCommandFields` from `@cratis/components/CommandForm`; it adds fields, not a second form.

## When it goes off the usual path

- **The server owns translated field messages:** send the selected locale through `<Arc httpHeadersCallback={() => ({ 'Accept-Language': locale })}>` and configure the backend to honor it. Return user-facing rule messages with the affected member names so the form can place them beside the fields. The header does not translate client-side errors or dialog labels.
- **Enter could activate confirmation on open:** import `{ DialogInitialFocus }` from `@cratis/components/Dialogs` and pass `initialFocus={DialogInitialFocus.Content}` to focus the title, then test that Enter there does not submit and Tab reaches the editable field.
- **The command is refused:** keep the dialog open. A field violation needs a correction; denied authorization needs a caller with permission, not a different field value.

For a one-off check in the existing edit story, type a new name, rerender the parent without closing the dialog, then submit. The command should carry the typed name and the original ID. Use [the UI observation skill](../cratis-specifications-observe-ui/SKILL.md) to exercise the interaction.

## Related skills

- [Choose a control](../cratis-components-choose-control/SKILL.md) for a known field; [edit schema-defined data](../cratis-components-edit-schema-data/SKILL.md) when the fields are determined at runtime.

- [Confirm an action](../cratis-components-coordinate-feedback/SKILL.md)

For one submission across several steps, read [wizard.md](references/wizard.md).

For confirming a command without double close, read [confirmation.md](references/confirmation.md).
