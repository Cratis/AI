---
name: cratis-components-build-canvas
description: Use when a developer lays out interactive DOM items or Pixi markers in world coordinates on a pannable, zoomable Canvas. Not for grouping tool buttons (use cratis-components-compose-toolbar).
compatibility: Requires react, @cratis/components and the pixi.js peer dependency.
---

# Place a book on a pannable board

Default to DOM `CanvasItem` for content that needs keyboard focus. For dense, noninteractive book markers import `{ Graphics }` from `pixi.js` and use `<Canvas items={books} renderItem={() => new Graphics().circle(0, 0, 6).fill(0x2563eb)} />` inside the same sized wrapper. Each book has `id`, `x` and `y`. Keep positions in host data; panning and zooming do not save them.

1. Install the Canvas peer (`npm install pixi.js@8.20.0` for Components 4.63.1). In `Features/Books/BookBoard.tsx`, import `Canvas` and `CanvasItem` from `@cratis/components/Canvas`. Render `BookBoard` inside the app's `CratisComponentsProvider` from `@cratis/components`.
2. Give the containing element a height and set the canvas to fill it. Zoom controls are visible by default and stay fixed when the board moves. Pass `showControls={false}` to hide them.
3. Pass the book ID, title and its world coordinates from the board screen. Place its button inside `CanvasItem`; call the screen's `openBook` handler with the same ID.

```tsx
import { Canvas, CanvasItem } from '@cratis/components/Canvas';

type BoardBook = { id: string; title: string; x: number; y: number };
export function BookBoard({ book, openBook }: { book: BoardBook; openBook: (id: string) => void }) {
    return <div style={{ width: '100%', height: 480 }}>
        <Canvas style={{ width: '100%', height: '100%' }}>
            <CanvasItem id={book.id} x={book.x} y={book.y}>
                <button type="button" onClick={() => openBook(book.id)}>{book.title}</button>
            </CanvasItem>
        </Canvas>
    </div>;
}
```

Pan or zoom: the book should move with the board. Tab to its button and activate it; the handler should receive the book ID, not its current coordinates.

## Avoid

- Don't add the camera offset to `x` or `y`; the canvas applies it when it positions the item.
- Don't put a fixed control inside a `CanvasItem`. Items move and scale with the board.

## When it goes off the usual path

- **Blank board on mount:** check that the containing element has nonzero width and height and that the required `pixi.js` peer is installed before changing world coordinates.

## Related skills

- [Add contextual board tools](../cratis-components-compose-toolbar/SKILL.md)

`initialPan` and `initialZoom` are starting values. Use the ready `CanvasHandle` for later navigation in world coordinates. Observe camera transforms separately from edits to items: panning must not dirty a diagram. Include the Pixi peer even when the item content is DOM.
