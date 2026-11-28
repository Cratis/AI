# Bind the Node reducer class

Use `@reducer("account-balance", undefined, Balance)` on the reducer class. Name the method `creditPosted` for `CreditPosted`, or bind it explicitly with `@handles(CreditPosted)`. It receives the event, current state and optional context. Return the next model: for example, use `(current?.total ?? 0) + event.amount`. Use the class decorator, not a `@reduces` method decorator; no such export is provided.
