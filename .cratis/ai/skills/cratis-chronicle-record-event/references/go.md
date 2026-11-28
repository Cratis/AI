# Register and append the Go value

With `type AuthorRegistered struct { Name string }`, register the type before creating the client: `_, err := chronicle.RegisterEvent[AuthorRegistered](registry, events.WithID("author-registered"))`. Handle registration errors. After opening the scoped store call `result, err := store.EventLog().Append(ctx, authorID, AuthorRegistered{Name: name})`. Check `err` first, then `result.Err()`. Reconcile a transport loss before retry; refusal is not the same as an unknown commit.
