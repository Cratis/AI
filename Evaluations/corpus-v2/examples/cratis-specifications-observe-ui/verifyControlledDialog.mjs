import assert from 'node:assert/strict';

export async function verifyControlledDialog(page) {
    const trigger = page.getByRole('button', { name: 'Add author' });
    await trigger.press('Enter');
    const name = page.getByRole('textbox', { name: 'Name' });
    assert.ok(await name.evaluate(el => el === el.ownerDocument.activeElement));
    const add = page.getByRole('button', { name: 'Add', exact: true });
    assert.ok(await add.isDisabled());
    await name.fill('Aster');
    await name.press('Enter');
    assert.equal(await page.getByRole('listitem').innerText(), 'Aster');
    assert.ok(await trigger.evaluate(el => el === el.ownerDocument.activeElement));
}
