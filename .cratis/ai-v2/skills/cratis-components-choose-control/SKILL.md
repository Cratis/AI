---
name: cratis-components-choose-control
description: Use when an input or navigation control needs selection, search, dates, tabs, tags or breadcrumbs. Not for command submission (cratis-components-submit-form).
---

# Choose a control by its committed value

For a small exclusive choice use ToggleGroup with one string value. Distinguish a filter choice from revealing a panel; they promise different keyboard behavior.

Use the component subpath imports below. If the installed declarations lack one of these props, inspect the package export and the host renderer before changing the interaction.

1. Name the value and commit boundary. Done: the scope has one key and Apply is the only action that changes the active filter.
2. Give the group an accessible name and keep draft selection controlled. Done: one tab stop reaches the group and arrow navigation moves to the other option.
3. Press Space to select the focused option in the draft. Tab to Apply and activate it. Done: Mine receives keyboard focus while the active value is still all; Apply commits mine.

## Example

Mount this view inside the configured application host.

```tsx
import { useState } from 'react';
import { ToggleGroup } from '@cratis/components/Common';

export function View() {
    const [draft, edit] = useState('all');
    const [active, apply] = useState('all');
    return <><ToggleGroup aria-label="Scope" options={[{ value: 'all', label: 'Everyone' },
        { value: 'mine', label: 'Mine' }]} value={draft} onChange={edit}/>
        <button onClick={() => apply(draft)}>Apply</button><output>{active}</output></>;
}
```

If changing a choice should reveal a different labeled panel, use tabs instead of assigning tab roles to a value picker.

Read references/choice-controls.md when options must be searched or selected in multiples.

Read references/navigation.md when selection navigates rather than setting a value.

Read references/dates.md when the chosen value is a calendar date.

## Verify

In the cratis-components-choose-control example fixture, run `npm run test:example`. Mine receives keyboard focus while the active value is still all; Apply commits mine.
