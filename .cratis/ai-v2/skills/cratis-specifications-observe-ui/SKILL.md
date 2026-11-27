---
name: cratis-specifications-observe-ui
description: Use when testing visible interaction with the real Library dialog in a Storybook play function, such as opening the dialog and editing the author name. Not for choosing a control (use cratis-components-choose-control).
compatibility: Requires React Storybook with @storybook/react-vite, the Library UI packages and generated proxies. The running application check requires Playwright.
---

# Open the real Add author dialog in a story

Put `AddAuthor.stories.tsx` beside the real [AddAuthorButton and AddAuthor](../cratis-components-submit-form/SKILL.md). Check that focus enters the dialog without configuring a different focus target for the test. Omit the decorator if the preview already supplies the [Library providers](../cratis-arc-react-bind-slice/SKILL.md).

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
        const dialog = await page.findByRole('dialog', { name: 'Add author' });
        await waitFor(() => expect(dialog.contains(dialog.ownerDocument.activeElement)).toBe(true));
        const input = within(dialog).getByRole('textbox');
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

For a server refusal, run the authenticated invalid-request check in [Deliver the slice](../cratis-platform-deliver-slice/SKILL.md). This story does not submit a command.

## Related skills

- [Deliver the slice](../cratis-platform-deliver-slice/SKILL.md) to check live delivery and backend refusal.
