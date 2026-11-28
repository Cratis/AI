# Map the Kotlin model

Start the declaration on the model with `@FromEvent(BookAdded::class)`. Bind its fields to the registered event and choose an ID matching the source or explicit projection key. Verify by reading the persisted instance, not by reflecting the annotation. If converting an existing fluent definition, preserve the deployed identifier and key; otherwise a new empty view can look like lost data.

For two different shapes with the same identity, declare `@VariantOf(WorkItem::class, key = "id")` with a string `id` and `@EntersOn(IssueOpened::class)` on the issue view. Non-entry events only update it. Declare shared mappings once on a `@GlobalFor(WorkItem::class)` handler. Test an update before the entry event: it must not create the view.
