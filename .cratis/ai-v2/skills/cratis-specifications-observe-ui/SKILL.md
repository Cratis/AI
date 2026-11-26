---
name: cratis-specifications-observe-ui
description: Tests visible interaction with the Library dialog in a Storybook play function. Use when specifying how a user opens the real dialog and edits the author name. Not for choosing a control (use cratis-components-choose-control).
compatibility: Requires React Storybook with @storybook/react-vite, the Library UI packages and generated proxies. The running application check requires Playwright.
---

# Open the real Add author dialog in a story

1. Start with [AddAuthorButton and AddAuthor](../cratis-components-submit-form/SKILL.md) and the generated `RegisterAuthor` proxy in the Library application. Put this story beside the button in `Features/Authors/Registration/AddAuthor.stories.tsx`. Its decorator mounts the [Library providers](../cratis-arc-react-bind-slice/SKILL.md); omit the local decorator if the project's preview already supplies both.
2. Open **Library / Authors / Registration → Opens And Edits Name** in Storybook. The play function opens the real dialog and edits its single name field. Query the trigger inside the canvas, then find the dialog in the preview document because the provider can render it outside the canvas.

```tsx
import 'reflect-metadata';
import { Arc } from '@cratis/arc.react';
import { CratisComponentsProvider } from '@cratis/components';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
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
        await userEvent.click(trigger);
        const page = within(canvasElement.ownerDocument.body);
        const dialog = within(await page.findByRole('dialog'));
        const input = dialog.getByRole('textbox');
        await userEvent.type(input, 'Aster');
        await expect(input).toHaveValue('Aster');
        await expect(dialog.getByRole('button', { name: 'Add', exact: true })).toBeVisible();
    },
};
```

## Check submission on the running Library application

Put this helper in `Features/Authors/Registration/verifyKeyboardRegistration.mjs`. Pass an authenticated Playwright page already on the Library Authors DataPage in a fresh namespace, and a unique name. Wait for the row without reloading:

```js
export async function verifyKeyboardRegistration(page, name) {
    await page.getByRole('button', { name: 'Add author' }).press('Enter');
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox').fill(name);
    await dialog.getByRole('button', { name: 'Add', exact: true }).press('Enter');
    await page.getByRole('row').filter({ hasText: name }).waitFor();
}
```

## Avoid

- Don't replace `AddAuthorButton` with a form defined by the story. That would not detect broken dialog wiring.
- Don't report a successful command or live query update from the story. It never presses Add.

## Related skills

- [Deliver the slice](../cratis-platform-deliver-slice/SKILL.md) to check live delivery and backend refusal.
