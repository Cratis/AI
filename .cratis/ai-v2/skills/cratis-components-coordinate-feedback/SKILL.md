---
name: cratis-components-coordinate-feedback
description: Registers confirmation and busy dialogs and asks for confirmation before an action runs. Use when an action needs a yes/no answer. Not for forms that collect command fields (use cratis-components-submit-form).
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

## Avoid

- Don't treat dismissal or No as Yes.
- Don't enable the button while the answer or the removal is pending.
- Don't report success on confirmation. Wait until the removal succeeds.

## Related skills

- [Open a custom command dialog](../cratis-components-submit-form/SKILL.md)
