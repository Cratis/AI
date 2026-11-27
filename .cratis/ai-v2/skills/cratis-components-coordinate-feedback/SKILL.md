---
name: cratis-components-coordinate-feedback
description: Use when registering confirmation and busy dialogs or when an action needs a yes/no answer before it runs. Not for forms that collect command fields (use cratis-components-submit-form).
compatibility: Requires react, @cratis/arc.react and @cratis/components.
---

# Confirm before removing an author

1. Inside the [application's Arc provider](../cratis-arc-react-bind-slice/SKILL.md), register both dialog components once in `App.tsx`. Here `Authors` is the [existing list screen](../cratis-components-display-list/SKILL.md); pass its required `onOpen` callback to display the selected author.

```tsx
import { DialogComponents } from '@cratis/arc.react/dialogs';
import { BusyIndicatorDialog, ConfirmationDialog } from '@cratis/components/Dialogs';
import { useState } from 'react';
import { Authors } from './Features/Authors/Listing/Authors';
import type { Author } from './generated/Features/Authors/Listing/Author';

export function App() {
    const [opened, open] = useState<Author>();
    return <DialogComponents confirmation={ConfirmationDialog} busyIndicator={BusyIndicatorDialog}>
        <Authors onOpen={open} />
        {opened && <section aria-label="Author details"><h2>{opened.name}</h2></section>}
    </DialogComponents>;
}
```

2. In `Features/Authors/Removal/RemoveAuthorButton.tsx`, accept the author's name and the caller's removal operation. The operation must resolve only on success and reject on failure. Ask the question on click, not during render.

```tsx
import { useState } from 'react';
import { DialogButtons, DialogResult, useConfirmationDialog } from '@cratis/arc.react/dialogs';

export function RemoveAuthorButton({ name, remove }: { name: string; remove: () => Promise<void> }) {
    const [confirm] = useConfirmationDialog('Remove author?', `Remove ${name} from the library?`, DialogButtons.YesNo);
    const [pending, setPending] = useState(false);
    const [failed, setFailed] = useState(false);
    async function onClick() {
        setPending(true);
        setFailed(false);
        try {
            if (await confirm() === DialogResult.Yes) await remove();
        } catch { setFailed(true); }
        finally { setPending(false); }
    }
    return <><button type="button" disabled={pending} onClick={onClick}>Remove</button>
        {failed && <p role="alert">Could not remove {name}.</p>}</>;
}
```

## Choose feedback for the wait

Default to local pending feedback for a short row action. Keep the button disabled while the answer or removal is pending. Ask for confirmation only when the choice matters; it is not progress feedback.

Choose the shared busy dialog when the user must wait before continuing. Registration alone does not show it. Import `{ useBusyIndicator }` from `@cratis/arc.react/dialogs` and add `const [showBusy, closeBusy] = useBusyIndicator('Removing author…');` in `RemoveAuthorButton`. Replace the existing Yes branch with `if (await confirm() === DialogResult.Yes) { void showBusy(); try { await remove(); } finally { closeBusy(); } }`. Do not await `showBusy()`; its promise resolves when the dialog closes.

## When it goes off the usual path

- **No or dismissal:** do not call the removal operation.
- **Failure after Yes:** show the removal failure and allow retry. Confirmation is not evidence that removal succeeded.

## Related skills

- [Host a chat](../cratis-components-host-chat/SKILL.md) when the screen needs a topic-based message sidebar rather than a dialog.

- [Open a custom command dialog](../cratis-components-submit-form/SKILL.md)
