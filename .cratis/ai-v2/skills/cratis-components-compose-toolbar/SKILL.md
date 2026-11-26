---
name: cratis-components-compose-toolbar
description: Use when contextual actions need toolbar groups, sections or fan-outs. Not for list data binding (cratis-components-display-list).
---

# Switch the active toolbar commands

Group mutually exclusive actions under named contexts in one ToolbarSection. Put commands available in every mode outside that section.

Use the component subpath imports below. If the installed declarations lack one of these props, inspect the package export and the host renderer before changing the interaction.

1. Map each action to the mode in which it is valid. Done: Draw line belongs only to draw and Add note only to review.
2. Bind activeContext to the host mode. Done: switching mode removes Draw line from the accessible action set rather than just dimming it.
3. Navigate into the changed toolbar and invoke the command from the keyboard. Done: Add note records Note and the inactive command is unreachable.

## Example

Mount this view inside the configured application host.

```tsx
import { useState } from 'react';
import { Toolbar, ToolbarButton, ToolbarContext, ToolbarSection } from '@cratis/components/Toolbar';

export function View() {
    const [mode, change] = useState('draw');
    const [last, record] = useState('');
    return <><button onClick={() => change('review')}>Review mode</button><Toolbar>
        <ToolbarSection activeContext={mode}>
            <ToolbarContext name="draw"><ToolbarButton text="Line" title="Draw line" onClick={() => record('Line')}/></ToolbarContext>
            <ToolbarContext name="review"><ToolbarButton text="Note" title="Add note" onClick={() => record('Note')}/></ToolbarContext>
        </ToolbarSection></Toolbar><output>{last}</output></>;
}
```

If the action renders but receives no focus, inspect the active toolbar context and the native button name; hiding just the icon leaves an unintended command.

Read references/palettes-and-folders.md when a mode has more actions than fit at once.

## Verify

In the cratis-components-compose-toolbar example fixture, run `npm run test:example`. Add note records Note and the inactive command is unreachable.
