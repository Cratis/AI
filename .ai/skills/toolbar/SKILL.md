---
name: toolbar
description: Use this skill when asked to add or build a canvas-style icon toolbar using the @cratis/components Toolbar component. Covers Toolbar, ToolbarButton, ToolbarSeparator, ToolbarSection, ToolbarContext, and ToolbarFanOutItem. Use whenever building tool panels, drawing tool selectors, zoom controls, or any icon-button group with active states, context switching, or fan-out sub-panels.
---

## When to use the Toolbar

The `Toolbar` component is designed for **canvas-style tool panels** — the kind you find in drawing or diagram editors. It groups `ToolbarButton` elements into a pill-shaped bar with hover tooltips and active highlights. Use it when you need:

- A tool selector with an "active tool" state
- A set of action buttons that animate between tool modes
- A toolbar that fans out sub-panels for grouped tools

For a standard page action menu (Create / Edit / Delete over a data table), use `DataPage.MenuItems` instead.

---

## Component overview

| Component | Purpose |
|---|---|
| `Toolbar` | Container — renders a pill-shaped bar of buttons |
| `ToolbarButton` | Icon or text button with tooltip and optional active state |
| `ToolbarSeparator` | Visual divider between button groups |
| `ToolbarSection` | Animated section that transitions between named contexts |
| `ToolbarContext` | Named set of buttons inside a `ToolbarSection` |
| `ToolbarFanOutItem` | Button that slides out a horizontal sub-panel on click |

All components import from the `@cratis/components/Toolbar` subpath (never the root barrel — see components.md):

```tsx
import { Toolbar, ToolbarButton, ToolbarSeparator, ToolbarSection, ToolbarContext, ToolbarFanOutItem } from '@cratis/components/Toolbar';
```

---

## Step 1 — Basic vertical toolbar

Place `ToolbarButton` elements inside `Toolbar`. The default orientation is vertical.

```tsx
import { Toolbar, ToolbarButton } from '@cratis/components/Toolbar';

export const DrawingToolbar = () => (
    <Toolbar>
        <ToolbarButton icon='pi pi-arrow-up-left' title='Select' />
        <ToolbarButton icon='pi pi-pencil' title='Draw' />
        <ToolbarButton icon='pi pi-stop' title='Rectangle' />
    </Toolbar>
);
```

---

## Step 2 — Active state (selected tool)

Use the `active` prop to highlight the currently selected tool. Drive it from state:

```tsx
import { useState } from 'react';
import { Toolbar, ToolbarButton } from '@cratis/components/Toolbar';

export const DrawingToolbar = () => {
    const [activeTool, setActiveTool] = useState('select');

    return (
        <Toolbar>
            <ToolbarButton
                icon='pi pi-arrow-up-left'
                title='Select'
                active={activeTool === 'select'}
                onClick={() => setActiveTool('select')}
            />
            <ToolbarButton
                icon='pi pi-pencil'
                title='Draw'
                active={activeTool === 'draw'}
                onClick={() => setActiveTool('draw')}
            />
            <ToolbarButton
                icon='pi pi-stop'
                title='Rectangle'
                active={activeTool === 'rect'}
                onClick={() => setActiveTool('rect')}
            />
        </Toolbar>
    );
};
```

---

## Step 3 — Separators

`ToolbarSeparator` draws a thin divider line between groups. Pass the same `orientation` as the enclosing `Toolbar`:

```tsx
<Toolbar>
    <ToolbarButton icon='pi pi-pencil' title='Draw' />
    <ToolbarButton icon='pi pi-stop' title='Rectangle' />
    <ToolbarSeparator />
    <ToolbarButton icon='pi pi-undo' title='Undo' />
    <ToolbarButton icon='pi pi-refresh' title='Redo' />
</Toolbar>
```

---

## Step 4 — Horizontal toolbar with text buttons

Pass `orientation='horizontal'` for a horizontal layout. Use `text` for buttons that display a value (e.g. zoom percentage):

```tsx
import { useState } from 'react';
import { Toolbar, ToolbarButton, ToolbarSeparator } from '@cratis/components/Toolbar';

export const ZoomToolbar = () => {
    const [zoom, setZoom] = useState(100);

    return (
        <Toolbar orientation='horizontal'>
            <ToolbarButton icon='pi pi-minus' title='Zoom out' tooltipPosition='bottom' onClick={() => setZoom(z => z - 10)} />
            <ToolbarButton text={`${zoom}%`} title='Reset zoom' tooltipPosition='bottom' onClick={() => setZoom(100)} />
            <ToolbarButton icon='pi pi-plus' title='Zoom in' tooltipPosition='bottom' onClick={() => setZoom(z => z + 10)} />
            <ToolbarSeparator orientation='horizontal' />
            <ToolbarButton icon='pi pi-question-circle' title='Help' tooltipPosition='bottom' />
        </Toolbar>
    );
};
```

> For horizontal toolbars, set `tooltipPosition='bottom'` (or `'top'`) so tooltips do not overlap the toolbar.

---

## Step 5 — Animated context switching

`ToolbarSection` + `ToolbarContext` allows the toolbar to show different sets of buttons depending on the active mode. When `activeContext` changes, the buttons fade out, the section morphs to the new size, and the new buttons fade in.

