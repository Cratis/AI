# Map fields on the Node model

Decorate the model with `@fromEvent(BookAdded)` and its title field with `@setFrom(BookAdded, "title")`. Include the model in artifact discovery before opening the store. In a disposable namespace, query `await store.readModels.getInstances(Book)` and match the expected book ID. Check both a missing book and two distinct books after replay; an empty materialized collection is not proof that the producer rejected an append.

## Variants

With `@cratis/chronicle` 6.2.0 or later, use variant shapes for mutually exclusive stages of one keyed entity. Assume `IssueCreated`, `PullRequestCreated`, `BuildCompleted` and `TitleChanged` are registered events, and append them under the same work item source ID.

```typescript
import { entersOn, fromEvent, globalFor, setFrom, variantOf } from '@cratis/chronicle';

export class WorkItem {} // identity only, not a read model

@variantOf(WorkItem, 'id')
@entersOn(IssueCreated)
@fromEvent(IssueCreated)
export class BacklogItem {
    id = '';
    title = '';
}

@variantOf(WorkItem, 'id')
@entersOn(PullRequestCreated)
@fromEvent(PullRequestCreated)
@fromEvent(BuildCompleted)
export class PullRequestItem {
    id = '';
    title = '';

    @setFrom(PullRequestCreated, 'pullRequestUrl')
    pullRequestUrl = '';

    @setFrom(BuildCompleted, 'buildStatus')
    buildStatus = '';
}

@globalFor(WorkItem)
export class WorkItemTitleMapping {
    @setFrom(TitleChanged, 'title')
    title = '';
}
```

Discover both shapes and the shared mapping. Fields set by the shared mapping must exist on each variant. Non-entry events update an existing row only. In a disposable namespace append `IssueCreated`, then `BuildCompleted`, and wait for delivery before asserting no `PullRequestItem` exists. Append `PullRequestCreated` then another `BuildCompleted`; confirm the row now exists with the new status.
