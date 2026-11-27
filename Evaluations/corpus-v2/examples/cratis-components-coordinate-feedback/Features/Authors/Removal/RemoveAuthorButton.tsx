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

export const RemovalExample = () => {
    const [removed, setRemoved] = useState(false);
    async function remove() {
        if (!(await fetch('/author', { method: 'DELETE' })).ok) throw new Error('Remove failed');
        setRemoved(true);
    }
    return removed ? <p>Author removed.</p> : <RemoveAuthorButton name="Fern" remove={remove} />;
};
