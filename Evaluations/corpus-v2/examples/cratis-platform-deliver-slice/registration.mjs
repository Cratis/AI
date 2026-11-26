import assert from 'node:assert/strict';

// The host owner supplies an authenticated Playwright page at the fresh Authors route.
export async function verifyRegistration(page) {
    const row = page.getByRole('row').filter({ hasText: 'Aster' });
    assert.equal(await row.count(), 0);
    await page.getByRole('button', { name: 'Add author' }).click();
    const add = page.getByRole('button', { name: 'Add', exact: true });
    assert.ok(await add.isDisabled());
    await page.getByRole('textbox', { name: 'Name' }).fill('Aster');
    await add.click();
    await row.waitFor({ timeout: 10000 });
    assert.equal(await row.count(), 1);
    await page.reload();
    await row.waitFor({ timeout: 10000 });
    assert.equal(await row.count(), 1);
}
