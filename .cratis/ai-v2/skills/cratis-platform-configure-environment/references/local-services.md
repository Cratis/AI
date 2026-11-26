# Translate only at the owning host

For a Screenplay OpenId provider aliased `Partner`, the requirement names include `authentication.providers.Partner.clientId`, `.clientSecret` and `.authority` under that same prefix. The model does not retrieve those values, register an identity provider, or test sign-in. Keep the alias in the host mapping; do not bind two providers to the same credential by dropping it.

For hierarchical .NET configuration keys use `__` between sections in environment variables. That convention is not a rule for rewriting every dotted model requirement: map the requirement explicitly to the consumer's actual key. Scope fixture variables to a unique prefix and remove them when the fixture exits.

Check each consumer's effective settings. A Chronicle connection set explicitly can win over a named connection string; the existence of the named key alone does not prove the selected endpoint. Do not print either connection string. Allowlist the intended authority and resource after resolution; compare scheme and port as well as host. In a container, loopback names that container, not another service. If local composition needs a service alias, allow only that alias on the disposable network rather than accepting arbitrary hostnames.
