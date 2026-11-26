---
name: cratis-specifications-observe-ui
description: Tests visible user interactions in a controlled Storybook story. Use when specifying a Library dialog's input, submission and visible result. Not for choosing a control (use cratis-components-choose-control).
compatibility: Requires a React Storybook project with story interaction tests enabled.
---

# Test author submission in a controlled story

1. Put the following story in `Features/Authors/Registration/AddAuthor.stories.tsx` in the Library UI project. The story owns its data and needs no authenticated host. Its form models the local interaction, not the Arc command or the production dialog.
2. Open **Library / Authors / Registration → Submit from keyboard** in Storybook and run its interaction. Assert against the rendered list, not a callback spy.

```tsx
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
```

## Check the production dialog separately

Put this helper in `Features/Authors/Registration/verifyKeyboardRegistration.mjs` in the browser-test project with `playwright` installed. Pass an authenticated Playwright page already on the Library Authors DataPage in a fresh namespace, and a unique name. It checks keyboard activation and live delivery, not initial focus placement.

```js
export async function verifyKeyboardRegistration(page, name) {
    await page.getByRole('button', { name: 'Add author' }).press('Enter');
    await page.getByRole('textbox', { name: 'Name' }).fill(name);
    await page.getByRole('button', { name: 'Add', exact: true }).press('Enter');
    await page.getByRole('row').filter({ hasText: name }).waitFor();
}
```

## Avoid

- Don't assert focus restoration or submission behavior of a production dialog from this controlled fixture.
- Don't use a local story to test live query delivery. Submit a unique name to the [running application](../cratis-platform-deliver-slice/SKILL.md) and wait for the matching row without a reload.

## Related skills

- [Submit the form](../cratis-components-submit-form/SKILL.md) for the production `AddAuthor` dialog.
