---
name: cratis-components-build-canvas
description: Places DOM content on a pannable, zoomable Canvas. Use when building a board with world coordinates and fixed zoom controls. Not for grouping tool buttons (use cratis-components-compose-toolbar).
compatibility: Requires react, @cratis/components and the pixi.js peer dependency.
---

# Place a book on a pannable board

1. Install the `pixi.js` version required by the `@cratis/components` peer dependency. In `Features/Books/BookBoard.tsx`, import `Canvas` and `CanvasItem` from `@cratis/components/Canvas`. Render `BookBoard` inside the [app's Components provider](../cratis-arc-react-bind-slice/SKILL.md).
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

## Avoid

- Don't add the camera offset to `x` or `y`; the canvas applies it when it positions the item.
- Don't put a fixed control inside a `CanvasItem`. Items move and scale with the board.

## Related skills

- [Add contextual board tools](../cratis-components-compose-toolbar/SKILL.md)
