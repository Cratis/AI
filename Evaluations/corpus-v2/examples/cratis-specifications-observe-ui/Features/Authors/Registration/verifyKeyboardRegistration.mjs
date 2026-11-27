export async function verifyKeyboardRegistration(page, name) {
    await page.getByRole('button', { name: 'Add author' }).press('Enter');
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox').fill(name);
    await dialog.getByRole('button', { name: 'Add', exact: true }).press('Enter');
    await page.getByRole('row').filter({ hasText: name }).waitFor();
}
