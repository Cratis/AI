---
name: cratis-components-theme-application
compatibility: Requires React, Cratis Components and a browser for computed styles.
description: Use when styling Components or integrating a renderer with the host design system. Not for selecting control semantics (cratis-components-choose-control).
---

# Scope the host theme

Load the published token and component styles in the application stylesheet. Override a documented token on the smallest host element that contains the themed controls.

Use the component subpath imports below. If the installed declarations lack one of these props, inspect the package export and the host renderer before changing the interaction.

1. Identify the renderer and the published rules for the target part. **Done:** An outline Button uses the primary color token after baseline styles load.
2. Import @cratis/components/tokens then @cratis/components/styles in host.css. Set --cratis-primary-color to rgb(101, 29, 155) only on .accent. **Done:** Computed color changes on Preview but not Outside.
3. Navigate with the keyboard in the browser, not a DOM emulator. **Done:** The scoped outline button changes color, its sibling stays unchanged, and keyboard focus has a visible ring or outline.

## Example

Mount this view inside the configured application host.

```tsx
import { Button } from '@cratis/components/Common';

export function View() {
    return <><section className="accent"><Button variant="outline" label="Preview"/></section>
        <Button variant="outline" label="Outside"/></>;
}
```

If the token changes but the rendered color does not, inspect the active renderer and the part consuming the token. Do not override a private descendant selector to force a match.

Read references/adapters.md when the application already provides a design-system renderer.

Read references/per-area-css.md when only a subset of Components styles may be loaded.

## Verify

**Requires:** For browser automation, check `npx playwright install --list` for Chromium; if unavailable, inspect computed styles and keyboard focus in a real browser instead.

Run `npx tsc --noEmit` in the frontend, then compare matching buttons inside and outside the theme scope in the mounted app. Only the scoped color changes and keyboard focus remains visible.
