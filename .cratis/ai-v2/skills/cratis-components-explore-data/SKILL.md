---
name: cratis-components-explore-data
description: Use when readers need PivotViewer cards to explore records by category or TimeMachine to browse dated versions of one record. Not for a plain table (use cratis-components-display-list).
compatibility: Requires react, @cratis/components and pixi.js for PivotViewer.
---

# Group library books by genre

Use `PivotViewer` to group current, already loaded records. Choose `TimeMachine` when comparing supplied snapshots over time of one record. Neither fetches history.

1. Put `BookExplorer.tsx` in `Features/Books` under the [application providers](../cratis-arc-react-bind-slice/SKILL.md). Filter and bound a large catalog at the query before passing the loaded books to the viewer; the viewer is not a paging mechanism.
2. Use a unique dimension `key` to identify the grouping choice. `getValue` returns the grouping value for each book. The dimension key does not have to be a book property.
3. Keep the book ID independent of its genre. Two books in one group still have distinct cards.

```tsx
import { PivotViewer } from '@cratis/components/PivotViewer';

type Book = { id: string; title: string; genre: string };
export function BookExplorer({ books }: { books: Book[] }) {
    return <div style={{ height: 520 }}>
        <PivotViewer data={books} getItemId={book => book.id}
            dimensions={[{ key: 'byGenre', label: 'Genre', getValue: book => book.genre }]}
            cardRenderer={book => ({ title: book.title })} />
    </div>;
}
```

Return structured text from `cardRenderer`. Put interactive React content in `detailRenderer`.

## Show the versions of a book

In `Features/Books/BookHistory.tsx`, accept snapshots oldest first. Build a version with a unique ID, `Date` timestamp, label and rendered content. Seed the initial index once; receive subsequent selections through `onVersionChange`.

```tsx
import { TimeMachine } from '@cratis/components/TimeMachine';

type Snapshot = { id: string; timestamp: Date; title: string };
export function BookHistory({ snapshots, select }: { snapshots: Snapshot[]; select: (index: number) => void }) {
    if (!snapshots.length) return <p>No book history.</p>;
    const versions = snapshots.map(s => ({ id: s.id, timestamp: s.timestamp, label: s.title, content: <p>{s.title}</p> }));
    return <TimeMachine versions={versions} currentVersionIndex={versions.length - 1} onVersionChange={select} />;
}
```

## Avoid

- Don't use the genre as the card ID. It identifies a group, not a book.
- Don't return raw dates when readers need monthly groups; return a year-month string from `getValue`.
- Don't use `currentVersionIndex` as a controlled selection after initialization.

## When it goes off the usual path

- **A snapshot includes data the caller cannot read:** have the server return only authorized rows and fields. Project the permitted fields instead of returning raw event payloads.

## Related skills

- [List authors in a table](../cratis-components-display-list/SKILL.md)
