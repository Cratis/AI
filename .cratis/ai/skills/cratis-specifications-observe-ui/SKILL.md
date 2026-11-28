---
name: cratis-specifications-observe-ui
description: Use when a frontend author needs to check keyboard interaction, dialog focus or visible input in a Storybook play function. Not for proving backend validation.
compatibility: Requires React Storybook with @storybook/react-vite, the Library UI packages and generated proxies. The running application check requires an authenticated browser session.
---

# Open the real Add author dialog in a story

Start with a Storybook preview for the application and a working dialog. In this Library example the trigger and dialog are both named “Add author”, with a single name field. Put `AddAuthor.stories.tsx` beside the application's `AddAuthorButton` and `AddAuthor` components. Check that focus enters the dialog without configuring a different focus target for the test. Omit the decorator if the preview already supplies the Arc and Components providers.

```tsx
import '@cratis/fundamentals/reflection';
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

Use the project's existing authenticated browser harness for command-to-row delivery. Start on Authors in a fresh namespace, submit a unique name and wait for its row on the same open page without reloading. Any harness that can do this satisfies the live check. For example, with Playwright, put this helper in `Features/Authors/Registration/verifyKeyboardRegistration.mjs` and pass it that page and name. `locator.press()` targets the element; it does not test how Tab gets there.

```js
export async function verifyKeyboardRegistration(page, name) {
    await page.getByRole('button', { name: 'Add author' }).press('Enter');
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox').fill(name);
    await dialog.getByRole('button', { name: 'Add', exact: true }).press('Enter');
    await page.getByRole('row').filter({ hasText: name }).waitFor();
}
```

If the dialog cannot be found after Enter, inspect the trigger's accessible name and check the document body for a portal before changing the component. The story does not submit a command. For server refusal, exercise the backend (`cratis-specifications-exercise-backend` skill) with the same invalid input.

A Storybook build compiles a play function; only an interaction runner that executes it proves the behavior. Use its instrumented assertions. Keep command refusal and draft-retention tests in the application runner; reserve the browser interaction for a consequence that needs a browser, such as focus return.
