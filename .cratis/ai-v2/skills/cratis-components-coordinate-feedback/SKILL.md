---
name: cratis-components-coordinate-feedback
description: Use when showing a ConfirmationDialog, notification or busy dialog and handling its result. Not for collecting command fields (cratis-components-submit-form).
---

# Await the result of confirmation

Register the confirmation renderer at the dialog host. Treat its result as a decision; only the requesting caller owns the effect and its outcome.

Use the component subpath imports below. If the installed declarations lack one of these props, inspect the package export and the host renderer before changing the interaction.

1. Choose the exact affirmative result. Done: Yes is the only result that starts the archive request; dismissal has the same effect as No.
2. Await the effect and keep busy scoped to that operation. Done: a rejected response produces failure feedback and releases the trigger in finally.
3. Count requests across cancel, failed confirmation and successful confirmation. Done: cancel sends none, each Yes sends one, and feedback distinguishes failure from success.

## Example

Mount this view inside the configured application host.

```tsx
import { useState } from 'react';
import { DialogButtons, DialogComponents, DialogResult, useConfirmationDialog } from '@cratis/arc.react/dialogs';
import { ConfirmationDialog } from '@cratis/components/Dialogs';

function Archive() {
    const [confirm] = useConfirmationDialog('Archive record?', 'Remove it from active records?', DialogButtons.YesNo);
    const [busy, setBusy] = useState(false);
    const [status, report] = useState('Ready');
    async function archive() {
        if (await confirm() !== DialogResult.Yes) return;
        setBusy(true);
        try { const result = await fetch('/archive', { method: 'POST' }); report(result.ok ? 'Archived' : 'Archive failed'); }
        catch { report('Archive unavailable'); }
        finally { setBusy(false); }
    }
    return <><button disabled={busy} onClick={archive}>Archive</button><output>{status}</output></>;
}
export const View = () => <DialogComponents confirmation={ConfirmationDialog}><Archive/></DialogComponents>;
```

An unresolved confirmation usually means the trigger is outside the registered dialog host. Do not attach another mutation to a rendered Yes button.

Read references/dialog-host.md when multiple routes open the same confirmation UI.

## Verify

In the cratis-components-coordinate-feedback example fixture, run `npm run test:example`. cancel sends none, each Yes sends one, and feedback distinguishes failure from success.
