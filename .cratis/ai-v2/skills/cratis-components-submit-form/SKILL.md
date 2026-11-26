---
name: cratis-components-submit-form
description: Builds a dialog that binds typed fields to a generated command and runs it on OK. Use when adding a create or edit form for a command. Not for a yes/no confirmation (use cratis-components-coordinate-feedback).
compatibility: Requires @cratis/components, @cratis/arc.react and @cratis/fundamentals.
---

# Open a dialog to register an author

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

## Avoid

- Don't execute a second command when the dialog closes.
- Don't put `CommandForm` inside `CommandDialog`; the dialog already contains the form.
- Don't expect removing a field to clear its value. Clear the property if it no longer applies.

## Related skills

- [Confirm an action](../cratis-components-coordinate-feedback/SKILL.md)
