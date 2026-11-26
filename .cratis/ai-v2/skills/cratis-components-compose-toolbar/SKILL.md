---
name: cratis-components-compose-toolbar
description: Builds a toolbar whose visible buttons change with the screen mode. Use when a screen needs a tool palette or mode-specific tools. Not for row actions on a list (use cratis-components-display-list).
compatibility: Requires react and @cratis/components.
---

# Switch shelf drawing tools between drawing and reviewing

1. In `Features/Board/DrawingTools.tsx`, accept the shelf board's current mode, the operation to draw a shelf and the operation to add a review note. Use the application's [Components provider](../cratis-arc-react-bind-slice/SKILL.md).
2. Give each button visible `text` or an `icon`, a `title` for its accessible name and tooltip, and `onClick` for the action.
3. Set `focusMode` to `SingleTabStop` to enter the toolbar once with Tab and move between its tools with arrow keys. The default `Arrows` mode leaves each tool a Tab stop.

```tsx
import { Toolbar, ToolbarButton, ToolbarContext, ToolbarFocusMode, ToolbarSection } from '@cratis/components/Toolbar';

export function DrawingTools({ mode, draw, annotate }: {
    mode: 'draw' | 'review'; draw: () => void; annotate: () => void;
}) {
    return <Toolbar aria-label="Shelf tools" focusMode={ToolbarFocusMode.SingleTabStop}>
        <ToolbarSection activeContext={mode}>
            <ToolbarContext name="draw"><ToolbarButton text="Shelf" title="Draw shelf" onClick={draw} /></ToolbarContext>
            <ToolbarContext name="review"><ToolbarButton text="Note" title="Add note" onClick={annotate} /></ToolbarContext>
        </ToolbarSection>
    </Toolbar>;
}
```

## Avoid

- Don't use a mode that matches no context name. The section then displays no tools.
- Don't rely on unmounting to clear a draft. An inactive context stays mounted, hidden and inert; explicitly reset the state if changing mode should discard it.

## Related skills

- [Place board items](../cratis-components-build-canvas/SKILL.md)
