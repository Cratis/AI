---
name: cratis-components-build-canvas
compatibility: Requires React, Cratis Components and a browser for hit testing.
description: Use when a spatial workspace needs pan, zoom, overlays or canvas objects. Not for a command toolbar alone (cratis-components-compose-toolbar).
---

# Keep world and screen coordinates separate

Give Canvas the camera and place selectable objects in world coordinates. Anchor screen controls outside that transform.

Use the component subpath imports below. If the installed declarations lack one of these props, inspect the package export and the host renderer before changing the interaction.

1. Give the world item a stable id and a hit shape in local coordinates. **Done:** The item at (64,48) responds at that initial location.
2. Place the camera action relative to the viewport. Use the supplied handle to center and zoom in one operation. **Done:** The same world point moves to the viewport center.
3. Hit-test before and after the move against the actual renderer. **Done:** The new center selects Pin, its old location misses, and the overlay rectangle does not move.

## Example

Mount this view inside the configured application host.

```tsx
import { useRef, useState } from 'react';
import { Graphics } from 'pixi.js';
import { Canvas, type CanvasHandle } from '@cratis/components/Canvas';
const marks = [{ id: 'Pin', x: 64, y: 48 }];
const renderMark = () => new Graphics().circle(0, 0, 12).fill(0x804080);
export function View() {
    const camera = useRef<CanvasHandle | null>(null);
    const [selected, select] = useState('');
    return <div style={{ position: 'relative', width: 480, height: 320 }}>
        <Canvas items={marks} renderItem={renderMark} showControls={false} showMinimap={false}
            style={{ width: '100%', height: '100%' }} onHandleReady={h => { camera.current = h; }}
            onItemPointerDown={item => select(previous => previous + item.id)} />
        <button style={{ position: 'absolute', top: 0, right: 0 }}
            onClick={() => camera.current?.smoothPanZoomToWorld(64, 48, 2, 80)}>Center pin</button>
        <output>{selected}</output></div>;
}
```

When drawing and selecting disagree, inspect whether the host applied pan or zoom twice. renderItem creates a local display object; Canvas places it at the item coordinates.

Read references/layers.md when a layer must stay readable during zoom.

## Verify

**Requires:** For browser automation, check `npx playwright install --list` for Chromium; if unavailable, exercise the mounted canvas in a real browser instead.

Run `npx tsc --noEmit` in the frontend, then pan and zoom before clicking the object's new and old positions. Only the new position hits; the overlay stays fixed. If the old position still hits, check whether the hit shape uses world coordinates rather than viewport pixels.
