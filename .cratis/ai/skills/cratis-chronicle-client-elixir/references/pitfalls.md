<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Common pitfalls

Source: `Cratis/Chronicle.Elixir`.

| Pitfall | Why it bites |
| --- | --- |
| Copying an older root README | Its module names may not exist; use namespaced `Chronicle.*` modules |
| Using `Chronicle.Concept` on a client that lacks it | Annotate fields with `pii/1,2` instead |
| Combining `pii` and `encrypted` | The same leaf raises `PiiAndEncryptedCombinedNotSupported`; neither is allowed on an `event_source_id: true` concept |
| Quoting the `VERSION` file | It is a build-time placeholder |
| Putting options only in `config.exs` | The client reads no application env; your app must pass child-spec keyword options |
| Omitting `:otp_app` | Discovery falls back to scanning every loaded module |
| Assuming the namespace default is `"default"` | It is `"Default"`; the moduledoc is wrong |
| `:ok = Chronicle.append(...)` in a server | A constraint violation returns `{:error, _}` and raises `MatchError` |
| Waiting for `:connected` | Observers attach at `:registered` |
| Reading `:correlation_id` from a reactor context | The map has six keys and that is not one |
| Two read models with the same final module segment | The default id is the last segment only |
| Appending from a `Task` and expecting the correlation id | Ambient context is per process |
| Treating quiet observers as "no events" | Keepalive eviction can silence observers while appends still succeed |
| Shipping the default TLS behavior | `skip_tls_validation` defaults to `true` |
| Forgetting `global_handlers:` or `:otp_app` discovery | Shared mappings are not merged into variants unless registered |
| A shared handler mapping a field one variant lacks | `GlobalHandlerPropertyNotOnVariant` at registration, not a silently skipped mapping |
