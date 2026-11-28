# Enforce admission at the server in Java

With authentication configured in the JVM host, annotate the Java command class with `@Authorize(policy = "activeSubscription")`. Register that policy in the host. Add `@Roles("member")` only if membership is also required. Invoke the command through Arc with a subscribed member, then repeat with a member whose subscription expired. Only the first invocation should reach `handle()`.

Use `AsyncIdentityDetailsProvider` for additional identity information returned to the client, not to decide the policy. If a denied caller can still read data, check that the query itself has an access requirement.
