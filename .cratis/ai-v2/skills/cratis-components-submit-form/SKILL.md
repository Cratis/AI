---
name: cratis-components-submit-form
description: Use when adding a create or edit dialog that binds typed fields to a generated command and submits it on OK. Not for a yes/no confirmation (use cratis-components-coordinate-feedback).
compatibility: Requires @cratis/components, @cratis/arc.react and @cratis/fundamentals.
---

# Open a dialog to register an author

Default to one `CommandDialog` for a short submission. Bind the state change's input to the generated command. Submitting requests the change; it does not prove that an event committed.

1. Under the app's [Arc and Components providers](../cratis-arc-react-bind-slice/SKILL.md), create `Features/Authors/Registration/AddAuthor.tsx`. Import the [generated command](../cratis-arc-generate-proxies/SKILL.md) from the private `generated/Features/Authors/Registration` folder. For the generated `id: Guid`, call `Guid.create()`. Use `initialValues` for the ID the reader doesn't type. Bind the Name field directly to the command property.

```tsx
import { CommandDialog } from '@cratis/components/CommandDialog';
import { InputTextField } from '@cratis/components/CommandForm';
import { Guid } from '@cratis/fundamentals';
import { RegisterAuthor } from '../../../generated/Features/Authors/Registration/RegisterAuthor';

export const AddAuthor = () => (
    <CommandDialog<RegisterAuthor> command={RegisterAuthor} title="Add author"
        okLabel="Add" initialValues={{ id: Guid.create() }}>
        <InputTextField<RegisterAuthor> value={author => author.name} title="Name" />
    </CommandDialog>
);
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

3. Add no submit handler. OK runs the command. The dialog stays open on failure so the reader can correct the name; keep both field errors and the form summary visible.

Choose `StepperCommandDialog` when one command genuinely needs several stages. Import it and `StepperPanel` from `@cratis/components/CommandDialog`; put each field group in a panel. Next and Previous move between panels without executing; the final Submit runs the command only after validation across all steps. Verify that returning to fix a required field on an earlier step preserves the other inputs and enables one final submission.

For commands with a generated `Date` property, bind `CalendarField` from `@cratis/components/CommandForm` as another typed field. Set `showTime` only if users supply a time as well as a date.

## Avoid

- Don't execute a second command when the dialog closes.
- Don't put `CommandForm` inside `CommandDialog`; the dialog already contains the form.

## When it goes off the usual path

- **Enter could activate confirmation on open:** set `initialFocus` to `DialogInitialFocus.Content` from `@cratis/components/Dialogs` to focus the title, then test that Enter there does not submit and Tab reaches the editable field.
- **The command is refused:** verify that the dialog stays open with the errors available for correction.
- **An input stops applying and its field disappears:** explicitly clear the corresponding property. Hiding the field doesn't clear the command value.

## Related skills

- [Choose a control](../cratis-components-choose-control/SKILL.md) for a known field; [edit schema-defined data](../cratis-components-edit-schema-data/SKILL.md) when the fields are determined at runtime.

- [Confirm an action](../cratis-components-coordinate-feedback/SKILL.md)
