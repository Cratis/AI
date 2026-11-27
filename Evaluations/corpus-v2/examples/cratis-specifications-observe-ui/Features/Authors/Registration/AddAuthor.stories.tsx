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