```tsx
import { useState } from 'react';
import { Toolbar, ToolbarButton, ToolbarSection, ToolbarContext } from '@cratis/components/Toolbar';

export const ContextualToolbar = () => {
    const [mode, setMode] = useState<'drawing' | 'text'>('drawing');

    return (
        <Toolbar>
            <ToolbarButton icon='pi pi-arrow-up-left' title='Select' />
            <ToolbarSection activeContext={mode}>
                <ToolbarContext name='drawing'>
                    <ToolbarButton icon='pi pi-pencil' title='Draw' />
                    <ToolbarButton icon='pi pi-stop' title='Rectangle' />
                    <ToolbarButton icon='pi pi-circle' title='Circle' />
                </ToolbarContext>
                <ToolbarContext name='text'>
                    <ToolbarButton icon='pi pi-align-left' title='Align Left' />
                    <ToolbarButton icon='pi pi-align-center' title='Align Center' />
                    <ToolbarButton icon='pi pi-align-right' title='Align Right' />
                </ToolbarContext>
            </ToolbarSection>
            <ToolbarButton icon='pi pi-undo' title='Undo' />
        </Toolbar>
    );
};
```

Only the `ToolbarSection` transitions. Buttons outside the section are unaffected.

---

## Step 6 — Fan-out sub-panel

`ToolbarFanOutItem` replaces a regular button with one that fans out a horizontal panel of additional tools. Clicking the button again or anywhere outside closes the panel.

```tsx
import { Toolbar, ToolbarButton, ToolbarFanOutItem } from '@cratis/components/Toolbar';

export const ShapesToolbar = () => (
    <Toolbar>
        <ToolbarButton icon='pi pi-arrow-up-left' title='Select' />
        <ToolbarFanOutItem icon='pi pi-th-large' tooltip='Shapes'>
            <ToolbarButton icon='pi pi-stop' title='Rectangle' />
            <ToolbarButton icon='pi pi-circle' title='Circle' />
            <ToolbarButton icon='pi pi-minus' title='Line' />
        </ToolbarFanOutItem>
    </Toolbar>
);
```

When the toolbar is on the **right side** of the screen, fan out to the left:

```tsx
<ToolbarFanOutItem icon='pi pi-th-large' tooltip='Shapes' fanOutDirection='left'>
    ...
</ToolbarFanOutItem>
```

---

## Props reference

### `Toolbar`

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | — | `ToolbarButton`, `ToolbarSeparator`, `ToolbarSection`, or `ToolbarFanOutItem` elements |
| `orientation` | `'vertical' \| 'horizontal'` | `'vertical'` | Layout direction |

### `ToolbarButton`

| Prop | Type | Default | Description |
|---|---|---|---|
| `icon` | `Icon` (`string \| ReactNode`) | — | PrimeIcons CSS class (e.g. `'pi pi-pencil'`) or a rendered node |
| `text` | `string` | — | Text shown inside the button (use for values like zoom %) |
| `title` | `string` | **required** | Tooltip text on hover, and the button's `aria-label` |
| `active` | `boolean` | `false` | Highlights the button as selected |
| `onClick` | `() => void` | — | Click handler |
| `tooltipPosition` | `'top' \| 'right' \| 'bottom' \| 'left'` | `'right'` | Tooltip position |
| `draggable` | `boolean` | `false` | Makes the button a drag source |
| `data` | `unknown` | — | Payload handed to `onDragStart` |
| `onDragStart` | `(data, event) => void` | — | Drag-start handler |

### `ToolbarSeparator`

| Prop | Type | Default | Description |
|---|---|---|---|
| `orientation` | `'vertical' \| 'horizontal'` | `'vertical'` | Match the enclosing `Toolbar` orientation |

### `ToolbarSection`

| Prop | Type | Default | Description |
|---|---|---|---|
| `activeContext` | `string` | first context name | Name of the active `ToolbarContext` |
| `children` | `ToolbarContext[]` | — | `ToolbarContext` children |
| `orientation` | `'vertical' \| 'horizontal'` | `'vertical'` | Match the enclosing `Toolbar` |

### `ToolbarContext`

| Prop | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | **required** | Identifier matched by `ToolbarSection.activeContext` |
| `children` | `ReactNode` | — | `ToolbarButton` elements for this context |

### `ToolbarFanOutItem`

| Prop | Type | Default | Description |
|---|---|---|---|
| `icon` | `Icon` (`string \| ReactNode`) | **required** | PrimeIcons CSS class for the trigger button, or a rendered node |
| `tooltip` | `string` | **required** | Tooltip for the trigger button |
| `tooltipPosition` | `'top' \| 'right' \| 'bottom' \| 'left'` | `'right'` | Tooltip position |
| `fanOutDirection` | `'right' \| 'left' \| 'up' \| 'down'` | `'right'` | Direction the sub-panel slides out |
| `children` | `ReactNode` | — | `ToolbarButton` elements inside the fan-out panel |

---

## Multiple toolbar groups

Render separate `Toolbar` instances to create distinct groups:

```tsx
<div className='flex flex-column gap-2'>
    <Toolbar>
        <ToolbarButton icon='pi pi-arrow-up-left' title='Select' />
        <ToolbarButton icon='pi pi-pencil' title='Draw' />
    </Toolbar>
    <Toolbar>
        <ToolbarButton icon='pi pi-undo' title='Undo' />
        <ToolbarButton icon='pi pi-refresh' title='Redo' />
    </Toolbar>
</div>
```

---

## Validation

After creating or modifying a Toolbar component, run:

```bash
yarn lint
npx tsc -b
```

Fix all errors before proceeding.
