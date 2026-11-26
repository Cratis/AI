import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';

export default { title: 'Library/Authors/Registration' };

function ControlledRegistration() {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [names, setNames] = useState<string[]>([]);
    return <>
        <button onClick={() => setOpen(true)}>Add author</button>
        {open && <form onSubmit={event => {
            event.preventDefault();
            setNames([...names, name]);
            setOpen(false);
            setName('');
        }}>
            <label>Name <input value={name} onChange={e => setName(e.target.value)} /></label>
            <button disabled={!name.trim()}>Add</button>
        </form>}
        <ul>{names.map((value, index) => <li key={index}>{value}</li>)}</ul>
    </>;
}

export const SubmitFromKeyboard = {
    render: () => <ControlledRegistration />,
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const canvas = within(canvasElement);
        await userEvent.click(canvas.getByRole('button', { name: 'Add author' }));
        await expect(canvas.getByRole('button', { name: 'Add', exact: true })).toBeDisabled();
        await userEvent.type(canvas.getByRole('textbox', { name: 'Name' }), 'Aster{Enter}');
        await expect(canvas.getByRole('listitem')).toHaveTextContent('Aster');
    },
};
