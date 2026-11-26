---
name: cratis-specifications-observe-ui
description: Tests an interaction through its visible outcome. Use when writing a Storybook interaction or a browser journey for focus, navigation or live UI state. Not for choosing a control (use cratis-components-choose-control).
compatibility: Requires Node.js and the application's UI runner; browser journeys require Playwright Chromium.
---

# Check keyboard submission in the Add author dialog

Test the dialog from the keyboard. A click handler can work even though opening the dialog loses focus or submitting a name never updates the visible list.

1. Add `playwright` to the browser-test project and install its Chromium browser. Start the Library's Authors screen with an empty Authors list, an **Add author** button and a dialog with a **Name** textbox and an **Add** submit button.
2. Open that screen in a Playwright page. Put the following check in `Features/Authors/Registration/verifyKeyboardRegistration.mjs` and pass it the opened page.
3. Check the name in the visible list and check where subsequent keyboard input will go.

```js
import assert from 'node:assert/strict';

export async function verifyKeyboardRegistration(page) {
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
```

For a local Storybook interaction, import `within`, `userEvent` and `expect` from `storybook/test`. Use `within(canvasElement)` to find the dialog controls, perform the interaction and assert the visible result. A story with a fake list cannot test live delivery. For a live query check, submit a unique disposable author to the running Library application and wait for the keyed row without a reload.

## Avoid

- Don't assert a setter call instead of the new author on screen.
- Don't infer focus from how a button looks; compare the control with the active element.
- Don't use a screenshot as the only assertion of successful submission.

## Related skills

- [Choose the control](../cratis-components-choose-control/SKILL.md) to change the interaction itself.
- [Deliver the slice](../cratis-platform-deliver-slice/SKILL.md) to connect the real command and query.
