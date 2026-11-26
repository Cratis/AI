import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { renderAuthors } from './dist/authors.js';

test('an editor cannot submit a blank name and sees the one accepted row', async t => {
    const dom = new JSDOM('<main></main>');
    t.after(() => dom.window.close());
    const document = dom.window.document;
    const canvas = within(document.body);
    const user = userEvent.setup({ document });
    const calls = [];
    renderAuthors(document.querySelector('main'), name => calls.push(name));
    await user.click(canvas.getByRole('button', { name: 'Add author' }));
    const add = canvas.getByRole('button', { name: 'Add', exact: true });
    assert.equal(add.disabled, true);
    await user.click(add);
    assert.deepEqual(calls, []);
    await user.type(canvas.getByRole('textbox', { name: 'Name' }), 'Aster');
    await user.click(add);
    assert.deepEqual(calls, ['Aster']);
    assert.equal(canvas.getByRole('listitem').textContent, 'Aster');
});
