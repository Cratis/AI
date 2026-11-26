---
name: cratis-components-theme-application
description: Loads the Components styles and overrides theme tokens within one part of the application. Use when setting up the baseline or changing a scoped palette. Not for choosing input controls (use cratis-components-choose-control).
compatibility: Requires @cratis/components and a CSS bundler that resolves package imports.
---

# Load the theme and change one area's color

1. Add `host.css` beside `main.tsx` and import `./host.css` from that entry point. Mount `CratisComponentsProvider` from `@cratis/components` as shown in [Mount Arc and read a query result](../cratis-arc-react-bind-slice/SKILL.md).
2. Load tokens, component styles and the baseline theme in order. Set the token on the wrapper of the area that should change:

```css
@import '@cratis/components/tokens';
@import '@cratis/components/styles';
@import '@cratis/components/theme';

.author-admin { --cratis-primary-color: rgb(101, 29, 155); }
```

3. Put `className="author-admin"` on the authors section. Controls inside inherit the override; sibling sections keep the default.
4. For an app-wide palette instead, put these rules after the three imports, outside `@layer`. Match the baseline selectors so the later value wins on the root and in themed subtrees. Wrap all three rules in `@media (forced-colors: none)` to preserve system colors in forced-colors mode.

```css
:root, .cratis-theme, :root.cratis-light, :root.cratis-dark.cratis-light,
:root.cratis-light .cratis-theme:not(.cratis-dark), .cratis-theme.cratis-light,
.cratis-dark .cratis-theme.cratis-light { --cratis-primary-color: #0f766e; }

:root.cratis-dark, .cratis-dark .cratis-theme, .cratis-theme.cratis-dark {
    --cratis-primary-color: #5eead4;
}

@media (prefers-color-scheme: dark) {
    :root:not(.cratis-light), .cratis-theme:not(.cratis-light) { --cratis-primary-color: #5eead4; }
}
```

## Target a component part

Use `.author-admin [data-cratis-part='header-content']` for the content inside a table header. ComboBox renders its popover outside its wrapper. Set `pt={{ popover: { className: 'author-options' } }}` on that ComboBox, then target `.author-options [data-cratis-part='optionLabel']` and `.author-options [data-cratis-part='optionDescription']` in `host.css`. Don't rely on the popover being a descendant of `.author-admin`.

## Avoid

- Don't change a global token to recolor one panel.
- Don't depend on private DOM nesting. Use the component's named part.
- Don't depend on rearranging imports. Normal overrides outside `@layer` beat layered component styles. The theme tokens are unlayered: match their selector specificity and put the override after the theme import.

## Related skills

- [Mount the providers](../cratis-arc-react-bind-slice/SKILL.md)
