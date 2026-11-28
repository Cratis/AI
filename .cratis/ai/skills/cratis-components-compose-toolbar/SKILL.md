---
name: cratis-components-compose-toolbar
description: Use when a developer groups screen actions in a keyboard-navigable toolbar or changes the available tools by mode. Not for row actions on a list (use cratis-components-display-list).
compatibility: Requires react and @cratis/components.
---

# Switch shelf drawing tools between drawing and reviewing

Use the [DataPage menu](../cratis-components-display-list/SKILL.md) for actions on its list or selection. For board tools, default to one stable group. Choose `ToolbarSection` with named contexts only when changing modes changes which tools are usable; keep shared tools outside the section.

1. In `Features/Board/DrawingTools.tsx`, accept the shelf board's current mode, the operation to draw a shelf and the operation to add a review note. Use the application's `CratisComponentsProvider` from `@cratis/components`.
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

For a one-off check in the existing story, Tab into the toolbar and use the arrow keys. Active tools should be reachable; hidden tools should not run. Use [the UI observation skill](../cratis-specifications-observe-ui/SKILL.md) to exercise the interaction. If a mode change hides the focused tool, have the host call `modeButtonRef.current?.focus()` on its visible mode switcher after the change.

## When it goes off the usual path

- **No tools appear after a mode switch:** check that `activeContext` matches a context name.
- **A draft should reset on mode switch:** call the host's `setDraft('')` as part of changing modes. An inactive context stays mounted, hidden and inert.

## Related skills

- [Place board items](../cratis-components-build-canvas/SKILL.md)

For tools contributed outside the toolbar subtree, put contributor and consumer under the same `ToolbarSlotProvider`, publish a named `ToolbarSlot`, and set order explicitly if it matters. Unmounting withdraws the contribution. Group related tools; reserve `active` for toggles. Use a folder for a catalog: `onActivate(item)` reports the item, but the host inserts it. A cancelled drag must not insert anything or close the drawer.

For a contributed command, label `ToolbarButton` with `title` and `ToolbarFanOutItem` with `tooltip`. Consume the named contribution in the layout or with `useToolbarSlot` under the same provider.
