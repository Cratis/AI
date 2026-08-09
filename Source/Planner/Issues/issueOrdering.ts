// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * The shape ordering works on - the manual sort position of an issue, when it has been dragged.
 */
export interface Orderable {
    order?: number;
}

const unorderedBase = 1_000_000_000;

/**
 * Gets the effective sort position of an issue - its manual position when dragged, otherwise a
 * large fallback based on its current index so undragged issues keep their natural order at the end.
 * @param issue The issue to get the position for.
 * @param index The current index of the issue in the displayed list.
 * @returns The effective sort position.
 */
export const effectiveOrder = (issue: Orderable, index: number) =>
    issue.order ?? unorderedBase + index;

/**
 * Computes the new manual sort position for the row that was dropped at the given index -
 * the midpoint between its new neighbors, so no other row needs renumbering.
 * @param rows The rows in their new visual order, as reported by the drop.
 * @param dropIndex The index the row was dropped at.
 * @returns The new sort position for the dropped row.
 */
export const computeNewOrder = (rows: Orderable[], dropIndex: number) => {
    const previous = dropIndex > 0 ? effectiveOrder(rows[dropIndex - 1], dropIndex - 1) : undefined;
    const next = dropIndex < rows.length - 1 ? effectiveOrder(rows[dropIndex + 1], dropIndex + 1) : undefined;

    if (previous !== undefined && next !== undefined) return (previous + next) / 2;
    if (previous !== undefined) return previous + 1024;
    if (next !== undefined) return next - 1024;
    return 0;
};

/**
 * Sorts issues for display - newest first by default, with manually ordered issues taking their
 * dragged position first.
 * @param issues The issues to sort.
 * @param createdAt Gets the creation time of an issue.
 * @returns The sorted issues.
 */
export const sortIssues = <T extends Orderable>(issues: T[], createdAt: (issue: T) => number): T[] => {
    const newestFirst = [...issues].sort((left, right) => createdAt(right) - createdAt(left));
    return newestFirst
        .map((issue, index) => ({ issue, order: effectiveOrder(issue, index) }))
        .sort((left, right) => left.order - right.order)
        .map((entry) => entry.issue);
};
