# Wait for the supervised Elixir client

Add `{Cratis.Chronicle.Client, name: :library, otp_app: :my_app, event_store: "library", connection_string: connection_string}` to the application supervisor. Keep secrets in runtime configuration. Wait for `:ok = Cratis.Chronicle.Client.await_registration(:library, 60_000)` before declaring the workload ready; pass `[client: :library, namespace: "test"]` on scoped operations. A live supervisor alone does not prove the model registered.

Use `"Default"` with a capital D when that is the intended namespace. The development preset is not the credential-free default. Configure trusted TLS explicitly. When authentication is enabled, an API key takes precedence over userinfo; remove unintended credentials. For lifecycle-based startup, wait for `:registered` with `Lifecycle.wait_until(Lifecycle.name_for(:library), :registered)`. Distinguish waiting for a connection lifecycle transition from waiting for application registration.
