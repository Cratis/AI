# Enforce admission at the server in Elixir

Authenticate the request in the host before passing it to Arc. In the command module declare `authorize roles: ["editor"]`. For a rule based on claims instead, register a policy module and declare `authorize policy: :can_publish`. Read-model declarations apply across the module unless a query overrides them.

Invoke the command as a signed-in editor and then a reader. The reader should get `isAuthorized: false` without running validation or the handler. If both succeed, check the artifact's declaration: no requirement means open access. `details/1` enriches the verified identity; it does not grant access.
