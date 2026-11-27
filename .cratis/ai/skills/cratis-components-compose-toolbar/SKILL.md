---
name: cratis-components-compose-toolbar
description: Use when a screen needs a toolbar with a tool palette or buttons that change with the screen mode. Not for row actions on a list (use cratis-components-display-list).
compatibility: Requires react and @cratis/components.
---

# Switch shelf drawing tools between drawing and reviewing

Use the [DataPage menu](../cratis-components-display-list/SKILL.md) for actions on its list or selection. For board tools, default to one stable group. Choose `ToolbarSection` with named contexts only when changing modes changes which tools are usable; keep shared tools outside the section.

1. In `Features/Board/DrawingTools.tsx`, accept the shelf board's current mode, the operation to draw a shelf and the operation to add a review note. Use the application's [Components provider](../cratis-arc-react-bind-slice/SKILL.md).
2. Give each button visible `text` and a `title` for its accessible name and tooltip, and `onClick` for the action.
3. Set `focusMode` to `SingleTabStop` to enter the toolbar once with Tab and move between its tools with arrow keys. Omit `focusMode` to keep each tool a Tab stop with arrow navigation.

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

Switch modes using the keyboard and check where focus lands. If a mode change hides the focused tool, have the host call `modeButtonRef.current?.focus()` on its visible mode switcher after the change.

## When it goes off the usual path

- **No tools appear after a mode switch:** check that `activeContext` matches a context name.
- **A draft should reset on mode switch:** call the host's `setDraft('')` as part of changing modes. An inactive context stays mounted, hidden and inert.

## Related skills

- [Place board items](../cratis-components-build-canvas/SKILL.md)
