---
name: cratis-components-theme-application
description: Loads the Components styles and overrides theme tokens within one part of the application. Use when setting up the baseline or changing a scoped palette. Not for choosing input controls (use cratis-components-choose-control).
compatibility: Requires @cratis/components and a CSS bundler that resolves package imports.
---

# Load the theme and change one area's color

1. Add `host.css` beside `main.tsx` and import `./host.css` from that entry point. Mount `CratisComponentsProvider` from `@cratis/components` as shown in [Mount Arc and list authors](../cratis-arc-react-bind-slice/SKILL.md).
2. Load tokens, component styles and the baseline theme in order. Set the token on the wrapper of the area that should change:

```css
@import '@cratis/components/tokens';
@import '@cratis/components/styles';
@import '@cratis/components/theme';

.author-admin { --cratis-primary-color: rgb(101, 29, 155); }
```

3. Put `className="author-admin"` on the authors section. Controls inside inherit the override; sibling sections keep the default.
4. For an app-wide palette instead, set the light tokens on `.cratis-theme` and the dark tokens on `.cratis-theme.cratis-dark`. In `@media (prefers-color-scheme: dark)`, set the dark tokens on `.cratis-theme:not(.cratis-light)`. Set the light tokens on `.cratis-dark .cratis-theme.cratis-light` so that an explicit light section inside a dark one stays light.

## Target a component part

Use `.author-admin [data-cratis-part='header-content']` for the content inside a table header. ComboBox renders its popover outside its wrapper. Set `pt={{ popover: { className: 'author-options' } }}` on that ComboBox, then target `.author-options [data-cratis-part='optionLabel']` and `.author-options [data-cratis-part='optionDescription']` in `host.css`. Don't rely on the popover being a descendant of `.author-admin`.

## Avoid

- Don't change a global token to recolor one panel.
- Don't depend on private DOM nesting. Use the component's named part.
- Don't depend on rearranging imports. Write normal overrides outside `@layer` so they take precedence over the library's layered normal rules.

## Related skills

- [Mount the providers](../cratis-arc-react-bind-slice/SKILL.md)
