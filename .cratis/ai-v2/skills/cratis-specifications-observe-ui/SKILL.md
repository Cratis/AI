---
name: cratis-specifications-observe-ui
description: Use when testing visible interaction with the real Library dialog in a Storybook play function, such as opening the dialog and editing the author name. Not for choosing a control (use cratis-components-choose-control).
compatibility: Requires React Storybook with @storybook/react-vite, the Library UI packages and generated proxies. The running application check requires Playwright.
---

# Open the real Add author dialog in a story

Use a story with fixed inputs and the real component for dialog interaction and focus. Start with [AddAuthorButton and AddAuthor](../cratis-components-submit-form/SKILL.md) and set the real dialog's `initialFocus={DialogInitialFocus.Content}` as described there. Put `AddAuthor.stories.tsx` beside the button. Omit its decorator if the preview already supplies the [Library providers](../cratis-arc-react-bind-slice/SKILL.md).

```tsx
import 'reflect-metadata';
import { Arc } from '@cratis/arc.react';
import { CratisComponentsProvider } from '@cratis/components';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { AddAuthorButton } from './AddAuthorButton';

const meta = {
    title: 'Library/Authors/Registration',
    component: AddAuthorButton,
    decorators: [Story => <CratisComponentsProvider><Arc><Story /></Arc></CratisComponentsProvider>],
} satisfies Meta<typeof AddAuthorButton>;
export default meta;

export const OpensAndEditsName: StoryObj<typeof meta> = {
    play: async ({ canvasElement }) => {
        const trigger = within(canvasElement).getByRole('button', { name: 'Add author' });
        trigger.focus();
        await userEvent.keyboard('{Enter}');
        const page = within(canvasElement.ownerDocument.body);
        const dialog = within(await page.findByRole('dialog', { name: 'Add author' }));
        const title = dialog.getByRole('heading', { name: 'Add author' });
        await waitFor(() => expect(title).toHaveFocus());
        const input = dialog.getByRole('textbox');
        await userEvent.type(input, 'Aster');
        await expect(input).toHaveValue('Aster');
        await userEvent.keyboard('{Escape}');
        await waitFor(() => expect(trigger).toHaveFocus());
    },
};
```

## Check submission on the running Library application

Choose an authenticated live browser for command-to-row delivery. Put this helper in `Features/Authors/Registration/verifyKeyboardRegistration.mjs` and pass a page on Authors in a fresh namespace, plus a unique name. Wait for the row without reloading. `locator.press()` targets the element; it does not test how Tab gets there.

```js
export async function verifyKeyboardRegistration(page, name) {
    await page.getByRole('button', { name: 'Add author' }).press('Enter');
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox').fill(name);
    await dialog.getByRole('button', { name: 'Add', exact: true }).press('Enter');
    await page.getByRole('row').filter({ hasText: name }).waitFor();
}
```

## When it goes off the usual path

- **The dialog is portalled outside the canvas:** keep the trigger lookup scoped to the canvas and the named dialog lookup scoped to the preview document.
- **Testing server refusal:** in a wired story, use a nonempty name with a fixed refusal at the command transport boundary. Verify the announced refusal, visible error and still-open dialog before editing and resubmitting with an accepted result. Assert focus returns to the trigger after dismissal. A disabled Add button on empty input doesn't exercise refusal.

## Related skills

- [Deliver the slice](../cratis-platform-deliver-slice/SKILL.md) to check live delivery and backend refusal.
