# Choose the violated predicate

“An author registers once” concerns the count of AuthorRegistered in one history. “No two authors own this handle” concerns the same property claimed by different histories. An existence query at the start of a request proves neither at commit. Exercise each rule with its actual conflicting source IDs; exclude ordinary optimistic concurrency from the test so it cannot mask the constraint under test.
