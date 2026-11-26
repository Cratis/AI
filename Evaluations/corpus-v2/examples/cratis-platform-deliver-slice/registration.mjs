import assert from 'node:assert/strict';

export async function verifyRegistration(page, name = 'Aster') {
    const row = page.getByRole('row').filter({ hasText: name });
    assert.equal(await row.count(), 0);
    await page.getByRole('button', { name: 'Add author' }).click();
    const add = page.getByRole('button', { name: 'Add', exact: true });
    assert.ok(await add.isDisabled());
    await page.getByRole('textbox', { name: 'Name' }).fill(name);
    await add.click();
    await row.waitFor();
    assert.equal(await row.count(), 1);
    await page.reload();
    await row.waitFor();
    assert.equal(await row.count(), 1);
}
