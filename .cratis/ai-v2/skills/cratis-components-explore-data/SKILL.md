---
name: cratis-components-explore-data
description: Use when building a PivotViewer or TimeMachine for pivot dimensions or historical navigation. Not for ordinary query rows (cratis-components-display-list).
---

# Explore a collection by dimension

Use PivotViewer to compare members of a collection at a chosen dimension. The dimension extracts a stable grouping value; card values carry the measures, not the group identity.

Use the component subpath imports below. If the installed declarations lack one of these props, inspect the package export and the host renderer before changing the interaction.

1. Define a known coordinate before rendering. Done: the three editions include two in East and one in West, each with its own copies measure.
2. Give each card a stable key; use the same getter for a filter and dimension sharing a key. Done: filtering by region compares region values, not formatted count labels.
3. Select East from the facet and inspect the viewer result. Done: the displayed count changes from three editions to two at East.

## Example

Mount this view inside the configured application host.

```tsx
import { PivotViewer } from '@cratis/components/PivotViewer';
const editions = [{ id: 'a', region: 'East', copies: 12 }, { id: 'b', region: 'West', copies: 5 },
    { id: 'c', region: 'East', copies: 8 }];
export function View() {
    return <div style={{ height: 520 }}><PivotViewer data={editions} getItemId={item => item.id}
        dimensions={[{ key: 'region', label: 'Region', getValue: item => item.region }]}
        filters={[{ key: 'region', label: 'Region', getValue: item => item.region }]}
        cardRenderer={item => ({ title: item.id, labels: ['Copies'], values: [String(item.copies)] })}
        labels={{ itemCount: count => count + ' editions' }}/></div>;
}
```

If the count does not narrow, check whether the facet is categorical but the getter returns numbers. Use a numeric range for numbers; formatValue changes the label, not the key.

Read references/time-positions.md when the selected coordinate is a position in history.

## Verify

In the cratis-components-explore-data example fixture, run `npm run test:example`. the displayed count changes from three editions to two at East.
