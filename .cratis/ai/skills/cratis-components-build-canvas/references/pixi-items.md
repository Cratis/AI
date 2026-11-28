# Use Pixi markers for dense data

Each item extends `CanvasItemData`: stable `id`, world `x` and world `y`. `renderItem(item)` returns a `PIXI.Container` (a `Graphics` is one), never a React node. Use `onItemPointerDown` to activate a marker. With `books` and the board's `openBook` handler in scope:

```tsx
import { Graphics } from 'pixi.js';
import { Canvas } from '@cratis/components/Canvas';

// Inside the sized board wrapper:
<Canvas className="book-board__surface" items={books}
    renderItem={() => new Graphics().circle(0, 0, 6).fill(0x2563eb)}
    onItemPointerDown={book => openBook(book.id)} />
```

Pixi markers are not keyboard-focusable. Keep a keyboard-operable DOM action for anything a marker opens. Verify in a real browser: pan, zoom, click a marker at its new screen position and confirm the handler receives its stable ID.
