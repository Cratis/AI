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
