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
