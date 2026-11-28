# Filter the Go subscription

On the destination store use `err := store.Subscriptions().Subscribe(ctx, "listing-feed", "library", "author-listed")`. Handle the error before checking the inbox. `events.WithSourceStore("library")` describes the event origin; it is not eligibility for publication or append routing. Use a producer that explicitly marks and routes the public fact.
